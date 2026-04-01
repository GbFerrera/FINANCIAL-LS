import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

type Params = { params: { code: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const proposal = await prisma.proposal.findUnique({
    where: { code: params.code },
    include: {
      client: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } }
    }
  })
  if (!proposal) {
    return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 })
  }
  return NextResponse.json(proposal)
}

const updateSchema = z.object({
  title: z.string().optional(),
  status: z.enum(["DRAFT", "SENT", "ACCEPTED", "REJECTED", "ARCHIVED"]).optional(),
  issuedAt: z.string().transform(str => new Date(str)).optional(),
  validUntil: z.string().transform(str => new Date(str)).optional(),
  objective: z.string().optional(),
  data: z.any().optional(),
  projectId: z.string().optional().nullable(),
  clientId: z.string().optional()
})

export async function PUT(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const input = updateSchema.parse(body)

    const existing = await prisma.proposal.findUnique({ where: { code: params.code } })
    if (!existing) {
      return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 })
    }

    const updated = await prisma.proposal.update({
      where: { code: params.code },
      data: {
        title: input.title,
        status: input.status,
        issuedAt: input.issuedAt,
        validUntil: input.validUntil,
        projectId: input.projectId ?? undefined,
        clientId: input.clientId ?? undefined,
        data: input.data !== undefined
          ? input.data
          : input.objective !== undefined
            ? { ...(existing.data as any), objective: input.objective }
            : undefined
      },
      include: {
        client: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } }
      }
    })

    return NextResponse.json(updated)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos", details: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
