import { PrismaClient, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function createAdmin() {
  console.log('👤 Criando usuário administrador...')

  try {
    // Hash da senha
    const hashedPassword = await bcrypt.hash('123456', 12)

    // Criar usuário admin
    const admin = await prisma.user.upsert({
      where: { email: 'gabriel@gmail.com' },
      update: {
        name: 'Gabriel Admin',
        password: hashedPassword,
        role: UserRole.ADMIN,
      },
      create: {
        name: 'Gabriel Admin',
        email: 'gabriel@gmail.com',
        password: hashedPassword,
        role: UserRole.ADMIN,
      },
    })

    console.log('✅ Usuário admin criado com sucesso!')
    console.log(`📧 Email: ${admin.email}`)
    console.log(`👤 Nome: ${admin.name}`)
    console.log(`🔑 Role: ${admin.role}`)
    console.log(`🆔 ID: ${admin.id}`)
    
  } catch (error) {
    console.error('❌ Erro ao criar usuário admin:', error)
    throw error
  }
}

createAdmin()
  .catch((e) => {
    console.error('❌ Erro durante a criação do admin:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })