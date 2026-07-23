import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { UserRole } from "@prisma/client"
import { evolutionCreateInstance, extractEvolutionInstanceIdFromCreate, evolutionFetchVersion, getEvolutionConfig, resolveEvolutionInstanceId } from "@/lib/evolution-api"
import { randomBytes } from "crypto"

const createSchema = z.object({
  label: z.string().min(1).max(80),
  isDefault: z.boolean().optional(),
})

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session) return { error: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) }
  if (session.user.role !== UserRole.ADMIN) {
    return { error: NextResponse.json({ error: "Sem permissão" }, { status: 403 }) }
  }
  return { session }
}

function slugInstanceName(label: string) {
  const base = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24)
  const suffix = randomBytes(3).toString("hex")
  return `rem-${base || "wa"}-${suffix}`
}

export async function GET() {
  const auth = await requireAdmin()
  if ("error" in auth) return auth.error

  try {
    const instances = await prisma.whatsAppInstance.findMany({
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      include: { _count: { select: { reminderTemplates: true } } },
    })

    return NextResponse.json({
      instances,
      evolutionConfigured: !!getEvolutionConfig(),
      evolutionVersion: await evolutionFetchVersion(),
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "Erro ao listar instâncias. Rode `npx prisma generate` e reinicie o dev server.",
      },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if ("error" in auth) return auth.error

  if (!getEvolutionConfig()) {
    return NextResponse.json(
      { error: "Evolution API não configurada (EVOLUTION_API_URL / EVOLUTION_API_KEY)" },
      { status: 503 }
    )
  }

  try {
    const body = createSchema.parse(await req.json())
    const instanceName = slugInstanceName(body.label)

    const evoPayload = await evolutionCreateInstance(instanceName)
    const evolutionInstanceId =
      extractEvolutionInstanceIdFromCreate(evoPayload) ??
      (await resolveEvolutionInstanceId(instanceName).catch(() => null))

    if (typeof prisma.whatsAppInstance?.create !== "function") {
      return NextResponse.json(
        {
          error:
            "Prisma desatualizado (model WhatsApp). Rode `npm run db:generate` e reinicie `npm run dev`.",
        },
        { status: 503 }
      )
    }

    if (body.isDefault) {
      await prisma.whatsAppInstance.updateMany({ data: { isDefault: false } })
    }
    const count = await prisma.whatsAppInstance.count()
    const created = await prisma.whatsAppInstance.create({
      data: {
        label: body.label.trim(),
        instanceName,
        evolutionInstanceId,
        status: "CONNECTING",
        isDefault: body.isDefault ?? count === 0,
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos", details: e.issues }, { status: 400 })
    }
    console.error(e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao criar instância" },
      { status: 500 }
    )
  }
}
