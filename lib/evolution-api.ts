const DEFAULT_TIMEOUT_MS = 30_000

export function getEvolutionConfig() {
  const baseUrl = (process.env.EVOLUTION_API_URL || "").replace(/\/$/, "")
  const apiKey = process.env.EVOLUTION_API_KEY || ""
  if (!baseUrl || !apiKey) return null
  return { baseUrl, apiKey }
}

/** Versão reportada pela Evolution (GET /). */
export async function evolutionFetchVersion(): Promise<string | null> {
  const cfg = getEvolutionConfig()
  if (!cfg) return null
  try {
    const res = await fetch(`${cfg.baseUrl}/`, { signal: AbortSignal.timeout(5000) })
    const data = (await res.json()) as { version?: string }
    return data.version ?? null
  } catch {
    return null
  }
}

export function describeMissingQr(params: {
  evolutionVersion: string | null
  connectPayload: unknown
}): string {
  const root = params.connectPayload as Record<string, unknown> | null
  const count = root?.count
  if (params.evolutionVersion?.startsWith("2.2.")) {
    return `Evolution ${params.evolutionVersion} tem bug conhecido: /instance/connect retorna {"count":0} sem QR. Atualize para v2.3.7 (npm run evo:upgrade) e crie a instância de novo.`
  }
  if (count === 0) {
    return "Evolution respondeu count:0 — sessão Baileys não gerou QR. Tente Atualizar QR, reinicie a instância ou use o Manager."
  }
  return "QR não veio na resposta da Evolution. Confira logs: docker compose logs evolution-api --tail 50"
}

