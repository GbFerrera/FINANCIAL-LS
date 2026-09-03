export type AgentLlmProvider = 'ollama' | 'rules'

export function getAgentLlmConfig() {
  const rawProvider = (process.env.AGENT_LLM_PROVIDER || 'ollama').toLowerCase()
  const provider: AgentLlmProvider = rawProvider === 'rules' ? 'rules' : 'ollama'

  return {
    provider,
    /** Se Ollama falhar, usa pipeline por regras (default: true) */
    fallbackToRules: process.env.AGENT_LLM_FALLBACK !== '0',
    ollama: {
      baseUrl: (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, ''),
      model: process.env.OLLAMA_MODEL || 'llama3.2',
      timeoutMs: Number(process.env.OLLAMA_TIMEOUT_MS || 120_000),
    },
  }
}
