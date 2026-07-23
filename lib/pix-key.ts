export type ReminderPixKeyType = "email" | "phone" | "cpf" | "cnpj" | "random"

export function normalizePixKeyType(raw: string | null | undefined): ReminderPixKeyType {
  const v = (raw || "email").toLowerCase()
  if (v === "phone" || v === "cpf" || v === "cnpj" || v === "random") return v
  if (v === "evp") return "random"
  return "email"
}

/** Tipo escolhido no template tem prioridade; senão infere pela chave. */
export function resolvePixKeyType(key: string, declared?: string | null): ReminderPixKeyType {
  if (declared?.trim()) return normalizePixKeyType(declared)
  return inferPixKeyTypeFromKey(key)
}

export function inferPixKeyType(key: string, declared?: string | null): ReminderPixKeyType {
  return resolvePixKeyType(key, declared)
}

function inferPixKeyTypeFromKey(key: string): ReminderPixKeyType {
  const k = key.trim()
  if (k.includes("@")) return "email"
  const digits = k.replace(/\D/g, "")
  if (digits.length === 14) return "cnpj"
  if (digits.length === 11) {
    const ddd = Number.parseInt(digits.slice(0, 2), 10)
    if (ddd >= 11 && ddd <= 99) return "phone"
    return "cpf"
  }
  if (digits.length === 10) return "phone"
  if (digits.length >= 12 && digits.startsWith("55")) return "phone"
  if (/^[0-9a-f-]{32,36}$/i.test(k)) return "random"
  return "email"
}

/** Chave Pix no formato exigido no payload EMV (copia e cola). */
export function formatPixKeyForEmv(key: string, keyType: ReminderPixKeyType): string {
  const trimmed = key.trim()
  if (keyType === "email") return trimmed.toLowerCase()
  if (keyType === "random") return trimmed

  const digits = trimmed.replace(/\D/g, "")

  if (keyType === "cpf" || keyType === "cnpj") return digits

  if (keyType === "phone") {
    let local = digits
    if (local.startsWith("55") && local.length >= 12) local = local.slice(2)
    if (local.length < 10 || local.length > 11) {
      throw new Error(`Telefone Pix inválido (${local.length} dígitos). Use DDD + número (10 ou 11 dígitos).`)
    }
    return `+55${local}`
  }

  return trimmed
}

/** Chave curta para exibir / 2ª mensagem WhatsApp (sem +55). */
export function formatPixKeyForDisplay(key: string, keyType: ReminderPixKeyType) {
  const trimmed = key.trim()
  if (keyType === "phone") {
    const digits = trimmed.replace(/\D/g, "")
    if (digits.startsWith("55") && digits.length >= 12) return digits.slice(2)
    return digits
  }
  if (keyType === "cpf" || keyType === "cnpj") return trimmed.replace(/\D/g, "")
  return trimmed
}

export const pixKeyForDisplay = formatPixKeyForDisplay
