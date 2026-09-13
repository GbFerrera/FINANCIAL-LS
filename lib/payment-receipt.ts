import { PaymentStatus, PrismaClient } from '@prisma/client'

type Tx = Pick<PrismaClient, 'financialEntry' | 'payment'>

export async function sumPaymentReceived(tx: Tx, paymentId: string) {
  const agg = await tx.financialEntry.aggregate({
    where: { paymentId, type: 'INCOME' },
    _sum: { amount: true },
  })
  return agg._sum.amount ?? 0
}

export function resolvePaymentStatusAfterReceipt(
  expectedAmount: number,
  receivedAmount: number
): PaymentStatus {
  if (receivedAmount <= 0) return PaymentStatus.PENDING
  if (receivedAmount >= expectedAmount - 0.009) return PaymentStatus.COMPLETED
  return PaymentStatus.PROCESSING
}
