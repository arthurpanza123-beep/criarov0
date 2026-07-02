import "server-only"

import { desc, inArray } from "drizzle-orm"
import { z } from "zod"

import { parseCsvRecords, type CsvRecord } from "@/lib/admin/csv"
import { safeErrorMessage } from "@/lib/observability/errors"
import { getDb } from "@/lib/db"
import { campaigns, customers, importBatches, managedAccounts, type ImportBatchRow } from "@/lib/db/schema"

type Db = ReturnType<typeof getDb>
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0]
type Executor = Db | Tx

export const IMPORT_ENTITIES = ["managed_accounts", "campaigns", "customers"] as const
export type ImportEntity = (typeof IMPORT_ENTITIES)[number]

export const IMPORT_LIMITS = { maxBytes: 2_000_000, maxRows: 5_000 } as const

export function isImportEntity(value: string): value is ImportEntity {
  return (IMPORT_ENTITIES as readonly string[]).includes(value)
}

const moneyString = z
  .string()
  .trim()
  .transform((value) => (value === "" ? "0" : value))
  .pipe(z.string().regex(/^\d+(\.\d{1,2})?$/, "valor monetário inválido (use ponto e sem negativo)"))

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "texto muito longo")
    .transform((value) => value || null)

const managedAccountRowSchema = z.object({
  label: z.string().trim().min(1, "label é obrigatório").max(200),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .transform((value) => value)
    .pipe(z.email("e-mail inválido")),
  provider: z.string().trim().min(1, "provider é obrigatório").max(80),
  monthlyCreditLimit: moneyString,
  notes: optionalText(2000),
})

const campaignRowSchema = z.object({
  name: z.string().trim().min(1, "name é obrigatório").max(200),
  platform: z.string().trim().min(1, "platform é obrigatório").max(80),
  rewardPerConversion: moneyString,
  currency: z
    .string()
    .trim()
    .transform((value) => value || "USD")
    .pipe(z.string().min(3, "currency inválida").max(8)),
  monthlyLimit: z
    .string()
    .trim()
    .transform((value) => (value ? Number(value) : null))
    .pipe(z.number().int("monthlyLimit deve ser inteiro").nonnegative("monthlyLimit não pode ser negativo").nullable()),
  referralUrl: z
    .string()
    .trim()
    .transform((value) => value || null)
    .pipe(z.url("referralUrl inválida").nullable()),
  notes: optionalText(2000),
  active: z
    .string()
    .trim()
    .toLowerCase()
    .transform((value) => value === "" || ["true", "1", "sim", "yes", "y"].includes(value)),
})

const customerRowSchema = z.object({
  name: z.string().trim().min(1, "name é obrigatório").max(200),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .transform((value) => value || null)
    .pipe(z.email("e-mail inválido").nullable()),
  phone: z
    .string()
    .trim()
    .transform((value) => value.replace(/[^\d+]/g, "") || null),
  notes: optionalText(2000),
})

type EntityAdapter = {
  columns: string[]
  schema: z.ZodType<Record<string, unknown>>
  dedupKey: (value: Record<string, unknown>) => string | null
  loadExistingKeys: (keys: string[], db: Executor) => Promise<Set<string>>
  insert: (value: Record<string, unknown>, db: Executor) => Promise<void>
}

const adapters: Record<ImportEntity, EntityAdapter> = {
  managed_accounts: {
    columns: ["label", "email", "provider", "monthlyCreditLimit", "notes"],
    schema: managedAccountRowSchema,
    dedupKey: (value) => String(value.email ?? "").toLowerCase() || null,
    async loadExistingKeys(keys, db) {
      if (keys.length === 0) return new Set()
      const rows = await db
        .select({ email: managedAccounts.email })
        .from(managedAccounts)
        .where(inArray(managedAccounts.email, keys))
      return new Set(rows.map((row) => row.email.toLowerCase()))
    },
    async insert(value, db) {
      await db.insert(managedAccounts).values({
        label: value.label as string,
        email: value.email as string,
        provider: value.provider as string,
        monthlyCreditLimit: value.monthlyCreditLimit as string,
        notes: value.notes as string | null,
      })
    },
  },
  campaigns: {
    columns: ["name", "platform", "rewardPerConversion", "currency", "monthlyLimit", "referralUrl", "notes", "active"],
    schema: campaignRowSchema,
    dedupKey: (value) => `${String(value.name ?? "").toLowerCase()}::${String(value.platform ?? "").toLowerCase()}`,
    async loadExistingKeys(keys, db) {
      if (keys.length === 0) return new Set()
      const names = keys.map((key) => key.split("::")[0])
      const rows = await db.select({ name: campaigns.name, platform: campaigns.platform }).from(campaigns).where(inArray(campaigns.name, names))
      return new Set(rows.map((row) => `${row.name.toLowerCase()}::${row.platform.toLowerCase()}`))
    },
    async insert(value, db) {
      await db.insert(campaigns).values({
        name: value.name as string,
        platform: value.platform as string,
        rewardPerConversion: value.rewardPerConversion as string,
        currency: value.currency as string,
        monthlyLimit: value.monthlyLimit as number | null,
        referralUrl: value.referralUrl as string | null,
        notes: value.notes as string | null,
        active: value.active as boolean,
      })
    },
  },
  customers: {
    columns: ["name", "email", "phone", "notes"],
    schema: customerRowSchema,
    dedupKey: (value) => (value.email ? String(value.email).toLowerCase() : null),
    async loadExistingKeys(keys, db) {
      if (keys.length === 0) return new Set()
      const rows = await db.select({ email: customers.email }).from(customers).where(inArray(customers.email, keys))
      return new Set(rows.filter((row) => row.email).map((row) => String(row.email).toLowerCase()))
    },
    async insert(value, db) {
      await db.insert(customers).values({
        name: value.name as string,
        email: value.email as string | null,
        phone: value.phone as string | null,
        notes: value.notes as string | null,
      })
    },
  },
}

