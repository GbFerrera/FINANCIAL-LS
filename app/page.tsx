'use client'

import { PageLoadingGate } from '@/components/ui/loading-animation'
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

  return (
    <PageLoadingGate loading={status === 'loading'}>
      <span className="sr-only">Redirecionando</span>
    </PageLoadingGate>
  )
}
