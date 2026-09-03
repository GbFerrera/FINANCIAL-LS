/**
 * Aplica checklist + comentários na task Link Control via API do PM (produção).
 *
 * Uso:
 *   PM_EMAIL=... PM_PASSWORD=... npx tsx scripts/apply-link-control-task-via-api.ts
 */
const SHARE_TOKEN = 'be242873-b7b6-486f-b4a0-095e5c5bb248'
const TASK_ID = 'cms644uec000uob2b9okygj1c'
const PROJECT_ID = 'cms643jgp000qob2bt1l5roc7'

const CHECKLIST: Array<{ title: string; items: Array<{ title: string; description?: string }> }> = [
  {
    title: '1. Repositório GitHub',
    items: [
      { title: 'Criar repo privado `link-control` (GbFerrera)', description: 'Base: cópia do FINANCIAL-LS (projects)' },
      { title: 'Copiar código do `projects` para o novo repo', description: 'Excluir .git, node_modules, .next antes do push inicial' },
      { title: 'Renomear package e README para Link Control', description: 'Atualizar name, descrição e links' },
      { title: 'Push inicial para `main`', description: 'git remote add origin + git push -u origin main' },
    ],
  },
  {
    title: '2. Base do sistema (projects → Link Control)',
    items: [
      { title: 'Clonar base do FINANCIAL-LS / projects', description: 'Next.js 15 + Prisma + NextAuth + módulos PM' },
      { title: 'Ajustar branding e env.example', description: 'NEXTAUTH_URL, SMTP, domínio Link Control' },
      { title: 'Revisar schema Prisma — escopo v1', description: 'Manter base PM; evoluir depois' },
      { title: 'Validar local: install + migrate + dev', description: 'Boot sem erros' },
    ],
  },
  {
    title: '3. Deploy Servidor 2 (Coolify)',
    items: [
      { title: 'Criar app no Coolify (Servidor 2)', description: 'Usar docker-compose.yml ou Dockerfile existente' },
      { title: 'Configurar domínio e SSL', description: 'Traefik + FQDN do Link Control' },
      { title: 'Variáveis de ambiente produção', description: 'DATABASE_URL, NEXTAUTH_*, SMTP, CRON_SECRET' },
      { title: 'PostgreSQL dedicado', description: 'Volume persistente — DB separado do projects' },
      { title: 'Deploy + smoke test', description: 'Login, /api/health, projeto teste' },
    ],
  },
  {
    title: '4. Pós-deploy',
    items: [
      { title: 'Seed admin (SEED_DB=true uma vez)', description: 'Desligar seed após primeiro deploy' },
      { title: 'Documentar no Link Brain', description: 'Projetos/Link Control + Deploy e Infra' },
      { title: 'Vincular repo ao projeto LinkControl no PM', description: 'URL GitHub na nota do projeto' },
    ],
  },
]

const COMMENTS = [
  `## Contexto — Link Control

Novo produto construído **em cima do código do projects** (FINANCIAL-LS).

- **Base local:** \`/Users/gabrielferreira/Desktop/projects\`
- **Repo origem:** https://github.com/GbFerrera/FINANCIAL-LS
- **Repo alvo:** \`GbFerrera/link-control\` (criar)
- **Deploy alvo:** Servidor 2 (Coolify · IP ref. 72.61.219.179)

**Objetivo v1:** subir a mesma stack em produção e evoluir a partir daí.`,

  `## Ordem de execução

1. \`gh auth login\` → criar repo \`link-control\`
2. Copiar projects → link-control (sem .git/node_modules/.next)
3. Push para GitHub
4. Nova app no Coolify (Servidor 2) apontando para o repo
5. Configurar env + PostgreSQL + domínio
6. Deploy e validar login

Marcar itens do checklist conforme avançar.`,

  `## Referências

| Item | Valor |
|------|-------|
| PM produção | https://projects.linksystem.tech |
| Projeto PM | LinkControl |
| Deploy ref | \`docker-compose.yml\` + \`DEPLOY_NOTES.md\` do projects |
| Doc vault | \`link-brain/Projetos/Link Control/\` |
| Script checklist | \`projects/scripts/setup-link-control-task.ts\` |`,
]

const TASK_DESCRIPTION = `Bootstrap do **Link Control** — fork operacional do sistema projects (FINANCIAL-LS).

**Repositório alvo:** \`GbFerrera/link-control\`
**Deploy alvo:** Servidor 2 (Coolify)

Portal: https://projects.linksystem.tech/task-portal/${SHARE_TOKEN}`

