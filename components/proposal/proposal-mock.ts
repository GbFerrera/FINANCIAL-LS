export type ProposalStepId =
  | "escopo-modulos"
  | "nao-entregaveis"
  | "sprints-entregaveis"
  | "stack-propriedade"
  | "suporte-financeiro"

export type ProposalModule = {
  title: string
  description: string
}

export type ProposalSprint = {
  name: string
  durationLabel: string
  goal: string
  deliverables: string[]
}

export type ProposalStackItem = {
  label: string
  value: string
}

export type ProposalFinancialScheduleItem = {
  label: string
  percent: number
  amount: number
  dueLabel: string
}

export type ProposalCardPaymentOption = {
  maxInstallments: number
  feePercent: number
  total: number
  installmentAmount: number
}

export type Proposal = {
  id: string
  title: string
  clientName: string
  projectName: string
  issuedAtLabel: string
  validUntilLabel: string
  objective: string
  scopeModules: ProposalModule[]
  nonDeliverables: string[]
  sprints: ProposalSprint[]
  stack: ProposalStackItem[]
  ownershipTerms: string[]
  supportTerms: string[]
  penaltyTerms?: string[]
  financial: {
    currency: "BRL"
    total: number
    paymentSummary: string
    paymentMethods?: string[]
    cardOption?: ProposalCardPaymentOption
    schedule: ProposalFinancialScheduleItem[]
    notes: string[]
  }
}

export const proposalMock: Proposal = {
  id: "PROP-0001",
  title: "Proposta Comercial (Contrato de Prestação de Serviços)",
  clientName: "Cliente Exemplo LTDA",
  projectName: "FINANCIAL LS",
  issuedAtLabel: "23/03/2026",
  validUntilLabel: "22/04/2026",
  objective:
    "Construir uma plataforma web para centralizar gestão financeira, projetos e rotinas do time, entregando por etapas (sprints) com validação contínua.",
  scopeModules: [
    {
      title: "Autenticação e Perfis",
      description:
        "Acesso seguro, perfis e permissões por rotas para administrar áreas do sistema.",
    },
    {
      title: "Gestão Financeira",
      description:
        "Lançamentos, categorias, visão geral por cliente e consolidação para tomada de decisão.",
    },
    {
      title: "Projetos e Sprints",
      description:
        "Backlog, sprints, entregáveis e acompanhamento do progresso com visão clara de status.",
    },
    {
      title: "Portal do Cliente",
      description:
        "Acesso dedicado para acompanhar contratos, pagamentos e comunicação do projeto.",
    },
    {
      title: "Uploads e Documentos",
      description:
        "Envio e organização de arquivos com histórico e versões quando aplicável.",
    },
    {
      title: "Notificações e Atividades",
      description:
        "Alertas sobre mudanças relevantes, marcos e movimentações importantes.",
    },
  ],
  nonDeliverables: [
    "Design completo (UI/Brand) além do que está nesta proposta visual",
    "Aplicativo mobile nativo (iOS/Android)",
    "Integração com ERPs/contabilidade não listadas no escopo",
    "Migração histórica completa de bases legadas sem diagnóstico prévio",
    "Suporte 24/7 e plantão fora do horário comercial",
  ],
  sprints: [
    {
      name: "Sprint 1",
      durationLabel: "1 semana",
      goal: "Base do projeto + estrutura de acesso e navegação",
      deliverables: [
        "Página de proposta/contrato (modelo de apresentação)",
        "Estrutura inicial de rotas e layout",
        "Padrões de componentes e tema",
      ],
    },
    {
      name: "Sprint 2",
      durationLabel: "1–2 semanas",
      goal: "Financeiro inicial e primeiros relatórios",
      deliverables: [
        "Cadastro de categorias",
        "Lançamentos (entradas/saídas) com validações",
        "Visão geral simplificada",
      ],
    },
    {
      name: "Sprint 3",
      durationLabel: "1–2 semanas",
      goal: "Projetos, backlog e acompanhamento por sprint",
      deliverables: [
        "Backlog do projeto",
        "Sprints com entregáveis",
        "Indicadores de progresso",
      ],
    },
  ],
  stack: [
    { label: "Frontend", value: "Next.js + React + TypeScript + Tailwind" },
    { label: "Backend", value: "Next.js Route Handlers + Prisma" },
    { label: "Banco de Dados", value: "PostgreSQL (ambiente de desenvolvimento)" },
    { label: "Auth", value: "NextAuth" },
    { label: "Infra", value: "Docker Compose (dev) + Deploy sob definição" },
  ],
  ownershipTerms: [
    "O código-fonte do que for desenvolvido sob encomenda é entregue ao contratante ao final do projeto, mediante quitação.",
    "Bibliotecas e serviços de terceiros mantêm suas licenças e termos originais.",
    "Reutilização de componentes genéricos pode ocorrer sem expor dados do contratante.",
  ],
  supportTerms: [
    "Garantia de 30 dias após a entrega final para correções de defeitos (bugs) no escopo contratado.",
    "Ajustes e melhorias fora do escopo entram como novo item de backlog com estimativa.",
    "Canal de atendimento: e-mail e/ou WhatsApp comercial, horário 9h–18h (dias úteis).",
  ],
  penaltyTerms: [
    "Em caso de rescisão antecipada, os valores das etapas já iniciadas ou concluídas não serão reembolsados.",
    "O não pagamento de qualquer parcela em até 5 dias úteis do vencimento acarreta multa de 2% e juros de 1% ao mês.",
    "O projeto será paralisado caso haja atraso no pagamento superior a 10 dias úteis."
  ],
  financial: {
    currency: "BRL",
    total: 18500,
    paymentSummary: "3 marcos (30% / 40% / 30) conforme entregas",
    paymentMethods: [
      "PIX/Transferência",
      "Boleto",
      "Cartão de crédito (até 12x, sujeito a taxa)",
    ],
    cardOption: {
      maxInstallments: 12,
      feePercent: 5,
      total: 19425,
      installmentAmount: 1618.75,
    },
    schedule: [
      { label: "Início do projeto", percent: 30, amount: 5550, dueLabel: "D+0" },
      {
        label: "Entrega Sprint 2",
        percent: 40,
        amount: 7400,
        dueLabel: "Ao concluir Sprint 2",
      },
      {
        label: "Entrega final",
        percent: 30,
        amount: 5550,
        dueLabel: "Ao concluir Sprint 3",
      },
    ],
    notes: [
      "Valores mockados apenas para demonstrar a proposta no app.",
      "Custos de infraestrutura/serviços externos (se houver) são cobrados à parte com transparência.",
    ],
  },
}
