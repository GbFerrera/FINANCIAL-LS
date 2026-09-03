/** Confirmação esperada: "sim", "yes", "confirmo", etc. */
export function isWorkflowConfirmation(text: string): boolean {
  const normalized = text.trim().toLowerCase()
  return /^(sim|s|yes|y|confirmo|confirmar|ok|pode criar|criar tarefas|pode|manda ver)$/.test(
    normalized
  )
}
