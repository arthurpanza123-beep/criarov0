import { z } from "zod"

import {
  CREDIT_LEDGER_STATUSES,
  CREDIT_LEDGER_TYPES,
  MANAGED_ACCOUNT_STATUSES,
  NOTIFICATION_TYPES,
  ORDER_STATUSES,
  REFERRAL_STATUSES,
  USER_ROLES,
} from "@/lib/types"

const idSchema = z.string().min(1)
const nullableTextSchema = z.string().trim().min(1).nullable()
const isoDateSchema = z.string().datetime()
const nullableIsoDateSchema = isoDateSchema.nullable()
const moneySchema = z.number().finite()
const nonNegativeMoneySchema = moneySchema.min(0)

export const userRoleSchema = z.enum(USER_ROLES)

export const managedAccountSchema = z.object({
  id: idSchema,
  label: z.string().trim().min(1),
  email: z.string().trim().email(),
  provider: z.string().trim().min(1),
  status: z.enum(MANAGED_ACCOUNT_STATUSES),
  creditBalance: nonNegativeMoneySchema,
  monthlyCreditLimit: nonNegativeMoneySchema,
  notes: nullableTextSchema,
  lastCheckedAt: nullableIsoDateSchema,
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
})

export const campaignSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1),
  platform: z.string().trim().min(1),
  referralUrl: z.string().trim().url().nullable(),
  rewardPerConversion: nonNegativeMoneySchema,
  monthlyLimit: z.number().int().nonnegative().nullable(),
  active: z.boolean(),
  termsUrl: z.string().trim().url().nullable(),
  notes: nullableTextSchema,
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
})

export const referralSchema = z.object({
  id: idSchema,
  campaignId: idSchema,
  contactName: z.string().trim().min(1),
  contactEmail: z.string().trim().email().nullable(),
  contactPhone: z.string().trim().min(1).nullable(),
  status: z.enum(REFERRAL_STATUSES),
  expectedReward: nonNegativeMoneySchema,
  approvedReward: nonNegativeMoneySchema.nullable(),
  invitedAt: nullableIsoDateSchema,
  convertedAt: nullableIsoDateSchema,
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
})

export const creditLedgerEntrySchema = z.object({
  id: idSchema,
  managedAccountId: idSchema,
  campaignId: idSchema.nullable(),
  referralId: idSchema.nullable(),
  type: z.enum(CREDIT_LEDGER_TYPES),
  amount: moneySchema,
  currency: z.string().trim().length(3),
  status: z.enum(CREDIT_LEDGER_STATUSES),
  description: nullableTextSchema,
  occurredAt: isoDateSchema,
  createdAt: isoDateSchema,
})

export const customerSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1),
  email: z.string().trim().email().nullable(),
  phone: z.string().trim().min(1).nullable(),
  notes: nullableTextSchema,
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
})

export const orderSchema = z.object({
  id: idSchema,
  customerId: idSchema,
  description: z.string().trim().min(1),
  creditAmount: nonNegativeMoneySchema,
  salePrice: nonNegativeMoneySchema,
  costPrice: nonNegativeMoneySchema,
  status: z.enum(ORDER_STATUSES),
  paidAt: nullableIsoDateSchema,
  deliveredAt: nullableIsoDateSchema,
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
})

export const activitySchema = z.object({
  id: idSchema,
  userId: idSchema,
  entityType: z.string().trim().min(1),
  entityId: idSchema,
  action: z.string().trim().min(1),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: isoDateSchema,
})

export const notificationSchema = z.object({
  id: idSchema,
  title: z.string().trim().min(1),
  message: z.string().trim().min(1),
  type: z.enum(NOTIFICATION_TYPES),
  readAt: nullableIsoDateSchema,
  createdAt: isoDateSchema,
})
