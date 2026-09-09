/** Cenário demo — OTIMIZE AUTOMAÇÃO INDUSTRIAL */

export const DEMO_COMPANY = {
  name: 'OTIMIZE AUTOMACAO INDUSTRIAL',
  shortName: 'OTIMIZE',
  tagline: 'Automação Industrial',
  adminName: 'Gabriel Ferreira — OTIMIZE',
}

export type DemoClient = {
  key: string
  name: string
  company: string
  email: string
  phone: string
}

export type DemoProject = {
  key: string
  clientKey: string
  name: string
  description: string
  status: 'PLANNING' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED'
  budget: number
  milestones: { name: string; status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' }[]
  tasks: {
    title: string
    status: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'COMPLETED'
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
    description?: string
  }[]
}

export type DemoWorkspace = {
  name: string
  slug: string
  description: string
  icon?: string
  projectKeys: string[]
}

/** Espaços descentralizados — cada um com pipeline próprio */
export const DEMO_WORKSPACES: DemoWorkspace[] = [
  {
    name: 'Manutenção Preventiva',
    slug: 'manutencao-preventiva',
    description:
      'Contratos recorrentes, visitas programadas e checklist por planta industrial.',
    icon: '🔧',
    projectKeys: ['mp-acoforte', 'mp-bomcorte', 'mp-norchem', 'mp-graosplus'],
  },
  {
    name: 'Projetos de Automação',
    slug: 'projetos-automacao',
    description: 'Novos projetos — CLP, SCADA, IHM, MES e integrações de campo.',
    icon: '⚙️',
    projectKeys: [
      'retrofit-laminacao',
      'scada-frigorifico',
      'ihm-mes-flexpack',
      'supervisorio-solar',
    ],
  },
  {
    name: 'Comissionamento e SAT',
    slug: 'comissionamento-sat',
    description: 'Start-up, loop check, FAT/SAT e entrega documentada ao cliente.',
    icon: '✅',
    projectKeys: ['comissionamento-reatores', 'esteira-graos'],
  },
]

export const DEMO_TEAM = [
  {
    email: 'carlos.silva@otimize-automacao.demo',
    name: 'Carlos Silva',
    role: 'TEAM' as const,
    password: 'Demo2026!',
  },
  {
    email: 'ana.rodrigues@otimize-automacao.demo',
    name: 'Ana Rodrigues',
    role: 'TEAM' as const,
    password: 'Demo2026!',
  },
  {
    email: 'marco.oliveira@otimize-automacao.demo',
    name: 'Marco Oliveira',
    role: 'TEAM' as const,
    password: 'Demo2026!',
  },
  {
    email: 'julia.fernandes@otimize-automacao.demo',
    name: 'Julia Fernandes',
    role: 'TEAM' as const,
    password: 'Demo2026!',
  },
]

export const DEMO_CLIENTS: DemoClient[] = [
  {
    key: 'acoforte',
    name: 'Ricardo Mendes',
    company: 'Metalúrgica AçoForte',
    email: 'ricardo.mendes@acoforte.com.br',
    phone: '(11) 3456-7800',
  },
  {
    key: 'bomcorte',
    name: 'Patricia Alves',
    company: 'Frigorífico BomCorte',
    email: 'patricia.alves@bomcorte.com.br',
    phone: '(42) 3222-9100',
  },
  {
    key: 'norchem',
    name: 'Fernando Lima',
    company: 'Indústria Química NorChem',
    email: 'fernando.lima@norchem.com.br',
    phone: '(47) 3333-4400',
  },
  {
    key: 'graosplus',
    name: 'Eduardo Rocha',
    company: 'GrãosPlus Armazéns',
    email: 'eduardo.rocha@graosplus.com.br',
    phone: '(65) 3612-5500',
  },
  {
    key: 'flexpack',
    name: 'Camila Santos',
    company: 'Embalagens FlexPack',
    email: 'camila.santos@flexpack.com.br',
    phone: '(19) 3877-2200',
  },
  {
    key: 'energiaverde',
    name: 'Lucas Barros',
    company: 'Usina Energia Verde',
    email: 'lucas.barros@energiaverde.com.br',
    phone: '(84) 3201-8800',
  },
]

export const DEMO_PROJECTS: DemoProject[] = [
  // —— Manutenção Preventiva (por planta) ——
  {
    key: 'mp-acoforte',
    clientKey: 'acoforte',
    name: 'MP — Laminação AçoForte',
    description: 'Contrato mensal: inspeção CLP, backup e suporte remoto linha 2.',
    status: 'IN_PROGRESS',
    budget: 54000,
    milestones: [
      { name: 'Planejamento visitas Q1', status: 'COMPLETED' },
      { name: 'Execução rotinas março', status: 'IN_PROGRESS' },
      { name: 'Relatório técnico mensal', status: 'PENDING' },
    ],
    tasks: [
      { title: 'Backup programas CLP S7-1500', status: 'COMPLETED', priority: 'HIGH' },
      { title: 'Verificação cartões I/O laminador', status: 'IN_PROGRESS', priority: 'HIGH' },
      { title: 'Atualizar log de alarmes críticos', status: 'IN_REVIEW', priority: 'MEDIUM' },
      { title: 'Agendar visita trimestral abril', status: 'TODO', priority: 'LOW' },
    ],
  },
  {
    key: 'mp-bomcorte',
    clientKey: 'bomcorte',
    name: 'MP — Câmaras BomCorte',
    description: 'Suporte SCADA Ignition, sensores de temperatura e compressores.',
    status: 'IN_PROGRESS',
    budget: 98400,
    milestones: [
      { name: 'Monitoramento remoto 24×7', status: 'IN_PROGRESS' },
      { name: 'Visita preventiva compressores', status: 'PENDING' },
    ],
    tasks: [
      { title: 'Revisar tags alarmes HACCP', status: 'IN_PROGRESS', priority: 'URGENT' },
      { title: 'Testar failover gateway MQTT', status: 'TODO', priority: 'HIGH' },
      { title: 'Relatório mensal disponibilidade SCADA', status: 'IN_REVIEW', priority: 'MEDIUM' },
    ],
  },
  {
    key: 'mp-norchem',
    clientKey: 'norchem',
    name: 'MP — Reatores NorChem',
    description: 'Manutenção lógica batch, intertravamentos e instrumentação.',
    status: 'IN_PROGRESS',
    budget: 54000,
    milestones: [
      { name: 'Auditoria receitas batch', status: 'COMPLETED' },
      { name: 'Simulação intertravamentos', status: 'IN_PROGRESS' },
    ],
    tasks: [
      { title: 'Validar temporizadores segurança reator 02', status: 'IN_PROGRESS', priority: 'URGENT' },
      { title: 'Exportar histórico tendências PID', status: 'TODO', priority: 'MEDIUM' },
    ],
  },
  {
    key: 'mp-graosplus',
    clientKey: 'graosplus',
    name: 'MP — Silos GrãosPlus',
    description: 'Rotina preventiva esteiras, balanças e supervisório de silos.',
    status: 'IN_PROGRESS',
    budget: 54000,
    milestones: [
      { name: 'Calibração balanças integradoras', status: 'IN_PROGRESS' },
      { name: 'Atualização firmware sensores nível', status: 'PENDING' },
    ],
    tasks: [
      { title: 'Checklist mensual motores esteira', status: 'COMPLETED', priority: 'MEDIUM' },
      { title: 'Verificar comunicação Modbus silos', status: 'IN_PROGRESS', priority: 'HIGH' },
    ],
  },
  // —— Projetos de Automação ——
  {
    key: 'retrofit-laminacao',
    clientKey: 'acoforte',
    name: 'Retrofit CLP — Linha de Laminação',
    description:
      'Substituição de CLP legado, novas IHMs e integração Profinet com drives Siemens.',
    status: 'IN_PROGRESS',
    budget: 285000,
    milestones: [
      { name: 'Levantamento de campo', status: 'COMPLETED' },
      { name: 'Projeto elétrico / ENG', status: 'COMPLETED' },
      { name: 'Programação CLP + IHM', status: 'IN_PROGRESS' },
      { name: 'FAT — Teste de fábrica', status: 'PENDING' },
      { name: 'SAT e comissionamento', status: 'PENDING' },
    ],
    tasks: [
      { title: 'Mapear E/S do CLP legado', status: 'COMPLETED', priority: 'HIGH' },
      {
        title: 'Lógica de segurança SIL2 — laminador',
        status: 'IN_PROGRESS',
        priority: 'URGENT',
      },
      { title: 'Blocos controle espessura', status: 'IN_PROGRESS', priority: 'HIGH' },
      { title: 'Profinet — inversores linha 2', status: 'IN_REVIEW', priority: 'MEDIUM' },
      { title: 'Documentação AS-BUILT', status: 'TODO', priority: 'MEDIUM' },
    ],
  },
  {
    key: 'scada-frigorifico',
    clientKey: 'bomcorte',
    name: 'SCADA — Expansão Câmaras Frigoríficas',
    description: 'Supervisório Ignition, HACCP e integração sensores wireless.',
    status: 'IN_PROGRESS',
    budget: 198000,
    milestones: [
      { name: 'Arquitetura SCADA / tags', status: 'IN_PROGRESS' },
      { name: 'Telas operação', status: 'IN_PROGRESS' },
      { name: 'Integração IoT', status: 'PENDING' },
    ],
    tasks: [
      { title: 'UDTs câmara fria', status: 'COMPLETED', priority: 'HIGH' },
      { title: 'Sinótico planta frigorífica', status: 'IN_PROGRESS', priority: 'HIGH' },
      { title: 'Alarmes HACCP + PDF', status: 'IN_PROGRESS', priority: 'URGENT' },
      { title: 'Gateway MQTT sensores', status: 'TODO', priority: 'MEDIUM' },
    ],
  },
  {
    key: 'ihm-mes-flexpack',
    clientKey: 'flexpack',
    name: 'IHM + MES — Enchedora FlexPack',
    description: 'IHM envase + OPC-UA com MES para rastreabilidade de lote.',
    status: 'PLANNING',
    budget: 142000,
    milestones: [
      { name: 'Workshop requisitos MES', status: 'IN_PROGRESS' },
      { name: 'Projeto funcional IHM', status: 'PENDING' },
      { name: 'OPC-UA + testes linha 3', status: 'PENDING' },
    ],
    tasks: [
      { title: 'Fluxo operacional envase', status: 'IN_PROGRESS', priority: 'HIGH' },
      { title: 'Mapa tags OPC-UA', status: 'TODO', priority: 'HIGH' },
      { title: 'Protótipo telas operador', status: 'TODO', priority: 'MEDIUM' },
    ],
  },
  {
    key: 'supervisorio-solar',
    clientKey: 'energiaverde',
    name: 'SCADA — Usina Solar 50 MW',
    description: 'Supervisório O&M, inversores Modbus/IEC-104 e KPIs de geração.',
    status: 'IN_PROGRESS',
    budget: 410000,
    milestones: [
      { name: 'Arquitetura dados', status: 'COMPLETED' },
      { name: 'Coleta campo', status: 'IN_PROGRESS' },
      { name: 'Dashboard O&M', status: 'IN_PROGRESS' },
    ],
    tasks: [
      { title: 'Registradores inversores Huawei', status: 'COMPLETED', priority: 'HIGH' },
      { title: 'KPI PR por string', status: 'IN_PROGRESS', priority: 'HIGH' },
      { title: 'Unifilar interativo', status: 'IN_REVIEW', priority: 'MEDIUM' },
      { title: 'Alarmes curtailment', status: 'TODO', priority: 'URGENT' },
    ],
  },
  // —— Comissionamento e SAT ——
  {
    key: 'comissionamento-reatores',
    clientKey: 'norchem',
    name: 'SAT — Reatores Batch NorChem',
    description: 'Loop check, receitas batch e entrega documentação SAT.',
    status: 'IN_PROGRESS',
    budget: 320000,
    milestones: [
      { name: 'Revisão P&ID', status: 'COMPLETED' },
      { name: 'Loop check', status: 'IN_PROGRESS' },
      { name: 'Teste receitas', status: 'PENDING' },
      { name: 'SAT assinado', status: 'PENDING' },
    ],
    tasks: [
      { title: 'Malha válvulas controle', status: 'IN_REVIEW', priority: 'URGENT' },
      { title: 'Sequência carregamento reator', status: 'IN_PROGRESS', priority: 'HIGH' },
      { title: 'Ajuste PID temperatura R-02', status: 'IN_PROGRESS', priority: 'HIGH' },
      { title: 'Relatório SAT', status: 'TODO', priority: 'MEDIUM' },
    ],
  },
  {
    key: 'esteira-graos',
    clientKey: 'graosplus',
    name: 'SAT — Esteira e Silos (entregue)',
    description: 'Projeto concluído — referência de entrega e documentação.',
    status: 'COMPLETED',
    budget: 175000,
    milestones: [
      { name: 'Instalação CLP', status: 'COMPLETED' },
      { name: 'Supervisório silos', status: 'COMPLETED' },
      { name: 'SAT e treinamento', status: 'COMPLETED' },
    ],
    tasks: [
      { title: 'Comissionamento balança', status: 'COMPLETED', priority: 'HIGH' },
      { title: 'Dashboard silos', status: 'COMPLETED', priority: 'MEDIUM' },
      { title: 'Manual operação', status: 'COMPLETED', priority: 'LOW' },
    ],
  },
]

export const DEMO_SUBSCRIPTION_GROUPS = [
  {
    name: 'Contratos OT — OTIMIZE',
    description: 'Manutenção preventiva, suporte SCADA e hospedagem OT.',
    plans: [
      { name: 'Manutenção CLP — Mensal', price: 4500, cycle: 'MONTHLY' as const },
      { name: 'Suporte SCADA 24×7', price: 8200, cycle: 'MONTHLY' as const },
      { name: 'Hospedagem servidor OT', price: 1800, cycle: 'MONTHLY' as const },
    ],
  },
]

export const DEMO_SUBSCRIPTIONS_BY_CLIENT: Record<string, string[]> = {
  acoforte: ['Manutenção CLP — Mensal'],
  bomcorte: ['Suporte SCADA 24×7', 'Hospedagem servidor OT'],
  norchem: ['Manutenção CLP — Mensal'],
  graosplus: ['Manutenção CLP — Mensal'],
  flexpack: [],
  energiaverde: ['Suporte SCADA 24×7'],
}

export type DemoTeamChatChannel = {
  slug: string
  name: string
  description?: string
  type?: 'GENERAL' | 'PROJECT'
}

export type DemoTeamChatMessage = {
  commsRoomId: string
  /** general | projects | random ou slug de canal extra */
  channelKey: string
  authorEmail: string
  content: string
  daysAgo: number
  hour: number
  minute?: number
}

/** Canais extras por setor (commsRoomId = slug do workspace) */
export const DEMO_SECTOR_CHAT_CHANNELS: {
  commsRoomId: string
  channels: DemoTeamChatChannel[]
}[] = [
  {
    commsRoomId: 'manutencao-preventiva',
    channels: [
      {
        slug: 'plantao',
        name: 'plantão',
        description: 'Escalonamento e urgências de contrato MP',
      },
      {
        slug: 'visitas-campo',
        name: 'visitas-campo',
        description: 'Agenda e retorno de visitas preventivas',
      },
    ],
  },
  {
    commsRoomId: 'projetos-automacao',
    channels: [
      {
        slug: 'engenharia',
        name: 'engenharia',
        description: 'Diagramas, listas técnicas e revisões',
      },
      {
        slug: 'fat-sat',
        name: 'fat-sat',
        description: 'Testes de fábrica e comissionamento',
      },
    ],
  },
  {
    commsRoomId: 'comissionamento-sat',
    channels: [
      {
        slug: 'loop-check',
        name: 'loop-check',
        description: 'Malhas, válvulas e instrumentação',
      },
      {
        slug: 'documentacao',
        name: 'documentação',
        description: 'Relatórios SAT, AS-BUILT e treinamentos',
      },
    ],
  },
]

/** Mensagens iniciais nos chats de cada setor */
export const DEMO_TEAM_CHAT_MESSAGES: DemoTeamChatMessage[] = [
  // —— OTIMIZE geral ——
  {
    commsRoomId: 'link-system',
    channelKey: 'general',
    authorEmail: 'carlos.silva@otimize-automacao.demo',
    content: 'Bom dia, equipe! Semana de visitas MP — quem puder revisar os backups até quarta.',
    daysAgo: 2,
    hour: 8,
    minute: 15,
  },
  {
    commsRoomId: 'link-system',
    channelKey: 'general',
    authorEmail: 'ana.rodrigues@otimize-automacao.demo',
    content: 'Plantão SCADA BomCorte ok ontem. Gateway redundante ainda em análise com o cliente.',
    daysAgo: 1,
    hour: 9,
    minute: 40,
  },
  {
    commsRoomId: 'link-system',
    channelKey: 'projects',
    authorEmail: 'marco.oliveira@otimize-automacao.demo',
    content: 'Retrofit laminação: lógica SIL2 em revisão interna. FAT previsto para abril.',
    daysAgo: 3,
    hour: 14,
    minute: 5,
  },
  {
    commsRoomId: 'link-system',
    channelKey: 'random',
    authorEmail: 'julia.fernandes@otimize-automacao.demo',
    content: 'Alguém tem o template de relatório mensal MP atualizado? 🙏',
    daysAgo: 0,
    hour: 11,
    minute: 20,
  },
  // —— Manutenção Preventiva ——
  {
    commsRoomId: 'manutencao-preventiva',
    channelKey: 'general',
    authorEmail: 'carlos.silva@otimize-automacao.demo',
    content: 'Backup S7-1500 AçoForte concluído. Arquivo `.zap18` anexado na tarefa do PM.',
    daysAgo: 1,
    hour: 10,
    minute: 30,
  },
  {
    commsRoomId: 'manutencao-preventiva',
    channelKey: 'general',
    authorEmail: 'ana.rodrigues@otimize-automacao.demo',
    content: 'Alarme HACCP câmara 03 normalizado. Causa: sensor wireless com bateria baixa.',
    daysAgo: 0,
    hour: 7,
    minute: 55,
  },
  {
    commsRoomId: 'manutencao-preventiva',
    channelKey: 'plantao',
    authorEmail: 'marco.oliveira@otimize-automacao.demo',
    content: 'NorChem — intertravamento reator 02 validado em simulação. Cliente avisado.',
    daysAgo: 0,
    hour: 22,
    minute: 10,
  },
  {
    commsRoomId: 'manutencao-preventiva',
    channelKey: 'visitas-campo',
    authorEmail: 'julia.fernandes@otimize-automacao.demo',
    content: 'Visita GrãosPlus quinta 14h — calibração balança integradora. Confirmado com Eduardo.',
    daysAgo: 2,
    hour: 16,
    minute: 0,
  },
  // —— Projetos de Automação ——
  {
    commsRoomId: 'projetos-automacao',
    channelKey: 'general',
    authorEmail: 'marco.oliveira@otimize-automacao.demo',
    content: 'Blocos de espessura laminador — versão 1.4 pronta para peer review.',
    daysAgo: 0,
    hour: 9,
    minute: 5,
  },
  {
    commsRoomId: 'projetos-automacao',
    channelKey: 'engenharia',
    authorEmail: 'carlos.silva@otimize-automacao.demo',
    content: 'Lista de E/S linha 2 atualizada no SharePoint. Falta validar 12 entradas digitais novas.',
    daysAgo: 1,
    hour: 11,
    minute: 30,
  },
  {
    commsRoomId: 'projetos-automacao',
    channelKey: 'projects',
    authorEmail: 'ana.rodrigues@otimize-automacao.demo',
    content: 'Sinótico frigorífico BomCorte — cliente pediu destaque para compressores 2 e 3.',
    daysAgo: 0,
    hour: 15,
    minute: 45,
  },
  {
    commsRoomId: 'projetos-automacao',
    channelKey: 'fat-sat',
    authorEmail: 'julia.fernandes@otimize-automacao.demo',
    content: 'Usina solar: KPI PR por string em teste. Unifilar interativo na fila de review.',
    daysAgo: 2,
    hour: 10,
    minute: 0,
  },
  // —— Comissionamento e SAT ——
  {
    commsRoomId: 'comissionamento-sat',
    channelKey: 'general',
    authorEmail: 'marco.oliveira@otimize-automacao.demo',
    content: 'Loop check NorChem — 18 de 22 malhas OK. Pendente 4 válvulas proporcionais.',
    daysAgo: 0,
    hour: 8,
    minute: 50,
  },
  {
    commsRoomId: 'comissionamento-sat',
    channelKey: 'loop-check',
    authorEmail: 'ana.rodrigues@otimize-automacao.demo',
    content: 'Planilha LC-NORCHEM-2026 atualizada. Fotos dos manômetros na pasta do projeto.',
    daysAgo: 1,
    hour: 17,
    minute: 20,
  },
  {
    commsRoomId: 'comissionamento-sat',
    channelKey: 'documentacao',
    authorEmail: 'carlos.silva@otimize-automacao.demo',
    content: 'Rascunho relatório SAT NorChem — seção treinamento operadores precisa de revisão.',
    daysAgo: 0,
    hour: 13,
    minute: 10,
  },
  {
    commsRoomId: 'comissionamento-sat',
    channelKey: 'random',
    authorEmail: 'julia.fernandes@otimize-automacao.demo',
    content: 'Referência GrãosPlus ajudou — usem o manual entregue como base para o próximo SAT.',
    daysAgo: 4,
    hour: 9,
    minute: 0,
  },
]

export type DemoDraftTask = {
  projectKey: string
  title: string
  description?: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  assigneeEmail?: string
}

/** Rascunhos por espaço — aparecem em /workspace/{slug}/drafts */
export const DEMO_WORKSPACE_DRAFTS: {
  workspaceSlug: string
  drafts: DemoDraftTask[]
}[] = [
  {
    workspaceSlug: 'manutencao-preventiva',
    drafts: [
      {
        projectKey: 'mp-acoforte',
        title: 'Revisar firmware CPU laminador — Q2',
        description: 'Verificar compatibilidade TIA V18 com patch de segurança Siemens.',
        priority: 'MEDIUM',
        assigneeEmail: 'carlos.silva@otimize-automacao.demo',
      },
      {
        projectKey: 'mp-bomcorte',
        title: 'Proposta upgrade gateway Ignition',
        description: 'Rascunho de escopo para redundância do gateway SCADA.',
        priority: 'LOW',
        assigneeEmail: 'ana.rodrigues@otimize-automacao.demo',
      },
      {
        projectKey: 'mp-norchem',
        title: 'Checklist intertravamentos — reator 03',
        description: 'Nova receita batch em homologação; aguardando P&ID revisado.',
        priority: 'HIGH',
        assigneeEmail: 'marco.oliveira@otimize-automacao.demo',
      },
      {
        projectKey: 'mp-graosplus',
        title: 'Plano calibração balanças — trimestre 2',
        priority: 'MEDIUM',
        assigneeEmail: 'julia.fernandes@otimize-automacao.demo',
      },
    ],
  },
  {
    workspaceSlug: 'projetos-automacao',
    drafts: [
      {
        projectKey: 'retrofit-laminacao',
        title: 'Estudo viabilidade Profinet — linha 3',
        description: 'Avaliar substituição Profibus legado; levantamento preliminar.',
        priority: 'MEDIUM',
        assigneeEmail: 'carlos.silva@otimize-automacao.demo',
      },
      {
        projectKey: 'scada-frigorifico',
        title: 'Template relatório HACCP automático',
        description: 'Rascunho de layout PDF diário para auditoria.',
        priority: 'HIGH',
        assigneeEmail: 'ana.rodrigues@otimize-automacao.demo',
      },
      {
        projectKey: 'ihm-mes-flexpack',
        title: 'Wireframe telas operador — envase',
        priority: 'LOW',
        assigneeEmail: 'julia.fernandes@otimize-automacao.demo',
      },
      {
        projectKey: 'supervisorio-solar',
        title: 'Integração API curtailment — ONS',
        description: 'Esboço de tags e alarmes para restrição de geração.',
        priority: 'URGENT',
        assigneeEmail: 'marco.oliveira@otimize-automacao.demo',
      },
      {
        projectKey: 'retrofit-laminacao',
        title: 'Lista materiais reserva — painel MCC',
        priority: 'MEDIUM',
      },
    ],
  },
  {
    workspaceSlug: 'comissionamento-sat',
    drafts: [
      {
        projectKey: 'comissionamento-reatores',
        title: 'Roteiro teste receita batch — R-02',
        description: 'Sequência de carregamento e aquecimento para homologação SAT.',
        priority: 'HIGH',
        assigneeEmail: 'marco.oliveira@otimize-automacao.demo',
      },
      {
        projectKey: 'comissionamento-reatores',
        title: 'Checklist loop check — válvulas proporcionais',
        priority: 'URGENT',
        assigneeEmail: 'ana.rodrigues@otimize-automacao.demo',
      },
      {
        projectKey: 'esteira-graos',
        title: 'Modelo relatório SAT — próximo cliente silos',
        description: 'Baseado na entrega GrãosPlus; adaptar seções de treinamento.',
        priority: 'LOW',
        assigneeEmail: 'carlos.silva@otimize-automacao.demo',
      },
    ],
  },
]

export type DemoTrainingNote = {
  projectKey: string
  title: string
  content: string
  visibility?: 'PUBLIC' | 'PRIVATE'
}

/** Guia do espaço — anexado ao primeiro projeto de cada workspace */
export const DEMO_WORKSPACE_TRAINING: {
  workspaceSlug: string
  projectKey: string
  title: string
  content: string
}[] = [
  {
    workspaceSlug: 'manutencao-preventiva',
    projectKey: 'mp-acoforte',
    title: '📘 Onboarding — Espaço Manutenção Preventiva',
    content: `# Bem-vindo ao espaço Manutenção Preventiva

Este espaço concentra **contratos recorrentes** e rotinas por planta industrial. Use o **Pipeline** deste espaço para acompanhar visitas, backups e relatórios mensais — sem misturar com projetos novos.

## O que o novo colaborador deve saber

1. **Cada projeto = uma planta/cliente** em contrato MP (ex.: MP — Laminação AçoForte).
2. Priorize tarefas com status **Em andamento** e alarmes marcados como **Urgente**.
3. Ao concluir visita, registre evidências na tarefa e atualize o **Financeiro** se houver medição.
4. Backup de CLP: sempre validar checksum e guardar em \`/Documentos/Clientes/{nome}/Backup\`.

## Fluxo padrão mensal

| Semana | Atividade |
|--------|-----------|
| 1 | Revisão remota SCADA/CLP + alarmes |
| 2 | Backup programas + relatório preliminar |
| 3 | Visita campo (se contrato prever) |
| 4 | Relatório assinado + fechamento no PM |

## Onde clicar na demo

- **Pipeline** → visão kanban só deste espaço
- **Projetos** → detalhe por planta
- **Financeiro** → receitas de contrato MP
- **Anotações** (este menu) → runbooks por cliente

> Dúvidas? Fale com Carlos Silva (CLP) ou Ana Rodrigues (SCADA).`,
  },
  {
    workspaceSlug: 'projetos-automacao',
    projectKey: 'retrofit-laminacao',
    title: '📘 Onboarding — Espaço Projetos de Automação',
    content: `# Bem-vindo ao espaço Projetos de Automação

Aqui ficam **projetos novos**: retrofit CLP, SCADA, IHM/MES e integrações. Cada projeto tem fases (marcos) do levantamento ao SAT.

## Metodologia OTIMIZE (resumo)

1. **Levantamento** — visita, E/S, riscos de segurança (SIL quando aplicável)
2. **Engenharia** — projeto elétrico, diagramas, lista de materiais
3. **Desenvolvimento** — programação CLP / telas SCADA / IHM
4. **FAT** — teste de fábrica antes de ir a campo
5. **SAT** — comissionamento na planta do cliente

## Pipeline deste espaço

Use colunas **A fazer → Em andamento → Testar → Concluído** para coordenar engenharia e campo.

## Boas práticas para trainees

- Toda alteração de lógica exige **revisão por par** antes de download em CLP de produção.
- Documente versões de programa (ex.: \`Laminacao_L2_v1.4.fdb\`).
- Vincule despesas de material ao projeto no módulo **Financeiro**.

## Projetos neste espaço (demo)

- Retrofit CLP — AçoForte
- SCADA — BomCorte
- IHM + MES — FlexPack
- SCADA — Usina Solar`,
  },
  {
    workspaceSlug: 'comissionamento-sat',
    projectKey: 'comissionamento-reatores',
    title: '📘 Onboarding — Espaço Comissionamento e SAT',
    content: `# Bem-vindo ao espaço Comissionamento e SAT

Projetos em fase final: **loop check**, testes de receita, ajuste de PID e **entrega documentada** ao cliente.

## Checklist SAT (use como referência)

- [ ] Loop check instrumentação (4–20 mA, válvulas, feedback)
- [ ] Teste de intertravamentos e alarmes críticos
- [ ] Receitas batch / sequências automáticas homologadas
- [ ] Treinamento operadores registrado
- [ ] Relatório SAT assinado + AS-BUILT entregue

## Pipeline

Priorize cards em **Testar** — são gate antes do go-live.

## Projeto referência concluído

Veja **SAT — Esteira e Silos (entregue)** como exemplo de projeto encerrado com documentação completa.`,
  },
]

export const DEMO_PROJECT_TRAINING: DemoTrainingNote[] = [
  {
    projectKey: 'mp-acoforte',
    title: 'Runbook — Backup CLP Siemens S7-1500',
    visibility: 'PUBLIC',
    content: `# Runbook: Backup mensal CLP

## Pré-requisitos
- TIA Portal V18+ instalado
- Acesso VPN planta AçoForte
- Credencial fornecida pelo cliente

## Passos
1. Conectar online ao CLP **CPU 1515F** (IP 192.168.10.10)
2. **Online → Backup de dispositivo** → salvar \`.zap18\`
3. Exportar blocos de segurança separadamente
4. Anexar evidência na tarefa "Backup programas CLP"
5. Registrar no PM e enviar link ao cliente

## SLA contrato
Backup até dia **10** de cada mês.`,
  },
  {
    projectKey: 'mp-bomcorte',
    title: 'Runbook — Alarmes HACCP Ignition',
    visibility: 'PUBLIC',
    content: `# Alarmes críticos HACCP

Temperatura câmara **≤ -18°C** por mais de 15 min → alarme crítico + SMS.

## Tags principais
- \`FRIG/CAM01/TempPV\`
- \`FRIG/COMP01/Status\`

## Escalonamento
1. Operador planta
2. Plantão OTIMIZE (plantão@otimize.demo)
3. Patricia Alves (cliente)`,
  },
  {
    projectKey: 'retrofit-laminacao',
    title: 'Treinamento — Lógica SIL2 laminador',
    visibility: 'PUBLIC',
    content: `# SIL2 — Laminador linha 2

## Objetivo
Garantir parada segura em falha de emergência ou perda de pressão hidráulica.

## Pontos de atenção
- **FB_SafetyGate** não editar sem aprovação do líder CLP
- Teste mensal: botoeira de emergência + cortina de luz
- Registre testes na tarefa correspondente

## Referência
Norma IEC 62061 — revisar capítulo 6 com mentor.`,
  },
  {
    projectKey: 'scada-frigorifico',
    title: 'Padrão de telas — Ignition OTIMIZE',
    visibility: 'PUBLIC',
    content: `# Padrão visual SCADA

- Cabeçalho: logo cliente + status comunicação
- Cores: verde=OK, amarelo=atenção, vermelho=crítico
- Toda tela com botão **Histórico** e **Ack alarmes**

Templates em: \`Biblioteca/Templates/Ignition\``,
  },
  {
    projectKey: 'ihm-mes-flexpack',
    title: 'Workshop MES — Roteiro trainee',
    visibility: 'PUBLIC',
    content: `# Roteiro workshop FlexPack

1. Mapear fluxo: encher → tampar → etiquetar → paletizar
2. Identificar pontos OPC-UA no MES cliente
3. Definir lote mínimo rastreável
4. Prototipar tela operador (mockup)
5. Validar com Camila Santos (cliente)`,
  },
  {
    projectKey: 'comissionamento-reatores',
    title: 'Loop check — Planilha e evidências',
    visibility: 'PUBLIC',
    content: `# Loop check NorChem

Use planilha **LC-NORCHEM-2026.xlsx** (copiar template interno).

Por válvula anotar:
- Tag | Setpoint | PV campo | % erro | OK/NOK | Foto manômetro

Anexar PDF assinado na tarefa "Malha válvulas controle".`,
  },
  {
    projectKey: 'supervisorio-solar',
    title: 'Modbus — Mapa inversores Huawei',
    visibility: 'PUBLIC',
    content: `# Registradores Modbus

| Registro | Descrição | Escala |
|----------|-----------|--------|
| 32016 | Potência AC | ÷10 kW |
| 32064 | Tensão DC string | ÷10 V |

Polling recomendado: **5 s** inversor, **60 s** meteo.`,
  },
  {
    projectKey: 'esteira-graos',
    title: '🏆 Referência — Projeto entregue (SAT OK)',
    visibility: 'PUBLIC',
    content: `# Caso de sucesso — GrãosPlus

Use este projeto como **referência de entrega**:
- Manual operação entregue
- Treinamento 4 operadores
- SAT assinado em 2025

Novos trainees: leiam as tarefas concluídas e replique o padrão de documentação.`,
  },
  {
    projectKey: 'mp-norchem',
    title: 'Simulação batch — Ambiente seguro',
    visibility: 'PUBLIC',
    content: `# Simulação sem produto

Sempre use flag **SIM_MODE** no CLP antes de testar sequências.

Nunca abrir válvulas de produto com SIM desligado.`,
  },
  {
    projectKey: 'mp-graosplus',
    title: 'Calibração balança — Procedimento',
    visibility: 'PUBLIC',
    content: `# Calibração trimestral

1. Peso padrão 500 kg certificado
2. Três ciclos carga/descarga
3. Registrar desvio máximo < 0,2%
4. Foto display + laudo na tarefa PM`,
  },
]
