import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Listar relatórios
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Por enquanto, retornamos templates de relatórios disponíveis
    // Em uma implementação real, você buscaria relatórios salvos do banco
    const templates = [
      {
        id: '1',
        name: 'Relatório Financeiro Mensal',
        type: 'financial',
        description: 'Receitas, despesas e lucro líquido do período',
        fields: ['receitas', 'despesas', 'lucro', 'margem']
      },
      {
        id: '2',
        name: 'Status de Projetos',
        type: 'projects',
        description: 'Progresso, orçamento e prazos dos projetos',
        fields: ['nome', 'status', 'progresso', 'orçamento', 'prazo']
      },
      {
        id: '3',
        name: 'Performance da Equipe',
        type: 'team',
        description: 'Produtividade e métricas dos membros da equipe',
        fields: ['nome', 'tarefas_concluídas', 'horas_trabalhadas', 'projetos']
      },
      {
        id: '4',
        name: 'Relatório de Clientes',
        type: 'clients',
        description: 'Informações e histórico dos clientes',
        fields: ['nome', 'empresa', 'projetos', 'valor_total', 'status']
      }
    ]

    // Buscar relatórios gerados (simulado por enquanto)
    const reports: any[] = []

    return NextResponse.json({
      reports,
      templates
    })
  } catch (error) {
    console.error('Erro ao buscar relatórios:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// POST - Gerar novo relatório
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { templateId, name, description, filters } = body

    // Gerar relatório baseado no template e filtros
    const reportData = await generateReportData(templateId, filters, session)
    
    const newReport = {
      id: `report_${Date.now()}`,
      name,
      description,
      templateId,
      status: 'COMPLETED',
      createdBy: session.user.name || 'Usuário',
      createdAt: new Date().toISOString(),
      filters,
      data: reportData,
      downloadUrl: `/api/reports/report_${Date.now()}/download`
    }

    return NextResponse.json({ report: newReport }, { status: 201 })
  } catch (error) {
    console.error('Erro ao gerar relatório:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

async function generateReportData(templateId: string, filters: any, session: any) {
  // Gerar dados reais baseados no template
  switch (templateId) {
    case 'financial':
      const financialEntries = await prisma.financialEntry.findMany({
        orderBy: { date: 'desc' }
      })
      
      const revenue = financialEntries.filter(f => f.type === 'INCOME')
      const expenses = financialEntries.filter(f => f.type === 'EXPENSE')
      
      return {
        totalRevenue: revenue.reduce((sum, r) => sum + r.amount, 0),
        totalExpenses: expenses.reduce((sum, e) => sum + e.amount, 0),
        netProfit: revenue.reduce((sum, r) => sum + r.amount, 0) - expenses.reduce((sum, e) => sum + e.amount, 0),
        entries: financialEntries.map(entry => ({
          date: entry.date.toISOString().split('T')[0],
          amount: entry.amount,
          type: entry.type,
          category: entry.category,
          description: entry.description
        }))
      }
      
    case 'projects':
      const projects = await prisma.project.findMany({
        include: {
          tasks: {
            select: {
              id: true,
              completedAt: true
            }
          }
        }
      })
      
      return {
        totalProjects: projects.length,
        activeProjects: projects.filter(p => p.status === 'IN_PROGRESS').length,
        completedProjects: projects.filter(p => p.status === 'COMPLETED').length,
        projects: projects.map(project => {
          const totalTasks = project.tasks.length
          const completedTasks = project.tasks.filter(t => t.completedAt).length
          const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
          
          return {
            name: project.name,
            status: project.status,
            progress,
            budget: project.budget,
            startDate: project.startDate?.toISOString().split('T')[0],
            endDate: project.endDate?.toISOString().split('T')[0]
          }
        })
      }
      
    case 'clients':
      const clients = await prisma.client.findMany({
        include: {
          projects: {
            select: {
              id: true,
              status: true,
              budget: true
            }
          }
        }
      })
      
      return {
        totalClients: clients.length,
        activeClients: clients.filter(c => c.projects.some(p => p.status === 'IN_PROGRESS')).length,
        clients: clients.map(client => ({
          name: client.name,
          email: client.email,
          totalProjects: client.projects.length,
          activeProjects: client.projects.filter(p => p.status === 'IN_PROGRESS').length,
          totalValue: client.projects.reduce((sum, p) => sum + (p.budget || 0), 0)
        }))
      }
      
    case 'team':
      const users = await prisma.user.findMany()
      const tasks = await prisma.task.findMany({
        select: {
          assigneeId: true,
          completedAt: true
        }
      })
      const projectTeam = await prisma.projectTeam.findMany({
        include: {
          project: {
            select: {
              status: true
            }
          }
        }
      })
      
      return {
        totalMembers: users.length,
        members: users.map(user => {
          const userTasks = tasks.filter(t => t.assigneeId === user.id)
          const userProjects = projectTeam.filter(pt => pt.userId === user.id)
          
          return {
            name: user.name,
            email: user.email,
            tasksCompleted: userTasks.filter(t => t.completedAt).length,
            totalTasks: userTasks.length,
            activeProjects: userProjects.filter(pt => pt.project.status === 'IN_PROGRESS').length
          }
        })
      }
      
    default:
      return {
        message: 'Dados do relatório gerados com sucesso',
        generatedAt: new Date().toISOString(),
        filters: filters
      }
  }
}