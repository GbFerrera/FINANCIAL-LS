import {
  FinancialType,
  PaymentMethod,
  PaymentStatus,
  PrismaClient,
  SubscriptionBillingCycle,
  SubscriptionStatus,
} from '@prisma/client'
import {
  DEMO_CLIENT_PAYMENTS,
  DEMO_CLIENT_SUBSCRIPTIONS,
  DEMO_CLIENTS,
  DEMO_FINANCIAL_ENTRIES,
  DEMO_PROJECTS,
  DEMO_SUBSCRIPTION_GROUPS,
} from '../data/industrial-automation-demo'

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

function monthAtOffset(monthsAgo: number, dueDay: number) {
  const d = new Date()
  d.setMonth(d.getMonth() - monthsAgo)
  d.setDate(Math.min(dueDay, 28))
  d.setHours(10, 0, 0, 0)
  return d
}

const PAYMENT_METHOD: Record<string, PaymentMethod> = {
  PIX: PaymentMethod.PIX,
  BANK_TRANSFER: PaymentMethod.BANK_TRANSFER,
  CREDIT_CARD: PaymentMethod.CREDIT_CARD,
  OTHER: PaymentMethod.OTHER,
}

const PAYMENT_STATUS: Record<string, PaymentStatus> = {
  COMPLETED: PaymentStatus.COMPLETED,
  PENDING: PaymentStatus.PENDING,
  PROCESSING: PaymentStatus.PROCESSING,
}

