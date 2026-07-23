import { evolutionSendText } from "./evolution-api"
import type { ReminderPixKeyType } from "./pix-key"
import type { ReminderPixPayload } from "./pix-copia-cola"
import { buildReminderPixPayload } from "./pix-copia-cola"

export type { ReminderPixKeyType } from "./pix-key"
export { normalizePixKeyType, inferPixKeyType, resolvePixKeyType } from "./pix-key"

export type ReminderWhatsAppPixConfig = {
  enabled: boolean
  key: string
  keyType: ReminderPixKeyType
  receiverName: string
  buttonLabel: string
  amountLabel?: string
  amountBrl?: number
  merchantCity?: string
  pixDescription?: string | null
  pixTxid?: string | null
}

function buildPixIntroBlock(pix: ReminderPixPayload) {
  return [
    "",
    "💳 *Pagamento via Pix*",
    `Recebedor: ${pix.receiverName}`,
    pix.amountLabel ? `Valor: ${pix.amountLabel}` : null,
    "",
    "_Na próxima mensagem enviamos só o Pix copia e cola — copie a linha inteira no app do banco._",
  ]
    .filter(Boolean)
    .join("\n")
}

/**
 * 1ª mensagem: lembrete + instrução Pix.
 * 2ª mensagem: somente o copia e cola (sem chave separada).
 */
export async function sendSubscriptionReminderWhatsApp(input: {
  instanceName: string
  phone: string
  subject: string
  body: string
  footer?: string
  pix?: ReminderWhatsAppPixConfig | null
  pauseSeconds?: number
}) {
  const baseText = `${input.subject}\n\n${input.body}`
  const pixConfig = input.pix?.enabled && input.pix.key.trim() ? input.pix : null

  if (!pixConfig) {
    await evolutionSendText(input.instanceName, input.phone, baseText)
    return { mode: "text" as const }
  }

  const payload = buildReminderPixPayload({
    key: pixConfig.key,
    keyType: pixConfig.keyType,
    receiverName: pixConfig.receiverName,
    amountBrl: pixConfig.amountBrl,
    amountLabel: pixConfig.amountLabel,
    merchantCity: pixConfig.merchantCity,
    pixDescription: pixConfig.pixDescription,
    pixTxid: pixConfig.pixTxid,
  })

  if (!payload) {
    await evolutionSendText(input.instanceName, input.phone, baseText)
    return { mode: "text" as const }
  }

  await evolutionSendText(input.instanceName, input.phone, `${baseText}${buildPixIntroBlock(payload)}`)

  const pause = Math.min(45, Math.max(1, input.pauseSeconds ?? 2))

  if (payload.copiaCola) {
    await new Promise((r) => setTimeout(r, pause * 1000))
    await evolutionSendText(input.instanceName, input.phone, payload.copiaCola)
    return { mode: "text_then_copia" as const, keyType: payload.keyType, copiaCola: true }
  }

  await new Promise((r) => setTimeout(r, pause * 1000))
  await evolutionSendText(
    input.instanceName,
    input.phone,
    payload.keyOnly + "\n\n_(Copia e cola indisponível — use a chave acima no Pix.)_"
  )
  return { mode: "text_then_key_fallback" as const, keyType: payload.keyType, copiaCola: false }
}
