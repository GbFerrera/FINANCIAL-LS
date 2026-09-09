/**
 * Popula histórico de supervisão (time entries + timer events) na demo OTIMIZE.
 * Uso: npx tsx scripts/seed-industrial-supervisor-history.ts
 */
import { PrismaClient } from '@prisma/client'
import { seedIndustrialSupervisorHistory } from './lib/seed-industrial-supervisor'

const prisma = new PrismaClient()

async function main() {
  console.log('\n👁️ Supervisão — histórico colaboradores OTIMIZE\n')
  const result = await seedIndustrialSupervisorHistory(prisma)
  console.log('\n✅ Concluído')
  console.log(`   Colaboradores: ${result.users}`)
  console.log(`   Time entries: ${result.timeEntries}`)
  console.log(`   Timer events: ${result.timerEvents}`)
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
