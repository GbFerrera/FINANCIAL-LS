import { buildReminderPixPayload, type ReminderPixPayload } from "./pix-copia-cola"
import { normalizePixKeyType } from "./subscription-reminder-whatsapp"

export type ReminderPixFieldSource = {
  includePix?: boolean
  pixKey?: string | null
  pixKeyType?: string | null
  pixReceiverName?: string | null
  pixCity?: string | null
  pixDescription?: string | null
  pixTxid?: string | null
}

export function shouldIncludeReminderPix(source: ReminderPixFieldSource) {
  return Boolean(source.includePix && source.pixKey?.trim())
}

export function buildReminderPixFromFields(
  source: ReminderPixFieldSource,
  input: {
    amountBrl: number
    amountLabel: string
    fallbackReceiverName: string
  }
): ReminderPixPayload | null {
  if (!shouldIncludeReminderPix(source)) return null
  return buildReminderPixPayload({
    key: source.pixKey!.trim(),
    keyType: source.pixKeyType,
    receiverName: source.pixReceiverName?.trim() || input.fallbackReceiverName,
    amountBrl: input.amountBrl,
    amountLabel: input.amountLabel,
    merchantCity: source.pixCity ?? undefined,
    pixDescription: source.pixDescription,
    pixTxid: source.pixTxid,
  })
}

export function buildWhatsAppPixConfigFromFields(
  source: ReminderPixFieldSource,
  input: {
    amountBrl: number
    amountLabel: string
    fallbackReceiverName: string
  }
) {
  if (!shouldIncludeReminderPix(source)) return null
  return {
    enabled: true as const,
    key: source.pixKey!.trim(),
    keyType: normalizePixKeyType(source.pixKeyType),
    receiverName: source.pixReceiverName?.trim() || input.fallbackReceiverName,
    buttonLabel: "Copiar Pix",
    amountLabel: input.amountLabel,
    amountBrl: input.amountBrl,
    merchantCity: source.pixCity ?? undefined,
    pixDescription: source.pixDescription ?? undefined,
    pixTxid: source.pixTxid ?? undefined,
  }
}
