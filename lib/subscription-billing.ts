/** Lógica de vencimento de assinaturas (compartilhada UI + scripts de reconciliação). */

export type BillingCycle = "MONTHLY" | "YEARLY"

export function daysInMonth(year: number, monthIndex0: number) {
  return new Date(year, monthIndex0 + 1, 0).getDate()
}

export function dueDateForMonth(year: number, monthIndex0: number, dueDay: number) {
  const dim = daysInMonth(year, monthIndex0)
  const day = Math.min(Math.max(1, dueDay), dim)
  return new Date(year, monthIndex0, day, 12, 0, 0, 0)
}

export function dateKey(d: Date) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

export function yearMonthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

export function normalizeToDueDay(raw: Date, dueDay: number) {
  return dueDateForMonth(raw.getFullYear(), raw.getMonth(), dueDay)
}

export function monthStartDate(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0)
}

export function monthEndDate(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
}

export function isFirstDueApplicable(startedAt: Date | null | undefined, due: Date) {
  if (!startedAt) return true
  return dateKey(startedAt) <= dateKey(due)
}

export function isCyclePaid(lastPaidFor: Date | null | undefined, due: Date) {
  if (!lastPaidFor) return false
  return yearMonthKey(lastPaidFor) === yearMonthKey(due)
}

export function chargeDueForMonth(input: {
  billingCycle: BillingCycle
  isActive: boolean
  linkStatus: string
  dueDay: number | null
  startedAt?: Date | null
  endedAt?: Date | null
  year: number
  monthIndex0: number
}) {
  const dueDay = typeof input.dueDay === "number" ? input.dueDay : null
  if (dueDay === null) return null
  if (!input.isActive) return null
  if ((input.linkStatus || "").toUpperCase() !== "ACTIVE") return null

  const monthNumber = String(input.monthIndex0 + 1).padStart(2, "0")
  const mStartKey = `${input.year}-${monthNumber}-01`
  const mEndKey = dateKey(new Date(input.year, input.monthIndex0 + 1, 0, 12, 0, 0, 0))

  const startedAt = input.startedAt ? new Date(input.startedAt) : null
  const endedAt = input.endedAt ? new Date(input.endedAt) : null
  if (endedAt && dateKey(endedAt) < mStartKey) return null
  if (startedAt && dateKey(startedAt) > mEndKey) return null

  const due = dueDateForMonth(input.year, input.monthIndex0, dueDay)
  if (startedAt && !isFirstDueApplicable(startedAt, due)) return null

  if (input.billingCycle === "MONTHLY") return due

  const cycleMonth = startedAt ? startedAt.getMonth() : input.monthIndex0
  if (cycleMonth !== input.monthIndex0) return null
  return due
}

export function nextChargeDateForClientSubscription(input: {
  from: Date
  dueDay: number
  billingCycle: BillingCycle
  startedAt?: Date | null
}) {
  const from = input.from
  const dueDay = Math.min(Math.max(1, input.dueDay), 31)

  const computeInMonth = (year: number, monthIndex0: number) => {
    const dim = daysInMonth(year, monthIndex0)
    const day = Math.min(dueDay, dim)
    return new Date(year, monthIndex0, day, 12, 0, 0, 0)
  }

  if (input.billingCycle === "YEARLY") {
    const base = input.startedAt ?? null
    const month = base ? base.getMonth() : from.getMonth()
    const thisYear = computeInMonth(from.getFullYear(), month)
    if (thisYear.getTime() >= from.getTime()) return thisYear
    return computeInMonth(from.getFullYear() + 1, month)
  }

  const thisMonth = computeInMonth(from.getFullYear(), from.getMonth())
  if (thisMonth.getTime() >= from.getTime()) return thisMonth
  const next = new Date(from.getFullYear(), from.getMonth() + 1, 1, 12, 0, 0, 0)
  return computeInMonth(next.getFullYear(), next.getMonth())
}

export function dayAfterNoon(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 12, 0, 0, 0)
}

export function unpaidDueDateForClientSubscription(input: {
  dueDay: number
  billingCycle: BillingCycle
  startedAt?: Date | null
  lastPaidFor?: Date | null
  referenceDate?: Date
}) {
  const ref = input.referenceDate ?? new Date()
  const startedAt = input.startedAt ? new Date(input.startedAt) : ref

  if (input.billingCycle === "YEARLY") {
    const from = input.lastPaidFor ? dayAfterNoon(input.lastPaidFor) : ref
    return nextChargeDateForClientSubscription({
      from,
      dueDay: input.dueDay,
      billingCycle: input.billingCycle,
      startedAt: input.startedAt,
    })
  }

  const lastPaid = input.lastPaidFor ? normalizeToDueDay(input.lastPaidFor, input.dueDay) : null
  const lastPaidYm = lastPaid ? yearMonthKey(lastPaid) : null

  const searchEnd = new Date(ref.getFullYear(), ref.getMonth() + 24, 1)
  const dues = listMonthlyDuesInRange({
    startedAt,
    dueDay: input.dueDay,
    from: startedAt,
    to: searchEnd,
  }).filter((due) => isFirstDueApplicable(startedAt, due))

  for (const due of dues) {
    const dueYm = yearMonthKey(due)
    if (!lastPaidYm) return due
    if (dueYm !== lastPaidYm) return due
  }

  if (lastPaid) {
    return nextChargeDateForClientSubscription({
      from: dayAfterNoon(lastPaid),
      dueDay: input.dueDay,
      billingCycle: input.billingCycle,
      startedAt: input.startedAt,
    })
  }

  return null
}

