import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { getAgentLlmConfig } from '@/lib/llm/config'
import { checkOllamaHealth } from '@/lib/llm/ollama'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const config = getAgentLlmConfig()

  if (config.provider === 'rules') {
    return NextResponse.json({
      provider: 'rules',
      configured: true,
      ollama: null,
    })
  }

  const health = await checkOllamaHealth()

  return NextResponse.json({
    provider: config.provider,
    configured: true,
    fallbackToRules: config.fallbackToRules,
    ollama: health,
  })
}
