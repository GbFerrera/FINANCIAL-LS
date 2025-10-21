import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params

    console.log('=== AVAILABLE SPRINTS API ===')
    console.log('Token:', token)

    // Buscar o usuário pelo accessToken
    const user = await prisma.user.findUnique({
      where: { accessToken: token },
      select: { 
        id: true, 
        name: true, 
        email: true,
        role: true
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 404 })
    }

    console.log('Colaborador encontrado:', user.name)

    // Buscar TODAS as sprints ativas e em planejamento
    // (não apenas as que o colaborador já participa)
    const sprints = await prisma.sprint.findMany({
      where: {
        status: {
          in: ['PLANNING', 'ACTIVE']
        }
      },
      select: {
        id: true,
        name: true,
        status: true,
        startDate: true,
        endDate: true,
        description: true
      },
      orderBy: [
        { status: 'asc' }, // ACTIVE primeiro
        { startDate: 'desc' }
      ]
    })

    console.log('Sprints disponíveis encontradas:', sprints.length)
    sprints.forEach(sprint => {
      console.log(`- ${sprint.name} (${sprint.status})`)
    })

    return NextResponse.json({
      collaborator: {
        id: user.id,
        name: user.name,
        email: user.email
      },
      sprints
    })
  } catch (error) {
    console.error('Erro ao buscar sprints disponíveis:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
