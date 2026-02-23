import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { calculateBasicProjectProgress } from "@/lib/progress-utils"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json(
        { error: "Não autorizado" },
        { status: 401 }
      )
    }

    // Build where clause based on user role
    let whereClause = {}
    
    if (session.user.role !== "ADMIN") {
      // Team members and clients see only their projects
      whereClause = {
        OR: [
          { clientId: session.user.id },
          { clients: { some: { clientId: session.user.id } } },
          {
            team: {
              some: {
                userId: session.user.id
              }
            }
          }
        ]
      }
    }

    // Fetch projects with related data
    const projects = await prisma.project.findMany({
      where: whereClause,
      include: {
        client: {
          select: {
            id: true,
            name: true
          }
        },
        clients: {
          include: {
            client: {
              select: { id: true, name: true }
            }
          }
        },
        team: {
          select: {
            userId: true
          }
        },
        milestones: {
          select: {
            id: true,
            status: true,
            completedAt: true
          }
        },
        tasks: {
          select: {
            id: true,
            status: true,
            completedAt: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Transform projects for frontend
    const transformedProjects = projects.map(project => {
      const totalMilestones = project.milestones.length
      const completedMilestones = project.milestones.filter(m => m.completedAt || m.status === 'COMPLETED').length
      const totalTasks = project.tasks.length
      const completedTasks = project.tasks.filter(t => {
        if (t.completedAt) return true
        const st = (t.status as unknown as string) || ''
        return st === 'COMPLETED' || st === 'DONE'
      }).length
      
      // Calculate progress using the standardized utility function
      const progress = calculateBasicProjectProgress(
        project.milestones,
        project.tasks
      )

      const partners = (project.clients || [])
        .filter((pc: { client: { id: string; name: string } }) => pc.client && pc.client.id !== project.client.id)
        .map((pc: { client: { id: string; name: string } }) => pc.client.name)

      return {
        id: project.id,
        name: project.name,
        description: project.description ?? '',
        status: project.status,
        startDate: project.startDate.toISOString(),
        endDate: project.endDate?.toISOString() || null,
        budget: project.budget,
        clientName: project.client.name,
        partners,
        teamCount: project.team.length,
        milestonesCount: totalMilestones,
        completedMilestones,
        tasksCount: totalTasks,
        completedTasks,
        progress,
        createdAt: project.createdAt.toISOString()
      }
    })

    // Calculate statistics
    const totalProjects = transformedProjects.length
    const activeProjects = transformedProjects.filter(p => p.status === 'IN_PROGRESS').length
    const completedProjects = transformedProjects.filter(p => p.status === 'COMPLETED').length
    const totalBudget = transformedProjects.reduce((sum, p) => sum + (p.budget || 0), 0)
    const averageProgress = totalProjects > 0 
      ? transformedProjects.reduce((sum, p) => sum + p.progress, 0) / totalProjects 
      : 0

    const stats = {
      totalProjects,
      activeProjects,
      completedProjects,
      totalBudget,
      averageProgress
    }

    return NextResponse.json({
      projects: transformedProjects,
      stats
    })

  } catch (error) {
    console.error('Erro ao buscar projetos:', error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
