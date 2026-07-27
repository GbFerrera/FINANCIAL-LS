import { prisma } from "@/lib/prisma"
import {
  isLinkBrainSyncEnabled,
  syncLinkBrainVault,
  getVaultPathFromEnv,
} from "@/lib/link-brain-sync"

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let syncInFlight = false
let syncPending = false

const DEBOUNCE_MS = Number(process.env.LINK_BRAIN_SYNC_DEBOUNCE_MS || 3000)

/**
 * Dispara sync do vault Link Brain após mudanças no PM (debounced).
 * No-op se OBSIDIAN_VAULT_PATH / LINK_BRAIN_VAULT_PATH não estiver configurado.
 */
export function scheduleLinkBrainSync(reason?: string) {
  if (!isLinkBrainSyncEnabled()) return
  if (process.env.NODE_ENV !== "production" && process.env.LINK_BRAIN_SYNC_ALLOW_DEV !== "1") {
    console.log(`[link-brain-sync] skip dev auto-sync${reason ? ` (${reason})` : ""}`)
    return
  }

  if (debounceTimer) clearTimeout(debounceTimer)

  debounceTimer = setTimeout(() => {
    debounceTimer = null
    void runLinkBrainSync(reason)
  }, DEBOUNCE_MS)
}

async function runLinkBrainSync(reason?: string) {
  if (syncInFlight) {
    syncPending = true
    return
  }

  syncInFlight = true
  const vaultPath = getVaultPathFromEnv()!

  try {
    const gitPush = process.env.LINK_BRAIN_GIT_PUSH === "1"
    const result = await syncLinkBrainVault(prisma, {
      vaultPath,
      gitPush,
      gitCommitMessage: reason
        ? `chore(link-brain): sync PM — ${reason}`
        : undefined,
    })
    if (result.ok) {
      console.log(
        `[link-brain-sync] OK — ${result.stats.filesWritten} arquivo(s)${reason ? ` (${reason})` : ""}`
      )
    } else if (result.skipped) {
      console.warn(`[link-brain-sync] skipped: ${result.reason}`)
    }
  } catch (err) {
    console.error("[link-brain-sync] erro:", err)
  } finally {
    syncInFlight = false
    if (syncPending) {
      syncPending = false
      void runLinkBrainSync(reason)
    }
  }
}

/** Sync imediato (API / CLI) */
export async function runLinkBrainSyncNow(options?: {
  dryRun?: boolean
  gitPush?: boolean
  reason?: string
}) {
  const vaultPath = getVaultPathFromEnv()
  if (!vaultPath) {
    return {
      ok: false,
      skipped: true,
      reason: "OBSIDIAN_VAULT_PATH não configurado",
    }
  }

  return syncLinkBrainVault(prisma, {
    vaultPath,
    dryRun: options?.dryRun,
    gitPush: options?.gitPush ?? process.env.LINK_BRAIN_GIT_PUSH === "1",
    gitCommitMessage: options?.reason
      ? `chore(link-brain): sync PM — ${options.reason}`
      : undefined,
  })
}
