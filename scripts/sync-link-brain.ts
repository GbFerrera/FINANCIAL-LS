/**
 * Sincroniza o vault Obsidian Link Brain com os dados do PM.
 *
 * Uso:
 *   npx tsx scripts/sync-link-brain.ts              # dry-run
 *   npx tsx scripts/sync-link-brain.ts --apply      # grava arquivos
 *   npx tsx scripts/sync-link-brain.ts --apply --push  # grava + git push
 *
 * Env:
 *   OBSIDIAN_VAULT_PATH ou LINK_BRAIN_VAULT_PATH
 *   DATABASE_URL  (use produção em prod; local com teste sobrescreve o vault!)
 */
import { PrismaClient } from "@prisma/client"
import { syncLinkBrainVault, getVaultPathFromEnv } from "../lib/link-brain-sync"

const prisma = new PrismaClient()
const args = process.argv.slice(2)
const apply = args.includes("--apply")
const gitPush = args.includes("--push")

async function main() {
  const vaultPath = getVaultPathFromEnv()
  if (!vaultPath) {
    console.error("❌ Defina OBSIDIAN_VAULT_PATH ou LINK_BRAIN_VAULT_PATH")
    process.exit(1)
  }

  console.log(apply ? "🔧 APPLY — gravando no vault\n" : "👀 dry-run\n")
  console.log(`Vault: ${vaultPath}\n`)

  const result = await syncLinkBrainVault(prisma, {
    vaultPath,
    dryRun: !apply,
    gitPush: apply && gitPush,
  })

  console.log(JSON.stringify(result, null, 2))

  if (!result.ok && result.skipped) {
    process.exit(1)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
