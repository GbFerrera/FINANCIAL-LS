import type { BillingCycle } from './subscription-billing'
import {
  auditClientSubscription,
  normalizeToDueDay,
  unpaidDueDateForClientSubscription,
  yearMonthKey,
} from './subscription-billing'

export type SubscriptionLinkRow = {
  id: string
  dueDay: number
  startedAt: Date
  lastPaidFor: Date | null
  paidAt: Date | null
  billingCycle: BillingCycle
  clientName: string
  subscriptionName: string
}

export type SubscriptionFix = {
  clientSubscriptionId: string
  clientName: string
  subscriptionName: string
  reason: string
  fromLastPaidFor: Date | null
  toLastPaidFor: Date | null
}

export function findSubscriptionPaymentFix(link: SubscriptionLinkRow): SubscriptionFix | null {
  const billingCycle = link.billingCycle

  if (billingCycle !== 'MONTHLY') return null

  const audit = auditClientSubscription({
    dueDay: link.dueDay,
    startedAt: link.startedAt,
    lastPaidFor: link.lastPaidFor,
    paidAt: link.paidAt,
    billingCycle,
  })

  const autoFix = audit.issues.find(
    (i) =>
      (i.code === 'AHEAD_ONE_MONTH' || i.code === 'OPEN_GAP_BEFORE_LAST_PAID') &&
      i.suggestedLastPaidFor !== undefined
  )
  if (autoFix) {
    return {
      clientSubscriptionId: link.id,
      clientName: link.clientName,
      subscriptionName: link.subscriptionName,
      reason: autoFix.code,
      fromLastPaidFor: link.lastPaidFor,
      toLastPaidFor: autoFix.suggestedLastPaidFor ?? null,
    }
  }

  if (!link.lastPaidFor) return null

  const lastPaid = normalizeToDueDay(link.lastPaidFor, link.dueDay)
  const nextUnpaid = unpaidDueDateForClientSubscription({
    dueDay: link.dueDay,
    billingCycle,
    startedAt: link.startedAt,
    lastPaidFor: lastPaid,
  })

  if (nextUnpaid && yearMonthKey(nextUnpaid) < yearMonthKey(lastPaid)) {
    return {
      clientSubscriptionId: link.id,
      clientName: link.clientName,
      subscriptionName: link.subscriptionName,
      reason: 'SKIPPED_MONTHS_AHEAD',
      fromLastPaidFor: link.lastPaidFor,
      toLastPaidFor: null,
    }
  }

  return null
}
