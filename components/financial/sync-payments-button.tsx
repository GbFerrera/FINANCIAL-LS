'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw, Loader2 } from 'lucide-react'

interface SyncResult {
  syncedCount: number
  message: string
  results: Array<{
    paymentId: string
    financialEntryId: string
    amount: number
    date: string
  }>
}

export function SyncPaymentsButton() {
  const [isLoading, setIsLoading] = useState(false)

  const handleSync = async () => {
    setIsLoading(true)
    
    try {
      const response = await fetch('/api/payments/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Erro ao sincronizar pagamentos')
      }

      const result: SyncResult = await response.json()
      
      if (result.syncedCount > 0) {
        alert(`${result.syncedCount} pagamentos sincronizados com sucesso!`)
      } else {
        alert('Todos os pagamentos já estão sincronizados')
      }

      // Recarregar a página para mostrar os dados atualizados
      window.location.reload()
      
    } catch (error) {
      console.error('Erro ao sincronizar:', error)
      alert('Erro ao sincronizar pagamentos')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      onClick={handleSync}
      disabled={isLoading}
      variant="outline"
      size="sm"
      className="gap-2"
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <RefreshCw className="h-4 w-4" />
      )}
      {isLoading ? 'Sincronizando...' : 'Sincronizar Pagamentos'}
    </Button>
  )
}