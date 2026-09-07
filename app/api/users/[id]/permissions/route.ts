import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { registryPaths } from "@/lib/access-control"
import {
  getDefaultWorkspaceAccess,
} from "@/lib/workspace-permissions"
import { getUserPermissionsSnapshot } from "@/lib/user-permissions-server"

const updateSchema = z.object({
  allowedPaths: z.array(z.string()),
  commissionsAccess: z.enum(["OWN_READ", "OWN_EDIT", "ALL_EDIT", "OWN", "ALL", "EDIT"]).optional(),
  workspaceAccess: z
    .object({
      workspaceIds: z.array(z.string()).nullable(),
      canCreateWorkspaces: z.boolean(),
    })
    .optional(),
})

function normalizeAccess(
  input: string | undefined,
  role?: string
): "OWN_READ" | "OWN_EDIT" | "ALL_EDIT" {
  if (!input) return role === "ADMIN" ? "ALL_EDIT" : "OWN_READ"
  switch (input) {
    case "OWN_READ":
    case "OWN_EDIT":
    case "ALL_EDIT":
      return input
    case "OWN":
      return "OWN_READ"
    case "ALL":
    case "EDIT":
      return "ALL_EDIT"
    default:
      return role === "ADMIN" ? "ALL_EDIT" : "OWN_READ"
  }
}

async function canManage(session: any, targetUserId: string) {
  if (!session) return false
  if (session.user.role === "ADMIN") return true
  return session.user.id === targetUserId
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    const { id: targetUserId } = await params
    if (!(await canManage(session, targetUserId))) {
      return NextResponse.json({ error: "Permissão insuficiente" }, { status: 403 })
    }

    const snapshot = await getUserPermissionsSnapshot(targetUserId)
    if (!snapshot) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })
    }

    return NextResponse.json({
      allowedPaths: snapshot.allowedPaths,
      commissionsAccess: snapshot.commissionsAccess,
      workspaceAccess: snapshot.workspaceAccess,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    const { id: targetUserId } = await params
    if (session.user.role !== "ADMIN" && session.user.id !== targetUserId) {
      return NextResponse.json({ error: "Permissão insuficiente" }, { status: 403 })
    }

    const body = await req.json()
    const data = updateSchema.parse(body)
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { role: true },
    } as any)

    if (!targetUser) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })
    }

    const ALIASES: Record<string, string> = {
      "/sprints": "/projects/sprints",
      "/tasks": "/projects/backlog",
    }

    const normalizedPaths = data.allowedPaths.map((p: string) => ALIASES[p] ?? p)
    const allowedSet = new Set(normalizedPaths)
    const validPaths = registryPaths()
    for (const p of allowedSet) {
      if (!validPaths.includes(p) && p !== "/*") {
        return NextResponse.json({ error: `Caminho inválido: ${p}` }, { status: 400 })
      }
    }

    const existing = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { skillsInterests: true },
    } as any)
    const base =
      typeof existing?.skillsInterests === "object" && existing?.skillsInterests !== null
        ? (existing?.skillsInterests as Record<string, unknown>)
        : {}

    const payload: Record<string, unknown> = {
      ...base,
      pagePermissions: Array.from(allowedSet),
    }

    if (typeof data.commissionsAccess !== "undefined") {
      payload.commissionsAccess = normalizeAccess(data.commissionsAccess, targetUser.role)
    }

    if (data.workspaceAccess) {
      payload.workspaceAccess = {
        workspaceIds: data.workspaceAccess.workspaceIds,
        canCreateWorkspaces: data.workspaceAccess.canCreateWorkspaces,
      }
    } else if (!base.workspaceAccess) {
      payload.workspaceAccess = getDefaultWorkspaceAccess(targetUser.role)
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
