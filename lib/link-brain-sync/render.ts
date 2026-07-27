import type { ProjectStatus } from "@prisma/client"
import {
  categoryLabel,
  type ClientCategory,
  type SyncClient,
  type SyncProject,
  type SyncSubscription,
} from "./classify"
import { clientWikilink, projectWikilink, sanitizeFilename } from "./paths"

const SOURCE = "https://projects.linksystem.tech"

export const AUTO_START = "<!-- link-brain:auto:start -->"
export const AUTO_END = "<!-- link-brain:auto:end -->"
export const MANUAL_MARKER = "<!-- link-brain:manual -->"

export function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function formatMoney(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function yamlQuote(value: string): string {
  if (/[:#\[\]{}&,*?]|^\s|\s$/.test(value)) return `"${value.replace(/"/g, '\\"')}"`
  return value
}

function projectTags(project: SyncProject, clientCompany: string | null): string[] {
  const tags = ["projeto", "sync"]
  const company = (clientCompany || "").toLowerCase()
  if (company.includes("link system")) tags.push("link-system")
  return tags
}

function clientTags(client: SyncClient): string[] {
  const tags = ["cliente", "sync", client.category.replace(/_/g, "-")]
  const company = (client.company || "").toLowerCase()
  if (company.includes("barbearia")) tags.push("barbearia", "link-callendar")
  if (company.includes("churrasco") || company.includes("império") || company.includes("imperio"))
    tags.push("linkeats", "restaurante")
  if (company.includes("clínica") || company.includes("clinica") || company.includes("med"))
    tags.push("clinica")
  if (company.includes("link system")) tags.push("link-system", "desenvolvimento")
  return [...new Set(tags)]
}

function renderProjectTable(projects: SyncProject[]): string {
  if (projects.length === 0) return "Nenhum."
  return [
    "| Projeto | Status |",
    "|---------|--------|",
    ...projects.map((p) => `| ${projectWikilink(p.name)} | ${p.status} |`),
  ].join("\n")
}

function renderSubscriptionTable(subs: SyncSubscription[]): string {
  if (subs.length === 0) return "Nenhuma ativa."
  return [
    "| Plano | Grupo | Valor |",
    "|-------|-------|-------|",
    ...subs.map((s) => `| ${s.plan} | ${s.group} | ${formatMoney(s.price)}/mês |`),
  ].join("\n")
}

export function renderClientBody(client: SyncClient): string {
  const title = sanitizeFilename(client.company || client.name)
  const lines: string[] = [`# ${title}`, ""]

  lines.push("## Dados", "")
  lines.push("| Campo | Valor |")
  lines.push("|-------|-------|")
  lines.push(`| Contato | ${client.name} |`)
  lines.push(`| E-mail | ${client.email} |`)
  if (client.phone) lines.push(`| Telefone | ${client.phone} |`)
  lines.push(`| Categoria | **${categoryLabel(client.category)}** |`)
  lines.push("")

  if (client.subscriptions.length > 0) {
    lines.push("## Assinatura ativa", "")
    lines.push(renderSubscriptionTable(client.subscriptions))
    lines.push("")
  }

  if (client.category === "desenvolvimento_ativo") {
    lines.push("## Projetos ativos", "")
    lines.push(renderProjectTable(client.activeProjects))
    lines.push("")
  } else if (client.category === "historico_sem_ativo") {
    lines.push("## Projetos", "")
    lines.push(renderProjectTable(client.inactiveProjects))
    lines.push("")
  } else if (client.category === "somente_assinante") {
    lines.push("## Projetos de desenvolvimento", "")
    lines.push("Nenhum.")
    lines.push("")
  } else {
    lines.push("## Projetos", "")
    lines.push("Nenhum.")
    lines.push("")
    lines.push("## Assinaturas", "")
    lines.push("Nenhuma ativa.")
    lines.push("")
  }

  lines.push("[[Clientes/00 - Clientes|← Clientes]]")
  return lines.join("\n")
}

export function renderClientNote(client: SyncClient, manualSection = ""): string {
  const title = sanitizeFilename(client.company || client.name)
  const frontmatter = [
    "---",
    "type: client",
    `tags: [${clientTags(client).map(yamlQuote).join(", ")}]`,
    `category: ${client.category}`,
    client.company ? `company: ${yamlQuote(client.company)}` : null,
    `pm_id: ${client.id}`,
    `updated: ${formatDate(new Date())}`,
    `source: ${SOURCE}`,
    "sync: auto",
    "---",
  ]
    .filter(Boolean)
    .join("\n")

  const manual = manualSection.trim()
    ? `\n\n${MANUAL_MARKER}\n\n${manualSection.trim()}\n`
    : ""

  return `${frontmatter}\n\n${AUTO_START}\n${renderClientBody(client)}\n${AUTO_END}${manual}\n`
}

export function renderProjectNote(
  project: SyncProject & {
    client: { id: string; name: string; company: string | null }
  },
  manualSection = ""
): string {
  const dir = sanitizeFilename(project.name)
  const frontmatter = [
    "---",
    "type: project",
    `tags: [${projectTags(project, project.client.company).map(yamlQuote).join(", ")}]`,
    `status: ${project.status}`,
    `client: ${sanitizeFilename(project.client.company || project.client.name)}`,
    `pm_id: ${project.id}`,
    `pm_client_id: ${project.client.id}`,
    `updated: ${formatDate(new Date())}`,
    `source: ${SOURCE}`,
    "sync: auto",
    "---",
  ].join("\n")

  const body = [
    `# ${project.name}`,
    "",
    "## Resumo",
    "",
    "| Campo | Valor |",
    "|-------|-------|",
    `| **Status** | ${project.status} |`,
    `| **Cliente** | ${clientWikilink(project.client)} |`,
    `| **PM ID** | ${project.id} |`,
    project.budget != null ? `| **Orçamento** | ${formatMoney(project.budget)} |` : null,
    project.startDate ? `| **Início** | ${formatDate(project.startDate)} |` : null,
    project.endDate ? `| **Previsão fim** | ${formatDate(project.endDate)} |` : null,
    "",
    "## Descrição",
    "",
    project.description?.trim() || "*Sem descrição no PM — editar em projects.linksystem.tech*",
    "",
    "## Documentação técnica (manual)",
    "",
    "Notas filhas mantidas manualmente no vault:",
    "",
    "- [[Arquitetura]]",
    "- [[Deploy e Infra]]",
    "- [[Variáveis de ambiente]]",
    "",
    "[[Projetos/00 - Projetos|← Projetos]]",
  ]
    .filter((line) => line !== null)
    .join("\n")

  const manual = manualSection.trim()
    ? `\n\n${MANUAL_MARKER}\n\n${manualSection.trim()}\n`
    : ""

  return `${frontmatter}\n\n${AUTO_START}\n${body}\n${AUTO_END}${manual}\n`
}

export function renderClientsMoc(
  clients: SyncClient[],
  syncedAt: string,
  totals: { projects: number; subscriptions: number }
): string {
  const byCategory = (cat: ClientCategory) => clients.filter((c) => c.category === cat)

  const dev = byCategory("desenvolvimento_ativo")
  const subs = byCategory("somente_assinante")
  const hist = byCategory("historico_sem_ativo")
  const none = byCategory("sem_vinculo")

  const link = (c: SyncClient) =>
    `[[Clientes/${sanitizeFilename(c.company || c.name)}|${c.company || c.name}]]`

  const subsByGroup = subs.reduce<Record<string, SyncClient[]>>((acc, c) => {
    const group = c.subscriptions[0]?.group || "Outros"
    if (!acc[group]) acc[group] = []
    acc[group].push(c)
    return acc
  }, {})

  let subsSection = ""
  for (const [group, groupClients] of Object.entries(subsByGroup).sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    subsSection += `\n### ${group} — ${groupClients.length} cliente(s)\n\n`
    subsSection += "| Cliente | Plano | Valor/mês |\n|---------|-------|-----------|\n"
    for (const c of groupClients.sort((a, b) =>
      (a.company || a.name).localeCompare(b.company || b.name)
    )) {
      const s = c.subscriptions[0]
      subsSection += `| ${link(c)} | ${s?.plan || "—"} | ${s ? formatMoney(s.price) : "—"} |\n`
    }
  }

  const allProjects = clients.flatMap((c) =>
    c.projects.map((p) => ({ p, c }))
  )

  return `---
type: moc
tags: [clientes, sync]
updated: ${formatDate(new Date())}
source: ${SOURCE}
synced_at: ${syncedAt}
---

# Clientes — Link System

Base sincronizada automaticamente do **projects.linksystem.tech**.

**Totais:** ${clients.length} clientes · ${totals.projects} projetos · ${totals.subscriptions} planos de assinatura ativos

> Sync automático via \`link-brain:sync\` — conteúdo entre \`${AUTO_START}\` é gerado pelo PM.

---

## Classificação

| Categoria | Qtd | Descrição |
|-----------|-----|-----------|
| Desenvolvimento ativo | ${dev.length} | Projeto em PLANNING, IN_PROGRESS ou ON_HOLD |
| Somente assinantes | ${subs.length} | Assinatura ACTIVE, sem projeto de dev |
| Histórico sem ativo | ${hist.length} | Projeto COMPLETED/CANCELLED, nada ativo |
| Sem vínculo ativo | ${none.length} | Sem projeto nem assinatura |

---

## Desenvolvimento ativo

| Cliente | Projetos ativos |
|---------|-----------------|
${dev
  .map(
    (c) =>
      `| ${link(c)} | ${c.activeProjects.map((p) => `${p.name} \`${p.status}\``).join(", ") || "—"} |`
  )
  .join("\n")}

---

## Somente assinantes
${subsSection || "\n*Nenhum.*\n"}

---

## Histórico sem projeto ativo

| Cliente | Projeto concluído |
|---------|-------------------|
${hist
  .map(
    (c) =>
      `| ${link(c)} | ${c.inactiveProjects.map((p) => `${p.name} \`${p.status}\``).join(", ") || "—"} |`
  )
  .join("\n")}

---

## Sem vínculo ativo

| Cliente |
|---------|
${none.map((c) => `| ${link(c)} |`).join("\n")}

---

## Todos os projetos (${allProjects.length})

Ver [[Projetos/00 - Projetos|Catálogo de projetos]].

| Projeto | Cliente | Status |
|---------|---------|--------|
${[...allProjects]
  .sort((a, b) => a.p.name.localeCompare(b.p.name))
  .map(
    ({ p, c }) =>
      `| ${projectWikilink(p.name)} | ${link(c)} | ${p.status} |`
  )
  .join("\n")}

---

## Links

- [[00 - Home|Home]]
- [[Projetos/00 - Projetos|Projetos]]
`
}

export function renderProjectsMoc(
  clients: SyncClient[],
  syncedAt: string
): string {
  const linkSystem = clients.find(
    (c) => (c.company || "").toLowerCase().includes("link system")
  )
  const ownProjects = linkSystem?.projects || []
  const activeOwn = ownProjects.filter((p) =>
    ["PLANNING", "IN_PROGRESS", "ON_HOLD"].includes(p.status)
  )
  const clientProjects = clients
    .filter((c) => c.category === "desenvolvimento_ativo" && !c.company?.toLowerCase().includes("link system"))
    .flatMap((c) => c.activeProjects.map((p) => ({ p, c })))
  const completed = clients.flatMap((c) =>
    c.inactiveProjects.map((p) => ({ p, c }))
  )

  const pl = (name: string) => projectWikilink(name)
  const cl = (c: SyncClient) =>
    `[[Clientes/${sanitizeFilename(c.company || c.name)}|${c.company || c.name}]]`

  return `---
type: moc
tags: [projetos, sync]
updated: ${formatDate(new Date())}
source: ${SOURCE}
synced_at: ${syncedAt}
---

# Projetos — Link System

Catálogo sincronizado automaticamente do PM — **${ownProjects.length + clientProjects.length + completed.length} projetos** registrados.

---

## Produtos Link (Link System)

| Projeto | Status |
|---------|--------|
${activeOwn.map((p) => `| ${pl(p.name)} | ${p.status} |`).join("\n")}

---

## Projetos de clientes — desenvolvimento ativo

| Projeto | Cliente | Status |
|---------|---------|--------|
${clientProjects.map(({ p, c }) => `| ${pl(p.name)} | ${cl(c)} | ${p.status} |`).join("\n")}

---

## Projetos concluídos

| Projeto | Cliente | Status |
|---------|---------|--------|
${completed.map(({ p, c }) => `| ${pl(p.name)} | ${cl(c)} | ${p.status} |`).join("\n")}

---

## Assinantes (sem projeto de dev)

Ver [[Clientes/00 - Clientes#Somente assinantes|Clientes → Somente assinantes]].

[[Templates/Projeto|Template novo projeto]]
`
}

export function extractManualSection(content: string): string {
  const manualIdx = content.indexOf(MANUAL_MARKER)
  if (manualIdx >= 0) {
    return content.slice(manualIdx + MANUAL_MARKER.length).trim()
  }

  const autoEnd = content.indexOf(AUTO_END)
  if (autoEnd >= 0) {
    return content.slice(autoEnd + AUTO_END.length).trim()
  }

  // Migração: preservar seções manuais conhecidas fora do bloco auto
  const manualSections = ["## Local", "## Hub", "## Observações"]
  const parts: string[] = []
  for (const heading of manualSections) {
    const idx = content.indexOf(heading)
    if (idx >= 0) {
      const start = content.lastIndexOf("\n## ", idx)
      const sliceStart = start >= 0 ? start + 1 : idx
      const next = content.indexOf("\n## ", sliceStart + heading.length)
      const section = content.slice(sliceStart, next >= 0 ? next : undefined).trim()
      if (section && !parts.includes(section)) parts.push(section)
    }
  }
  return parts.join("\n\n")
}