/** Simula o cálculo antigo (bug) de "próxima cobrança" após pagar no mês do vencimento. */
export function legacyBuggyNextAfterPay(input: {
  settledDue: Date
  dueDay: number
  billingCycle: BillingCycle
  startedAt?: Date | null
  paidAt: Date
}) {
  const currentDueFromPaidAt = nextChargeDateForClientSubscription({
    from: input.paidAt,
    dueDay: input.dueDay,
    billingCycle: input.billingCycle,
    startedAt: input.startedAt,
  })
  if (!currentDueFromPaidAt) return null
  return nextChargeDateForClientSubscription({
    from: dayAfterNoon(currentDueFromPaidAt),
    dueDay: input.dueDay,
    billingCycle: input.billingCycle,
    startedAt: input.startedAt,
  })
}

export function listMonthlyDuesInRange(input: {
  startedAt: Date
  dueDay: number
  from: Date
  to: Date
}) {
  const out: Date[] = []
  let y = input.from.getFullYear()
  let m = input.from.getMonth()
  const end = input.to.getTime()
  const startLimit = input.startedAt.getTime()

  for (let i = 0; i < 240; i++) {
    const due = dueDateForMonth(y, m, input.dueDay)
    if (due.getTime() > end) break
    if (due.getTime() >= startLimit) out.push(due)
    m += 1
    if (m > 11) {
      m = 0
      y += 1
    }
  }
  return out
}

export type SubscriptionAuditIssue = {
  code: "AHEAD_ONE_MONTH" | "LEGACY_UI_SKIP_RISK" | "OPEN_GAP_BEFORE_LAST_PAID"
  message: string
  suggestedLastPaidFor?: Date | null
}

export function auditClientSubscription(input: {
  dueDay: number
  startedAt: Date
  lastPaidFor: Date | null
  paidAt: Date | null
  billingCycle: BillingCycle
  referenceDate?: Date
}) {
  const issues: SubscriptionAuditIssue[] = []
  const ref = input.referenceDate ?? new Date()

  if (!input.lastPaidFor || input.billingCycle !== "MONTHLY") {
    return { issues, nextUnpaid: null as Date | null, openDues: [] as Date[] }
  }

  const lastPaid = normalizeToDueDay(input.lastPaidFor, input.dueDay)
  const paidAt = input.paidAt ? new Date(input.paidAt) : null
  const nextUnpaid = unpaidDueDateForClientSubscription({
    dueDay: input.dueDay,
    billingCycle: input.billingCycle,
    startedAt: input.startedAt,
    lastPaidFor: lastPaid,
    referenceDate: ref,
  })

  const dues = listMonthlyDuesInRange({
    startedAt: input.startedAt,
    dueDay: input.dueDay,
    from: input.startedAt,
    to: ref,
  })

  const openDues = dues.filter((due) => {
    if (due.getTime() > ref.getTime()) return false
    return yearMonthKey(due) !== yearMonthKey(lastPaid)
  })

  if (paidAt) {
    const paidAtDue = dueDateForMonth(paidAt.getFullYear(), paidAt.getMonth(), input.dueDay)
    const paidLateInMonth = paidAt.getDate() > input.dueDay

    const lastYm = yearMonthKey(lastPaid)
    const paidAtDueYm = yearMonthKey(paidAtDue)
    const expectedNextYm = yearMonthKey(
      dueDateForMonth(paidAtDue.getFullYear(), paidAtDue.getMonth() + 1, input.dueDay)
    )

    if (paidLateInMonth && lastYm === expectedNextYm && paidAtDueYm !== lastYm) {
      issues.push({
        code: "AHEAD_ONE_MONTH",
        message:
          "Pagamento registrado no mês seguinte ao vencimento pago (bug do painel ao marcar pago após o dia de vencimento).",
        suggestedLastPaidFor: paidAtDue,
      })
    }

    const buggyNext = legacyBuggyNextAfterPay({
      settledDue: paidAtDue,
      dueDay: input.dueDay,
      billingCycle: input.billingCycle,
      startedAt: input.startedAt,
      paidAt,
    })
    if (
      buggyNext &&
      yearMonthKey(buggyNext) === lastYm &&
      yearMonthKey(buggyNext) !== yearMonthKey(nextUnpaid)
    ) {
      issues.push({
        code: "LEGACY_UI_SKIP_RISK",
        message: `lastPaidFor coincide com o "próximo" errado da UI antiga (${dateKey(buggyNext)}), possível mês intermediário em aberto.`,
      })
    }
  }

  for (const due of openDues) {
    if (due.getTime() < lastPaid.getTime() && yearMonthKey(due) !== yearMonthKey(lastPaid)) {
      issues.push({
        code: "OPEN_GAP_BEFORE_LAST_PAID",
        message: `Ciclo em aberto antes do último pago: vencimento ${dateKey(due)}.`,
        suggestedLastPaidFor: null,
      })
      break
    }
  }

  const correctedNextUnpaid = unpaidDueDateForClientSubscription({
    dueDay: input.dueDay,
    billingCycle: input.billingCycle,
    startedAt: input.startedAt,
    lastPaidFor: input.lastPaidFor,
    referenceDate: ref,
  })

  return {
    issues,
    nextUnpaid: correctedNextUnpaid,
    openDues,
    lastPaidNormalized: lastPaid,
  }
}
