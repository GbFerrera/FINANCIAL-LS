/**
 * Cria projeto e sprints MKT na demo OTIMIZE (sem apagar dados).
 * Uso: npx tsx scripts/seed-industrial-mkt-sprints.ts
 */
import { PrismaClient } from '@prisma/client'
import { appendIndustrialMktSprints } from './lib/seed-industrial-mkt'

const prisma = new PrismaClient()

async function main() {
  console.log('\n📣 Sprints Marketing — OTIMIZE\n')
  const result = await appendIndustrialMktSprints(prisma)
  console.log(`\n✅ Projeto MKT: ${result.projectId}`)
  console.log(`   Sprints criadas: ${result.sprintsCreated}`)
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
