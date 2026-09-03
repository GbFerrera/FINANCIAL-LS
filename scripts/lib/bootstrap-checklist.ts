export type ChecklistGroup = {
  title: string
  items: Array<{ title: string; description?: string }>
}

/** Checklist padrão bootstrap produto Link System (4 fases). */
export function defaultBootstrapChecklist(projectName: string, baseRepo = 'FINANCIAL-LS'): ChecklistGroup[] {
  const slug = projectName.toLowerCase().replace(/\s+/g, '-')
  return [
    {
      title: '1. Repositório GitHub',
      items: [
        { title: `Criar repo privado \`${slug}\` (GbFerrera)`, description: `Base: cópia do ${baseRepo} se aplicável` },
        { title: 'Copiar código base para o novo repo', description: 'Excluir .git, node_modules, .next antes do push' },
        { title: `Renomear package e README para ${projectName}`, description: 'Atualizar name, descrição e links' },
        { title: 'Push inicial para `main`', description: 'git remote add origin + git push -u origin main' },
      ],
    },
    {
      title: '2. Base do sistema',
      items: [
        { title: 'Clonar/ajustar código base', description: 'Stack conforme projeto' },
        { title: 'Ajustar branding e env.example', description: 'NEXTAUTH_URL, SMTP, domínio' },
        { title: 'Revisar schema / escopo v1', description: 'Manter mínimo viável' },
        { title: 'Validar local: install + migrate + dev', description: 'Boot sem erros' },
      ],
    },
    {
      title: '3. Deploy (Coolify)',
      items: [
        { title: 'Criar app no Coolify', description: 'Dockerfile ou docker-compose existente' },
        { title: 'Configurar domínio e SSL', description: 'Traefik + FQDN' },
        { title: 'Variáveis de ambiente produção', description: 'DATABASE_URL, NEXTAUTH_*, SMTP, CRON_SECRET' },
        { title: 'PostgreSQL dedicado', description: 'Volume persistente' },
        { title: 'Deploy + smoke test', description: 'Login, /api/health' },
      ],
    },
    {
      title: '4. Pós-deploy',
      items: [
        { title: 'Seed admin (SEED_DB=true uma vez)', description: 'Desligar seed depois' },
        { title: 'Documentar no Link Brain', description: `Projetos/${projectName}/` },
        { title: 'Vincular repo ao projeto no PM', description: 'URL GitHub na nota' },
      ],
    },
  ]
}

export function defaultBootstrapComments(projectName: string, projectId: string, shareUrl: string): string[] {
  return [
    `## Contexto — ${projectName}

Projeto bootstrap criado via skill **link-system-pm-bootstrap**.

- **Vault:** \`/Users/gabrielferreira/Desktop/link-brain/Projetos/${projectName}/\`
- **PM projeto:** \`${projectId}\`
- **Task portal:** ${shareUrl}`,

    `## Ordem de execução

1. Repo GitHub
2. Base local
3. Deploy Coolify
4. Doc Link Brain

Marcar checklist conforme avançar.`,

    `## Referências

| Item | Valor |
|------|-------|
| PM | https://projects.linksystem.tech |
| Link Brain sync | \`pnpm link-brain:sync\` |
| Skill | \`link-system-pm-bootstrap\` |`,
  ]
}

export function defaultTaskDescription(projectName: string, shareUrl: string, repoSlug?: string): string {
  const repo = repoSlug || projectName.toLowerCase().replace(/\s+/g, '-')
  return `Bootstrap do **${projectName}**.

**Repositório alvo:** \`GbFerrera/${repo}\`
**Deploy:** Coolify (Servidor 2)

Portal: ${shareUrl}`
}
