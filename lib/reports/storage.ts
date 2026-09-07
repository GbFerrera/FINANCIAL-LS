import { mkdir, readFile, writeFile, unlink, readdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import {
  ReportFormat,
  ReportPayload,
  StoredReportMeta,
  formatExtension,
} from './types'

const REPORTS_DIR = join(process.cwd(), 'uploads', 'reports')

function userDir(userId: string) {
  return join(REPORTS_DIR, userId)
}

function metaPath(userId: string, reportId: string) {
  return join(userDir(userId), `${reportId}.meta.json`)
}

function previewPath(userId: string, reportId: string) {
  return join(userDir(userId), `${reportId}.preview.json`)
}

function filePath(userId: string, reportId: string, format: ReportFormat) {
  return join(userDir(userId), `${reportId}.${formatExtension(format)}`)
}

export async function ensureReportsDir(userId: string) {
  const dir = userDir(userId)
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }
}

export async function saveReportFile(
  userId: string,
  reportId: string,
  format: ReportFormat,
  buffer: Buffer
): Promise<string> {
  await ensureReportsDir(userId)
  const path = filePath(userId, reportId, format)
  await writeFile(path, buffer)
  return path
}

export async function saveReportMeta(meta: StoredReportMeta) {
  await ensureReportsDir(meta.userId)
  await writeFile(metaPath(meta.userId, meta.id), JSON.stringify(meta, null, 2), 'utf-8')
}

export async function saveReportPreview(
  userId: string,
  reportId: string,
  payload: ReportPayload
) {
  await ensureReportsDir(userId)
  await writeFile(previewPath(userId, reportId), JSON.stringify(payload), 'utf-8')
}

export async function getReportPreview(
  userId: string,
  reportId: string
): Promise<ReportPayload | null> {
  const path = previewPath(userId, reportId)
  if (!existsSync(path)) return null
  const raw = await readFile(path, 'utf-8')
  return JSON.parse(raw) as ReportPayload
}

export async function getReportMeta(
  userId: string,
  reportId: string
): Promise<StoredReportMeta | null> {
  const path = metaPath(userId, reportId)
  if (!existsSync(path)) return null
  const raw = await readFile(path, 'utf-8')
  return JSON.parse(raw) as StoredReportMeta
}

export async function readReportFile(
  userId: string,
  reportId: string,
  format: ReportFormat
): Promise<Buffer | null> {
  const path = filePath(userId, reportId, format)
  if (!existsSync(path)) return null
  return readFile(path)
}

export async function listUserReports(userId: string): Promise<StoredReportMeta[]> {
  const dir = userDir(userId)
  if (!existsSync(dir)) return []

  const files = await readdir(dir)
  const metas = await Promise.all(
    files
      .filter((f) => f.endsWith('.meta.json'))
      .map(async (f) => {
        const raw = await readFile(join(dir, f), 'utf-8')
        return JSON.parse(raw) as StoredReportMeta
      })
  )

  return metas.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

export async function deleteReport(userId: string, reportId: string): Promise<boolean> {
  const meta = await getReportMeta(userId, reportId)
  if (!meta) return false

  const paths = [
    metaPath(userId, reportId),
    previewPath(userId, reportId),
    filePath(userId, reportId, meta.format),
  ]

  await Promise.all(
    paths.map(async (path) => {
      if (existsSync(path)) await unlink(path)
    })
  )

  return true
}
