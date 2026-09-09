/**
 * Popula rascunhos (DRAFT) em cada espaço de trabalho da demo OTIMIZE.
 * Uso: npx tsx scripts/seed-industrial-workspace-drafts.ts
 */
import { PrismaClient } from '@prisma/client'
import { seedIndustrialWorkspaceDrafts } from './lib/seed-industrial-drafts'

const prisma = new PrismaClient()

async function main() {
  console.log('\n📝 Rascunhos — espaços OTIMIZE\n')
  const result = await seedIndustrialWorkspaceDrafts(prisma)
  console.log('\n✅ Concluído')
  console.log(`   Espaços: ${result.workspaces}`)
  console.log(`   Rascunhos: ${result.drafts}`)
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
