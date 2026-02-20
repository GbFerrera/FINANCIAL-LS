import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { getDefaultAllowedPaths, registryPaths } from "@/lib/access-control"

const updateSchema = z.object({
  allowedPaths: z.array(z.string()).min(1),
})

async function canManage(session: any, targetUserId: string) {
  if (!session) return false
  if (session.user.role === "ADMIN") return true
  return session.user.id === targetUserId
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    const targetUserId = params.id
    if (!(await canManage(session, targetUserId))) {
      return NextResponse.json({ error: "Permissão insuficiente" }, { status: 403 })
    }

    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { role: true },
    } as any)
    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })
    }

    const userData = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { skillsInterests: true, role: true },
    } as any)
    const stored = (userData?.skillsInterests as any) || {}
    const storedPaths: string[] = Array.isArray(stored.pagePermissions) ? stored.pagePermissions : []
    const ALIASES: Record<string, string> = {
      "/sprints": "/projects/sprints",
      "/tasks": "/projects/backlog",
    }
    const allowedRaw = storedPaths.length > 0 ? storedPaths : getDefaultAllowedPaths(user.role)
    const allowedPaths = allowedRaw.map((p: string) => ALIASES[p] ?? p)

    return NextResponse.json({ allowedPaths })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    const targetUserId = params.id
    // Apenas ADMIN pode atualizar permissões de outros usuários
    if (session.user.role !== "ADMIN" && session.user.id !== targetUserId) {
      return NextResponse.json({ error: "Permissão insuficiente" }, { status: 403 })
    }

    const body = await req.json()
    const data = updateSchema.parse(body)

    const ALIASES: Record<string, string> = {
      "/sprints": "/projects/sprints",
      "/tasks": "/projects/backlog",
    }

    const normalizedPaths = data.allowedPaths.map((p: string) => ALIASES[p] ?? p)
    const allowedSet = new Set(normalizedPaths)
    // Validar contra o registro de rotas
    const validPaths = registryPaths()
    for (const p of allowedSet) {
      if (!validPaths.includes(p) && p !== "/*") {
        return NextResponse.json({ error: `Caminho inválido: ${p}` }, { status: 400 })
      }
    }

    // Atualiza JSON skillsInterests com permissões
    const existing = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { skillsInterests: true },
    } as any)
    const base =
      typeof existing?.skillsInterests === "object" && existing?.skillsInterests !== null
        ? (existing?.skillsInterests as Record<string, unknown>)
        : {}
    const payload = {
      ...base,
      pagePermissions: Array.from(allowedSet),
    }
    await prisma.user.update({
      where: { id: targetUserId },
      data: { skillsInterests: payload },
    } as any)

    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos", details: e.issues }, { status: 400 })
    }
    console.error(e)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
