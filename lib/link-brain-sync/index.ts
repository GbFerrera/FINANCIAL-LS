import fs from "fs/promises"
import path from "path"
import { execFile } from "child_process"
import { promisify } from "util"
import type { PrismaClient } from "@prisma/client"
import { classifyClient, type SyncClient, type SyncSubscription } from "./classify"
import {
  clientNotePath,
  projectNotePath,
  sanitizeFilename,
} from "./paths"
import {
  extractManualSection,
  renderClientNote,
  renderClientsMoc,
  renderProjectNote,
  renderProjectsMoc,
} from "./render"

const execFileAsync = promisify(execFile)

export type LinkBrainSyncOptions = {
  vaultPath: string
  dryRun?: boolean
  gitPush?: boolean
  gitCommitMessage?: string
}

export type LinkBrainSyncResult = {
  ok: boolean
  skipped?: boolean
  reason?: string
  syncedAt: string
  vaultPath: string
  dryRun: boolean
  stats: {
    clients: number
    projects: number
    activeSubscriptions: number
    filesWritten: number
    filesSkipped: number
  }
  written: string[]
}

async function readManualSection(filePath: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath, "utf8")
    return extractManualSection(content)
  } catch {
    return ""
  }
}

async function writeFileSafe(
  filePath: string,
  content: string,
  dryRun: boolean
): Promise<boolean> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  let existing = ""
  try {
    existing = await fs.readFile(filePath, "utf8")
  } catch {
    // new file
  }
  if (existing === content) return false
  if (!dryRun) await fs.writeFile(filePath, content, "utf8")
  return true
}

export async function fetchLinkBrainData(prisma: PrismaClient) {
  const [clientsRaw, subscriptionsRaw, projectCount] = await Promise.all([
    prisma.client.findMany({
      orderBy: { company: "asc" },
      include: {
        projects: {
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            status: true,
            description: true,
            startDate: true,
            endDate: true,
            budget: true,
            clientId: true,
          },
        },
        subscriptions: {
          where: { status: "ACTIVE" },
          include: {
            subscription: {
              include: { group: true },
            },
          },
        },
      },
    }),
    prisma.subscription.findMany({
      where: { isActive: true },
      include: {
        clients: {
          where: { status: "ACTIVE" },
        },
      },
    }),
    prisma.project.count(),
  ])

  const activeSubscriptionLinks = subscriptionsRaw.reduce((sum, s) => sum + s.clients.length, 0)

  const clients: SyncClient[] = clientsRaw.map((c) => {
    const subscriptions: SyncSubscription[] = c.subscriptions.map((cs) => ({
      plan: cs.subscription.name,
      group: cs.subscription.group.name,
      status: cs.status,
      price: cs.subscription.price,
    }))
    const projects = c.projects.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      description: p.description,
      startDate: p.startDate,
      endDate: p.endDate,
      budget: p.budget,
    }))
    const classified = classifyClient(projects, subscriptions)
    return {
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      company: c.company,
      projects,
      subscriptions,
      ...classified,
    }
  })

  const clientById = new Map(clientsRaw.map((c) => [c.id, c]))

  const projectsWithClient = clientsRaw.flatMap((c) =>
    c.projects.map((p) => ({
      ...p,
      client: {
        id: c.id,
        name: c.name,
        company: c.company,
      },
    }))
  )

  return {
    clients,
    projectsWithClient,
    clientById,
    totals: {
      projects: projectCount,
      activeSubscriptions: activeSubscriptionLinks,
    },
  }
}

