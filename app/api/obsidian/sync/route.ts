import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { UserRole } from "@prisma/client"
import { z } from "zod"
import { runLinkBrainSyncNow } from "@/lib/link-brain-sync/trigger"

const bodySchema = z.object({
  dryRun: z.boolean().optional(),
  gitPush: z.boolean().optional(),
  cronSecret: z.string().min(1).optional(),
  reason: z.string().optional(),
})

async function authorize(req: NextRequest, body: z.infer<typeof bodySchema>) {
  const url = new URL(req.url)
  const headerSecret =
    req.headers.get("x-cron-secret") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    url.searchParams.get("cronSecret") ||
    body.cronSecret ||
    null

  if (headerSecret) {
    const secret = process.env.CRON_SECRET
    if (!secret) {
      return {
        error: NextResponse.json(
          { error: "CRON_SECRET não configurado" },
          { status: 500 }
        ),
      }
    }
    if (headerSecret !== secret) {
      return { error: NextResponse.json({ error: "Secret inválido" }, { status: 401 }) }
    }
    return { ok: true as const }
  }

  const session = await getServerSession(authOptions)
  if (!session) {
    return { error: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) }
  }
  if (session.user.role !== UserRole.ADMIN) {
    return { error: NextResponse.json({ error: "Sem permissão" }, { status: 403 }) }
  }
  return { ok: true as const }
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json().catch(() => ({}))
    const body = bodySchema.parse(json)
    const auth = await authorize(req, body)
    if ("error" in auth) return auth.error

    const result = await runLinkBrainSyncNow({
      dryRun: body.dryRun,
      gitPush: body.gitPush,
      reason: body.reason || "api/manual",
    })

    if (result.skipped) {
      return NextResponse.json(
        { ok: false, error: result.reason, hint: "Configure OBSIDIAN_VAULT_PATH no servidor" },
        { status: 503 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Body inválido", details: error.issues }, { status: 400 })
    }
    console.error("[obsidian/sync]", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const configured = Boolean(
    process.env.OBSIDIAN_VAULT_PATH || process.env.LINK_BRAIN_VAULT_PATH
  )
  return NextResponse.json({
    service: "link-brain-sync",
    configured,
    vaultPath: configured
      ? process.env.OBSIDIAN_VAULT_PATH || process.env.LINK_BRAIN_VAULT_PATH
      : null,
    autoSync: process.env.LINK_BRAIN_SYNC_ENABLED !== "0" && configured,
    gitPush: process.env.LINK_BRAIN_GIT_PUSH === "1",
    docs: "POST /api/obsidian/sync — admin session ou x-cron-secret",
  })
}
