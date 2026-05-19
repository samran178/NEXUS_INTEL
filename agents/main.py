import os
import json
import re
import threading
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timezone
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from crewai import Agent, Task, Crew, Process, LLM
from crewai_tools import TavilySearchTool

app = FastAPI(title="AI Market Research Agent Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = os.environ.get("DATABASE_URL")
TAVILY_API_KEY = os.environ.get("TAVILY_API_KEY")

# Prefer Replit's managed AI proxy; fall back to user's own key
AI_BASE_URL = os.environ.get("AI_INTEGRATIONS_OPENAI_BASE_URL")
AI_API_KEY = os.environ.get("AI_INTEGRATIONS_OPENAI_API_KEY") or os.environ.get("OPENAI_API_KEY")


def make_llm(max_tokens: int = 4096) -> LLM:
    """Create a CrewAI LLM using Replit's AI proxy if available."""
    kwargs = dict(
        model="openai/gpt-4o-mini",
        api_key=AI_API_KEY,
        max_tokens=max_tokens,
        temperature=0.3,
    )
    if AI_BASE_URL:
        kwargs["base_url"] = AI_BASE_URL
    return LLM(**kwargs)


def get_db_conn():
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)


def update_report(report_id: int, **kwargs):
    if not kwargs:
        return
    conn = get_db_conn()
    try:
        cur = conn.cursor()
        set_clauses = []
        values = []
        for key, value in kwargs.items():
            if isinstance(value, (dict, list)):
                set_clauses.append(f"{key} = %s::jsonb")
                values.append(json.dumps(value))
            else:
                set_clauses.append(f"{key} = %s")
                values.append(value)
        values.append(report_id)
        cur.execute(
            f"UPDATE research_reports SET {', '.join(set_clauses)} WHERE id = %s",
            values,
        )
        conn.commit()
    finally:
        conn.close()


class ResearchRequest(BaseModel):
    report_id: int
    query: str


