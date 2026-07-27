import path from "path"

const INVALID_FILENAME = /[<>:"/\\|?*\x00-\x1f]/g

export function sanitizeFilename(name: string): string {
  return name
    .replace(INVALID_FILENAME, "")
    .replace(/\s+/g, " ")
    .trim()
}

export function clientFilename(client: { id: string; company: string | null; name: string }): string {
  const base = sanitizeFilename(client.company || client.name)
  return `${base || client.id}.md`
}

export function projectDirName(name: string): string {
  return sanitizeFilename(name) || "projeto"
}

export function clientNotePath(vaultRoot: string, client: { id: string; company: string | null; name: string }) {
  return path.join(vaultRoot, "Clientes", clientFilename(client))
}

export function projectNotePath(vaultRoot: string, projectName: string) {
  const dir = projectDirName(projectName)
  return path.join(vaultRoot, "Projetos", dir, `${dir}.md`)
}

export function clientWikilink(client: { company: string | null; name: string }): string {
  const label = sanitizeFilename(client.company || client.name)
  return `[[Clientes/${label}|${client.company || client.name}]]`
}

export function projectWikilink(projectName: string): string {
  const dir = projectDirName(projectName)
  return `[[Projetos/${dir}/${dir}|${projectName}]]`
}
