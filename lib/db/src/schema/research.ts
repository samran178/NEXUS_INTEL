import { pgTable, text, serial, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const researchReportsTable = pgTable("research_reports", {
  id: serial("id").primaryKey(),
  query: text("query").notNull(),
  status: text("status").notNull().default("pending"),
  currentAgent: text("current_agent"),
  agentProgress: text("agent_progress"),
  report: text("report"),
  swotAnalysis: jsonb("swot_analysis"),
  competitors: jsonb("competitors"),
  marketSize: text("market_size"),
  keyTrends: jsonb("key_trends"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const insertResearchReportSchema = createInsertSchema(researchReportsTable).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});
export type InsertResearchReport = z.infer<typeof insertResearchReportSchema>;
export type ResearchReport = typeof researchReportsTable.$inferSelect;
