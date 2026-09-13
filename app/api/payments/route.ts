import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { endOfDay, startOfDay } from 'date-fns'
import { PaymentMethod, PaymentStatus } from '@prisma/client'
import { resolvePaymentStatusAfterReceipt, sumPaymentReceived } from '@/lib/payment-receipt'
import { buildInstallmentPlan } from '@/lib/payment-installments'
import { randomUUID } from 'crypto'

// GET - Listar pagamentos
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    const status = searchParams.get('status')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    const parseLocalDate = (s: string) => {
      const [y, m, d] = s.split('-').map(Number)
      return new Date(y, (m || 1) - 1, d || 1)
    }

    const whereClause: any = {}
    if (clientId) whereClause.clientId = clientId
    if (status) whereClause.status = status
    if (startDate || endDate) {
      whereClause.paymentDate = {}
      if (startDate) whereClause.paymentDate.gte = startOfDay(parseLocalDate(startDate))
      if (endDate) whereClause.paymentDate.lte = endOfDay(parseLocalDate(endDate))
    }

    const payments = await prisma.payment.findMany({
      where: whereClause,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          }
        },
        paymentProjects: {
          include: {
            project: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip: (page - 1) * limit,
      take: limit
    })

    const total = await prisma.payment.count({
      where: whereClause
    })

    const paymentIds = payments.map((p) => p.id)
    const receivedByPayment =
      paymentIds.length > 0
        ? await prisma.financialEntry.groupBy({
            by: ['paymentId'],
            where: { paymentId: { in: paymentIds }, type: 'INCOME' },
            _sum: { amount: true },
          })
        : []
    const receivedMap = new Map(
      receivedByPayment.map((row) => [row.paymentId, row._sum.amount ?? 0])
    )

    const enriched = payments.map((p) => ({
      ...p,
      receivedAmount: receivedMap.get(p.id) ?? 0,
    }))

    return NextResponse.json({
      payments: enriched,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Erro ao buscar pagamentos:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// POST - Criar novo pagamento
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const {
      clientId,
      amount,
      description,
      paymentDate,
      method,
      status,
      reminderSendEmail,
      reminderSendWhatsApp,
      reminderDaysBefore,
      reminderSendTime,
      reminderSubject,
      reminderBody,
      whatsAppInstanceId,
      reminderIncludePix,
      pixKey,
      pixKeyType,
      pixReceiverName,
      pixCity,
      pixDescription,
      pixTxid,
    } = body

    // Validações
    if (!clientId || !amount || !paymentDate) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: clientId, amount, paymentDate' },
        { status: 400 }
      )
    }

    // Verificar se o cliente existe
    const client = await prisma.client.findUnique({
      where: { id: clientId }
    })

    if (!client) {
      return NextResponse.json(
        { error: 'Cliente não encontrado' },
        { status: 404 }
      )
    }

    const desiredStatus =
      status && typeof status === 'string' && Object.values(PaymentStatus).includes(status as PaymentStatus)
        ? (status as PaymentStatus)
        : PaymentStatus.COMPLETED

    const wantsReminder = Boolean(reminderSendEmail || reminderSendWhatsApp)
    const daysBefore = Number.parseInt(String(reminderDaysBefore ?? 1), 10)
    const includePix = Boolean(reminderIncludePix && pixKey?.trim())
    const amountNumber = parseFloat(amount)
    const installmentsRaw = body?.installments as { count?: number; intervalMonths?: number } | undefined
    const installmentCount = Math.floor(Number(installmentsRaw?.count ?? 0))
    const intervalMonths = Math.max(1, Math.floor(Number(installmentsRaw?.intervalMonths ?? 1)))

    const paymentInclude = {
      client: { select: { id: true, name: true, email: true } },
      paymentProjects: {
        include: { project: { select: { id: true, name: true } } },
      },
    } as const

    const basePaymentData = {
      clientId,
      method: (method || 'BANK_TRANSFER') as PaymentMethod,
      status: desiredStatus,
      reminderSendEmail: wantsReminder && Boolean(reminderSendEmail),
      reminderSendWhatsApp: wantsReminder && Boolean(reminderSendWhatsApp),
      reminderDaysBefore: Number.isFinite(daysBefore) && daysBefore >= 0 ? daysBefore : 1,
      reminderSendTime:
        typeof reminderSendTime === 'string' && reminderSendTime.trim()
          ? reminderSendTime.trim()
          : '09:00',
      reminderSubject: reminderSubject?.trim() || null,
      reminderBody: reminderBody?.trim() || null,
      whatsAppInstanceId: whatsAppInstanceId?.trim() || null,
      reminderIncludePix: wantsReminder && includePix,
      pixKey: wantsReminder && includePix ? String(pixKey).trim() : null,
      pixKeyType: wantsReminder && includePix ? (pixKeyType?.trim() || 'random') : null,
      pixReceiverName: wantsReminder && includePix ? pixReceiverName?.trim() || null : null,
      pixCity: wantsReminder && includePix ? pixCity?.trim() || null : null,
      pixDescription: wantsReminder && includePix ? pixDescription?.trim() || null : null,
      pixTxid: wantsReminder && includePix ? pixTxid?.trim() || null : null,
    }

    const result = await prisma.$transaction(async (tx) => {
      if (installmentCount > 1 && desiredStatus === PaymentStatus.PENDING) {
        const plan = buildInstallmentPlan({
          totalAmount: amountNumber,
          count: installmentCount,
          firstDueDate: new Date(paymentDate),
          intervalMonths,
        })
        const groupId = randomUUID()
        const baseDescription = description?.trim() || null
        const createdPayments = []

        for (const slice of plan) {
          const sliceDescription = baseDescription
            ? `${baseDescription} (${slice.installmentNumber}/${slice.installmentTotal})`
            : `Parcela ${slice.installmentNumber}/${slice.installmentTotal}`

          const created = await tx.payment.create({
            data: {
              ...basePaymentData,
              amount: slice.amount,
              description: sliceDescription,
              paymentDate: slice.paymentDate,
              installmentGroupId: groupId,
              installmentNumber: slice.installmentNumber,
              installmentTotal: slice.installmentTotal,
            },
            include: paymentInclude,
          })
          createdPayments.push(created)
        }

        return { batch: true as const, payments: createdPayments, installmentGroupId: groupId }
      }

      const created = await tx.payment.create({
        data: {
          ...basePaymentData,
          amount: amountNumber,
          description,
          paymentDate: new Date(paymentDate),
        },
        include: paymentInclude,
      })

      if (desiredStatus === PaymentStatus.COMPLETED) {
        await tx.financialEntry.create({
          data: {
            type: 'INCOME',
            category: 'Pagamento de Cliente',
            description: description || `Pagamento recebido de ${client.name}`,
            amount: amountNumber,
            date: new Date(paymentDate),
            isRecurring: false,
            paymentId: created.id,
          },
        })
      }

      return { batch: false as const, payment: created }
    })

    if ('batch' in result && result.batch) {
      return NextResponse.json(
        {
          payments: result.payments,
          installmentGroupId: result.installmentGroupId,
          count: result.payments.length,
        },
        { status: 201 }
      )
    }

    return NextResponse.json(result.payment, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar pagamento:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const paymentId = body?.paymentId as string | undefined
    const markAsReceived = body?.markAsReceived === true
    const update = body?.update as
      | {
          clientId?: string
          amount?: string | number
          description?: string | null
          paymentDate?: string
          method?: string
          reminderSendEmail?: boolean
          reminderSendWhatsApp?: boolean
          reminderDaysBefore?: number
          reminderSendTime?: string
          reminderSubject?: string | null
          reminderBody?: string | null
          whatsAppInstanceId?: string | null
          reminderIncludePix?: boolean
          pixKey?: string | null
          pixKeyType?: string | null
          pixReceiverName?: string | null
          pixCity?: string | null
          pixDescription?: string | null
          pixTxid?: string | null
        }
      | undefined
    const reminderPatch = body?.reminder as typeof update | undefined

    if (!paymentId) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

    if (markAsReceived) {
      const rawAmount = body?.receivedAmount
      const receivedDateRaw = body?.receivedDate as string | undefined
      const nextDueDateRaw = body?.nextDueDate as string | undefined
      const receiptLabel =
        typeof body?.receiptLabel === 'string' ? body.receiptLabel.trim() : ''
      const partialAmount =
        rawAmount === undefined || rawAmount === null
          ? null
          : typeof rawAmount === 'number'
            ? rawAmount
            : parseFloat(String(rawAmount))

      const result = await prisma.$transaction(async (tx) => {
        const payment = await tx.payment.findUnique({
          where: { id: paymentId },
          include: { client: true }
        })
        if (!payment) return null

        const alreadyReceived = await sumPaymentReceived(tx, paymentId)
        const remaining = Math.max(0, payment.amount - alreadyReceived)

        if (remaining <= 0.009) {
          const updated = await tx.payment.update({
            where: { id: paymentId },
            data: { status: PaymentStatus.COMPLETED },
          })
          return { ...updated, receivedAmount: alreadyReceived }
        }

        const creditAmount =
          partialAmount != null && Number.isFinite(partialAmount) && partialAmount > 0
            ? partialAmount
            : remaining

        if (creditAmount <= 0 || creditAmount > remaining + 0.009) {
          return { error: 'INVALID_AMOUNT' as const }
        }

        const receiptDate =
          receivedDateRaw && Number.isFinite(new Date(receivedDateRaw).getTime())
            ? new Date(receivedDateRaw)
            : new Date()

        const baseDescription =
          payment.description || `Pagamento de ${payment.client.name}`
        let entryDescription = baseDescription
        if (creditAmount < payment.amount - 0.009) {
          entryDescription = receiptLabel
            ? `${baseDescription} — ${receiptLabel}`
            : `${baseDescription} (parcial)`
        } else if (receiptLabel) {
          entryDescription = `${baseDescription} — ${receiptLabel}`
        } else {
          entryDescription = `Pagamento recebido de ${payment.client.name}`
        }

        await tx.financialEntry.create({
          data: {
            type: 'INCOME',
            category: 'Pagamento de Cliente',
            description: entryDescription,
            amount: creditAmount,
            date: receiptDate,
            isRecurring: false,
            paymentId: payment.id,
          },
        })

        const totalReceived = alreadyReceived + creditAmount
        const nextStatus = resolvePaymentStatusAfterReceipt(payment.amount, totalReceived)

        const paymentUpdate: {
          status: PaymentStatus
          paymentDate?: Date
        } = { status: nextStatus }

        if (nextStatus === PaymentStatus.PROCESSING && nextDueDateRaw) {
          const nextDue = new Date(nextDueDateRaw)
          if (Number.isFinite(nextDue.getTime())) {
            paymentUpdate.paymentDate = nextDue
          }
        }

        const updated = await tx.payment.update({
          where: { id: paymentId },
          data: paymentUpdate,
        })

        return { ...updated, receivedAmount: totalReceived }
      })

      if (!result) return NextResponse.json({ error: 'Pagamento não encontrado' }, { status: 404 })
      if ((result as { error?: string }).error === 'INVALID_AMOUNT') {
        return NextResponse.json({ error: 'Valor de recebimento inválido' }, { status: 400 })
      }
      return NextResponse.json(result)
    }

    if (!update) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    if (!update.clientId || update.amount === undefined || update.amount === null || !update.paymentDate) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: clientId, amount, paymentDate' },
        { status: 400 }
      )
    }

    const amountNumber = typeof update.amount === 'number' ? update.amount : parseFloat(String(update.amount))
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })
    }

    const parsedDate = new Date(update.paymentDate)
    if (!Number.isFinite(parsedDate.getTime())) {
      return NextResponse.json({ error: 'Data inválida' }, { status: 400 })
    }

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: { client: true }
      })
      if (!payment) return null

      const client = await tx.client.findUnique({ where: { id: update.clientId! } })
      if (!client) return { error: 'Cliente não encontrado' as const }

      const nextMethod =
        update.method &&
        typeof update.method === 'string' &&
        Object.values(PaymentMethod).includes(update.method as PaymentMethod)
          ? (update.method as PaymentMethod)
          : payment.method

      const updated = await tx.payment.update({
        where: { id: paymentId },
        data: {
          clientId: update.clientId,
          amount: amountNumber,
          description: update.description ?? null,
          paymentDate: parsedDate,
          method: nextMethod,
          ...(reminderPatch || update.reminderSendEmail !== undefined
            ? {
                reminderSendEmail: Boolean(
                  reminderPatch?.reminderSendEmail ?? update.reminderSendEmail
                ),
                reminderSendWhatsApp: Boolean(
                  reminderPatch?.reminderSendWhatsApp ?? update.reminderSendWhatsApp
                ),
                reminderDaysBefore:
                  reminderPatch?.reminderDaysBefore ?? update.reminderDaysBefore ?? undefined,
                reminderSendTime:
                  reminderPatch?.reminderSendTime ?? update.reminderSendTime ?? undefined,
                reminderSubject:
                  reminderPatch?.reminderSubject !== undefined
                    ? reminderPatch.reminderSubject
                    : update.reminderSubject,
                reminderBody:
                  reminderPatch?.reminderBody !== undefined
                    ? reminderPatch.reminderBody
                    : update.reminderBody,
                whatsAppInstanceId:
                  reminderPatch?.whatsAppInstanceId !== undefined
                    ? reminderPatch.whatsAppInstanceId
                    : update.whatsAppInstanceId,
                reminderIncludePix:
                  reminderPatch?.reminderIncludePix ?? update.reminderIncludePix ?? undefined,
                pixKey:
                  reminderPatch?.pixKey !== undefined ? reminderPatch.pixKey : update.pixKey,
                pixKeyType:
                  reminderPatch?.pixKeyType !== undefined
                    ? reminderPatch.pixKeyType
                    : update.pixKeyType,
                pixReceiverName:
                  reminderPatch?.pixReceiverName !== undefined
                    ? reminderPatch.pixReceiverName
                    : update.pixReceiverName,
                pixCity: reminderPatch?.pixCity !== undefined ? reminderPatch.pixCity : update.pixCity,
                pixDescription:
                  reminderPatch?.pixDescription !== undefined
                    ? reminderPatch.pixDescription
                    : update.pixDescription,
                pixTxid: reminderPatch?.pixTxid !== undefined ? reminderPatch.pixTxid : update.pixTxid,
              }
            : {}),
        },
      })

      const entry = await tx.financialEntry.findFirst({ where: { paymentId } })
      if (entry) {
        await tx.financialEntry.update({
          where: { id: entry.id },
          data: {
            amount: updated.amount,
            date: updated.paymentDate,
            description: updated.description || entry.description
          }
        })
      } else if (String(updated.status || '').toUpperCase() === 'COMPLETED') {
        await tx.financialEntry.create({
          data: {
            type: 'INCOME',
            category: 'Pagamento de Cliente',
            description: updated.description || `Pagamento recebido de ${client.name}`,
            amount: updated.amount,
            date: updated.paymentDate,
            isRecurring: false,
            paymentId: updated.id
          }
        })
      }

      return updated
    })

    if (!result) return NextResponse.json({ error: 'Pagamento não encontrado' }, { status: 404 })
    if ((result as any).error) return NextResponse.json({ error: (result as any).error }, { status: 404 })
    return NextResponse.json(result)
  } catch (error) {
    console.error('Erro ao atualizar pagamento:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const paymentId = body?.paymentId as string | undefined
    if (!paymentId) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

    await prisma.$transaction(async (tx) => {
      await tx.financialEntry.deleteMany({ where: { paymentId } })
      await tx.paymentProject.deleteMany({ where: { paymentId } })
      await tx.payment.delete({ where: { id: paymentId } })
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao excluir pagamento:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
