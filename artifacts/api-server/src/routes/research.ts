import { Router, type IRouter } from "express";
import { eq, desc, count } from "drizzle-orm";
import { db, researchReportsTable } from "@workspace/db";
import {
  CreateResearchBody,
  GetResearchParams,
  DeleteResearchParams,
  GetResearchStatusParams,
  DownloadReportParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const AGENTS_SERVICE_URL = process.env.AGENTS_SERVICE_URL || "http://localhost:8001";

router.get("/research", async (req, res): Promise<void> => {
  const reports = await db
    .select()
    .from(researchReportsTable)
    .orderBy(desc(researchReportsTable.createdAt));

  const mapped = reports.map((r) => ({
    id: r.id,
    query: r.query,
    status: r.status,
    currentAgent: r.currentAgent ?? null,
    agentProgress: r.agentProgress ?? null,
    report: r.report ?? null,
    swotAnalysis: r.swotAnalysis ?? null,
    competitors: r.competitors ?? null,
    marketSize: r.marketSize ?? null,
    keyTrends: r.keyTrends ?? null,
    errorMessage: r.errorMessage ?? null,
    createdAt: r.createdAt.toISOString(),
    completedAt: r.completedAt ? r.completedAt.toISOString() : null,
  }));

  res.json(mapped);
});

router.post("/research", async (req, res): Promise<void> => {
  const parsed = CreateResearchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [report] = await db
    .insert(researchReportsTable)
    .values({ query: parsed.data.query, status: "pending" })
    .returning();

  // Trigger the Python agent service
  try {
    const agentRes = await fetch(`${AGENTS_SERVICE_URL}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ report_id: report.id, query: parsed.data.query }),
    });
    if (!agentRes.ok) {
      req.log.warn({ status: agentRes.status }, "Agent service returned non-OK status");
    }
  } catch (err) {
    req.log.error({ err }, "Failed to reach agent service — will show as pending");
    // Mark as failed if agent service is unavailable
    await db
      .update(researchReportsTable)
      .set({ status: "failed", errorMessage: "Agent service unavailable. Please ensure the AI agents are running." })
      .where(eq(researchReportsTable.id, report.id));
  }

  const updated = await db
    .select()
    .from(researchReportsTable)
    .where(eq(researchReportsTable.id, report.id));

  const r = updated[0];
  res.status(201).json({
    id: r.id,
    query: r.query,
    status: r.status,
    currentAgent: r.currentAgent ?? null,
    agentProgress: r.agentProgress ?? null,
    report: r.report ?? null,
    swotAnalysis: r.swotAnalysis ?? null,
    competitors: r.competitors ?? null,
    marketSize: r.marketSize ?? null,
    keyTrends: r.keyTrends ?? null,
    errorMessage: r.errorMessage ?? null,
    createdAt: r.createdAt.toISOString(),
    completedAt: r.completedAt ? r.completedAt.toISOString() : null,
  });
});

router.get("/research/stats", async (_req, res): Promise<void> => {
  const all = await db.select().from(researchReportsTable);
  const total = all.length;
  const completed = all.filter((r) => r.status === "completed").length;
  const running = all.filter((r) => r.status === "running" || r.status === "pending").length;
  const failed = all.filter((r) => r.status === "failed").length;
  const recentQueries = all
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 5)
    .map((r) => r.query);

  res.json({ total, completed, running, failed, recentQueries });
});

router.get("/research/:id", async (req, res): Promise<void> => {
  const params = GetResearchParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [report] = await db
    .select()
    .from(researchReportsTable)
    .where(eq(researchReportsTable.id, params.data.id));

  if (!report) {
    res.status(404).json({ error: "Research report not found" });
    return;
  }

  res.json({
    id: report.id,
    query: report.query,
    status: report.status,
    currentAgent: report.currentAgent ?? null,
    agentProgress: report.agentProgress ?? null,
    report: report.report ?? null,
    swotAnalysis: report.swotAnalysis ?? null,
    competitors: report.competitors ?? null,
    marketSize: report.marketSize ?? null,
    keyTrends: report.keyTrends ?? null,
    errorMessage: report.errorMessage ?? null,
    createdAt: report.createdAt.toISOString(),
    completedAt: report.completedAt ? report.completedAt.toISOString() : null,
  });
});

router.delete("/research/:id", async (req, res): Promise<void> => {
  const params = DeleteResearchParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(researchReportsTable)
    .where(eq(researchReportsTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Research report not found" });
    return;
  }

  res.sendStatus(204);
});

router.get("/research/:id/status", async (req, res): Promise<void> => {
  const params = GetResearchStatusParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [report] = await db
    .select()
    .from(researchReportsTable)
    .where(eq(researchReportsTable.id, params.data.id));

  if (!report) {
    res.status(404).json({ error: "Research report not found" });
    return;
  }

  res.json({
    id: report.id,
    status: report.status,
    currentAgent: report.currentAgent ?? null,
    agentProgress: report.agentProgress ?? null,
    errorMessage: report.errorMessage ?? null,
  });
});

router.get("/research/:id/download", async (req, res): Promise<void> => {
  const params = DownloadReportParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [report] = await db
    .select()
    .from(researchReportsTable)
    .where(eq(researchReportsTable.id, params.data.id));

  if (!report || !report.report) {
    res.status(404).json({ error: "Report not found or not yet complete" });
    return;
  }

  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Content-Disposition", `attachment; filename="market-report-${params.data.id}.md"`);
  res.send(report.report);
});

export default router;
