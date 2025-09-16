const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  try {
    console.log('Verificando tarefas...')
    
    const tasks = await prisma.task.findMany({
      select: {
        id: true,
        title: true,
        actualHours: true,
        estimatedHours: true,
        status: true
      },
      take: 10
    })
    
    console.log('Tarefas encontradas:', tasks.length)
    
    tasks.forEach(task => {
      console.log(`\nID: ${task.id}`)
      console.log(`Título: ${task.title}`)
      console.log(`Status: ${task.status}`)
      console.log(`Horas Estimadas: ${task.estimatedHours || 'null'}`)
      console.log(`Horas Trabalhadas: ${task.actualHours || 'null'}`)
      console.log('---')
    })
    
    // Verificar time entries
    console.log('\n\nVerificando time entries...')
    const timeEntries = await prisma.timeEntry.findMany({
      select: {
        id: true,
        taskId: true,
        duration: true,
        isActive: true,
        task: {
          select: {
            title: true
          }
        }
      },
      take: 10
    })
    
    console.log('Time entries encontradas:', timeEntries.length)
    timeEntries.forEach(entry => {
      console.log(`\nTask: ${entry.task.title}`)
      console.log(`Duration: ${entry.duration} segundos`)
      console.log(`Active: ${entry.isActive}`)
    })
    
  } catch (error) {
    console.error('Erro:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()