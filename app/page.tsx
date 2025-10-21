'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return // Ainda carregando

    if (!session) {
      // Não autenticado, redirecionar para login
      router.push('/auth/signin')
      return
    }

    // Autenticado, redirecionar baseado no papel do usuário
    if (session.user.role === 'ADMIN') {
      router.push('/dashboard')
    } else if (session.user.role === 'TEAM') {
      router.push('/team')
    } else if (session.user.role === 'CLIENT') {
      router.push('/client')
    } else {
      router.push('/auth/signin')
    }
  }, [session, status, router])

  // Mostrar loading enquanto verifica autenticação
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Carregando...</p>
      </div>
    </div>
  )
}
