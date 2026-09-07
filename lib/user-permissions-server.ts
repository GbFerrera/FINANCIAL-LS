import { UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getDefaultAllowedPaths } from '@/lib/access-control'
import {
  parseWorkspaceAccess,
  type StoredUserPermissions,
  type WorkspaceAccessConfig,
} from '@/lib/workspace-permissions'

const PATH_ALIASES: Record<string, string> = {
  '/sprints': '/projects/sprints',
  '/tasks': '/projects/backlog',
}

export type UserPermissionsSnapshot = {
  role: UserRole
  allowedPaths: string[]
  commissionsAccess: 'OWN_READ' | 'OWN_EDIT' | 'ALL_EDIT'
  workspaceAccess: WorkspaceAccessConfig
}

function normalizeCommissionsAccess(
  input: string | undefined,
  role: UserRole
): 'OWN_READ' | 'OWN_EDIT' | 'ALL_EDIT' {
  if (!input) return role === UserRole.ADMIN ? 'ALL_EDIT' : 'OWN_READ'
  switch (input) {
    case 'OWN_READ':
    case 'OWN_EDIT':
    case 'ALL_EDIT':
      return input
    case 'OWN':
      return 'OWN_READ'
    case 'ALL':
    case 'EDIT':
      return 'ALL_EDIT'
    default:
      return role === UserRole.ADMIN ? 'ALL_EDIT' : 'OWN_READ'
  }
}

export async function getUserPermissionsSnapshot(
  userId: string
): Promise<UserPermissionsSnapshot | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, skillsInterests: true },
  })

  if (!user) return null

  const stored = (user.skillsInterests as StoredUserPermissions | null) ?? {}
  const storedPaths = Array.isArray(stored.pagePermissions) ? stored.pagePermissions : []
  const hasStoredPermissions = Array.isArray(stored.pagePermissions)
  const defaults = getDefaultAllowedPaths(user.role)
  const allowedRaw = hasStoredPermissions ? storedPaths : defaults
  const allowedPaths = allowedRaw.map((p) => PATH_ALIASES[p] ?? p)

  return {
    role: user.role,
    allowedPaths,
    commissionsAccess: normalizeCommissionsAccess(stored.commissionsAccess, user.role),
    workspaceAccess: parseWorkspaceAccess(stored, user.role),
  }
}

export function isAdminRole(role: UserRole): boolean {
  return role === UserRole.ADMIN
}
