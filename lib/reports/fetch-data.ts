import { prisma } from '@/lib/prisma'
import { ReportExportRequest, ReportPayload, ReportType } from './types'

function inDateRange(
  date: Date | null | undefined,
  range?: { start?: string; end?: string }
) {
  if (!range?.start && !range?.end) return true
  if (!date) return false
  const ts = date.getTime()
  if (range.start) {
    const start = new Date(range.start)
    start.setHours(0, 0, 0, 0)
    if (ts < start.getTime()) return false
  }
  if (range.end) {
    const end = new Date(range.end)
    end.setHours(23, 59, 59, 999)
    if (ts > end.getTime()) return false
  }
  return true
}

function formatDate(date: Date | null | undefined) {
  if (!date) return ''
  return date.toISOString().split('T')[0]
}

function formatCurrency(value: number | null | undefined) {
  if (value == null) return ''
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export async function fetchReportPayload(
  type: ReportType,
  generatedBy: string,
  options: Pick<ReportExportRequest, 'dateRange' | 'filters'>
): Promise<ReportPayload> {
  const generatedAt = new Date().toISOString()

  switch (type) {
    case 'financial':
      return fetchFinancialReport(generatedBy, generatedAt, options)
    case 'projects':
      return fetchProjectsReport(generatedBy, generatedAt, options)
    case 'clients':
      return fetchClientsReport(generatedBy, generatedAt, options)
    case 'team':
      return fetchTeamReport(generatedBy, generatedAt, options)
  }
}

async function fetchFinancialReport(
  generatedBy: string,
  generatedAt: string,
  options: Pick<ReportExportRequest, 'dateRange' | 'filters'>
): Promise<ReportPayload> {
  const entries = await prisma.financialEntry.findMany({
    include: { project: { select: { name: true } } },
    orderBy: { date: 'desc' },
  })

  const filtered = entries.filter((e) => inDateRange(e.date, options.dateRange))

  const rows = filtered.map((entry) => ({
    data: formatDate(entry.date),
    tipo: entry.type === 'INCOME' ? 'Receita' : 'Despesa',
    categoria: entry.category,
    descricao: entry.description,
    projeto: entry.project?.name ?? '—',
    valor: entry.amount,
    valor_formatado: formatCurrency(entry.amount),
  }))

  const totalRevenue = filtered
    .filter((e) => e.type === 'INCOME')
    .reduce((sum, e) => sum + e.amount, 0)
  const totalExpenses = filtered
    .filter((e) => e.type === 'EXPENSE')
    .reduce((sum, e) => sum + e.amount, 0)

  return {
    title: 'Relatório Financeiro',
    type: 'financial',
    generatedAt,
    generatedBy,
    dateRange: options.dateRange,
    columns: [
      { key: 'data', label: 'Data' },
      { key: 'tipo', label: 'Tipo' },
      { key: 'categoria', label: 'Categoria' },
      { key: 'descricao', label: 'Descrição' },
      { key: 'projeto', label: 'Projeto' },
      { key: 'valor_formatado', label: 'Valor' },
    ],
    rows,
    summary: {
      total_receitas: formatCurrency(totalRevenue),
      total_despesas: formatCurrency(totalExpenses),
      lucro_liquido: formatCurrency(totalRevenue - totalExpenses),
      lancamentos: rows.length,
    },
  }
}

async function fetchProjectsReport(
  generatedBy: string,
  generatedAt: string,
  options: Pick<ReportExportRequest, 'dateRange' | 'filters'>
): Promise<ReportPayload> {
  const projects = await prisma.project.findMany({
    include: {
      client: { select: { name: true } },
      tasks: { select: { id: true, completedAt: true } },
      team: { include: { user: { select: { name: true } } } },
      financials: { select: { amount: true, type: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  let filtered = projects.filter((p) =>
    inDateRange(p.startDate, options.dateRange)
  )

  if (options.filters?.status) {
    filtered = filtered.filter((p) => p.status === options.filters!.status)
  }

  const rows = filtered.map((project) => {
    const totalTasks = project.tasks.length
    const completedTasks = project.tasks.filter((t) => t.completedAt).length
    const progress =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
    const spent = project.financials
      .filter((f) => f.type === 'EXPENSE')
      .reduce((sum, f) => sum + f.amount, 0)

    return {
      nome: project.name,
      cliente: project.client?.name ?? '—',
      status: project.status,
      progresso: `${progress}%`,
      orcamento: formatCurrency(project.budget),
      gasto: formatCurrency(spent),
      inicio: formatDate(project.startDate),
      fim: formatDate(project.endDate),
      tarefas: `${completedTasks}/${totalTasks}`,
      equipe: project.team.map((t) => t.user.name).join(', ') || '—',
    }
  })

  return {
    title: 'Relatório de Projetos',
    type: 'projects',
    generatedAt,
    generatedBy,
    dateRange: options.dateRange,
    columns: [
      { key: 'nome', label: 'Projeto' },
      { key: 'cliente', label: 'Cliente' },
      { key: 'status', label: 'Status' },
      { key: 'progresso', label: 'Progresso' },
      { key: 'orcamento', label: 'Orçamento' },
      { key: 'gasto', label: 'Gasto' },
      { key: 'inicio', label: 'Início' },
      { key: 'fim', label: 'Fim' },
      { key: 'tarefas', label: 'Tarefas' },
      { key: 'equipe', label: 'Equipe' },
    ],
    rows,
    summary: {
      total_projetos: rows.length,
      em_andamento: filtered.filter((p) => p.status === 'IN_PROGRESS').length,
      concluidos: filtered.filter((p) => p.status === 'COMPLETED').length,
    },
  }
}

async function fetchClientsReport(
  generatedBy: string,
  generatedAt: string,
  options: Pick<ReportExportRequest, 'dateRange' | 'filters'>
): Promise<ReportPayload> {
  const clients = await prisma.client.findMany({
    include: {
      projects: {
        select: { id: true, status: true, budget: true, startDate: true },
      },
    },
    orderBy: { name: 'asc' },
  })

  let filtered = clients
  if (options.dateRange?.start || options.dateRange?.end) {
    filtered = clients.filter((client) =>
      client.projects.some((p) => inDateRange(p.startDate, options.dateRange))
    )
  }

  const rows = filtered.map((client) => {
    const activeProjects = client.projects.filter(
      (p) => p.status === 'IN_PROGRESS'
    ).length
    const totalValue = client.projects.reduce(
      (sum, p) => sum + (p.budget || 0),
      0
    )

    return {
      nome: client.name,
      email: client.email ?? '—',
      telefone: client.phone ?? '—',
      projetos_ativos: activeProjects,
      total_projetos: client.projects.length,
      valor_total: formatCurrency(totalValue),
      status: activeProjects > 0 ? 'Ativo' : 'Inativo',
    }
  })

  return {
    title: 'Relatório de Clientes',
    type: 'clients',
    generatedAt,
    generatedBy,
    dateRange: options.dateRange,
    columns: [
      { key: 'nome', label: 'Cliente' },
      { key: 'email', label: 'E-mail' },
      { key: 'telefone', label: 'Telefone' },
      { key: 'projetos_ativos', label: 'Projetos ativos' },
      { key: 'total_projetos', label: 'Total projetos' },
      { key: 'valor_total', label: 'Valor total' },
      { key: 'status', label: 'Status' },
    ],
    rows,
    summary: {
      total_clientes: rows.length,
      clientes_ativos: rows.filter((r) => r.status === 'Ativo').length,
    },
  }
}

async function fetchTeamReport(
  generatedBy: string,
  generatedAt: string,
  options: Pick<ReportExportRequest, 'dateRange' | 'filters'>
): Promise<ReportPayload> {
  const [users, tasks, projectTeam, timerEvents] = await Promise.all([
    prisma.user.findMany({
      where: { role: { not: 'CLIENT' } },
      orderBy: { name: 'asc' },
    }),
    prisma.task.findMany({
      select: { assigneeId: true, completedAt: true, createdAt: true },
    }),
    prisma.projectTeam.findMany({
      include: { project: { select: { status: true, name: true } } },
    }),
    prisma.timerEvent.findMany({
      where: { type: 'TIMER_STOP' },
      select: { userId: true, duration: true, timestamp: true },
    }),
  ])

  const rows = users.map((user) => {
    const userTasks = tasks.filter((t) => t.assigneeId === user.id)
    const completedTasks = userTasks.filter((t) => t.completedAt)
    const userProjects = projectTeam.filter((pt) => pt.userId === user.id)
    const userTimerEvents = timerEvents.filter(
      (e) =>
        e.userId === user.id && inDateRange(e.timestamp, options.dateRange)
    )
    const totalMinutes = userTimerEvents.reduce(
      (sum, e) => sum + (e.duration ?? 0),
      0
    )
    const hours = Math.round((totalMinutes / 60) * 10) / 10

    return {
      nome: user.name ?? '—',
      email: user.email ?? '—',
      cargo: user.role,
      tarefas_concluidas: completedTasks.length,
      total_tarefas: userTasks.length,
      projetos_ativos: userProjects.filter(
        (pt) => pt.project.status === 'IN_PROGRESS'
      ).length,
      horas_registradas: hours,
    }
  })

  return {
    title: 'Relatório de Equipe',
    type: 'team',
    generatedAt,
    generatedBy,
    dateRange: options.dateRange,
    columns: [
      { key: 'nome', label: 'Nome' },
      { key: 'email', label: 'E-mail' },
      { key: 'cargo', label: 'Cargo' },
      { key: 'tarefas_concluidas', label: 'Tarefas concluídas' },
      { key: 'total_tarefas', label: 'Total tarefas' },
      { key: 'projetos_ativos', label: 'Projetos ativos' },
      { key: 'horas_registradas', label: 'Horas (timer)' },
    ],
    rows,
    summary: {
      membros: rows.length,
      tarefas_concluidas_total: rows.reduce(
        (sum, r) => sum + Number(r.tarefas_concluidas),
        0
      ),
    },
  }
}
