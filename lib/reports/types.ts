export type ReportType = 'financial' | 'projects' | 'team' | 'clients'
export type ReportFormat = 'pdf' | 'csv' | 'xlsx'

export interface ReportColumn {
  key: string
  label: string
}

export interface ReportPayload {
  title: string
  type: ReportType
  generatedAt: string
  generatedBy: string
  dateRange?: { start?: string; end?: string }
  columns: ReportColumn[]
  rows: Record<string, string | number | null>[]
  summary?: Record<string, string | number>
}

export interface StoredReportMeta {
  id: string
  name: string
  type: ReportType
  format: ReportFormat
  filename: string
  size: number
  createdAt: string
  description: string
  userId: string
  rowCount?: number
  dateRange?: { start?: string; end?: string }
  generatedBy?: string
}

export interface ReportExportRequest {
  name?: string
  type: ReportType
  format: ReportFormat
  dateRange?: { start?: string; end?: string }
  filters?: { status?: string; client?: string; department?: string }
}

export function normalizeFormat(format: string): ReportFormat | null {
  if (format === 'pdf' || format === 'csv') return format
  if (format === 'excel' || format === 'xlsx') return 'xlsx'
  return null
}

export function formatExtension(format: ReportFormat): string {
  return format === 'xlsx' ? 'xlsx' : format
}

export function formatMimeType(format: ReportFormat): string {
  switch (format) {
    case 'pdf':
      return 'application/pdf'
    case 'csv':
      return 'text/csv; charset=utf-8'
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  }
}
