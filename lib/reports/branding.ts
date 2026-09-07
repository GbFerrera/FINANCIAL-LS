import { existsSync } from 'fs'
import { join } from 'path'

export type ReportBranding = {
  name: string
  tagline: string
  siteUrl: string
  logoPath: string | null
}

const LOGO_CANDIDATES = [
  'icon-code-512.png',
  'pwa-icon-512.png',
  'icon-code-192.png',
  'apple-touch-icon.png',
]

export function getReportBranding(): ReportBranding {
  const publicDir = join(process.cwd(), 'public')
  let logoPath: string | null = null

  for (const file of LOGO_CANDIDATES) {
    const candidate = join(publicDir, file)
    if (existsSync(candidate)) {
      logoPath = candidate
      break
    }
  }

  return {
    name: process.env.REPORT_BRAND_NAME?.trim() || 'Link System',
    tagline: process.env.REPORT_BRAND_TAGLINE?.trim() || 'Gestão de projetos e operações',
    siteUrl: process.env.REPORT_BRAND_URL?.trim() || 'projects.linksystem.tech',
    logoPath,
  }
}

export const PDF_THEME = {
  ink: '#18181b',
  muted: '#71717a',
  border: '#e4e4e7',
  surface: '#fafafa',
  stripe: '#f4f4f5',
  headerBg: '#18181b',
  headerText: '#ffffff',
  accent: '#27272a',
} as const

const SUMMARY_LABELS: Record<string, string> = {
  total_receitas: 'Total receitas',
  total_despesas: 'Total despesas',
  lucro_liquido: 'Lucro líquido',
  lancamentos: 'Lançamentos',
  total_projetos: 'Total projetos',
  em_andamento: 'Em andamento',
  concluidos: 'Concluídos',
  total_clientes: 'Total clientes',
  clientes_ativos: 'Clientes ativos',
  membros: 'Membros',
  tarefas_concluidas_total: 'Tarefas concluídas',
}

export function formatSummaryLabel(key: string) {
  return SUMMARY_LABELS[key] ?? key.replace(/_/g, ' ')
}

const TYPE_LABELS: Record<string, string> = {
  financial: 'Financeiro',
  projects: 'Projetos',
  team: 'Equipe',
  clients: 'Clientes',
}

export function formatReportTypeLabel(type: string) {
  return TYPE_LABELS[type] ?? type
}
