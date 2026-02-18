import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(request: NextRequest) {
  // Rotas públicas que não precisam de autenticação
  const publicPaths = [
    '/api/auth/.*',
    '/auth/signin',
    '/auth/error',
    '/login',
    '/register',
    '/api/files/.*', // Permitir acesso a arquivos sem autenticação
    '/client-portal/.*', // Portal do cliente
    '/collaborator-portal/.*', // Portal do colaborador
    '/api/client-portal/.*', // APIs do portal do cliente
    '/api/collaborator-portal/.*', // APIs do portal do colaborador
  ]

  const isPublicPath = publicPaths.some(path => {
    const regex = new RegExp(`^${path}$`)
    return regex.test(request.nextUrl.pathname)
  })

  if (isPublicPath) {
    return NextResponse.next()
  }

  // Verificar token de autenticação
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET
  })

  // Redirecionar para login se não estiver autenticado
  if (!token) {
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }
    
    return NextResponse.redirect(new URL('/auth/signin', request.url))
  }

  return NextResponse.next()
}

// Configurar quais rotas devem passar pelo middleware
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}