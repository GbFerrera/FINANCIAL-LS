import { getAgentLlmConfig } from './config'

export class OllamaError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message)
    this.name = 'OllamaError'
  }
}

export type OllamaHealth = {
  ok: boolean
  baseUrl: string
  model: string
  models: string[]
  error?: string
}

export async function checkOllamaHealth(): Promise<OllamaHealth> {
  const { ollama } = getAgentLlmConfig()
  try {
    const res = await fetch(`${ollama.baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(5_000),
      cache: 'no-store',
    })
    if (!res.ok) {
      return {
        ok: false,
        baseUrl: ollama.baseUrl,
        model: ollama.model,
        models: [],
        error: `HTTP ${res.status}`,
      }
    }
    const data = (await res.json()) as { models?: { name: string }[] }
    const models = (data.models || []).map((m) => m.name)
    const modelAvailable =
      models.some((name) => name === ollama.model || name.startsWith(`${ollama.model}:`))

    return {
      ok: modelAvailable || models.length > 0,
      baseUrl: ollama.baseUrl,
      model: ollama.model,
      models,
      error: modelAvailable
        ? undefined
        : models.length
          ? `Modelo "${ollama.model}" não encontrado. Disponíveis: ${models.slice(0, 5).join(', ')}`
          : 'Nenhum modelo instalado (ollama pull llama3.2)',
    }
  } catch (e) {
    return {
      ok: false,
      baseUrl: ollama.baseUrl,
      model: ollama.model,
      models: [],
      error: e instanceof Error ? e.message : 'Ollama indisponível',
    }
  }
}

export async function ollamaChat(params: {
  system: string
  user: string
  json?: boolean
}): Promise<string> {
  const { ollama } = getAgentLlmConfig()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ollama.timeoutMs)

  try {
    const res = await fetch(`${ollama.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: ollama.model,
        stream: false,
        format: params.json ? 'json' : undefined,
        messages: [
          { role: 'system', content: params.system },
          { role: 'user', content: params.user },
        ],
      }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new OllamaError(text || `Ollama HTTP ${res.status}`, res.status)
    }

    const data = (await res.json()) as { message?: { content?: string } }
    const content = data.message?.content?.trim()
    if (!content) throw new OllamaError('Resposta vazia do Ollama')
    return content
  } finally {
    clearTimeout(timer)
  }
}
