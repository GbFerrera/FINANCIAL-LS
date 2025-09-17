const { PrismaClient } = require('@prisma/client')

async function getClientToken() {
  const prisma = new PrismaClient()
  
  try {
    const clients = await prisma.client.findMany({
      select: {
        name: true,
        accessToken: true
      }
    })
    
    console.log('Clientes encontrados:')
    clients.forEach(client => {
      console.log(`- ${client.name}: ${client.accessToken}`)
    })
  } catch (error) {
    console.error('Erro:', error)
  } finally {
    await prisma.$disconnect()
  }
}

getClientToken()