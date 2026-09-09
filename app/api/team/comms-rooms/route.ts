import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DEFAULT_COMMS_ROOM_ID } from '@/lib/team-chat'

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'S'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const workspaces = await prisma.workspace.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { slug: true, name: true, icon: true },
    })

    const isIndustrialDemo = workspaces.some((w) => w.slug === 'manutencao-preventiva')

    const companyRoom = {
      id: DEFAULT_COMMS_ROOM_ID,
      name: isIndustrialDemo ? 'OTIMIZE — Geral' : 'Link System',
      initial: isIndustrialDemo ? 'OT' : 'LS',
      kind: 'company' as const,
    }

    const sectorRooms = workspaces.map((workspace) => ({
      id: workspace.slug,
      name: workspace.name,
      initial: workspace.icon?.replace(/\p{Extended_Pictographic}/gu, '').trim() || initials(workspace.name),
      kind: 'sector' as const,
    }))

    return NextResponse.json({
      rooms: [companyRoom, ...sectorRooms],
    })
  } catch (error) {
    console.error('Erro ao buscar salas de comunicação:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
