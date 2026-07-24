import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { z } from "zod"
import { UserRole } from "@prisma/client"
import { runReminderDispatch } from "@/lib/run-reminder-dispatch"
import { enqueueReminderDispatch, getReminderQueue } from "@/lib/reminder-queue"

const bodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dryRun: z.boolean().optional(),
  cronSecret: z.string().min(1).optional(),
  onlyClientEmail: z.string().email().optional(),
  async: z.boolean().optional(),
})

async function authorize(req: NextRequest, body: z.infer<typeof bodySchema>) {
  const url = new URL(req.url)
  const xCronSecret = req.headers.get("x-cron-secret")
  const authorization = req.headers.get("authorization")
  const querySecret = url.searchParams.get("cronSecret")
  const headerSecret =
    xCronSecret || authorization?.replace(/^Bearer\s+/i, "") || querySecret || null
  const providedSecret = headerSecret || body.cronSecret || null

  if (providedSecret) {
    const secret = process.env.CRON_SECRET
    if (!secret) {
      return {
        error: NextResponse.json(
          { error: "CRON_SECRET não está configurado no ambiente do servidor" },
          { status: 500 }
        ),
      }
    }
    if (providedSecret !== secret) {
      return { error: NextResponse.json({ error: "x-cron-secret inválido" }, { status: 401 }) }
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

    const dryRun = body.dryRun ?? false
    const skipSendTimeCheck = dryRun || Boolean(body.date)

    if (body.async && getReminderQueue()) {
      const job = await enqueueReminderDispatch({
        dryRun,
        skipSendTimeCheck,
        onlyClientEmail: body.onlyClientEmail,
        date: body.date,
      })
      return NextResponse.json({
        ok: true,
        queued: true,
        jobId: job.id,
      })
    }

    const result = await runReminderDispatch({
      date: body.date,
      dryRun,
      skipSendTimeCheck,
      onlyClientEmail: body.onlyClientEmail,
    })

    return NextResponse.json(result)
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos", details: e.issues }, { status: 400 })
    }
    console.error(e)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
