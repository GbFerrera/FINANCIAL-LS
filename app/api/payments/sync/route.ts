import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// POST - Sincronizar pagamentos existentes com entradas financeiras
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Buscar todos os pagamentos que não têm entrada financeira correspondente
    const paymentsWithoutFinancialEntry = await prisma.payment.findMany({
      include: {
        client: {
          select: {
            name: true
          }
        }
      }
    })

    // Buscar entradas financeiras existentes para evitar duplicatas
    const existingFinancialEntries = await prisma.financialEntry.findMany({
      where: {
        category: 'Pagamento de Cliente'
      }
    })

    const existingAmountsAndDates = new Set(
      existingFinancialEntries.map(entry => 
        `${entry.amount}_${entry.date.toISOString().split('T')[0]}`
      )
    )

    let syncedCount = 0
    const results: Array<{
      paymentId: string
      financialEntryId: string
      amount: number
      date: Date
    }> = []

    // Usar transação para sincronizar todos os pagamentos
    await prisma.$transaction(async (tx) => {
      for (const payment of paymentsWithoutFinancialEntry) {
        const paymentKey = `${payment.amount}_${payment.paymentDate.toISOString().split('T')[0]}`
        
        // Verificar se já existe uma entrada financeira para este pagamento
        if (!existingAmountsAndDates.has(paymentKey)) {
          const financialEntry = await tx.financialEntry.create({
            data: {
              type: 'INCOME',
              category: 'Pagamento de Cliente',
              description: payment.description || `Pagamento recebido de ${payment.client.name}`,
              amount: payment.amount,
              date: payment.paymentDate,
              isRecurring: false,
              paymentId: payment.id // Vincular entrada financeira ao pagamento
            }
          })

          results.push({
            paymentId: payment.id,
            financialEntryId: financialEntry.id,
            amount: payment.amount,
            date: payment.paymentDate
          })

          syncedCount++
        }
      }
    })

    return NextResponse.json({
      message: `${syncedCount} pagamentos sincronizados com entradas financeiras`,
      syncedCount,
      results
    }, { status: 200 })

  } catch (error) {
    console.error('Erro ao sincronizar pagamentos:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}