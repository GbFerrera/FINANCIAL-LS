/**
 * Adiciona anotações de treinamento na demo existente (sem apagar dados).
 * Uso: npx tsx scripts/seed-industrial-training-notes.ts
 */
import { PrismaClient } from '@prisma/client'
import { appendIndustrialTrainingNotes } from './lib/seed-industrial-notes'

const prisma = new PrismaClient()

async function main() {
  console.log('\n📝 Anotações de treinamento — OTIMIZE\n')
  const result = await appendIndustrialTrainingNotes(prisma)
  console.log(`\n✅ Projetos encontrados: ${result.projectsFound}`)
  console.log(`   Anotações criadas: ${result.notesCreated}`)
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
