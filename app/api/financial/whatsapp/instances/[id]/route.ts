import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import {
  evolutionConnectionState,
  evolutionDeleteInstance,
  evolutionFetchQrPayload,
  extractPairingCode,
  extractQrCode,
  extractQrCodeRaw,
  evolutionFetchVersion,
  evolutionManagerLoginUrl,
  evolutionManagerUrl,
  getEvolutionConfig,
  mapEvolutionState,
  resolveEvolutionInstanceId,
  describeMissingQr,
} from "@/lib/evolution-api"

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session) return { error: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) }
  if (session.user.role !== UserRole.ADMIN) {
    return { error: NextResponse.json({ error: "Sem permissão" }, { status: 403 }) }
  }
  return { session }
}

async function loadInstance(id: string) {
  return prisma.whatsAppInstance.findUnique({ where: { id } })
}

async function ensureEvolutionInstanceId(row: {
  id: string
  instanceName: string
  evolutionInstanceId: string | null
}) {
  if (row.evolutionInstanceId) return row.evolutionInstanceId
  try {
    const evoId = await resolveEvolutionInstanceId(row.instanceName)
    if (evoId) {
      await prisma.whatsAppInstance.update({
        where: { id: row.id },
        data: { evolutionInstanceId: evoId },
      })
    }
    return evoId
  } catch {
    return null
  }
}

async function resolveId(params: { id: string } | Promise<{ id: string }>) {
  const { id } = await params
  return id
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if ("error" in auth) return auth.error

  const id = await resolveId(params)
  const row = await loadInstance(id)
  if (!row) return NextResponse.json({ error: "Instância não encontrada" }, { status: 404 })

  if (!getEvolutionConfig()) {
    return NextResponse.json({ error: "Evolution API não configurada" }, { status: 503 })
  }

  try {
    const payload = await evolutionFetchQrPayload(row.instanceName)
    const qrCode = extractQrCode(payload)
    const qrCodeRaw = extractQrCodeRaw(payload)
    const pairingCode = extractPairingCode(payload)
    const mapped = mapEvolutionState(payload)
    const evolutionInstanceId = await ensureEvolutionInstanceId(row)

    await prisma.whatsAppInstance.update({
      where: { id: row.id },
      data: {
        status: mapped.status === "DISCONNECTED" && (qrCode || qrCodeRaw || pairingCode) ? "CONNECTING" : mapped.status,
        phone: mapped.phone ?? row.phone,
      },
    })

    const evolutionVersion = await evolutionFetchVersion()

    return NextResponse.json({
      qrCode,
      qrCodeRaw,
      pairingCode,
      managerUrl: evolutionManagerUrl(evolutionInstanceId),
      managerLoginUrl: evolutionManagerLoginUrl(),
      status: mapped.status,
      phone: mapped.phone ?? row.phone,
      evolutionVersion,
      qrDiagnosis:
        qrCode || qrCodeRaw || pairingCode
          ? null
          : describeMissingQr({ evolutionVersion, connectPayload: payload }),
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao obter QR Code" },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if ("error" in auth) return auth.error

  const id = await resolveId(params)
  const row = await loadInstance(id)
  if (!row) return NextResponse.json({ error: "Instância não encontrada" }, { status: 404 })

  const url = new URL(req.url)
  const action = url.searchParams.get("action")

  if (action === "sync") {
    if (!getEvolutionConfig()) {
      return NextResponse.json({ error: "Evolution API não configurada" }, { status: 503 })
    }
    try {
      const payload = await evolutionConnectionState(row.instanceName)
      const mapped = mapEvolutionState(payload)
      const updated = await prisma.whatsAppInstance.update({
        where: { id: row.id },
        data: { status: mapped.status, phone: mapped.phone ?? row.phone },
      })
      return NextResponse.json(updated)
    } catch (e) {
      console.error(e)
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Erro ao sincronizar" },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if ("error" in auth) return auth.error

  const id = await resolveId(params)
  const row = await loadInstance(id)
  if (!row) return NextResponse.json({ error: "Instância não encontrada" }, { status: 404 })

  if (getEvolutionConfig()) {
    try {
      await evolutionDeleteInstance(row.instanceName)
    } catch (e) {
      console.warn("Evolution delete failed:", e)
    }
  }

  await prisma.whatsAppInstance.delete({ where: { id: row.id } })
  return NextResponse.json({ ok: true })
}