export async function syncLinkBrainVault(
  prisma: PrismaClient,
  options: LinkBrainSyncOptions
): Promise<LinkBrainSyncResult> {
  const syncedAt = new Date().toISOString()
  const vaultPath = path.resolve(options.vaultPath)
  const dryRun = options.dryRun ?? false
  const written: string[] = []
  let filesSkipped = 0

  try {
    await fs.access(vaultPath)
  } catch {
    return {
      ok: false,
      skipped: true,
      reason: `Vault não encontrado: ${vaultPath}`,
      syncedAt,
      vaultPath,
      dryRun,
      stats: {
        clients: 0,
        projects: 0,
        activeSubscriptions: 0,
        filesWritten: 0,
        filesSkipped: 0,
      },
      written: [],
    }
  }

  const { clients, projectsWithClient, totals } = await fetchLinkBrainData(prisma)

  // MOCs
  const mocClientsPath = path.join(vaultPath, "Clientes", "00 - Clientes.md")
  const mocProjectsPath = path.join(vaultPath, "Projetos", "00 - Projetos.md")

  const mocClients = renderClientsMoc(clients, syncedAt, {
    projects: totals.projects,
    subscriptions: totals.activeSubscriptions,
  })
  const mocProjects = renderProjectsMoc(clients, syncedAt)

  for (const [filePath, content] of [
    [mocClientsPath, mocClients],
    [mocProjectsPath, mocProjects],
  ] as const) {
    const changed = await writeFileSafe(filePath, content, dryRun)
    if (changed) written.push(path.relative(vaultPath, filePath))
    else filesSkipped += 1
  }

  // Client notes
  for (const client of clients) {
    const filePath = clientNotePath(vaultPath, client)
    const manual = await readManualSection(filePath)
    const content = renderClientNote(client, manual)
    const changed = await writeFileSafe(filePath, content, dryRun)
    if (changed) written.push(path.relative(vaultPath, filePath))
    else filesSkipped += 1
  }

  // Project index notes (não sobrescreve Arquitetura.md etc.)
  for (const project of projectsWithClient) {
    const filePath = projectNotePath(vaultPath, project.name)
    const manual = await readManualSection(filePath)
    const content = renderProjectNote(project, manual)
    const changed = await writeFileSafe(filePath, content, dryRun)
    if (changed) written.push(path.relative(vaultPath, filePath))
    else filesSkipped += 1
  }

  // Update home sync line (light touch)
  const homePath = path.join(vaultPath, "00 - Home.md")
  try {
    let home = await fs.readFile(homePath, "utf8")
    const syncBlock = `## Clientes (sync ${syncedAt.slice(0, 10)})

- **${clients.length} clientes** — ver [[Clientes/00 - Clientes|Clientes]]
- ${clients.filter((c) => c.category === "desenvolvimento_ativo").length} com dev ativo · ${clients.filter((c) => c.category === "somente_assinante").length} assinantes · ${clients.filter((c) => c.category === "historico_sem_ativo").length} histórico · ${clients.filter((c) => c.category === "sem_vinculo").length} sem vínculo
- Fonte: [projects.linksystem.tech](https://projects.linksystem.tech) — sync automático`

    if (/## Clientes \(sync .+\)[\s\S]*?(?=\n## |\n---|\Z)/.test(home)) {
      home = home.replace(
        /## Clientes \(sync .+\)[\s\S]*?(?=\n## |\n---|\Z)/,
        syncBlock + "\n"
      )
    } else if (home.includes("## Próximos passos")) {
      home = home.replace("## Próximos passos", `${syncBlock}\n\n---\n\n## Próximos passos`)
    }
    const homeChanged = await writeFileSafe(homePath, home, dryRun)
    if (homeChanged) written.push("00 - Home.md")
    else filesSkipped += 1
  } catch {
    // home optional
  }

  if (!dryRun && options.gitPush && written.length > 0) {
    await gitCommitAndPush(vaultPath, options.gitCommitMessage)
  }

  return {
    ok: true,
    syncedAt,
    vaultPath,
    dryRun,
    stats: {
      clients: clients.length,
      projects: totals.projects,
      activeSubscriptions: totals.activeSubscriptions,
      filesWritten: written.length,
      filesSkipped,
    },
    written,
  }
}

async function gitCommitAndPush(vaultPath: string, message?: string) {
  const msg =
    message ||
    `chore(link-brain): sync automático do PM ${new Date().toISOString().slice(0, 10)}`
  const opts = { cwd: vaultPath }
  try {
    await execFileAsync("git", ["add", "-A"], opts)
    const { stdout: status } = await execFileAsync("git", ["status", "--porcelain"], opts)
    if (!status.trim()) return
    await execFileAsync("git", ["commit", "-m", msg], opts)
    await execFileAsync("git", ["push"], opts)
  } catch (err) {
    console.warn("[link-brain-sync] git push falhou:", err)
  }
}

export function getVaultPathFromEnv(): string | null {
  const p = process.env.OBSIDIAN_VAULT_PATH || process.env.LINK_BRAIN_VAULT_PATH
  return p?.trim() || null
}

export function isLinkBrainSyncEnabled(): boolean {
  if (process.env.LINK_BRAIN_SYNC_ENABLED === "0") return false
  return Boolean(getVaultPathFromEnv())
}
