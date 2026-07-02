import { sql } from "drizzle-orm"
import { check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core"

import { user } from "./auth.generated"
import { jobStatusEnum, jobTypeEnum } from "./enums"
import { createdAt, id, updatedAt } from "./shared"

export const jobs = pgTable(
  "jobs",
  {
    id: id(),
    type: jobTypeEnum("type").notNull(),
    status: jobStatusEnum("status").notNull().default("pending"),
    priority: integer("priority").notNull().default(0),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    result: jsonb("result").$type<Record<string, unknown>>(),
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    timeoutMs: integer("timeout_ms").notNull().default(30000),
    runAt: timestamp("run_at", { withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedBy: text("locked_by"),
    idempotencyKey: text("idempotency_key"),
    createdBy: uuid("created_by").references(() => user.id, { onDelete: "set null" }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    check("jobs_attempts_non_negative_chk", sql`${table.attempts} >= 0`),
    check("jobs_max_attempts_positive_chk", sql`${table.maxAttempts} >= 1`),
    check("jobs_timeout_positive_chk", sql`${table.timeoutMs} >= 1000`),
    // NULL idempotency keys are allowed to coexist (Postgres treats NULLs as distinct).
    uniqueIndex("jobs_idempotency_key_unique_idx").on(table.idempotencyKey),
    index("jobs_status_run_at_priority_idx").on(table.status, table.runAt, table.priority),
    index("jobs_type_idx").on(table.type),
    index("jobs_created_by_idx").on(table.createdBy),
  ],
)

export type JobRow = typeof jobs.$inferSelect
export type NewJobRow = typeof jobs.$inferInsert
