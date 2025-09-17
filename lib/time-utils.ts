/**
 * Calcula o tempo estimado baseado nos campos startTime e endTime
 * Se não houver startTime/endTime, usa estimatedHours como fallback
 */
export function calculateEstimatedTime(task: {
  startTime?: Date | string | null
  endTime?: Date | string | null
  estimatedHours?: number | null
}): number {
  // Se temos startTime e endTime, calcular a diferença
  if (task.startTime && task.endTime) {
    const start = new Date(task.startTime)
    const end = new Date(task.endTime)
    
    // Calcular diferença em horas
    const diffInMs = end.getTime() - start.getTime()
    const diffInHours = diffInMs / (1000 * 60 * 60)
    
    return Math.max(0, diffInHours) // Garantir que não seja negativo
  }
  
  // Fallback para estimatedHours se não tiver startTime/endTime
  return task.estimatedHours || 0
}

/**
 * Formata tempo em horas para exibição
 */
export function formatTime(hours: number): string {
  if (hours >= 1) {
    // Se for número inteiro, mostra só as horas
    if (hours % 1 === 0) {
      return `${hours}h`
    }
    // Se tiver decimais, mostra horas e minutos
    const wholeHours = Math.floor(hours)
    const minutes = Math.round((hours - wholeHours) * 60)
    return minutes > 0 ? `${wholeHours}h ${minutes}min` : `${wholeHours}h`
  } else {
    return `${Math.round(hours * 60)}min`
  }
}

/**
 * Formata tempo estimado para exibição com texto
 */
export function formatEstimatedTime(hours: number): string {
  if (hours >= 1) {
    // Se for número inteiro, mostra só as horas
    if (hours % 1 === 0) {
      return `${hours}h estimadas`
    }
    // Se tiver decimais, mostra horas e minutos
    const wholeHours = Math.floor(hours)
    const minutes = Math.round((hours - wholeHours) * 60)
    return minutes > 0 ? `${wholeHours}h ${minutes}min estimados` : `${wholeHours}h estimadas`
  } else {
    return `${Math.round(hours * 60)}min estimados`
  }
}

/**
 * Formata tempo decorrido em milissegundos para exibição
 */
export function formatElapsedTime(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  } else {
    return `${seconds}s`
  }
}