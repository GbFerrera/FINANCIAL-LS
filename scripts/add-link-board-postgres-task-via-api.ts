/**
 * Adiciona fase PostgreSQL + Prisma na task Link Board (PM).
 */
import { pmApi, pmSession } from './lib/pm-api-client'

const TASK_ID = 'cmsryiir000egnv2cq54vzw87'

const GROUP = {
  title: '5. PostgreSQL + Prisma (melhoria)',
  items: [
    {
      title: 'Subir Postgres — docker compose up db -d',
      description: 'Banco local na porta 5432',
    },
    {
      title: 'Configurar DATABASE_URL em api/.env',
      description: 'postgresql://linkboard:linkboard@localhost:5436/linkboard',
    },
    {
      title: 'Rodar prisma db push na pasta api',
    },
    {
      title: 'Validar persistencia — criar pedido, reiniciar API, pedido continua',
    },
    {
      title: 'Explorar schema — api/prisma/schema.prisma (Order + OrderItem)',
    },
    {
      title: 'Opcional: prisma studio para ver dados na UI',
    },
  ],
}

const COMMENT = `[PostgreSQL]
- Banco: Postgres 16 via Docker Compose
- ORM: Prisma (mesmo padrao Link Eats)
- Pedidos persistem apos reload e restart da API
- Health: GET /health retorna { ok, db }`

async function main() {
  const { base, cookies } = await pmSession()

  const checklistRes = await pmApi(base, cookies, `/api/tasks/${TASK_ID}/checklist`)
  const { groups } = (await checklistRes.json()) as { groups: Array<{ title: string }> }

  if (groups.some((g) => g.title.includes('PostgreSQL'))) {
    console.log('Fase PostgreSQL ja existe — skip checklist')
  } else {
    const groupRes = await pmApi(base, cookies, `/api/tasks/${TASK_ID}/checklist`, {
      method: 'POST',
      body: JSON.stringify({ action: 'create_group', title: GROUP.title }),
    })
    if (!groupRes.ok) throw new Error(await groupRes.text())
    const { group } = (await groupRes.json()) as { group: { id: string } }

    for (const item of GROUP.items) {
      await pmApi(base, cookies, `/api/tasks/${TASK_ID}/checklist`, {
        method: 'POST',
        body: JSON.stringify({
          action: 'create_item',
          groupId: group.id,
          title: item.title,
          description: item.description,
        }),
      })
    }
    console.log(`+ ${GROUP.title} (${GROUP.items.length} itens)`)
  }

  const commentsRes = await pmApi(base, cookies, `/api/tasks/${TASK_ID}/comments`)
  const comments = commentsRes.ok ? ((await commentsRes.json()) as Array<{ content: string }>) : []

  if (!comments.some((c) => c.content.startsWith('[PostgreSQL]'))) {
    await pmApi(base, cookies, `/api/tasks/${TASK_ID}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content: COMMENT }),
    })
    console.log('+ comentario PostgreSQL')
  }

  console.log('Task atualizada:', `https://projects.linksystem.tech/task-portal/52f16ea3-8612-4b56-b769-be96d8377bec`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