function parseCookies(setCookieHeaders: string[]): Record<string, string> {
  const jar: Record<string, string> = {}
  for (const header of setCookieHeaders) {
    const part = header.split(';')[0]
    const eq = part.indexOf('=')
    if (eq > 0) jar[part.slice(0, eq)] = part.slice(eq + 1)
  }
  return jar
}

function cookieHeader(jar: Record<string, string>): string {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')
}

async function login(base: string, email: string, password: string): Promise<string> {
  const jar: Record<string, string> = {}

  const csrfRes = await fetch(`${base}/api/auth/csrf`)
  const csrfJson = (await csrfRes.json()) as { csrfToken: string }
  Object.assign(jar, parseCookies([...(csrfRes.headers.getSetCookie?.() ?? [])]))

  const signInRes = await fetch(`${base}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookieHeader(jar),
    },
    body: new URLSearchParams({
      csrfToken: csrfJson.csrfToken,
      email,
      password,
      redirect: 'false',
      json: 'true',
    }),
    redirect: 'manual',
  })

  Object.assign(jar, parseCookies([...(signInRes.headers.getSetCookie?.() ?? [])]))

  const sessionRes = await fetch(`${base}/api/auth/session`, {
    headers: { Cookie: cookieHeader(jar) },
  })
  const session = (await sessionRes.json()) as { user?: { email?: string } }
  if (!session.user?.email) {
    throw new Error('Login falhou — verifique PM_EMAIL e PM_PASSWORD')
  }

  return cookieHeader(jar)
}

async function api(
  base: string,
  cookies: string,
  path: string,
  init?: RequestInit
): Promise<Response> {
  return fetch(`${base}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookies,
      ...(init?.headers ?? {}),
    },
  })
}

async function main() {
  const base = (process.env.PM_BASE || 'https://projects.linksystem.tech').replace(/\/$/, '')
  const email = process.env.PM_EMAIL
  const password = process.env.PM_PASSWORD

  if (!email || !password) {
    throw new Error('Defina PM_EMAIL e PM_PASSWORD')
  }

  console.log(`Login em ${base}...`)
  const cookies = await login(base, email, password)
  console.log('Login OK')

  const portalRes = await fetch(`${base}/api/task-portal/${SHARE_TOKEN}`)
  const portal = (await portalRes.json()) as {
    checklist?: { groups?: unknown[] }
  }

  if ((portal.checklist?.groups?.length ?? 0) > 0) {
    console.log('Checklist já populado — pulando criação')
  } else {
    for (const groupDef of CHECKLIST) {
      const groupRes = await api(base, cookies, `/api/tasks/${TASK_ID}/checklist`, {
        method: 'POST',
        body: JSON.stringify({ action: 'create_group', title: groupDef.title }),
      })
      if (!groupRes.ok) {
        throw new Error(`create_group failed: ${groupRes.status} ${await groupRes.text()}`)
      }
      const { group } = (await groupRes.json()) as { group: { id: string } }

      for (const itemDef of groupDef.items) {
        const itemRes = await api(base, cookies, `/api/tasks/${TASK_ID}/checklist`, {
          method: 'POST',
          body: JSON.stringify({
            action: 'create_item',
            groupId: group.id,
            title: itemDef.title,
            description: itemDef.description,
          }),
        })
        if (!itemRes.ok) {
          throw new Error(`create_item failed: ${itemRes.status} ${await itemRes.text()}`)
        }
      }
      console.log(`+ ${groupDef.title} (${groupDef.items.length} itens)`)
    }
  }

  for (const content of COMMENTS) {
    const res = await api(base, cookies, `/api/tasks/${TASK_ID}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    })
    if (!res.ok) {
      throw new Error(`comment failed: ${res.status} ${await res.text()}`)
    }
    console.log('+ comentário')
  }

  const taskRes = await api(base, cookies, `/api/projects/${PROJECT_ID}/tasks/${TASK_ID}`, {
    method: 'PUT',
    body: JSON.stringify({ description: TASK_DESCRIPTION }),
  })
  if (!taskRes.ok) {
    console.warn(`PUT descrição falhou (${taskRes.status}) — verifique manualmente`)
  } else {
    console.log('Descrição atualizada')
  }

  const verify = await fetch(`${base}/api/task-portal/${SHARE_TOKEN}`)
  const data = (await verify.json()) as {
    checklist: { progress: { total: number } }
    comments: unknown[]
  }
  console.log(`Verificado: ${data.checklist.progress.total} itens checklist, ${data.comments.length} comentários`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
