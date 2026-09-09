/**
 * Popula chats de comunicação por setor (team/chat) na demo OTIMIZE.
 * Uso: npx tsx scripts/seed-industrial-team-chat.ts
 */
import { PrismaClient } from '@prisma/client'
import { seedIndustrialTeamChat } from './lib/seed-industrial-team-chat'

const prisma = new PrismaClient()

async function main() {
  console.log('\n💬 Team chat — setores OTIMIZE\n')
  const result = await seedIndustrialTeamChat(prisma)
  console.log('\n✅ Concluído')
  console.log(`   Salas: ${result.rooms}`)
  console.log(`   Canais: ${result.channels}`)
  console.log(`   Mensagens: ${result.messages}`)
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
