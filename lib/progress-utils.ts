/**
 * Utility functions for calculating project progress
 */

export interface ProgressCalculationData {
  milestones: Array<{
    status?: string
    completedAt?: string | Date | null
  }>
  tasks: Array<{
    status?: string
    completedAt?: string | Date | null
  }>
  financials?: Array<{
    type: string
    amount: number
  }>
}

export interface ProgressWeights {
  milestones: number
  tasks: number
  financials: number
}

/**
 * Default weights for progress calculation
 * Milestones have the highest weight as they represent major deliverables
 * Tasks have medium weight for day-to-day progress
 * Financials have lower weight but still contribute to overall progress
 */
export const DEFAULT_PROGRESS_WEIGHTS: ProgressWeights = {
  milestones: 0.6,  // 60%
  tasks: 0.3,       // 30%
  financials: 0.1   // 10%
}

/**
 * Checks if a milestone is completed
 */
function isMilestoneCompleted(milestone: { status?: string; completedAt?: string | Date | null }): boolean {
  // Check status first (more reliable for our use case)
  if (milestone.status === 'COMPLETED') {
    return true
  }
  // Fallback to completedAt
  return !!milestone.completedAt
}

/**
 * Checks if a task is completed
 */
function isTaskCompleted(task: { status?: string; completedAt?: string | Date | null }): boolean {
  // Check completedAt first (more reliable)
  if (task.completedAt) {
    return true
  }
  // Support both COMPLETED and DONE status
  return task.status === 'COMPLETED' || task.status === 'DONE'
}

/**
 * Calculates financial progress based on income vs expenses
 * This gives an indication of project financial health
 */
function calculateFinancialProgress(financials: Array<{ type: string; amount: number }>): number {
  if (!financials || financials.length === 0) {
    return 0
  }

  const income = financials
    .filter(f => f.type === 'INCOME')
    .reduce((sum, f) => sum + f.amount, 0)
  
  const expenses = financials
    .filter(f => f.type === 'EXPENSE')
    .reduce((sum, f) => sum + f.amount, 0)

  // If no income, progress is 0
  if (income === 0) {
    return 0
  }

  // Financial progress is based on how much of the income has been "utilized"
  // Higher expenses relative to income indicate more project activity
  // But we cap it at 100% to avoid over-weighting
  const utilizationRate = Math.min(expenses / income, 1)
  return utilizationRate * 100
}

/**
 * Calculates overall project progress
 */
export function calculateProjectProgress(
  data: ProgressCalculationData,
  weights: ProgressWeights = DEFAULT_PROGRESS_WEIGHTS
): number {
  let totalProgress = 0
  let totalWeight = 0

  // Calculate milestone progress
  if (data.milestones && data.milestones.length > 0) {
    const completedMilestones = data.milestones.filter(isMilestoneCompleted).length
    const milestoneProgress = (completedMilestones / data.milestones.length) * 100
    totalProgress += milestoneProgress * weights.milestones
    totalWeight += weights.milestones
  }

  // Calculate task progress
  if (data.tasks && data.tasks.length > 0) {
    const completedTasks = data.tasks.filter(isTaskCompleted).length
    const taskProgress = (completedTasks / data.tasks.length) * 100
    totalProgress += taskProgress * weights.tasks
    totalWeight += weights.tasks
  }

  // Calculate financial progress (optional)
  if (data.financials && data.financials.length > 0) {
    const financialProgress = calculateFinancialProgress(data.financials)
    totalProgress += financialProgress * weights.financials
    totalWeight += weights.financials
  }

  // If no components have data, return 0
  if (totalWeight === 0) {
    return 0
  }

  // Normalize by actual weight used (in case some components are missing)
  return Math.round(totalProgress / totalWeight)
}

/**
 * Calculates progress with custom weights
 */
export function calculateProjectProgressWithCustomWeights(
  data: ProgressCalculationData,
  milestoneWeight: number,
  taskWeight: number,
  financialWeight: number = 0
): number {
  const weights: ProgressWeights = {
    milestones: milestoneWeight,
    tasks: taskWeight,
    financials: financialWeight
  }
  
  return calculateProjectProgress(data, weights)
}

/**
 * Legacy function for backward compatibility
 * Calculates progress without financial data
 */
export function calculateBasicProjectProgress(
  milestones: Array<{ status?: string; completedAt?: string | Date | null }>,
  tasks: Array<{ status?: string; completedAt?: string | Date | null }>
): number {
  return calculateProjectProgress({
    milestones,
    tasks
  }, {
    milestones: 0.7,
    tasks: 0.3,
    financials: 0
  })
}