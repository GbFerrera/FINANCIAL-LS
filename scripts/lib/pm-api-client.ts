/**
 * Cliente HTTP autenticado para projects.linksystem.tech (NextAuth credentials).
 */
export function parseCookies(setCookieHeaders: string[]): Record<string, string> {
  const jar: Record<string, string> = {}
  for (const header of setCookieHeaders) {
    const part = header.split(';')[0]
    const eq = part.indexOf('=')
    if (eq > 0) jar[part.slice(0, eq)] = part.slice(eq + 1)
  }
  return jar
}

export function cookieHeader(jar: Record<string, string>): string {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')
}

export async function loginPm(base: string, email: string, password: string): Promise<string> {
  const jar: Record<string, string> = {}

  const csrfRes = await fetch(`${base}/api/auth/csrf`)
  const csrfJson = (await csrfRes.json()) as { csrfToken: string }
  Object.assign(jar, parseCookies([...(csrfRes.headers.getSetCookie?.() ?? [])]))

  const signInRes = await fetch(`${base}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookieHeader(jar),
    },
    body: new URLSearchParams({
      csrfToken: csrfJson.csrfToken,
      email,
      password,
      redirect: 'false',
      json: 'true',
    }),
    redirect: 'manual',
  })

  Object.assign(jar, parseCookies([...(signInRes.headers.getSetCookie?.() ?? [])]))

  const sessionRes = await fetch(`${base}/api/auth/session`, {
    headers: { Cookie: cookieHeader(jar) },
  })
  const session = (await sessionRes.json()) as { user?: { email?: string } }
  if (!session.user?.email) {
    throw new Error('Login PM falhou — verifique PM_EMAIL e PM_PASSWORD')
  }

  return cookieHeader(jar)
}

export async function pmApi(
  base: string,
  cookies: string,
  path: string,
  init?: RequestInit
): Promise<Response> {
  return fetch(`${base}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookies,
      ...(init?.headers ?? {}),
    },
  })
}

export function pmBase(): string {
  return (process.env.PM_BASE || 'https://projects.linksystem.tech').replace(/\/$/, '')
}

export function requirePmCredentials(): { email: string; password: string } {
  const email = process.env.PM_EMAIL
  const password = process.env.PM_PASSWORD
  if (!email || !password) {
    throw new Error('Defina PM_EMAIL e PM_PASSWORD')
  }
  return { email, password }
}

export async function pmSession(): Promise<{ base: string; cookies: string }> {
  const base = pmBase()
  const { email, password } = requirePmCredentials()
  const cookies = await loginPm(base, email, password)
  return { base, cookies }
}
