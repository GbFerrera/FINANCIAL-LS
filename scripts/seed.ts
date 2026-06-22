import { PrismaClient, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...')

  const email = process.env.SEED_ADMIN_EMAIL
  const password = process.env.SEED_ADMIN_PASSWORD
  const name = process.env.SEED_ADMIN_NAME || 'Administrador'

  if (!email || !password) {
    throw new Error('SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD devem estar definidos')
  }

  const adminPasswordHash = await bcrypt.hash(password, 12)

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      password: adminPasswordHash,
      role: UserRole.ADMIN,
    },
    create: {
      name,
      email,
      password: adminPasswordHash,
      role: UserRole.ADMIN,
    },
  })

  console.log('✅ Seed concluído com sucesso!')
  console.log('\n📋 Usuário admin criado/garantido:')
  console.log(`👤 ${admin.name} <${admin.email}>`)
}

main()
  .catch((e) => {
    console.error('❌ Erro durante o seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
