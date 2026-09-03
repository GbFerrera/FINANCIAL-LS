/**
 * Popula checklist e comentários da task "Iniciar projeto" (Link Control).
 *
 * Uso (produção — pegar DATABASE_URL no Coolify do projects):
 *   DATABASE_URL="postgresql://..." npx tsx scripts/setup-link-control-task.ts
 *
 * Portal: https://projects.linksystem.tech/task-portal/be242873-b7b6-486f-b4a0-095e5c5bb248
 */
import { PrismaClient } from '@prisma/client'

const SHARE_TOKEN = 'be242873-b7b6-486f-b4a0-095e5c5bb248'

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

Portal: https://projects.linksystem.tech/task-portal/be242873-b7b6-486f-b4a0-095e5c5bb248`

async function main() {
  const prisma = new PrismaClient()

  const task = await prisma.task.findFirst({
    where: { shareToken: SHARE_TOKEN },
    include: { project: true, checklistGroups: { include: { items: true } } },
  })

  if (!task) {
    console.error(`Task com shareToken ${SHARE_TOKEN} não encontrada neste DATABASE_URL.`)
    console.error('Use o DATABASE_URL de produção (Coolify → projects → Environment).')
    process.exit(1)
  }

  console.log(`Task: ${task.title} (${task.id}) · Projeto: ${task.project.name}`)

  if (task.checklistGroups.length > 0) {
    console.log('Checklist já existe — pulando criação (delete manual se quiser recriar).')
  } else {
    for (let gi = 0; gi < CHECKLIST.length; gi++) {
      const groupDef = CHECKLIST[gi]
      const group = await prisma.taskChecklistGroup.create({
        data: { title: groupDef.title, taskId: task.id, order: gi },
      })
      for (let ii = 0; ii < groupDef.items.length; ii++) {
        const itemDef = groupDef.items[ii]
        await prisma.taskChecklistItem.create({
          data: {
            title: itemDef.title,
            description: itemDef.description ?? null,
            groupId: group.id,
            taskId: task.id,
            order: ii,
          },
        })
      }
      console.log(`+ Grupo: ${groupDef.title} (${groupDef.items.length} itens)`)
    }
  }

  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    orderBy: { createdAt: 'asc' },
  })

  if (!admin) {
    console.warn('Nenhum admin encontrado — comentários não criados.')
  } else {
    for (const content of COMMENTS) {
      const prefix = content.slice(0, 50)
      const existing = await prisma.comment.findFirst({
        where: { taskId: task.id, content: { startsWith: prefix } },
      })
      if (existing) {
        console.log('Comentário já existe — skip')
        continue
      }
      await prisma.comment.create({
        data: {
          content,
          authorId: admin.id,
          projectId: task.projectId,
          taskId: task.id,
          type: 'INTERNAL',
        },
      })
      console.log('+ Comentário adicionado')
    }
  }

  await prisma.task.update({
    where: { id: task.id },
    data: { description: TASK_DESCRIPTION },
  })

  console.log('Descrição da task atualizada.')
  await prisma.$disconnect()
  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