export type ImportRowResult = { line: number; status: "valid" | "invalid" | "duplicate"; errors?: string[] }

export type ImportReport = {
  totalRows: number
  validRows: number
  invalidRows: number
  duplicateRows: number
  rows: ImportRowResult[]
}

type ValidRow = { line: number; data: Record<string, unknown>; key: string | null }

function pickColumns(record: CsvRecord, columns: string[]): Record<string, string> {
  const picked: Record<string, string> = {}
  for (const column of columns) picked[column] = record[column] ?? ""
  return picked
}

async function analyze(entity: ImportEntity, records: CsvRecord[], db: Db) {
  const adapter = adapters[entity]
  const rows: ImportRowResult[] = []
  const validCandidates: ValidRow[] = []

  records.forEach((record, index) => {
    const line = index + 2 // header is line 1
    const parsed = adapter.schema.safeParse(pickColumns(record, adapter.columns))
    if (!parsed.success) {
      rows.push({ line, status: "invalid", errors: parsed.error.issues.map((issue) => `${issue.path.join(".") || "linha"}: ${issue.message}`) })
      return
    }
    const key = adapter.dedupKey(parsed.data)
    validCandidates.push({ line, data: parsed.data, key })
  })

  const keys = validCandidates.map((row) => row.key).filter((key): key is string => Boolean(key))
  const existing = await adapter.loadExistingKeys(keys, db)

  const seen = new Set<string>()
  const toInsert: ValidRow[] = []
  for (const candidate of validCandidates) {
    if (candidate.key && (existing.has(candidate.key) || seen.has(candidate.key))) {
      rows.push({ line: candidate.line, status: "duplicate" })
      continue
    }
    if (candidate.key) seen.add(candidate.key)
    rows.push({ line: candidate.line, status: "valid" })
    toInsert.push(candidate)
  }

  rows.sort((a, b) => a.line - b.line)
  const invalidRows = rows.filter((row) => row.status === "invalid").length
  const duplicateRows = rows.filter((row) => row.status === "duplicate").length
  const report: ImportReport = {
    totalRows: records.length,
    validRows: toInsert.length,
    invalidRows,
    duplicateRows,
    rows: rows.slice(0, 1000),
  }
  return { report, toInsert }
}

export type RunImportOptions = { dryRun: boolean; actorId?: string | null; filename?: string | null }

export type RunImportResult = { batch: ImportBatchRow; report: ImportReport; imported: number }

export async function runImport(entity: ImportEntity, csvText: string, options: RunImportOptions): Promise<RunImportResult> {
  if (Buffer.byteLength(csvText, "utf8") > IMPORT_LIMITS.maxBytes) {
    throw new Error(`Arquivo excede o tamanho máximo de ${IMPORT_LIMITS.maxBytes} bytes.`)
  }
  const { records } = parseCsvRecords(csvText)
  if (records.length === 0) throw new Error("Nenhuma linha de dados encontrada no CSV.")
  if (records.length > IMPORT_LIMITS.maxRows) {
    throw new Error(`Arquivo excede o máximo de ${IMPORT_LIMITS.maxRows} linhas.`)
  }

  const db = getDb()
  const adapter = adapters[entity]
  const { report, toInsert } = await analyze(entity, records, db)

  const baseValues = {
    entity,
    filename: options.filename ?? null,
    dryRun: options.dryRun,
    totalRows: report.totalRows,
    validRows: report.validRows,
    invalidRows: report.invalidRows,
    duplicateRows: report.duplicateRows,
    createdBy: options.actorId ?? null,
    report: report as unknown as Record<string, unknown>,
  }

  if (options.dryRun) {
    const [batch] = await db
      .insert(importBatches)
      .values({ ...baseValues, status: "dry_run", finishedAt: new Date() })
      .returning()
    return { batch, report, imported: 0 }
  }

  let imported = 0
  let status: "imported" | "failed" = "imported"
  let errorReport: Record<string, unknown> = baseValues.report
  try {
    await db.transaction(async (tx) => {
      for (const row of toInsert) {
        await adapter.insert(row.data, tx)
      }
    })
    imported = toInsert.length
  } catch (error) {
    status = "failed"
    imported = 0
    errorReport = { ...report, error: safeErrorMessage(error, "Falha ao importar; alterações revertidas.") }
  }

  const [batch] = await db
    .insert(importBatches)
    .values({ ...baseValues, report: errorReport, status, importedRows: imported, finishedAt: new Date() })
    .returning()
  return { batch, report, imported }
}

export async function listImportBatches(limit = 50, db: Db = getDb()) {
  return db.select().from(importBatches).orderBy(desc(importBatches.createdAt)).limit(limit)
}

export const importService = {
  entities: IMPORT_ENTITIES,
  limits: IMPORT_LIMITS,
  run: runImport,
  list: listImportBatches,
  templateColumns: (entity: ImportEntity) => adapters[entity].columns,
}
