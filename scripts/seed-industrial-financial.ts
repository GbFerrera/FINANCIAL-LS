/**
 * Popula pagamentos, assinaturas e lançamentos financeiros da demo OTIMIZE.
 * Uso: npx tsx scripts/seed-industrial-financial.ts
 */
import { PrismaClient } from '@prisma/client'
import { seedIndustrialFinancial } from './lib/seed-industrial-financial'

const prisma = new PrismaClient()

async function main() {
  console.log('\n💰 Financeiro — demo OTIMIZE\n')
  const result = await seedIndustrialFinancial(prisma)
  console.log('\n✅ Concluído')
  console.log(`   Assinaturas: ${result.subscriptions}`)
  console.log(`   Pagamentos: ${result.payments}`)
  console.log(`   Lançamentos: ${result.entries}`)
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