export async function seedIndustrialFinancial(prisma: PrismaClient) {
  console.log('💰 Financeiro — pagamentos e assinaturas OTIMIZE...')

  const demoEmails = DEMO_CLIENTS.map((c) => c.email)
  const clients = await prisma.client.findMany({
    where: { email: { in: demoEmails } },
    select: { id: true, email: true, name: true },
  })

  if (clients.length === 0) {
    console.log('   Nenhum cliente demo — rode seed industrial primeiro')
    return { entries: 0, payments: 0, subscriptions: 0 }
  }

  const clientByKey = Object.fromEntries(
    DEMO_CLIENTS.map((c) => {
      const row = clients.find((x) => x.email === c.email)
      return [c.key, row?.id]
    })
  ) as Record<string, string | undefined>

  const projectNames = Object.fromEntries(DEMO_PROJECTS.map((p) => [p.key, p.name]))
  const projects = await prisma.project.findMany({
    where: { name: { in: Object.values(projectNames) } },
    select: { id: true, name: true },
  })
  const projectByKey: Record<string, string> = {}
  for (const [key, name] of Object.entries(projectNames)) {
    const row = projects.find((p) => p.name === name)
    if (row) projectByKey[key] = row.id
  }

  const demoClientIds = clients.map((c) => c.id)
  const demoProjectIds = Object.values(projectByKey)

  const clientSubs = await prisma.clientSubscription.findMany({
    where: { clientId: { in: demoClientIds } },
    select: { id: true },
  })
  const clientSubIds = clientSubs.map((s) => s.id)

  const entryIds = await prisma.financialEntry.findMany({
    where: {
      OR: [
        { projectId: { in: demoProjectIds } },
        { clientSubscriptionId: { in: clientSubIds } },
        { payment: { clientId: { in: demoClientIds } } },
      ],
    },
    select: { id: true },
  })

  if (entryIds.length > 0) {
    await prisma.financialAttachment.deleteMany({
      where: { financialEntryId: { in: entryIds.map((e) => e.id) } },
    })
    await prisma.financialEntry.deleteMany({
      where: { id: { in: entryIds.map((e) => e.id) } },
    })
  }

  await prisma.paymentProject.deleteMany({
    where: { payment: { clientId: { in: demoClientIds } } },
  })
  await prisma.paymentReminderSendLog.deleteMany({
    where: { payment: { clientId: { in: demoClientIds } } },
  })
  await prisma.payment.deleteMany({
    where: { clientId: { in: demoClientIds } },
  })

  const planIds: Record<string, string> = {}
  for (const group of DEMO_SUBSCRIPTION_GROUPS) {
    let g = await prisma.subscriptionGroup.findFirst({ where: { name: group.name } })
    if (!g) {
      g = await prisma.subscriptionGroup.create({
        data: { name: group.name, description: group.description },
      })
    }
    for (const plan of group.plans) {
      let sub = await prisma.subscription.findFirst({
        where: { groupId: g.id, name: plan.name },
      })
      if (!sub) {
        sub = await prisma.subscription.create({
          data: {
            groupId: g.id,
            name: plan.name,
            price: plan.price,
            billingCycle: plan.cycle as SubscriptionBillingCycle,
          },
        })
      } else {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { price: plan.price },
        })
      }
      planIds[plan.name] = sub.id
    }
  }

  let subscriptionLinks = 0

  for (const link of DEMO_CLIENT_SUBSCRIPTIONS) {
    const clientId = clientByKey[link.clientKey]
    const subscriptionId = planIds[link.planName]
    if (!clientId || !subscriptionId) continue

    const lastPaidFor =
      link.lastPaidForDaysAgo != null ? daysAgo(link.lastPaidForDaysAgo) : null

    const row = await prisma.clientSubscription.upsert({
      where: {
        clientId_subscriptionId: { clientId, subscriptionId },
      },
      create: {
        clientId,
        subscriptionId,
        status: SubscriptionStatus.ACTIVE,
        dueDay: link.dueDay,
        startedAt: daysAgo(link.startedAtDaysAgo),
        lastPaidFor,
        paidAt: lastPaidFor,
      },
      update: {
        status: SubscriptionStatus.ACTIVE,
        dueDay: link.dueDay,
        lastPaidFor,
        paidAt: lastPaidFor,
      },
      include: {
        client: { select: { name: true } },
        subscription: { select: { name: true, price: true } },
      },
    })

    subscriptionLinks++

    if (lastPaidFor) {
      const monthsBack = Math.min(6, Math.ceil(link.lastPaidForDaysAgo / 28))
      for (let m = monthsBack; m >= 0; m--) {
        const paidDate = monthAtOffset(m, link.dueDay)
        if (paidDate > lastPaidFor) continue
        await prisma.financialEntry.create({
          data: {
            type: FinancialType.INCOME,
            category: 'Assinaturas',
            description: `${row.client.name} • ${row.subscription.name}`,
            amount: row.subscription.price,
            date: paidDate,
            clientSubscriptionId: row.id,
          },
        })
      }
    }
  }

  let entryCount = 0
  for (const e of DEMO_FINANCIAL_ENTRIES) {
    await prisma.financialEntry.create({
      data: {
        type: e.type as FinancialType,
        category: e.category,
        description: e.description,
        amount: e.amount,
        date: daysAgo(e.daysAgo),
        projectId: e.projectKey ? projectByKey[e.projectKey] ?? null : null,
      },
    })
    entryCount++
  }

  let paymentCount = 0
  for (const p of DEMO_CLIENT_PAYMENTS) {
    const clientId = clientByKey[p.clientKey]
    if (!clientId) continue

    const payment = await prisma.payment.create({
      data: {
        clientId,
        amount: p.amount,
        description: p.description,
        paymentDate: daysAgo(p.daysAgo),
        method: PAYMENT_METHOD[p.method] ?? PaymentMethod.PIX,
        status: PAYMENT_STATUS[p.status] ?? PaymentStatus.COMPLETED,
        paymentProjects: p.projectAllocations?.length
          ? {
              create: p.projectAllocations
                .filter((a) => projectByKey[a.projectKey])
                .map((a) => ({
                  projectId: projectByKey[a.projectKey],
                  amount: a.amount,
                })),
            }
          : undefined,
      },
    })

    if (p.status === 'COMPLETED') {
      await prisma.financialEntry.create({
        data: {
          type: FinancialType.INCOME,
          category: 'Pagamentos',
          description: p.description,
          amount: p.amount,
          date: daysAgo(p.daysAgo),
          paymentId: payment.id,
          projectId: p.projectAllocations?.[0]
            ? projectByKey[p.projectAllocations[0].projectKey] ?? null
            : null,
        },
      })
      entryCount++
    }

    paymentCount++
  }

  const subIncomeCount = await prisma.financialEntry.count({
    where: { category: 'Assinaturas', clientSubscriptionId: { not: null } },
  })

  console.log(
    `   ${subscriptionLinks} assinaturas · ${paymentCount} pagamentos · ${entryCount + subIncomeCount} lançamentos`
  )

  return {
    entries: entryCount + subIncomeCount,
    payments: paymentCount,
    subscriptions: subscriptionLinks,
  }
}
