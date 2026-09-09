/** Marketing — OTIMIZE AUTOMAÇÃO INDUSTRIAL */

export const DEMO_MKT_CLIENT = {
  key: 'otimize-interno',
  name: 'Equipe Marketing',
  company: 'OTIMIZE AUTOMACAO INDUSTRIAL',
  email: 'marketing@otimize-automacao.demo',
  phone: '(11) 4000-0000',
}

export const DEMO_MKT_PROJECT = {
  key: 'mkt-otimize',
  clientKey: 'otimize-interno',
  name: '[MKT] OTIMIZE — Automação Industrial',
  description:
    'Campanhas, conteúdo e geração de demanda para serviços de automação industrial.',
  status: 'IN_PROGRESS' as const,
  budget: 48000,
}

export type DemoMktSprint = {
  key: string
  name: string
  description: string
  status: 'PLANNING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
  startDaysAgo?: number
  startDaysFromStart?: number
  endDaysFromStart: number
  goal: string
  capacity: number
  tasks: {
    title: string
    status: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'COMPLETED'
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
    description?: string
  }[]
}

export const DEMO_MKT_SPRINTS: DemoMktSprint[] = [
  {
    key: 'mkt-q1-cases',
    name: '[MKT] Q1 — Cases LinkedIn & Autoridade',
    description: 'Série de posts com cases reais (AçoForte, BomCorte, NorChem).',
    status: 'ACTIVE',
    startDaysAgo: 10,
    endDaysFromStart: 18,
    goal: '12 posts + 3 carrosséis técnicos + 500 leads qualificados',
    capacity: 40,
    tasks: [
      {
        title: 'Carrossel — Retrofit CLP linha laminação',
        status: 'COMPLETED',
        priority: 'HIGH',
        description: 'Antes/depois, ganho OEE, foto planta.',
      },
      {
        title: 'Post LinkedIn — SCADA HACCP BomCorte',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
      },
      {
        title: 'Vídeo 60s — Depoimento cliente NorChem',
        status: 'IN_PROGRESS',
        priority: 'URGENT',
      },
      {
        title: 'Agendar posts semana 3 (Buffer)',
        status: 'TODO',
        priority: 'MEDIUM',
      },
      {
        title: 'Relatório métricas engajamento Q1',
        status: 'TODO',
        priority: 'LOW',
      },
    ],
  },
  {
    key: 'mkt-landing-servicos',
    name: '[MKT] Landing — Serviços OT',
    description: 'Página de conversão: CLP, SCADA, manutenção preventiva.',
    status: 'ACTIVE',
    startDaysAgo: 3,
    endDaysFromStart: 21,
    goal: 'Landing no ar + formulário demo + pixel conversão',
    capacity: 32,
    tasks: [
      {
        title: 'Copy landing — Manutenção Preventiva',
        status: 'IN_REVIEW',
        priority: 'HIGH',
      },
      {
        title: 'Wireframe Figma mobile/desktop',
        status: 'COMPLETED',
        priority: 'MEDIUM',
      },
      {
        title: 'Implementar página no site OTIMIZE',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
      },
      {
        title: 'Configurar GA4 + eventos formulário',
        status: 'TODO',
        priority: 'MEDIUM',
      },
    ],
  },
  {
    key: 'mkt-feira-industrial',
    name: '[MKT] Feira — Automec 2026',
    description: 'Material de stand, brindes técnicos e follow-up pós-feira.',
    status: 'PLANNING',
    startDaysFromStart: 14,
    endDaysFromStart: 45,
    goal: 'Stand + 50 contatos qualificados pós-evento',
    capacity: 56,
    tasks: [
      {
        title: 'Briefing stand 3×3 m',
        status: 'TODO',
        priority: 'HIGH',
      },
      {
        title: 'Folder técnico — Portfólio OTIMIZE',
        status: 'TODO',
        priority: 'MEDIUM',
      },
      {
        title: 'Lista brindes (pen drive com cases PDF)',
        status: 'TODO',
        priority: 'LOW',
      },
      {
        title: 'Script abordagem SDR pós-feira',
        status: 'TODO',
        priority: 'MEDIUM',
      },
    ],
  },
  {
    key: 'mkt-newsletter-mp',
    name: '[MKT] Newsletter — Manutenção Preventiva',
    description: 'Edição mensal educativa para base de clientes MP.',
    status: 'COMPLETED',
    startDaysAgo: 45,
    endDaysFromStart: 14,
    goal: 'Newsletter enviada — taxa abertura > 28%',
    capacity: 24,
    tasks: [
      {
        title: 'Tema: "5 sinais de que seu CLP precisa de upgrade"',
        status: 'COMPLETED',
        priority: 'HIGH',
      },
      {
        title: 'Design email (template OTIMIZE)',
        status: 'COMPLETED',
        priority: 'MEDIUM',
      },
      {
        title: 'Disparo Mailchimp + segmentação MP',
        status: 'COMPLETED',
        priority: 'HIGH',
      },
    ],
  },
]
