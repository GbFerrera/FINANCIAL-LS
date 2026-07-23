import { createStaticPix, hasError, parsePix } from "pix-utils"
import type { ReminderPixKeyType } from "./pix-key"
import { formatPixKeyForDisplay, formatPixKeyForEmv, resolvePixKeyType } from "./pix-key"

export type StaticPixCopiaColaInput = {
  pixKey: string
  keyType?: ReminderPixKeyType | null
  /** Nome do recebedor no EMV (deve coincidir com o cadastro DICT, máx. 25 caracteres). */
  merchantName: string
  merchantCity?: string
  /** Valor em reais (ex.: 97) */
  amountBrl: number
  /** Campo 62 — descrição / info adicional (ex.: "teste de descricao"). */
  infoAdicional?: string
  /** Identificador da transação (campo 62-05), até 25 caracteres alfanuméricos. */
  txid?: string
}

function stripAccents(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

/** Nome exibido no QR (59) — mantém espaços; BACEN permite letras, números e espaço. */
function sanitizeMerchantName(name: string) {
  return stripAccents(name)
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 25)
}

function sanitizeCity(city: string) {
  return stripAccents(city)
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 15)
}

function sanitizeInfoAdicional(text: string) {
  return stripAccents(text).replace(/\s+/g, " ").trim().slice(0, 72)
}

function sanitizeTxid(txid: string) {
  return txid.replace(/[^a-zA-Z0-9]/g, "").slice(0, 25)
}

/** Remove quebras de linha; não remove espaços dentro do payload (nome/descrição Pix). */
export function normalizeCopiaColaPayload(code: string) {
  return code.replace(/[\r\n]+/g, "").trim()
}

/**
 * Gera Pix copia e cola estático (EMV) — não precisa de banco/PSP.
 * O valor é fixo na string; confirmação de pagamento é manual ou via extrato.
 */
export function buildStaticPixCopiaCola(input: StaticPixCopiaColaInput): string | null {
  const amount = Number(input.amountBrl)
  if (!Number.isFinite(amount) || amount <= 0) return null

  try {
    const keyType = resolvePixKeyType(input.pixKey, input.keyType)
    const pixKey = formatPixKeyForEmv(input.pixKey, keyType)
    const merchantName = sanitizeMerchantName(
      process.env.REMINDER_PIX_MERCHANT_NAME?.trim() || input.merchantName || "RECEBEDOR"
    )
    const merchantCity = sanitizeCity(
      input.merchantCity?.trim() ||
        process.env.REMINDER_PIX_CITY?.trim() ||
        process.env.PIX_MERCHANT_CITY?.trim() ||
        "Goiania"
    )

    const infoRaw =
      input.infoAdicional?.trim() ||
      process.env.REMINDER_PIX_DESCRIPTION?.trim() ||
      undefined
    const infoAdicional = infoRaw ? sanitizeInfoAdicional(infoRaw) : undefined

    const txidRaw =
      input.txid?.trim() || process.env.REMINDER_PIX_TXID?.trim() || "ASSINATURA"
    const txid = sanitizeTxid(txidRaw) || "ASSINATURA"

    const pix = createStaticPix({
      merchantName: merchantName || "RECEBEDOR",
      merchantCity: merchantCity || "Goiania",
      pixKey,
      transactionAmount: Number(amount.toFixed(2)),
      ...(infoAdicional ? { infoAdicional } : {}),
      txid,
    })

    if (hasError(pix)) return null

    const code = normalizeCopiaColaPayload(pix.toBRCode())
    parsePix(code).throwIfError()
    return code
  } catch {
    return null
  }
}

export function parseAmountBrlFromReminderVars(precoFormatted: string, fallback = 0) {
  const digits = precoFormatted.replace(/[^\d,.-]/g, "")
  if (!digits) return fallback
  const normalized = digits.includes(",")
    ? digits.replace(/\./g, "").replace(",", ".")
    : digits
  const n = Number.parseFloat(normalized)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export type ReminderPixPayload = {
  keyType: ReminderPixKeyType
  keyOnly: string
  keyTypeLabel: string
  copiaCola: string | null
  receiverName: string
  amountLabel?: string
}

function keyTypeLabel(keyType: ReminderPixKeyType) {
  if (keyType === "phone") return "Telefone"
  if (keyType === "email") return "E-mail"
  if (keyType === "cpf") return "CPF"
  if (keyType === "cnpj") return "CNPJ"
  return "Chave aleatória"
}

export function buildReminderPixPayload(input: {
  key: string
  keyType?: ReminderPixKeyType | null
  receiverName: string
  amountBrl?: number
  amountLabel?: string
  merchantCity?: string
  pixDescription?: string | null
  pixTxid?: string | null
}): ReminderPixPayload | null {
  const key = input.key?.trim()
  if (!key) return null

  const keyType = resolvePixKeyType(key, input.keyType)
  const keyOnly = formatPixKeyForDisplay(key, keyType)
  const amountBrl = input.amountBrl ?? 0
  const copiaColaRaw =
    amountBrl > 0
      ? buildStaticPixCopiaCola({
          pixKey: key,
          keyType,
          merchantName: input.receiverName,
          merchantCity: input.merchantCity,
          amountBrl,
          infoAdicional: input.pixDescription ?? undefined,
          txid: input.pixTxid ?? undefined,
        })
      : null
  const copiaCola = copiaColaRaw ? normalizeCopiaColaPayload(copiaColaRaw) : null

  return {
    keyType,
    keyOnly,
    keyTypeLabel: keyTypeLabel(keyType),
    copiaCola,
    receiverName: input.receiverName,
    amountLabel: input.amountLabel,
  }
}

export function appendPixToPlainEmailText(body: string, pix: ReminderPixPayload) {
  const lines = [
    body,
    "",
    "— Pagamento via Pix —",
    `Recebedor: ${pix.receiverName}`,
    pix.amountLabel ? `Valor: ${pix.amountLabel}` : null,
    pix.copiaCola ? "" : null,
    pix.copiaCola ? "Pix copia e cola:" : null,
    pix.copiaCola ? pix.copiaCola : null,
    pix.copiaCola
      ? "Copie a linha inteira no app do banco (Pix → Pix copia e cola → Colar)."
      : "Não foi possível gerar o Pix copia e cola. Entre em contato para pagar.",
  ].filter((line) => line !== null) as string[]
  return lines.join("\n")
}
