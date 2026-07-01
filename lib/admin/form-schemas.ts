import { z } from "zod"

import { roleValues } from "@/lib/auth/permissions"
import {
  CREDIT_LEDGER_STATUSES,
  CREDIT_LEDGER_TYPES,
  MANAGED_ACCOUNT_STATUSES,
  NOTIFICATION_TYPES,
  ORDER_STATUSES,
  REFERRAL_STATUSES,
} from "@/lib/types"

const text = (label: string, max = 200) =>
  z.string().trim().min(1, `${label} é obrigatório.`).max(max, `${label} é muito longo.`)

const optionalText = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max, "Texto muito longo.")
    .transform((value) => value || null)

const optionalUrl = z
  .string()
  .trim()
  .transform((value) => value || null)
  .pipe(z.url().nullable())

const money = z
  .string()
  .trim()
  .regex(/^-?\d+(\.\d{1,2})?$/, "Valor monetário inválido.")

const nonNegativeMoney = money.refine((value) => !value.startsWith("-"), "Valor não pode ser negativo.")

const optionalInt = z
  .string()
  .trim()
  .transform((value) => (value ? Number(value) : null))
  .pipe(z.number().int().nonnegative().nullable())

const nullableEmail = z
  .string()
  .trim()
  .toLowerCase()
  .transform((value) => value || null)
  .pipe(z.email().nullable())

export const idFormSchema = z.object({
  id: z.string().trim().min(1, "Registro inválido."),
})

export const managedAccountFormSchema = z.object({
  id: z.string().trim().optional(),
  label: text("Nome"),
  email: z.email().toLowerCase(),
  provider: text("Fornecedor", 80),
  status: z.enum(MANAGED_ACCOUNT_STATUSES).default("active"),
  monthlyCreditLimit: nonNegativeMoney.default("0"),
  notes: optionalText(),
  lastCheckedAt: z
    .string()
    .trim()
    .transform((value) => (value ? new Date(value) : null))
    .refine((value) => value === null || Number.isFinite(value.getTime()), "Data inválida."),
})

export const campaignFormSchema = z.object({
  id: z.string().trim().optional(),
  name: text("Nome"),
  platform: text("Plataforma", 80),
  referralUrl: optionalUrl,
  rewardPerConversion: nonNegativeMoney.default("0"),
  monthlyLimit: optionalInt,
  currency: z.string().trim().min(3).max(8).default("USD"),
  active: z.enum(["true", "false"]).transform((value) => value === "true"),
  termsUrl: optionalUrl,
  notes: optionalText(),
})

export const referralFormSchema = z.object({
  id: z.string().trim().optional(),
  campaignId: z.string().trim().min(1, "Campanha obrigatória."),
  contactName: text("Contato"),
  contactEmail: nullableEmail,
  contactPhone: optionalText(40),
  status: z.enum(REFERRAL_STATUSES).default("pending"),
  expectedReward: nonNegativeMoney.default("0"),
  approvedReward: nonNegativeMoney.optional(),
})

export const referralTransitionFormSchema = z.object({
  id: z.string().trim().min(1),
  status: z.enum(REFERRAL_STATUSES),
})

export const referralApprovalFormSchema = z.object({
  id: z.string().trim().min(1),
  approvedReward: nonNegativeMoney,
})

export const customerFormSchema = z.object({
  id: z.string().trim().optional(),
  name: text("Nome"),
  email: nullableEmail,
  phone: optionalText(40),
  notes: optionalText(),
})

export const orderFormSchema = z.object({
  id: z.string().trim().optional(),
  customerId: z.string().trim().min(1, "Cliente obrigatório."),
  description: text("Descrição", 500),
  creditAmount: nonNegativeMoney.default("0"),
  salePrice: nonNegativeMoney.default("0"),
  costPrice: nonNegativeMoney.default("0"),
  currency: z.string().trim().min(3).max(8).default("USD"),
  status: z.enum(ORDER_STATUSES).default("draft"),
})

export const orderTransitionFormSchema = z.object({
  id: z.string().trim().min(1),
  status: z.enum(ORDER_STATUSES),
})

export const creditLedgerFormSchema = z
  .object({
    managedAccountId: z.string().trim().min(1, "Conta obrigatória."),
    campaignId: z.string().trim().transform((value) => value || null),
    referralId: z.string().trim().transform((value) => value || null),
    type: z.enum(CREDIT_LEDGER_TYPES),
    amount: money,
    currency: z.string().trim().min(3).max(8).default("USD"),
    status: z.enum(CREDIT_LEDGER_STATUSES).default("pending"),
    description: optionalText(500),
  })
  .refine((value) => value.type === "adjustment" || !value.amount.startsWith("-"), {
    message: "Somente ajustes podem ter valor negativo.",
    path: ["amount"],
  })

export const settingFormSchema = z.object({
  key: z.string().trim().min(1),
  value: z.string().trim().min(1, "Valor obrigatório."),
})

export const notificationIdFormSchema = idFormSchema

export const internalNotificationSchema = z.object({
  title: text("Título", 120),
  message: text("Mensagem", 500),
  type: z.enum(NOTIFICATION_TYPES).default("info"),
})

export const roleFormSchema = z.enum(roleValues)

export function parseForm<T extends z.ZodType>(schema: T, formData: FormData): z.infer<T> {
  return schema.parse(Object.fromEntries(formData))
}