def run_research_agents(report_id: int, query: str):
    try:
        search_tool = TavilySearchTool()
        llm = make_llm()

        # ── Agent 1: The Researcher ──────────────────────────────────────────
        update_report(
            report_id,
            status="running",
            current_agent="The Researcher",
            agent_progress="Searching the web for market data and industry information...",
        )

        researcher = Agent(
            role="Market Researcher",
            goal=(
                f"Find comprehensive market data, industry trends, and competitor "
                f"information for: {query}"
            ),
            backstory=(
                "You are an expert market researcher who excels at finding relevant "
                "business data from the internet. You search for market size estimates, "
                "key players, pricing information, and industry trends."
            ),
            tools=[search_tool],
            verbose=True,
            llm=llm,
            max_iter=5,
        )

        # ── Agent 2: The Data Analyst ────────────────────────────────────────
        analyst = Agent(
            role="Data Analyst",
            goal=(
                "Extract and structure key data points: competitor names, pricing, "
                "market share, and organize findings into clean data structures"
            ),
            backstory=(
                "You are a meticulous data analyst who takes raw research and extracts "
                "structured insights. You identify competitors, their pricing models, "
                "market positioning, and quantify market metrics."
            ),
            verbose=True,
            llm=llm,
            max_iter=3,
        )

        # ── Agent 3: The Business Strategist ────────────────────────────────
        strategist = Agent(
            role="Business Strategist",
            goal=(
                "Perform a thorough SWOT analysis and identify strategic opportunities "
                "and threats in the market"
            ),
            backstory=(
                "You are a seasoned business strategist with expertise in competitive "
                "analysis. You evaluate markets objectively and provide actionable "
                "strategic insights through structured SWOT frameworks."
            ),
            verbose=True,
            llm=llm,
            max_iter=3,
        )

        # ── Agent 4: The Report Writer ───────────────────────────────────────
        writer = Agent(
            role="Report Writer",
            goal=(
                "Compile all findings into a comprehensive, well-structured market "
                "research report in Markdown format"
            ),
            backstory=(
                "You are an expert business writer who creates professional market "
                "research reports. You synthesize complex data into clear, actionable "
                "narratives that help executives make decisions."
            ),
            verbose=True,
            llm=make_llm(max_tokens=8192),
            max_iter=3,
        )

        # ── Task 1: Research ─────────────────────────────────────────────────
        task_research = Task(
            description=(
                f"Research the following market/business topic thoroughly: {query}\n\n"
                "Search the web to find:\n"
                "1. Market overview and size estimates\n"
                "2. Key players and major competitors (at least 3-5)\n"
                "3. Pricing information and business models\n"
                "4. Recent trends and developments (last 1-2 years)\n"
                "5. Target customer segments\n"
                "6. Geographic markets involved\n\n"
                "Use multiple searches to gather comprehensive data. Return all findings in detail."
            ),
            expected_output=(
                "A comprehensive research summary with market data, competitor details, "
                "pricing information, and key trends. Include specific numbers, company "
                "names, and sources where found."
            ),
            agent=researcher,
        )

        # ── Task 2: Data Analysis ────────────────────────────────────────────
        update_report(
            report_id,
            current_agent="The Data Analyst",
            agent_progress="Extracting competitor data, pricing structures, and market metrics...",
        )

        task_analysis = Task(
            description=(
                "Using the research findings, extract and structure the following data:\n\n"
                "1. COMPETITORS LIST: For each major competitor extract:\n"
                "   - Company name\n"
                "   - Brief description (1-2 sentences)\n"
                "   - Market share (if available, or estimate)\n"
                "   - Pricing model/range\n"
                "   - Key strengths\n\n"
                "2. MARKET SIZE: Estimate the total addressable market size\n\n"
                "3. KEY TRENDS: List 5-7 most important market trends\n\n"
                'Format competitors as a JSON array: [{"name":"...","description":"...","marketShare":"...","pricing":"...","strengths":"..."}]\n'
                'Format key trends as a JSON array of strings: ["trend 1","trend 2",...]\n'
                "Also provide a market size estimate as a plain string."
            ),
            expected_output=(
                "Structured data: a JSON array of competitors, a JSON array of key "
                "trends, and a market size estimate string."
            ),
            agent=analyst,
            context=[task_research],
        )

        # ── Task 3: SWOT Analysis ────────────────────────────────────────────
        update_report(
            report_id,
            current_agent="The Business Strategist",
            agent_progress="Analyzing market position and performing SWOT analysis...",
        )

        task_swot = Task(
            description=(
                "Based on the research and analysis, perform a comprehensive SWOT "
                "analysis for someone entering or competing in this market.\n\n"
                "Return ONLY a JSON object with exactly these keys:\n"
                '{"strengths":["..."],"weaknesses":["..."],"opportunities":["..."],"threats":["..."]}\n\n'
                "Each array should contain 4-6 specific, actionable items."
            ),
            expected_output=(
                "A JSON object with strengths, weaknesses, opportunities, and threats "
                "arrays, each containing 4-6 specific items."
            ),
            agent=strategist,
            context=[task_research, task_analysis],
        )

        # ── Task 4: Report Writing ───────────────────────────────────────────
        update_report(
            report_id,
            current_agent="The Report Writer",
            agent_progress="Compiling findings into a comprehensive market report...",
        )

        task_report = Task(
            description=(
                f'Compile all research findings into a professional market research report in Markdown for: "{query}"\n\n'
                "Structure:\n"
                "# [Title]\n"
                "## Executive Summary\n"
                "## Market Overview\n"
                "## Competitive Landscape\n"
                "## Pricing Analysis\n"
                "## Market Trends\n"
                "## SWOT Analysis\n"
                "## Strategic Recommendations\n"
                "## Conclusion\n\n"
                "Make it professional, data-rich, and at least 800 words."
            ),
            expected_output=(
                "A complete, well-structured Markdown market research report, "
                "at least 800 words, covering all major aspects of the market."
            ),
            agent=writer,
            context=[task_research, task_analysis, task_swot],
        )

        crew = Crew(
            agents=[researcher, analyst, strategist, writer],
            tasks=[task_research, task_analysis, task_swot, task_report],
            process=Process.sequential,
            verbose=True,
        )

        result = crew.kickoff()
        final_report = str(result)

        # ── Parse structured data from task outputs ──────────────────────────
        competitors: list = []
        swot_analysis: dict = {}
        market_size: str | None = None
        key_trends: list = []

        try:
            analysis_output = str(
                task_analysis.output.raw if task_analysis.output else ""
            )

            # Extract competitors JSON array (objects)
            comp_match = re.search(r'\[\s*\{.*?\}\s*\]', analysis_output, re.DOTALL)
            if comp_match:
                try:
                    competitors = json.loads(comp_match.group())
                except Exception:
                    pass

            # Extract trends JSON array (strings)
            for m in re.finditer(r'\[([^\[\]]*"[^"]*"[^\[\]]*)\]', analysis_output):
                try:
                    parsed = json.loads(f"[{m.group(1)}]")
                    if parsed and isinstance(parsed[0], str) and len(parsed) >= 3:
                        key_trends = parsed
                        break
                except Exception:
                    pass

            # Extract market size
            size_match = re.search(
                r'(\$[\d\.,]+\s*(?:billion|million|trillion)[^.\n]*)',
                analysis_output,
                re.IGNORECASE,
            )
            if size_match:
                market_size = size_match.group(1).strip()
        except Exception:
            pass

        try:
            swot_output = str(task_swot.output.raw if task_swot.output else "")
            swot_match = re.search(r'\{[\s\S]*\}', swot_output)
            if swot_match:
                swot_analysis = json.loads(swot_match.group())
        except Exception:
            pass

        update_report(
            report_id,
            status="completed",
            current_agent=None,
            agent_progress=None,
            report=final_report,
            swot_analysis=swot_analysis or None,
            competitors=competitors or None,
            market_size=market_size,
            key_trends=key_trends or None,
            completed_at=datetime.now(timezone.utc).isoformat(),
        )

    except Exception as e:
        update_report(
            report_id,
            status="failed",
            current_agent=None,
            agent_progress=None,
            error_message=str(e)[:1000],
        )


@app.post("/run")
async def run_research(req: ResearchRequest):
    thread = threading.Thread(
        target=run_research_agents,
        args=(req.report_id, req.query),
        daemon=True,
    )
    thread.start()
    return {"started": True, "report_id": req.report_id}


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("AGENTS_PORT", "8001"))
    uvicorn.run(app, host="0.0.0.0", port=port)
