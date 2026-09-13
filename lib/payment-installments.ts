import { addMonths } from 'date-fns'

export type InstallmentPlanInput = {
  totalAmount: number
  count: number
  firstDueDate: Date
  intervalMonths?: number
}

export type InstallmentSlice = {
  installmentNumber: number
  installmentTotal: number
  amount: number
  paymentDate: Date
}

export function splitInstallmentAmounts(totalAmount: number, count: number): number[] {
  if (count < 1 || totalAmount <= 0) return []
  const centsTotal = Math.round(totalAmount * 100)
  const base = Math.floor(centsTotal / count)
  const remainder = centsTotal - base * count
  return Array.from({ length: count }, (_, i) => (base + (i < remainder ? 1 : 0)) / 100)
}

export function buildInstallmentPlan(input: InstallmentPlanInput): InstallmentSlice[] {
  const count = Math.max(1, Math.min(48, Math.floor(input.count)))
  const intervalMonths = Math.max(1, Math.floor(input.intervalMonths ?? 1))
  const amounts = splitInstallmentAmounts(input.totalAmount, count)

  return amounts.map((amount, index) => ({
    installmentNumber: index + 1,
    installmentTotal: count,
    amount,
    paymentDate: addMonths(input.firstDueDate, index * intervalMonths),
  }))
}

export function formatInstallmentLabel(number?: number | null, total?: number | null) {
  if (!number || !total || total <= 1) return null
  return `${number}/${total}`
}
