export const USER_ROLES = ["owner", "admin", "operator", "viewer"] as const
export type UserRole = (typeof USER_ROLES)[number]

export const MANAGED_ACCOUNT_STATUSES = [
  "active",
  "inactive",
  "suspended",
  "archived",
] as const
export type ManagedAccountStatus = (typeof MANAGED_ACCOUNT_STATUSES)[number]

export type ManagedAccount = {
  id: string
  label: string
  email: string
  provider: string
  status: ManagedAccountStatus
  creditBalance: number
  monthlyCreditLimit: number
  notes: string | null
  lastCheckedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type Campaign = {
  id: string
  name: string
  platform: string
  referralUrl: string | null
  rewardPerConversion: number
  monthlyLimit: number | null
  active: boolean
  termsUrl: string | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

export const REFERRAL_STATUSES = [
  "pending",
  "invited",
  "accessed",
  "registered",
  "awaiting_approval",
  "approved",
  "rejected",
  "archived",
] as const
export type ReferralStatus = (typeof REFERRAL_STATUSES)[number]

export type Referral = {
  id: string
  campaignId: string
  contactName: string
  contactEmail: string | null
  contactPhone: string | null
  status: ReferralStatus
  expectedReward: number
  approvedReward: number | null
  invitedAt: Date | null
  convertedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export const CREDIT_LEDGER_TYPES = [
  "earned",
  "spent",
  "adjustment",
  "expired",
  "sale",
] as const
export type CreditLedgerType = (typeof CREDIT_LEDGER_TYPES)[number]

export const CREDIT_LEDGER_STATUSES = [
  "pending",
  "confirmed",
  "cancelled",
] as const
export type CreditLedgerStatus = (typeof CREDIT_LEDGER_STATUSES)[number]

export type CreditLedgerEntry = {
  id: string
  managedAccountId: string
  campaignId: string | null
  referralId: string | null
  type: CreditLedgerType
  amount: number
  currency: string
  status: CreditLedgerStatus
  description: string | null
  occurredAt: Date
  createdAt: Date
}

export type Customer = {
  id: string
  name: string
  email: string | null
  phone: string | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

export const ORDER_STATUSES = [
  "draft",
  "pending_payment",
  "paid",
  "processing",
  "delivered",
  "cancelled",
  "refunded",
] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export type Order = {
  id: string
  customerId: string
  description: string
  creditAmount: number
  salePrice: number
  costPrice: number
  status: OrderStatus
  paidAt: Date | null
  deliveredAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type Activity = {
  id: string
  userId: string
  entityType: string
  entityId: string
  action: string
  metadata: Record<string, unknown>
  createdAt: Date
}

export const NOTIFICATION_TYPES = ["info", "success", "warning", "error"] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export type Notification = {
  id: string
  title: string
  message: string
  type: NotificationType
  readAt: Date | null
  createdAt: Date
}
