import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function cleanDatabase() {
  console.log('🧹 Iniciando limpeza dos dados fictícios...')

  try {
    // Deletar em ordem para respeitar as foreign keys
    console.log('🗑️  Removendo comentários...')
    await prisma.comment.deleteMany({})

    console.log('🗑️  Removendo entradas financeiras...')
    await prisma.financialEntry.deleteMany({})

    console.log('🗑️  Removendo membros da equipe dos projetos...')
    await prisma.projectTeam.deleteMany({})

    console.log('🗑️  Removendo tarefas...')
    await prisma.task.deleteMany({})

    console.log('🗑️  Removendo milestones...')
    await prisma.milestone.deleteMany({})

    console.log('🗑️  Removendo projetos...')
    await prisma.project.deleteMany({})

    console.log('🗑️  Removendo clientes...')
    await prisma.client.deleteMany({})

    console.log('🗑️  Removendo usuários...')
    await prisma.user.deleteMany({})

    console.log('✅ Limpeza concluída com sucesso!')
    console.log('\n🎉 Banco de dados limpo e pronto para uso!')
    console.log('\n💡 Dica: Você pode criar seu primeiro usuário admin através da interface de registro.')
    
  } catch (error) {
    console.error('❌ Erro durante a limpeza:', error)
    throw error
  }
}

cleanDatabase()
  .catch((e) => {
    console.error('❌ Erro durante a limpeza:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })