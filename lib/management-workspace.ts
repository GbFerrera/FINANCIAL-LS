import type { Prisma } from '@prisma/client'
import { defaultManagementSettings, mergeWorkspaceSettings, parseWorkspaceSettings } from '@/lib/workspace-settings'

type Tx = Prisma.TransactionClient

export async function ensureManagementInternalProject(
  tx: Tx,
  workspaceName: string,
  existingSettings: unknown
): Promise<{ projectId: string; settings: ReturnType<typeof mergeWorkspaceSettings> }> {
  const parsed = parseWorkspaceSettings(existingSettings)
  const baseSettings = mergeWorkspaceSettings(defaultManagementSettings(), parsed)

  if (baseSettings.internalProjectId) {
    const existing = await tx.project.findUnique({
      where: { id: baseSettings.internalProjectId },
      select: { id: true },
    })
    if (existing) {
      return { projectId: existing.id, settings: baseSettings }
    }
  }

  const client =
    (await tx.client.findFirst({
      where: { name: { contains: 'Link System', mode: 'insensitive' } },
      select: { id: true },
    })) ||
    (await tx.client.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    }))

  if (!client) {
    throw new Error('Nenhum cliente cadastrado para criar o espaço de gerenciamento')
  }

  const project = await tx.project.create({
    data: {
      name: `[Gestão] ${workspaceName}`,
      description: 'Projeto interno do espaço de gerenciamento (não vinculado a entregas)',
      status: 'PLANNING',
      startDate: new Date(),
      clientId: client.id,
    },
    select: { id: true },
  })

  const settings = mergeWorkspaceSettings(baseSettings, { internalProjectId: project.id })
  return { projectId: project.id, settings }
}
