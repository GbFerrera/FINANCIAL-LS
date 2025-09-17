const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function createTestData() {
  console.log('🚀 Criando dados de teste adicionais...')

  try {
    // Buscar o cliente existente
    const existingClient = await prisma.client.findFirst({
      where: { email: 'cliente@empresa.com' }
    })

    if (!existingClient) {
      console.log('❌ Cliente não encontrado')
      return
    }

    console.log('✅ Cliente encontrado:', existingClient.name)

    // Criar um novo projeto
    const newProject = await prisma.project.create({
      data: {
        name: 'App Mobile - Delivery',
        description: 'Desenvolvimento de aplicativo mobile para delivery de comida',
        status: 'IN_PROGRESS',
        startDate: new Date('2024-08-01'),
        endDate: new Date('2024-12-31'),
        budget: 45000,
        clientId: existingClient.id
      }
    })

    console.log('✅ Novo projeto criado:', newProject.name)

    // Criar pagamentos
    const payment1 = await prisma.payment.create({
      data: {
        clientId: existingClient.id,
        amount: 15000,
        description: 'Pagamento inicial - App Mobile',
        paymentDate: new Date('2024-08-15'),
        method: 'PIX',
        status: 'COMPLETED'
      }
    })

    const payment2 = await prisma.payment.create({
      data: {
        clientId: existingClient.id,
        amount: 12000,
        description: 'Segunda parcela - App Mobile',
        paymentDate: new Date('2024-09-15'),
        method: 'BANK_TRANSFER',
        status: 'COMPLETED'
      }
    })

    console.log('✅ Pagamentos criados:', payment1.amount, payment2.amount)

    // Criar entradas financeiras correspondentes
    await prisma.financialEntry.create({
      data: {
        type: 'INCOME',
        category: 'Projeto',
        description: 'Pagamento inicial - App Mobile',
        amount: 15000,
        date: new Date('2024-08-15'),
        projectId: newProject.id
      }
    })

    await prisma.financialEntry.create({
      data: {
        type: 'INCOME',
        category: 'Projeto',
        description: 'Segunda parcela - App Mobile',
        amount: 12000,
        date: new Date('2024-09-15'),
        projectId: newProject.id
      }
    })

    // Criar algumas despesas
    await prisma.financialEntry.create({
      data: {
        type: 'EXPENSE',
        category: 'Infraestrutura',
        description: 'Servidor AWS - Setembro',
        amount: 850,
        date: new Date('2024-09-01')
      }
    })

    await prisma.financialEntry.create({
      data: {
        type: 'EXPENSE',
        category: 'Software',
        description: 'Licenças de desenvolvimento',
        amount: 1200,
        date: new Date('2024-09-10')
      }
    })

    console.log('✅ Entradas financeiras criadas')

    // Criar outro cliente
    const newClient = await prisma.client.create({
      data: {
        name: 'João Santos',
        email: 'joao@techstartup.com',
        phone: '(11) 98888-7777',
        company: 'Tech Startup Inc',
        accessToken: require('uuid').v4()
      }
    })

    console.log('✅ Novo cliente criado:', newClient.name)

    // Criar projeto para o novo cliente
    const startupProject = await prisma.project.create({
      data: {
        name: 'Sistema de CRM',
        description: 'Desenvolvimento de sistema de gestão de relacionamento com clientes',
        status: 'PLANNING',
        startDate: new Date('2024-10-01'),
        endDate: new Date('2025-03-31'),
        budget: 35000,
        clientId: newClient.id
      }
    })

    console.log('✅ Projeto para novo cliente criado:', startupProject.name)

    // Criar pagamento para o novo cliente
    const startupPayment = await prisma.payment.create({
      data: {
        clientId: newClient.id,
        amount: 10000,
        description: 'Sinal - Sistema CRM',
        paymentDate: new Date('2024-09-17'),
        method: 'PIX',
        status: 'COMPLETED'
      }
    })

    // Criar entrada financeira correspondente
    await prisma.financialEntry.create({
      data: {
        type: 'INCOME',
        category: 'Projeto',
        description: 'Sinal - Sistema CRM',
        amount: 10000,
        date: new Date('2024-09-17'),
        projectId: startupProject.id
      }
    })

    console.log('✅ Dados de teste criados com sucesso!')
    console.log('📊 Resumo:')
    console.log('- 2 clientes')
    console.log('- 3 projetos')
    console.log('- 4 pagamentos')
    console.log('- 6 entradas financeiras')

  } catch (error) {
    console.error('❌ Erro ao criar dados de teste:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createTestData()