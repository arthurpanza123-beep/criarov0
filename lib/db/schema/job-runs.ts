import { sql } from "drizzle-orm"
import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { jobRunStatusEnum } from "./enums"
import { jobs } from "./jobs"
import { createdAt, id } from "./shared"

export const jobRuns = pgTable(
  "job_runs",
  {
    id: id(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    attempt: integer("attempt").notNull(),
    status: jobRunStatusEnum("status").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),
    error: text("error"),
    logs: jsonb("logs").$type<unknown[]>().notNull().default(sql`'[]'::jsonb`),
    createdAt: createdAt(),
  },
  (table) => [
    index("job_runs_job_id_idx").on(table.jobId),
    index("job_runs_created_at_idx").on(table.createdAt),
  ],
)

export type JobRunRow = typeof jobRuns.$inferSelect
export type NewJobRunRow = typeof jobRuns.$inferInsert
