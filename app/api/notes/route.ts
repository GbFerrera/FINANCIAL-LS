import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const createSchema = z.object({
  title: z.string().min(1),
  projectId: z.string().min(1),
  content: z.string().optional(),
  diagram: z.any().optional(),
  accessUserIds: z.array(z.string()).optional(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get("projectId") || undefined
    const q = searchParams.get("q") || ""

    const where: Record<string, unknown> = {
      ...(projectId ? { projectId } : {}),
      ...(q
        ? {
            title: { contains: q, mode: "insensitive" },
          }
        : {}),
    }

    if (session.user.role === "ADMIN") {
      // admins see all filtered by project
    } else {
      where.OR = [
        { createdById: session.user.id },
        { access: { some: { userId: session.user.id } } },
        { project: { team: { some: { userId: session.user.id } } } },
      ]
    }

    const notes = await prisma.note.findMany({
      where,
      include: {
        project: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        access: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
      orderBy: { updatedAt: "desc" },
    })

    return NextResponse.json({ notes })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const json = await req.json()
    const body = createSchema.parse(json)

    const teamUsers = await prisma.projectTeam.findMany({
      where: { projectId: body.projectId },
      select: { userId: true },
    })
    const teamSet = new Set(teamUsers.map((t) => t.userId))

    const accessIds = (body.accessUserIds || []).filter((id) => teamSet.has(id))

    const base = await prisma.note.create({
      data: {
        title: body.title,
        content: body.content,
        diagram: body.diagram ?? undefined,
        projectId: body.projectId,
        createdById: session.user.id,
      },
    })

    if (accessIds.length > 0) {
      await prisma.noteAccess.createMany({
        data: accessIds.map((userId) => ({ noteId: base.id, userId })),
        skipDuplicates: true,
      })
    }

    const note = await prisma.note.findUnique({
      where: { id: base.id },
      include: {
        project: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        access: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    })

    return NextResponse.json(note, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos", details: error.issues }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