async function evolutionFetch(path: string, init?: RequestInit) {
  const cfg = getEvolutionConfig()
  if (!cfg) {
    throw new Error("Evolution API não configurada (EVOLUTION_API_URL / EVOLUTION_API_KEY)")
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  try {
    const res = await fetch(`${cfg.baseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        apikey: cfg.apiKey,
        ...(init?.headers || {}),
      },
    })

    const text = await res.text()
    let data: unknown = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = { raw: text }
    }

    if (!res.ok) {
      const msg =
        typeof data === "object" && data && "message" in data
          ? String((data as { message: unknown }).message)
          : text || res.statusText
      throw new Error(msg || `Evolution HTTP ${res.status}`)
    }

    return data
  } catch (err) {
    clearTimeout(timeout)
    const code =
      err && typeof err === "object" && "cause" in err
        ? (err.cause as { code?: string })?.code
        : undefined
    if (code === "ECONNREFUSED" || (err instanceof Error && err.message.includes("fetch failed"))) {
      throw new Error(
        `Evolution API indisponível em ${cfg.baseUrl}. Suba com: docker compose up -d evolution-redis evolution-api`
      )
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

export async function evolutionFetchInstances() {
  return evolutionFetch("/instance/fetchInstances", { method: "GET" })
}

export function extractEvolutionInstanceIdFromCreate(payload: unknown): string | null {
  const root = payload as Record<string, unknown>
  const inst = root.instance as Record<string, unknown> | undefined
  if (!inst) return null
  const id = inst.instanceId ?? inst.id
  return typeof id === "string" && id.length > 0 ? id : null
}

export function findEvolutionInstanceIdByName(payload: unknown, instanceName: string): string | null {
  if (!Array.isArray(payload)) return null
  for (const item of payload) {
    if (!item || typeof item !== "object") continue
    const row = item as { name?: string; id?: string }
    if (row.name === instanceName && row.id) return row.id
  }
  return null
}

export async function resolveEvolutionInstanceId(instanceName: string): Promise<string | null> {
  const list = await evolutionFetchInstances()
  return findEvolutionInstanceIdByName(list, instanceName)
}

export async function evolutionCreateInstance(instanceName: string) {
  return evolutionFetch("/instance/create", {
    method: "POST",
    body: JSON.stringify({
      instanceName,
      integration: "WHATSAPP-BAILEYS",
      qrcode: true,
    }),
  })
}

export async function evolutionRestart(instanceName: string) {
  return evolutionFetch(`/instance/restart/${encodeURIComponent(instanceName)}`, {
    method: "POST",
  })
}

export async function evolutionConnect(instanceName: string) {
  return evolutionFetch(`/instance/connect/${encodeURIComponent(instanceName)}`, {
    method: "GET",
  })
}

/** Tenta obter QR (base64 ou code) reiniciando a sessão se a Evolution retornar count: 0. */
export async function evolutionFetchQrPayload(instanceName: string) {
  let payload = await evolutionConnect(instanceName)
  if (!hasQrPayload(payload)) {
    try {
      await evolutionRestart(instanceName)
    } catch {
      /* ignore */
    }
    await sleep(1500)
    payload = await evolutionConnect(instanceName)
  }
  if (!hasQrPayload(payload)) {
    await sleep(2000)
    payload = await evolutionConnect(instanceName)
  }
  return payload
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function hasQrPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") return false
  const root = payload as Record<string, unknown>
  if (extractQrCode(payload)) return true
  if (typeof root.code === "string" && root.code.length > 10) return true
  if (typeof root.pairingCode === "string" && root.pairingCode.length > 0) return true
  const q = root.qrcode as Record<string, unknown> | undefined
  if (q && typeof q.code === "string" && q.code.length > 10) return true
  return false
}

export async function evolutionConnectionState(instanceName: string) {
  return evolutionFetch(`/instance/connectionState/${encodeURIComponent(instanceName)}`, {
    method: "GET",
  })
}

export async function evolutionDeleteInstance(instanceName: string) {
  return evolutionFetch(`/instance/delete/${encodeURIComponent(instanceName)}`, {
    method: "DELETE",
  })
}

export async function evolutionSendText(instanceName: string, number: string, text: string) {
  return evolutionFetch(`/message/sendText/${encodeURIComponent(instanceName)}`, {
    method: "POST",
    body: JSON.stringify({ number, text }),
  })
}

export type EvolutionPixKeyType = "email" | "phone" | "cpf" | "cnpj" | "random"

/** Botão "copiar" (texto). Mesmas limitações de entrega que outros botões no WhatsApp Web. */
export async function evolutionSendCopyButton(input: {
  instanceName: string
  number: string
  title: string
  description: string
  footer?: string
  button: { displayText: string; copyCode: string }
}) {
  return evolutionFetch(`/message/sendButtons/${encodeURIComponent(input.instanceName)}`, {
    method: "POST",
    body: JSON.stringify({
      number: input.number,
      title: input.title,
      description: input.description,
      footer: input.footer || "",
      buttons: [
        {
          type: "copy",
          displayText: input.button.displayText,
          copyCode: input.button.copyCode,
        },
      ],
    }),
  })
}

/** Botão nativo de Pix (WhatsApp). Pode não ser entregue em contas WhatsApp Web / Baileys — use fallback. */
export async function evolutionSendPixButton(input: {
  instanceName: string
  number: string
  title: string
  description: string
  footer?: string
  button: {
    displayText: string
    currency?: string
    name: string
    key: string
    keyType: EvolutionPixKeyType
  }
}) {
  return evolutionFetch(`/message/sendButtons/${encodeURIComponent(input.instanceName)}`, {
    method: "POST",
    body: JSON.stringify({
      number: input.number,
      title: input.title,
      description: input.description,
      footer: input.footer || input.button.name,
      buttons: [
        {
          type: "pix",
          displayText: input.button.displayText,
          currency: input.button.currency || "BRL",
          name: input.button.name,
          key: input.button.key,
          keyType: input.button.keyType,
        },
      ],
    }),
  })
}

/** Normaliza telefone BR para WhatsApp (somente dígitos, com DDI 55). */
export function normalizeWhatsAppNumber(raw: string | null | undefined) {
  if (!raw) return null
  let digits = raw.replace(/\D/g, "")
  if (!digits) return null
  if (digits.startsWith("0")) digits = digits.slice(1)
  if (!digits.startsWith("55") && digits.length <= 11) digits = `55${digits}`
  if (digits.length < 12) return null
  return digits
}

export function mapEvolutionState(payload: unknown): {
  status: "CONNECTED" | "CONNECTING" | "DISCONNECTED"
  phone?: string
} {
  const root = payload as Record<string, unknown>
  const inst = (root.instance as Record<string, unknown>) || root
  const stateRaw =
    inst.state ?? inst.status ?? root.state ?? root.status ?? root.connectionStatus
  const state = String(stateRaw || "").toLowerCase()

  let status: "CONNECTED" | "CONNECTING" | "DISCONNECTED" = "DISCONNECTED"
  if (state.includes("open") || state === "connected") status = "CONNECTED"
  else if (state.includes("connect") || state.includes("qr") || state === "close") status = "CONNECTING"

  const phone =
    (inst.owner as string) ||
    (inst.number as string) ||
    (root.number as string) ||
    undefined

  return { status, phone: phone ? phone.replace(/\D/g, "") : undefined }
}

export function extractQrCode(payload: unknown): string | null {
  const root = payload as Record<string, unknown>
  const nested = (root.qrcode as Record<string, unknown>) || (root.qr as Record<string, unknown>) || {}
  const base64 =
    (root.base64 as string) ||
    (nested.base64 as string) ||
    (nested.qrcode as string)
  if (typeof base64 === "string" && base64.length > 20) {
    return base64.startsWith("data:") ? base64 : `data:image/png;base64,${base64}`
  }
  return null
}

export function extractPairingCode(payload: unknown): string | null {
  const root = payload as Record<string, unknown>
  const nested = (root.qrcode as Record<string, unknown>) || {}
  const code = root.pairingCode ?? nested.pairingCode
  return typeof code === "string" && code.length > 0 ? code : null
}

/** Conteúdo bruto do QR (Evolution v2.3+); renderize com lib QR no client se não houver base64. */
export function extractQrCodeRaw(payload: unknown): string | null {
  const root = payload as Record<string, unknown>
  const nested = (root.qrcode as Record<string, unknown>) || {}
  const code = root.code ?? nested.code
  return typeof code === "string" && code.length > 10 ? code : null
}

export function evolutionManagerLoginUrl() {
  const cfg = getEvolutionConfig()
  if (!cfg) return null
  return `${cfg.baseUrl.replace(/\/$/, "")}/manager/login`
}

/** Painel Evolution — usa o UUID da instância (não o nome). */
export function evolutionManagerUrl(evolutionInstanceId?: string | null) {
  const cfg = getEvolutionConfig()
  if (!cfg) return null
  const base = cfg.baseUrl.replace(/\/$/, "")
  if (!evolutionInstanceId) return `${base}/manager/`
  return `${base}/manager/instance/${evolutionInstanceId}/dashboard`
}
