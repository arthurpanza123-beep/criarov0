import { sql } from "drizzle-orm"
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { user } from "./auth.generated"
import { importEntityEnum, importStatusEnum } from "./enums"
import { createdAt, id } from "./shared"

export const importBatches = pgTable(
  "import_batches",
  {
    id: id(),
    entity: importEntityEnum("entity").notNull(),
    status: importStatusEnum("status").notNull().default("pending"),
    filename: text("filename"),
    dryRun: boolean("dry_run").notNull().default(true),
    totalRows: integer("total_rows").notNull().default(0),
    validRows: integer("valid_rows").notNull().default(0),
    invalidRows: integer("invalid_rows").notNull().default(0),
    importedRows: integer("imported_rows").notNull().default(0),
    duplicateRows: integer("duplicate_rows").notNull().default(0),
    report: jsonb("report").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdBy: uuid("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => [
    index("import_batches_entity_idx").on(table.entity),
    index("import_batches_created_at_idx").on(table.createdAt),
    index("import_batches_created_by_idx").on(table.createdBy),
  ],
)

export type ImportBatchRow = typeof importBatches.$inferSelect
export type NewImportBatchRow = typeof importBatches.$inferInsert
