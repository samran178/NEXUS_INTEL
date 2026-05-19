# NEXUS_INTEL — AI Market Research & Competitor Analyst Agent

An AI-powered dashboard where users enter a business query and an autonomous multi-agent workflow searches the live internet, scrapes business websites, aggregates pricing, performs SWOT analysis, and generates a downloadable market report.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `python3 agents/main.py` — run the Python AI agent service (port 8001, set AGENTS_PORT=8001)
- `pnpm --filter @workspace/market-research run dev` — run the React dashboard (port varies)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`, `OPENAI_API_KEY`, `TAVILY_API_KEY`, `AGENTS_SERVICE_URL`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, TailwindCSS, shadcn/ui, Recharts
- API: Express 5 (Node.js)
- AI Agents: Python 3.11, CrewAI, Tavily Search, OpenAI GPT-4o-mini
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth)
- `lib/db/src/schema/research.ts` — DB schema for research reports
- `artifacts/api-server/src/routes/research.ts` — Express routes for research
- `agents/main.py` — Python FastAPI service running the 4 CrewAI agents
- `artifacts/market-research/src/` — React frontend dashboard

## Architecture decisions

- Multi-agent architecture: 4 specialized CrewAI agents (Researcher, Data Analyst, Business Strategist, Report Writer) run sequentially
- The Python agent service runs as a separate process (port 8001), called by the Node.js API when a new research job is submitted
- Agents run in a background thread so the API responds immediately; frontend polls `/research/:id/status` every 2s
- All structured data (SWOT, competitors, trends) is stored as JSONB in PostgreSQL
- OpenAPI-first: all API contracts defined in `lib/api-spec/openapi.yaml`, hooks generated via Orval

## Product

- Users enter a market research query on the dashboard
- 4 AI agents autonomously execute: web search → data extraction → SWOT analysis → report writing
- Live progress updates show which agent is active
- Completed reports include: full markdown report, SWOT quadrant, competitor table, key trends, market size
- Reports can be downloaded as `.md` files

## User preferences

- No Replit-specific file or folder names in the project (clean for external sharing)
- Use Tavily API for web search, OpenAI GPT-4o-mini for LLM calls

## Gotchas

- The Python agent service must be running (workflow: "AI Agents Service") for research jobs to execute
- CrewAI `TavilySearchTool()` picks up `TAVILY_API_KEY` from environment automatically
- `AGENTS_SERVICE_URL` env var must be set to `http://localhost:8001` for the Node API to reach the Python service
- After OpenAPI spec changes, always re-run codegen before using updated types
