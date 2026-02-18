import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

interface RouteParams {
  params: { id: string }
}

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().optional().nullable(),
  diagram: z.any().optional().nullable(),
  accessUserIds: z.array(z.string()).optional(),
})

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

    const note = await prisma.note.findUnique({
      where: { id: params.id },
      include: {
        project: { select: { id: true, name: true, team: { select: { userId: true } } } },
        createdBy: { select: { id: true, name: true, email: true } },
        access: { include: { user: { select: { id: true, name: true, email: true } } } },
      },
    })
    if (!note) return NextResponse.json({ error: "Nota não encontrada" }, { status: 404 })

    const isAdmin = session.user.role === "ADMIN"
    const canView =
      isAdmin ||
      note.createdById === session.user.id ||
      note.access.some((a) => a.userId === session.user.id) ||
      note.project.team.some((t) => t.userId === session.user.id)

    if (!canView) return NextResponse.json({ error: "Sem permissão" }, { status: 403 })

    return NextResponse.json(note)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    const json = await req.json()
    const body = updateSchema.parse(json)

    const existing = await prisma.note.findUnique({
      where: { id: params.id },
      include: { project: { select: { id: true } }, access: true },
    })
    if (!existing) return NextResponse.json({ error: "Nota não encontrada" }, { status: 404 })

    const isAdmin = session.user.role === "ADMIN"
    const isOwner = existing.createdById === session.user.id
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    let toCreate: string[] = []
    let toDelete: string[] = []
    if (body.accessUserIds) {
      const teamUsers = await prisma.projectTeam.findMany({
        where: { projectId: existing.projectId },
        select: { userId: true },
      })
      const teamSet = new Set(teamUsers.map((t) => t.userId))

      const nextSet = new Set(body.accessUserIds.filter((id) => teamSet.has(id)))
      const currentSet = new Set(existing.access.map((a) => a.userId))

      toCreate = [...nextSet].filter((id) => !currentSet.has(id))
      toDelete = [...currentSet].filter((id) => !nextSet.has(id))
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (toDelete.length > 0) {
        await tx.noteAccess.deleteMany({ where: { noteId: params.id, userId: { in: toDelete } } })
      }
      if (toCreate.length > 0) {
        await tx.noteAccess.createMany({
          data: toCreate.map((userId) => ({ noteId: params.id, userId })),
          skipDuplicates: true,
        })
      }
      return tx.note.update({
        where: { id: params.id },
        data: {
          title: body.title ?? undefined,
          content: body.content ?? undefined,
          diagram: body.diagram ?? undefined,
        },
        include: {
          project: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true, email: true } },
          access: { include: { user: { select: { id: true, name: true, email: true } } } },
        },
      })
    })

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos", details: error.issues }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

    const existing = await prisma.note.findUnique({ where: { id: params.id } })
    if (!existing) return NextResponse.json({ error: "Nota não encontrada" }, { status: 404 })
    const isAdmin = session.user.role === "ADMIN"
    const isOwner = existing.createdById === session.user.id
    if (!isAdmin && !isOwner) return NextResponse.json({ error: "Sem permissão" }, { status: 403 })

    await prisma.note.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
