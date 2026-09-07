import { UserRole } from '@prisma/client'
import { isPathAllowed } from '@/lib/access-control'

export type WorkspaceAccessConfig = {
  /** null = todos os espaços; array vazio = nenhum específico */
  workspaceIds: string[] | null
  canCreateWorkspaces: boolean
}

export type StoredUserPermissions = {
  pagePermissions?: string[]
  commissionsAccess?: string
  workspaceAccess?: Partial<WorkspaceAccessConfig>
}

const WORKSPACE_PATH = '/workspace'
const WORKSPACE_SETTINGS_PATH = '/settings/workspaces'

export function getDefaultWorkspaceAccess(role: UserRole): WorkspaceAccessConfig {
  if (role === UserRole.ADMIN) {
    return { workspaceIds: null, canCreateWorkspaces: true }
  }
  if (role === UserRole.TEAM) {
    return { workspaceIds: null, canCreateWorkspaces: false }
  }
  return { workspaceIds: [], canCreateWorkspaces: false }
}

export function parseWorkspaceAccess(
  stored: StoredUserPermissions | null | undefined,
  role: UserRole
): WorkspaceAccessConfig {
  const defaults = getDefaultWorkspaceAccess(role)
  const raw = stored?.workspaceAccess
  if (!raw || typeof raw !== 'object') return defaults

  const workspaceIds = Array.isArray(raw.workspaceIds)
    ? raw.workspaceIds.filter((id): id is string => typeof id === 'string')
    : raw.workspaceIds === null
      ? null
      : defaults.workspaceIds

  return {
    workspaceIds,
    canCreateWorkspaces:
      typeof raw.canCreateWorkspaces === 'boolean'
        ? raw.canCreateWorkspaces
        : defaults.canCreateWorkspaces,
  }
}

export function hasWorkspaceFeatureAccess(
  allowedPaths: string[] | null | undefined,
  isAdmin = false
): boolean {
  if (isAdmin) return true
  if (!allowedPaths) return false
  return isPathAllowed(WORKSPACE_PATH, allowedPaths)
}

export function canManageWorkspaces(
  workspaceAccess: WorkspaceAccessConfig,
  isAdmin = false
): boolean {
  if (isAdmin) return true
  return workspaceAccess.canCreateWorkspaces
}

export function filterWorkspacesForUser<T extends { id: string }>(
  workspaces: T[],
  workspaceAccess: WorkspaceAccessConfig,
  isAdmin = false
): T[] {
  if (isAdmin || workspaceAccess.workspaceIds === null) return workspaces
  const allowed = new Set(workspaceAccess.workspaceIds)
  return workspaces.filter((w) => allowed.has(w.id))
}

export function canAccessWorkspaceById(
  workspaceId: string,
  workspaceAccess: WorkspaceAccessConfig,
  isAdmin = false
): boolean {
  if (isAdmin || workspaceAccess.workspaceIds === null) return true
  return workspaceAccess.workspaceIds.includes(workspaceId)
}

export function syncWorkspacePaths(
  allowedPaths: string[],
  workspaceEnabled: boolean,
  canCreate: boolean
): string[] {
  const set = new Set(allowedPaths.filter((p) => p !== WORKSPACE_PATH && p !== WORKSPACE_SETTINGS_PATH))
  if (workspaceEnabled) {
    set.add(WORKSPACE_PATH)
    if (canCreate) set.add(WORKSPACE_SETTINGS_PATH)
  }
  return Array.from(set)
}

export function isWorkspaceFeatureEnabled(allowedPaths: string[]): boolean {
  return isPathAllowed(WORKSPACE_PATH, allowedPaths)
}

export { WORKSPACE_PATH, WORKSPACE_SETTINGS_PATH }
