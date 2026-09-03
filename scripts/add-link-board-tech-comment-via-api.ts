/**
 * Adiciona comentário de stack/tecnologias na task Link Board (PM).
 *
 * Uso:
 *   cd /Users/gabrielferreira/Desktop/projects
 *   npx tsx scripts/add-link-board-tech-comment-via-api.ts
 */
import { pmApi, pmSession } from './lib/pm-api-client'

const TASK_ID = 'cmsrxy31l008onv2c7b4thvbj'

const TECH_COMMENT = `## Stack — principais tecnologias (Link System)

Referência do que usamos no **Link Board** e nos produtos reais (Link Eats, etc.).

---

### Frontend

| Tecnologia | O que é | Por que usamos |
|------------|---------|----------------|
| **Next.js 16** | Framework React com App Router | SSR/SSG quando precisa, rotas por pasta (\`/novo\`, \`/\`), deploy simples (Vercel/Coolify), padrão em todos os painéis Link |
| **React 19** | UI declarativa | Ecossistema maduro, hooks, componentização — base de todo front |
| **TypeScript** | JS tipado | Menos bug em produção, autocomplete, contratos claros entre front e API |
| **Tailwind CSS 4** | Utility-first CSS | Velocidade no layout, consistência visual, sem CSS solto espalhado |
| **shadcn/ui** | Componentes copiáveis (Radix/Base UI + Tailwind) | Não é lib fechada — o código fica no repo, customizamos Badge, Dialog, Card etc. Igual Link Eats |
| **Sonner** | Toasts | Feedback instantâneo (pedido criado, erro de API) sem modal bloqueante |
| **Lucide** | Ícones SVG | Leve, consistente, integrado ao shadcn |

**Padrão front:** páginas com interatividade usam \`'use client'\`; fetch REST + subscribe WebSocket no \`useEffect\`.

---

### Backend (API)

| Tecnologia | O que é | Por que usamos |
|------------|---------|----------------|
| **Node.js 20** | Runtime JS no servidor | Mesma linguagem front/back, time full-stack |
| **Fastify** | HTTP framework (alternativa ao Express) | Rápido, schema de rotas, plugins (CORS). No Link Eats usamos Fastify no back principal |
| **ws** | WebSocket nativo | Tempo real leve, controle total do protocolo — **mesmo padrão do Link Eats** (\`/ws\`, mensagens \`{ type, payload }\`) |
| **pnpm** | Gerenciador de pacotes | Monorepos, installs rápidos, lockfile — padrão Link System |

**Padrão API:** REST para CRUD + WebSocket para broadcast (order-created, order-updated). Rooms por contexto (aqui: \`kitchen\`).

---

### Realtime (WebSocket)

| Conceito | No Link Board | No Link Eats |
|----------|---------------|--------------|
| Path | \`ws://host:3333/ws\` | \`wss://api.linkeats.com.br/ws\` |
| Join | \`join-room\` + \`kitchen\` | \`join-company\` + \`companyId\` |
| Eventos | \`order-created\`, \`order-updated\` | pedidos, KDS, impressora, notificações |
| Client | singleton + reconnect + handlers por \`type\` | \`websocket-client.ts\` — mesmo desenho |

**Por que WS e não polling?** KDS e notificações precisam atualizar em **< 1s**; polling gasta banda e atrasa operação de restaurante.

---

### DevOps / entrega (fase do onboarding)

| Tecnologia | Por que |
|------------|---------|
| **Docker + Compose** | Ambiente igual para todo dev, sobe api+web com um comando, base para deploy |
| **Git + PR → develop** | Code review, histórico, não quebra produção |
| **GitHub** | Repo público de treino: ${'https://github.com/GbFerrera/link-board'} |

---

### O que **não** está neste mini projeto (mas existe no Link Eats)

- **Prisma + PostgreSQL** — persistência multi-tenant
- **Coolify / VPS** — deploy produção
- **Electron (Printer)** — app Windows impressão

No onboarding você aprende o **núcleo** (Next + shadcn + WS). Depois entra no monorepo real com banco, auth e integrações.

---

### Resumo em uma frase

> **Next.js** monta a UI, **shadcn** padroniza componentes, **Fastify** expõe REST, **WebSocket** sincroniza telas em tempo real — igual operamos no Link Eats, em escala reduzida.`

async function main() {
  const { base, cookies } = await pmSession()
  const prefix = '## Stack — principais tecnologias'

  const commentsRes = await pmApi(base, cookies, `/api/tasks/${TASK_ID}/comments`)
  const existing = commentsRes.ok
    ? ((await commentsRes.json()) as Array<{ content: string }>)
    : []

  if (existing.some((c) => c.content.startsWith(prefix))) {
    console.log('Comentário de stack já existe — atualizando...')
    // PM pode não ter PUT em comment; adicionamos novo se não achar exato
    const exact = existing.find((c) => c.content.startsWith(prefix))
    if (exact) {
      console.log('Skip — conteúdo já presente')
      return
    }
  }

  const res = await pmApi(base, cookies, `/api/tasks/${TASK_ID}/comments`, {
    method: 'POST',
    body: JSON.stringify({ content: TECH_COMMENT }),
  })
  if (!res.ok) throw new Error(`comment: ${res.status} ${await res.text()}`)

  console.log('+ Comentário de tecnologias adicionado na task Link Board')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
