/** Destino padrão após login (ADMIN / TEAM). Safe for client components. */
export const POST_LOGIN_PATH = '/team/office'

export function getPostLoginPath(role: string): string {
  if (role === 'CLIENT') return '/client'
  return POST_LOGIN_PATH
}
