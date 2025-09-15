import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { 
      type, // 'projects', 'tasks', 'clients', 'financial', 'time_tracking'
      format, // 'json', 'csv', 'xlsx', 'pdf'
      dateRange,
      filters
    } = body

    if (!type || !format) {
      return NextResponse.json(
        { error: 'Tipo de relatório e formato são obrigatórios' },
        { status: 400 }
      )
    }

    // Validar tipos e formatos
    const validTypes = ['projects', 'tasks', 'clients', 'financial', 'time_tracking']
    const validFormats = ['json', 'csv', 'xlsx', 'pdf']
    
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Tipo de relatório inválido' },
        { status: 400 }
      )
    }

    if (!validFormats.includes(format)) {
      return NextResponse.json(
        { error: 'Formato de exportação inválido' },
        { status: 400 }
      )
    }

    // Buscar dados reais do banco baseado no tipo de relatório
    let reportData: any = {}
    let filename = ''
    
    switch (type) {
      case 'projects':
        const projects = await prisma.project.findMany({
          include: {
            client: {
              select: { name: true }
            },
            tasks: {
              select: {
                id: true,
                completedAt: true
              }
            },
            team: {
              include: {
                user: {
                  select: { name: true }
                }
              }
            },
            financials: {
              select: {
                amount: true,
                type: true
              }
            }
          }
        })
        
        const projectsData = projects.map(project => {
          const totalTasks = project.tasks.length
          const completedTasks = project.tasks.filter(t => t.completedAt).length
          const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
          const spent = project.financials.filter(f => f.type === 'EXPENSE').reduce((sum, f) => sum + f.amount, 0)
          
          return {
            id: project.id,
            name: project.name,
            client: project.client?.name || 'N/A',
            status: project.status,
            progress,
            budget: project.budget,
            spent,
            startDate: project.startDate?.toISOString().split('T')[0],
            endDate: project.endDate?.toISOString().split('T')[0],
            team: project.team.map(t => t.user.name),
            tasksCompleted: completedTasks,
            totalTasks
          }
        })
        
        reportData = {
          title: 'Relatório de Projetos',
          generatedAt: new Date().toISOString(),
          generatedBy: session.user.name,
          data: projectsData,
          summary: {
            totalProjects: projects.length,
            activeProjects: projects.filter(p => p.status === 'IN_PROGRESS').length,
            completedProjects: projects.filter(p => p.status === 'COMPLETED').length,
            totalBudget: projects.reduce((sum, p) => sum + (p.budget || 0), 0),
            totalSpent: projects.reduce((sum, p) => {
              const spent = p.financials.filter(f => f.type === 'EXPENSE').reduce((s, f) => s + f.amount, 0)
              return sum + spent
            }, 0)
          }
        }
        filename = `projetos_${new Date().toISOString().split('T')[0]}`
        break

      case 'tasks':
        const tasks = await prisma.task.findMany({
          include: {
            project: {
              select: { name: true }
            },
            assignee: {
              select: { name: true }
            }
          }
        })
        
        const tasksData = tasks.map(task => ({
          id: task.id,
          title: task.title,
          project: task.project?.name || 'N/A',
          assignee: task.assignee?.name || 'Não atribuído',
          status: task.status,
          priority: task.priority,
          dueDate: task.dueDate?.toISOString().split('T')[0],
          completedAt: task.completedAt?.toISOString().split('T')[0],
          estimatedHours: task.estimatedHours,
          actualHours: task.actualHours
        }))
        
        reportData = {
          title: 'Relatório de Tarefas',
          generatedAt: new Date().toISOString(),
          generatedBy: session.user.name,
          data: tasksData,
          summary: {
            totalTasks: tasks.length,
            completedTasks: tasks.filter(t => t.completedAt).length,
            inProgressTasks: tasks.filter(t => t.status === 'IN_PROGRESS').length,
            overdueTasks: tasks.filter(t => t.dueDate && t.dueDate < new Date() && !t.completedAt).length,
            totalEstimatedHours: tasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0),
            totalActualHours: tasks.reduce((sum, t) => sum + (t.actualHours || 0), 0)
          }
        }
        filename = `tarefas_${new Date().toISOString().split('T')[0]}`
        break

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
        
        const clientsData = clients.map(client => ({
          id: client.id,
          name: client.name,
          email: client.email,
          phone: client.phone,
          activeProjects: client.projects.filter(p => p.status === 'IN_PROGRESS').length,
          totalProjects: client.projects.length,
          totalInvested: client.projects.reduce((sum, p) => sum + (p.budget || 0), 0),
          lastContact: client.updatedAt.toISOString().split('T')[0],
          status: client.projects.some(p => p.status === 'IN_PROGRESS') ? 'ATIVO' : 'INATIVO'
        }))
        
        reportData = {
          title: 'Relatório de Clientes',
          generatedAt: new Date().toISOString(),
          generatedBy: session.user.name,
          data: clientsData,
          summary: {
            totalClients: clients.length,
            activeClients: clients.filter(c => c.projects.some(p => p.status === 'IN_PROGRESS')).length,
            inactiveClients: clients.filter(c => !c.projects.some(p => p.status === 'IN_PROGRESS')).length,
            totalRevenue: clients.reduce((sum, c) => sum + c.projects.reduce((s, p) => s + (p.budget || 0), 0), 0)
          }
        }
        filename = `clientes_${new Date().toISOString().split('T')[0]}`
        break

      case 'financial':
        const financialEntries = await prisma.financialEntry.findMany({
          include: {
            project: {
              select: { name: true }
            }
          },
          orderBy: { date: 'desc' }
        })
        
        const revenue = financialEntries.filter(f => f.type === 'INCOME')
        const expenses = financialEntries.filter(f => f.type === 'EXPENSE')
        
        reportData = {
          title: 'Relatório Financeiro',
          generatedAt: new Date().toISOString(),
          generatedBy: session.user.name,
          data: {
            revenue: revenue.map(r => ({
              date: r.date.toISOString().split('T')[0],
              value: r.amount,
              project: r.project?.name || 'N/A',
              description: r.description
            })),
            expenses: expenses.map(e => ({
              date: e.date.toISOString().split('T')[0],
              value: e.amount,
              category: e.category,
              project: e.project?.name || 'N/A',
              description: e.description
            }))
          },
          summary: {
            totalRevenue: revenue.reduce((sum, r) => sum + r.amount, 0),
            totalExpenses: expenses.reduce((sum, e) => sum + e.amount, 0),
            netProfit: revenue.reduce((sum, r) => sum + r.amount, 0) - expenses.reduce((sum, e) => sum + e.amount, 0)
          }
        }
        filename = `financeiro_${new Date().toISOString().split('T')[0]}`
        break

      case 'time_tracking':
        // Time tracking não implementado ainda no banco de dados
        reportData = {
          title: 'Relatório de Controle de Tempo',
          generatedAt: new Date().toISOString(),
          generatedBy: session.user.name,
          data: [],
          summary: {
            totalHours: 0,
            totalEntries: 0,
            uniqueUsers: 0
          }
        }
        filename = `tempo_${new Date().toISOString().split('T')[0]}`
        break
    }

    // Aplicar filtros de data se fornecidos
    if (dateRange && dateRange.start && dateRange.end && reportData.data) {
      const startDate = new Date(dateRange.start)
      const endDate = new Date(dateRange.end)
      
      // Filtrar dados baseado no tipo de relatório e range de datas
      if (type === 'financial' && Array.isArray(reportData.data)) {
        reportData.data = reportData.data.filter((item: any) => {
          const itemDate = new Date(item.date || item.createdAt)
          return itemDate >= startDate && itemDate <= endDate
        })
      }
    }

    if (filters && reportData.data) {
      // Aplicar filtros específicos baseado no tipo
      if (filters.status && Array.isArray(reportData.data)) {
        reportData.data = reportData.data.filter((item: any) => item.status === filters.status)
      }
      if (filters.clientId && Array.isArray(reportData.data)) {
        reportData.data = reportData.data.filter((item: any) => item.clientId === filters.clientId)
      }
    }

    // Gerar arquivo baseado no formato
    let downloadUrl = ''
    let mimeType = ''
    
    switch (format) {
      case 'json':
        downloadUrl = `/api/reports/download/${filename}.json`
        mimeType = 'application/json'
        break
      case 'csv':
        downloadUrl = `/api/reports/download/${filename}.csv`
        mimeType = 'text/csv'
        break
      case 'xlsx':
        downloadUrl = `/api/reports/download/${filename}.xlsx`
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        break
      case 'pdf':
        downloadUrl = `/api/reports/download/${filename}.pdf`
        mimeType = 'application/pdf'
        break
    }

    return NextResponse.json({
      report: {
        id: `report_${Date.now()}`,
        type,
        format,
        filename: `${filename}.${format}`,
        downloadUrl,
        mimeType,
        size: JSON.stringify(reportData).length, // Tamanho simulado
        generatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h
        data: format === 'json' ? reportData : null // Retorna dados apenas para JSON
      },
      message: 'Relatório gerado com sucesso'
    })
  } catch (error) {
    console.error('Erro ao gerar relatório:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}