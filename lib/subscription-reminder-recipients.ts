import { prisma } from "@/lib/prisma"

export async function validateRecipientIdsForGroup(groupId: string, clientSubscriptionIds: string[]) {
  if (clientSubscriptionIds.length === 0) {
    throw new Error("Selecione ao menos um destinatário")
  }

  const unique = [...new Set(clientSubscriptionIds)]
  const rows = await prisma.clientSubscription.findMany({
    where: {
      id: { in: unique },
      status: "ACTIVE",
      subscription: { groupId, isActive: true },
    },
    select: { id: true },
  })

  if (rows.length !== unique.length) {
    throw new Error("Um ou mais destinatários não pertencem ao grupo selecionado")
  }

  return unique
}

export async function syncTemplateRecipients(templateId: string, clientSubscriptionIds: string[]) {
  await prisma.$transaction([
    prisma.subscriptionReminderTemplateRecipient.deleteMany({ where: { templateId } }),
    prisma.subscriptionReminderTemplateRecipient.createMany({
      data: clientSubscriptionIds.map((clientSubscriptionId) => ({
        templateId,
        clientSubscriptionId,
      })),
    }),
  ])
}
