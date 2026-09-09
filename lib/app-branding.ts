const DEFAULT_APP_NAME = 'Link System'
const DEFAULT_APP_TAGLINE = 'Software House'

/** Lê branding no servidor (runtime — APP_NAME / APP_TAGLINE no Coolify). */
export function resolveAppBrand() {
  return {
    name:
      process.env.APP_NAME?.trim() ||
      process.env.NEXT_PUBLIC_APP_NAME?.trim() ||
      DEFAULT_APP_NAME,
    tagline:
      process.env.APP_TAGLINE?.trim() ||
      process.env.NEXT_PUBLIC_APP_TAGLINE?.trim() ||
      DEFAULT_APP_TAGLINE,
  }
}
