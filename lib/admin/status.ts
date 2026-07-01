import type { OrderStatus, ReferralStatus } from "@/lib/types"
import { centsToDecimal, decimalToCents } from "@/lib/admin/money"

export const referralTransitions: Record<ReferralStatus, ReferralStatus[]> = {
  pending: ["invited", "rejected", "archived"],
  invited: ["accessed", "registered", "rejected", "archived"],
  accessed: ["registered", "awaiting_approval", "rejected", "archived"],
  registered: ["awaiting_approval", "approved", "rejected", "archived"],
  awaiting_approval: ["approved", "rejected", "archived"],
  approved: ["archived"],
  rejected: ["archived"],
  archived: [],
}

export const orderTransitions: Record<OrderStatus, OrderStatus[]> = {
  draft: ["pending_payment", "cancelled"],
  pending_payment: ["paid", "cancelled"],
  paid: ["processing", "refunded"],
  processing: ["delivered", "cancelled"],
  delivered: ["refunded"],
  cancelled: [],
  refunded: [],
}

export function canTransitionReferral(from: ReferralStatus, to: ReferralStatus, administrative = false) {
  return administrative || referralTransitions[from].includes(to)
}

export function canTransitionOrder(from: OrderStatus, to: OrderStatus, administrative = false) {
  return administrative || orderTransitions[from].includes(to)
}

export function assertReferralTransition(from: ReferralStatus, to: ReferralStatus, administrative = false) {
  if (!canTransitionReferral(from, to, administrative)) {
    throw new Error(`Transição de indicação inválida: ${from} -> ${to}.`)
  }
}

export function assertOrderTransition(from: OrderStatus, to: OrderStatus, administrative = false) {
  if (!canTransitionOrder(from, to, administrative)) {
    throw new Error(`Transição de pedido inválida: ${from} -> ${to}.`)
  }
}

export function grossProfit(salePrice: string | number, costPrice: string | number) {
  return centsToDecimal(decimalToCents(salePrice) - decimalToCents(costPrice))
}
