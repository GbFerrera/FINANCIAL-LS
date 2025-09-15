import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    // Find client by access token
    const client = await prisma.client.findUnique({
      where: { accessToken: params.token },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        company: true
      }
    })

    if (!client) {
      return NextResponse.json(
        { error: 'Token inválido ou expirado' },
        { status: 404 }
      )
    }

    // Get client's projects with related data
    const projects = await prisma.project.findMany({
      where: { clientId: client.id },
      include: {
        milestones: {
          select: {
            id: true,
            name: true,
            status: true,
            dueDate: true,
            completedAt: true
          },
          orderBy: {
            order: 'asc'
          }
        },
        tasks: {
          select: {
            id: true,
            title: true,
            status: true,
            dueDate: true,
            completedAt: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        files: {
          select: {
            id: true,
            filename: true,
            originalName: true,
            size: true,
            url: true,
            createdAt: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        comments: {
          where: {
            OR: [
              { type: 'CLIENT_VISIBLE' },
              { type: 'CLIENT_REQUEST' },
              { clientId: client.id }
            ]
          },
          include: {
            author: {
              select: {
                name: true
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        },
        financials: {
          select: {
            id: true,
            type: true,
            description: true,
            amount: true,
            date: true,
            createdAt: true
          },
          orderBy: {
            date: 'desc'
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Transform projects data
    const transformedProjects = projects.map(project => {
      const completedMilestones = project.milestones.filter(m => m.completedAt).length
      const completedTasks = project.tasks.filter(t => t.status === 'COMPLETED').length
      
      // Calculate progress based on milestones and tasks
      const milestoneProgress = project.milestones.length > 0 
        ? (completedMilestones / project.milestones.length) * 0.7 // 70% weight for milestones
        : 0
      
      const taskProgress = project.tasks.length > 0 
        ? (completedTasks / project.tasks.length) * 0.3 // 30% weight for tasks
        : 0
      
      const progress = Math.round((milestoneProgress + taskProgress) * 100)

      return {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        startDate: project.startDate.toISOString(),
        endDate: project.endDate?.toISOString() || null,
        budget: project.budget || 0,
        progress,
        milestones: project.milestones.map(milestone => ({
          id: milestone.id,
          title: milestone.name,
          status: milestone.status,
          dueDate: milestone.dueDate?.toISOString() || null,
          completedAt: milestone.completedAt?.toISOString() || null
        })),
        tasks: project.tasks.map(task => ({
          id: task.id,
          title: task.title,
          status: task.status,
          dueDate: task.dueDate?.toISOString() || null,
          completedAt: task.completedAt?.toISOString() || null
        })),
        files: project.files.map(file => ({
          id: file.id,
          filename: file.filename,
          originalName: file.originalName,
          size: file.size,
          url: file.url,
          createdAt: file.createdAt.toISOString()
        })),
        comments: project.comments.map(comment => ({
          id: comment.id,
          content: comment.content,
          type: comment.type,
          createdAt: comment.createdAt.toISOString(),
          authorName: comment.author?.name || null
        })),
        financialEntries: project.financials.map(financial => ({
          id: financial.id,
          type: financial.type,
          amount: financial.amount,
          description: financial.description,
          date: financial.date.toISOString(),
          createdAt: financial.createdAt.toISOString()
        }))
      }
    })

    return NextResponse.json({
      client,
      projects: transformedProjects
    })
  } catch (error) {
    console.error('Erro ao buscar dados do portal do cliente:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}