'use client'

import { PageLoadingGate } from '@/components/ui/loading-animation'
import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { getPostLoginPath } from '@/lib/post-login'

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

    // Autenticado — escritório 2D por padrão (clientes → portal)
    router.push(getPostLoginPath(session.user.role))
  }, [session, status, router])

  return (
    <PageLoadingGate loading={status === 'loading'}>
      <span className="sr-only">Redirecionando</span>
    </PageLoadingGate>
  )
}
