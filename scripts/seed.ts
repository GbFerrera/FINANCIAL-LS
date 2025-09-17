import { PrismaClient, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...')

  // Criar usuários de demonstração
  const adminPassword = await bcrypt.hash('admin123', 12)
  const teamPassword = await bcrypt.hash('dev123', 12)
  const clientPassword = await bcrypt.hash('cliente123', 12)

  // Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@softhouse.com' },
    update: {},
    create: {
      name: 'Administrador',
      email: 'admin@softhouse.com',
      password: adminPassword,
      role: UserRole.ADMIN,
    },
  })

  // Membro da equipe
  const teamMember = await prisma.user.upsert({
    where: { email: 'dev@softhouse.com' },
    update: {},
    create: {
      name: 'João Desenvolvedor',
      email: 'dev@softhouse.com',
      password: teamPassword,
      role: UserRole.TEAM,
    },
  })

  // Cliente de demonstração
  const demoClient = await prisma.client.upsert({
    where: { email: 'cliente@empresa.com' },
    update: {},
    create: {
      name: 'Maria Silva',
      email: 'cliente@empresa.com',
      phone: '(11) 99999-9999',
      company: 'Empresa Demo Ltda',
      accessToken: uuidv4(),
    },
  })

  // Projeto de demonstração
  const demoProject = await prisma.project.upsert({
    where: { id: 'demo-project-1' },
    update: {},
    create: {
      id: 'demo-project-1',
      name: 'Sistema de E-commerce',
      description: 'Desenvolvimento de plataforma de vendas online completa',
      status: 'IN_PROGRESS',
      startDate: new Date('2024-01-15'),
      endDate: new Date('2024-06-15'),
      budget: 50000,
      clientId: demoClient.id,
    },
  })

  // Milestones do projeto
  const milestone1 = await prisma.milestone.create({
    data: {
      name: 'Análise e Planejamento',
      description: 'Levantamento de requisitos e arquitetura do sistema',
      status: 'COMPLETED',
      dueDate: new Date('2024-02-15'),
      completedAt: new Date('2024-02-10'),
      order: 1,
      projectId: demoProject.id,
    },
  })

  const milestone2 = await prisma.milestone.create({
    data: {
      name: 'Desenvolvimento Backend',
      description: 'API REST, banco de dados e autenticação',
      status: 'IN_PROGRESS',
      dueDate: new Date('2024-04-15'),
      order: 2,
      projectId: demoProject.id,
    },
  })

  const milestone3 = await prisma.milestone.create({
    data: {
      name: 'Desenvolvimento Frontend',
      description: 'Interface do usuário e painel administrativo',
      status: 'PENDING',
      dueDate: new Date('2024-05-15'),
      order: 3,
      projectId: demoProject.id,
    },
  })

  // Tarefas
  await prisma.task.createMany({
    data: [
      {
        title: 'Configurar banco de dados',
        description: 'Modelagem e configuração do PostgreSQL',
        status: 'COMPLETED',
        priority: 'HIGH',
        completedAt: new Date('2024-02-05'),
        estimatedHours: 8,
        actualHours: 6,
        projectId: demoProject.id,
        milestoneId: milestone1.id,
        assigneeId: teamMember.id,
      },
      {
        title: 'Implementar autenticação JWT',
        description: 'Sistema de login e controle de sessão',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        dueDate: new Date('2024-03-20'),
        estimatedHours: 12,
        actualHours: 8,
        projectId: demoProject.id,
        milestoneId: milestone2.id,
        assigneeId: teamMember.id,
      },
      {
        title: 'Criar API de produtos',
        description: 'CRUD completo para gerenciamento de produtos',
        status: 'TODO',
        priority: 'MEDIUM',
        dueDate: new Date('2024-04-01'),
        estimatedHours: 16,
        projectId: demoProject.id,
        milestoneId: milestone2.id,
        assigneeId: teamMember.id,
      },
    ],
  })

  // Adicionar membro à equipe do projeto
  await prisma.projectTeam.upsert({
    where: {
      userId_projectId: {
        userId: teamMember.id,
        projectId: demoProject.id,
      }
    },
    update: {},
    create: {
      userId: teamMember.id,
      projectId: demoProject.id,
      role: 'Desenvolvedor Full Stack',
    },
  })

  // Entradas financeiras de demonstração
  await prisma.financialEntry.createMany({
    data: [
      {
        type: 'INCOME',
        category: 'Projeto',
        description: 'Pagamento inicial - Sistema E-commerce',
        amount: 25000,
        date: new Date('2024-01-20'),
        projectId: demoProject.id,
      },
      {
        type: 'EXPENSE',
        category: 'Salários',
        description: 'Salário equipe desenvolvimento',
        amount: 15000,
        date: new Date('2024-02-01'),
        isRecurring: true,
        recurringType: 'MONTHLY',
      },
      {
        type: 'EXPENSE',
        category: 'Infraestrutura',
        description: 'Serviços AWS',
        amount: 500,
        date: new Date('2024-02-01'),
        isRecurring: true,
        recurringType: 'MONTHLY',
      },
    ],
  })

  // Comentários de demonstração
  await prisma.comment.createMany({
    data: [
      {
        content: 'Projeto iniciado com sucesso! Cronograma aprovado pelo cliente.',
        type: 'INTERNAL',
        authorId: admin.id,
        projectId: demoProject.id,
      },
      {
        content: 'Gostaria de adicionar uma funcionalidade de wishlist. É possível?',
        type: 'CLIENT_REQUEST',
        clientId: demoClient.id,
        projectId: demoProject.id,
      },
    ],
  })

  console.log('✅ Seed concluído com sucesso!')
  console.log('\n📋 Usuários criados:')
  console.log('👤 Admin: admin@softhouse.com / admin123')
  console.log('👥 Equipe: dev@softhouse.com / dev123')
  console.log('🏢 Cliente: cliente@empresa.com / cliente123')
  console.log(`\n🔗 Token de acesso do cliente: ${demoClient.accessToken}`)
}

main()
  .catch((e) => {
    console.error('❌ Erro durante o seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })