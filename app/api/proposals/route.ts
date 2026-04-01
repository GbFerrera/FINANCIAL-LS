import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const createSchema = z.object({
  clientId: z.string().min(1),
  projectId: z.string().optional().nullable(),
  title: z.string().min(1),
  issuedAt: z.string().transform(str => new Date(str)),
  validUntil: z.string().transform(str => new Date(str)).optional(),
  objective: z.string().optional(),
  data: z.any().optional()
})

function formatCode(n: number) {
  const s = String(n).padStart(4, "0")
  return `PROP-${s}`
}

async function nextCode() {
  const last = await prisma.proposal.findFirst({
    orderBy: { createdAt: "desc" },
    select: { code: true }
  })
  if (!last?.code) return formatCode(1)
  const m = last.code.match(/PROP-(\d+)/)
  const num = m ? parseInt(m[1], 10) + 1 : 1
  return formatCode(num)
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get("clientId") || undefined
  const projectId = searchParams.get("projectId") || undefined
  const code = searchParams.get("code") || undefined
  const page = parseInt(searchParams.get("page") || "1", 10)
  const limit = parseInt(searchParams.get("limit") || "10", 10)
  const skip = (page - 1) * limit

  const where: any = {}
  if (clientId) where.clientId = clientId
  if (projectId) where.projectId = projectId
  if (code) where.code = code

  const [items, total] = await Promise.all([
    prisma.proposal.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } }
      }
    }),
    prisma.proposal.count({ where })
  ])

  return NextResponse.json({
    proposals: items,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  })
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const input = createSchema.parse(body)

    const client = await prisma.client.findUnique({ where: { id: input.clientId } })
    if (!client) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 400 })
    }
    const hasProject = input.projectId && input.projectId !== "none"
    if (hasProject) {
      const project = await prisma.project.findUnique({ where: { id: input.projectId! } })
      if (!project) {
        return NextResponse.json({ error: "Projeto não encontrado" }, { status: 400 })
      }
    }

    const code = await nextCode()

    const proposal = await prisma.proposal.create({
      data: {
        code,
        title: input.title,
        issuedAt: input.issuedAt,
        validUntil: input.validUntil,
        clientId: input.clientId,
        projectId: hasProject ? input.projectId! : null,
        createdById: session.user.id,
        data: input.data ?? {
          objective: input.objective ?? "",
        }
      },
      include: {
        client: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } }
      }
    })

    return NextResponse.json(proposal, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos", details: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
