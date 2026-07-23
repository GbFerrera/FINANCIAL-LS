export function reminderAppBaseUrl() {
  const fromEnv = process.env.NEXTAUTH_URL?.trim() || process.env.APP_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, "")
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return "http://localhost:3000"
}

/** Página pública com botão de copiar (e-mail não roda JavaScript). */
export function pixKeyCopyPageUrl(keyOnly: string, keyTypeLabel?: string) {
  const v = Buffer.from(keyOnly, "utf8").toString("base64url")
  const params = new URLSearchParams({ v })
  if (keyTypeLabel?.trim()) {
    params.set("t", Buffer.from(keyTypeLabel.trim(), "utf8").toString("base64url"))
  }
  return `${reminderAppBaseUrl()}/pix/copiar-chave?${params.toString()}`
}

export function decodePixCopyPageParam(encoded: string | null | undefined) {
  if (!encoded?.trim()) return null
  try {
    return Buffer.from(encoded, "base64url").toString("utf8")
  } catch {
    return null
  }
}
