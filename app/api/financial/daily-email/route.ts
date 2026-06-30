import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import nodemailer from "nodemailer"
import { z } from "zod"
import { UserRole, PaymentStatus } from "@prisma/client"
import fs from "node:fs"
import path from "node:path"
import zlib from "node:zlib"

function daysInMonth(year: number, monthIndex0: number) {
  return new Date(year, monthIndex0 + 1, 0).getDate()
}

function dueDateForMonth(year: number, monthIndex0: number, dueDay: number) {
  const dim = daysInMonth(year, monthIndex0)
  const day = Math.min(Math.max(1, dueDay), dim)
  return new Date(year, monthIndex0, day, 12, 0, 0, 0)
}

function dateKey(d: Date) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

function formatDateBR(d: Date) {
  return d.toLocaleDateString("pt-BR")
}

function formatDateTimeBR(d: Date) {
  return d.toLocaleString("pt-BR")
}

function recurringLabel(t?: string | null) {
  const v = (t || "").toUpperCase()
  if (v === "YEARLY") return "Anual"
  if (v === "QUARTERLY") return "Trimestral"
  return "Mensal"
}

function escapePdfText(text: string) {
  return (text || "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")
}

function readPngRgb(filePath: string): { width: number; height: number; rgb: Buffer } | null {
  try {
    const bytes = fs.readFileSync(filePath)
    if (bytes.length < 8) return null
    const signature = bytes.subarray(0, 8)
    const expected = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    if (!signature.equals(expected)) return null

    let pos = 8
    let width = 0
    let height = 0
    let bitDepth = 0
    let colorType = 0
    const idatChunks: Buffer[] = []

    while (pos + 8 <= bytes.length) {
      const len = bytes.readUInt32BE(pos)
      pos += 4
      const type = bytes.subarray(pos, pos + 4).toString("ascii")
      pos += 4
      const data = bytes.subarray(pos, pos + len)
      pos += len
      pos += 4
      if (type === "IHDR") {
        width = data.readUInt32BE(0)
        height = data.readUInt32BE(4)
        bitDepth = data.readUInt8(8)
        colorType = data.readUInt8(9)
      } else if (type === "IDAT") {
        idatChunks.push(data)
      } else if (type === "IEND") {
        break
      }
    }

    if (!width || !height) return null
    if (bitDepth !== 8) return null
    if (colorType !== 6 && colorType !== 2) return null

    const compressed = Buffer.concat(idatChunks)
    const inflated = zlib.inflateSync(compressed)

    const bytesPerPixel = colorType === 6 ? 4 : 3
    const rowSize = width * bytesPerPixel
    const expectedSize = (rowSize + 1) * height
    if (inflated.length < expectedSize) return null

    const recon = Buffer.alloc(height * rowSize)
    const paeth = (a: number, b: number, c: number) => {
      const p = a + b - c
      const pa = Math.abs(p - a)
      const pb = Math.abs(p - b)
      const pc = Math.abs(p - c)
      if (pa <= pb && pa <= pc) return a
      if (pb <= pc) return b
      return c
    }

    for (let y = 0; y < height; y += 1) {
      const rowStart = y * (rowSize + 1)
      const filter = inflated[rowStart]
      const inRow = inflated.subarray(rowStart + 1, rowStart + 1 + rowSize)
      const outRow = recon.subarray(y * rowSize, (y + 1) * rowSize)
      const prevRow = y === 0 ? null : recon.subarray((y - 1) * rowSize, y * rowSize)

      for (let x = 0; x < rowSize; x += 1) {
        const raw = inRow[x]
        const left = x >= bytesPerPixel ? outRow[x - bytesPerPixel] : 0
        const up = prevRow ? prevRow[x] : 0
        const upLeft = prevRow && x >= bytesPerPixel ? prevRow[x - bytesPerPixel] : 0
        let val = 0
        if (filter === 0) val = raw
        else if (filter === 1) val = (raw + left) & 0xff
        else if (filter === 2) val = (raw + up) & 0xff
        else if (filter === 3) val = (raw + Math.floor((left + up) / 2)) & 0xff
        else if (filter === 4) val = (raw + paeth(left, up, upLeft)) & 0xff
        else return null
        outRow[x] = val
      }
    }

    if (colorType === 2) return { width, height, rgb: recon }

    const rgb = Buffer.alloc(width * height * 3)
    for (let i = 0, j = 0; i < recon.length; i += 4, j += 3) {
      rgb[j] = recon[i]
      rgb[j + 1] = recon[i + 1]
      rgb[j + 2] = recon[i + 2]
    }
    return { width, height, rgb }
  } catch {
    return null
  }
}

function buildStyledPdf(input: {
  dateLabel: string
  summary: Array<{ label: string; value: string }>
  receiveRows: Array<{ name: string; amount: string; status: string }>
  payRows: Array<{ name: string; amount: string; status: string }>
  entriesRows: Array<{ name: string; amount: string; status: string }>
}) {
  const margin = 40
  const pageW = 612
  const pageH = 792
  const headerH = 64
  const headerY = pageH - headerH

  const logoPath = path.join(process.cwd(), "public", "logo-cortada.png")
  const logo = readPngRgb(logoPath)

  const logoObjId = logo ? 6 : null
  const fontObjId = logo ? 7 : 6
  const contentObjId = logo ? 5 : 4
  const pageObjId = 3
  const pagesObjId = 2
  const catalogObjId = 1

  const content: string[] = []
  content.push("q")
  content.push("1 1 1 rg")
  content.push(`0 0 ${pageW} ${pageH} re f`)
  content.push("Q")

  content.push("q")
  content.push("0.06 0.12 0.22 rg")
  content.push(`0 ${headerY} ${pageW} ${headerH} re f`)
  content.push("Q")

  const text = (x: number, y: number, size: number, value: string, rgb?: [number, number, number]) => {
    const [r, g, b] = rgb ?? [0, 0, 0]
    content.push(`${r} ${g} ${b} rg`)
    content.push("BT")
    content.push(`/F1 ${size} Tf`)
    content.push(`${x} ${y} Td`)
    content.push(`(${escapePdfText(value)}) Tj`)
    content.push("ET")
  }

  const line = (x1: number, y1: number, x2: number, y2: number, w = 1, rgb?: [number, number, number]) => {
    const [r, g, b] = rgb ?? [0.85, 0.85, 0.85]
    content.push(`${r} ${g} ${b} RG`)
    content.push(`${w} w`)
    content.push(`${x1} ${y1} m`)
    content.push(`${x2} ${y2} l`)
    content.push("S")
  }

  const rectFill = (x: number, y: number, w: number, h: number, rgb: [number, number, number]) => {
    content.push(`${rgb[0]} ${rgb[1]} ${rgb[2]} rg`)
    content.push(`${x} ${y} ${w} ${h} re f`)
  }

  if (logo && logoObjId) {
    const targetW = 28
    const targetH = 28
    const x = margin
    const y = pageH - 48
    content.push("q")
    content.push(`${targetW} 0 0 ${targetH} ${x} ${y} cm`)
    content.push("/Im1 Do")
    content.push("Q")
  }

  text(margin + 38, pageH - 40, 18, "Financeiro Link System", [1, 1, 1])
  text(margin + 38, pageH - 58, 10, input.dateLabel, [0.9, 0.93, 0.98])

  const boxY = headerY - 72
  const boxW = (pageW - margin * 2 - 12) / 2
  const boxH = 54

  const boxes = input.summary.slice(0, 4)
  for (let i = 0; i < boxes.length; i += 1) {
    const row = i < 2 ? 0 : 1
    const col = i % 2
    const x = margin + col * (boxW + 12)
    const y = boxY - row * (boxH + 12)
    rectFill(x, y, boxW, boxH, [0.96, 0.97, 0.99])
    line(x, y, x + boxW, y, 0.5, [0.85, 0.88, 0.92])
    line(x, y + boxH, x + boxW, y + boxH, 0.5, [0.85, 0.88, 0.92])
    line(x, y, x, y + boxH, 0.5, [0.85, 0.88, 0.92])
    line(x + boxW, y, x + boxW, y + boxH, 0.5, [0.85, 0.88, 0.92])
    text(x + 12, y + 34, 10, boxes[i].label, [0.18, 0.22, 0.28])
    text(x + 12, y + 14, 14, boxes[i].value, [0.05, 0.1, 0.2])
  }

  let cursorY = boxY - 2 * (boxH + 12) - 20
  const section = (title: string) => {
    rectFill(margin, cursorY, pageW - margin * 2, 22, [0.93, 0.95, 0.98])
    text(margin + 10, cursorY + 7, 11, title, [0.05, 0.1, 0.2])
    cursorY -= 28
  }

  const table = (rows: Array<{ name: string; amount: string; status: string }>) => {
    const wName = 360
    const wAmount = 90
    const wStatus = pageW - margin * 2 - wName - wAmount
    rectFill(margin, cursorY, pageW - margin * 2, 18, [0.98, 0.98, 0.99])
    text(margin + 10, cursorY + 5, 9, "Item", [0.18, 0.22, 0.28])
    text(margin + 10 + wName, cursorY + 5, 9, "Valor", [0.18, 0.22, 0.28])
    text(margin + 10 + wName + wAmount, cursorY + 5, 9, "Status", [0.18, 0.22, 0.28])
    cursorY -= 18
    const maxRows = Math.max(0, Math.floor((cursorY - 60) / 18))
    const clipped = clampList(rows, Math.min(rows.length, maxRows))
    for (let i = 0; i < clipped.items.length; i += 1) {
      const r = clipped.items[i]
      if (i % 2 === 0) rectFill(margin, cursorY, pageW - margin * 2, 18, [1, 1, 1])
      else rectFill(margin, cursorY, pageW - margin * 2, 18, [0.995, 0.996, 0.998])
      const statusUpper = (r.status || "").toUpperCase()
      const statusColor: [number, number, number] =
        statusUpper.includes("PAGO") || statusUpper.includes("RECEBIDO")
          ? [0.12, 0.62, 0.34]
          : statusUpper.includes("VENC")
            ? [0.85, 0.2, 0.2]
            : statusUpper.includes("A PAGAR") || statusUpper.includes("PEND")
              ? [0.9, 0.6, 0.12]
              : [0.18, 0.22, 0.28]
      text(margin + 10, cursorY + 5, 9, r.name.slice(0, 70), [0.18, 0.22, 0.28])
      text(margin + 10 + wName, cursorY + 5, 9, r.amount, [0.18, 0.22, 0.28])
      text(margin + 10 + wName + wAmount, cursorY + 5, 9, r.status, statusColor)
      cursorY -= 18
    }
    if (clipped.remaining > 0) {
      rectFill(margin, cursorY, pageW - margin * 2, 18, [1, 1, 1])
      text(margin + 10, cursorY + 5, 9, `... (+${clipped.remaining} itens)`, [0.35, 0.38, 0.45])
      cursorY -= 18
    }
    cursorY -= 12
  }

  section("Agenda · Receber")
  table(input.receiveRows)
  section("Agenda · Pagar")
  table(input.payRows)
  section("Movimentações (Financeiro)")
  table(input.entriesRows)

  text(margin, 26, 8, `Gerado em ${formatDateTimeBR(new Date())}`, [0.45, 0.48, 0.52])

  const contentStream = content.join("\n") + "\n"
  const contentLength = Buffer.byteLength(contentStream, "latin1")

  const objects: Array<{ id: number; body: string; stream?: Buffer }> = []
  objects.push({ id: catalogObjId, body: "<<\n/Type /Catalog\n/Pages 2 0 R\n>>" })
  objects.push({ id: pagesObjId, body: "<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>" })

  const resourcesParts: string[] = []
  resourcesParts.push("/Font << /F1 " + fontObjId + " 0 R >>")
  if (logoObjId) resourcesParts.push("/XObject << /Im1 " + logoObjId + " 0 R >>")

  objects.push({
    id: pageObjId,
    body: `<<\n/Type /Page\n/Parent ${pagesObjId} 0 R\n/MediaBox [0 0 ${pageW} ${pageH}]\n/Resources << ${resourcesParts.join(" ")} >>\n/Contents ${contentObjId} 0 R\n>>`,
  })

  if (!logoObjId) {
    objects.push({ id: contentObjId, body: `<<\n/Length ${contentLength}\n>>\nstream\n${contentStream}endstream` })
    objects.push({ id: fontObjId, body: "<<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica\n>>" })
  } else {
    const rgb = logo!.rgb
    const compressed = zlib.deflateSync(rgb)
    const imgBody =
      `<<\n/Type /XObject\n/Subtype /Image\n/Width ${logo!.width}\n/Height ${logo!.height}\n/ColorSpace /DeviceRGB\n/BitsPerComponent 8\n/Filter /FlateDecode\n/Length ${compressed.length}\n>>`
    objects.push({ id: contentObjId, body: `<<\n/Length ${contentLength}\n>>\nstream\n${contentStream}endstream` })
    objects.push({ id: logoObjId, body: imgBody + "\nstream\n", stream: compressed })
    objects.push({ id: fontObjId, body: "<<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica\n>>" })
  }

  const parts: Buffer[] = []
  const offsets: number[] = []
  let cursor = 0

  const pushStr = (s: string) => {
    const b = Buffer.from(s, "latin1")
    parts.push(b)
    cursor += b.length
  }

  const pushBuf = (b: Buffer) => {
    parts.push(b)
    cursor += b.length
  }

  pushStr("%PDF-1.4\n")
  offsets[0] = 0

  for (const obj of objects) {
    offsets[obj.id] = cursor
    if (!obj.stream) {
      pushStr(`${obj.id} 0 obj\n${obj.body}\nendobj\n`)
      continue
    }
    pushStr(`${obj.id} 0 obj\n${obj.body}`)
    pushBuf(obj.stream)
    pushStr("\nendstream\nendobj\n")
  }

  const xrefStart = cursor
  const maxId = objects.reduce((acc, o) => (o.id > acc ? o.id : acc), 0)
  pushStr("xref\n")
  pushStr(`0 ${maxId + 1}\n`)
  pushStr("0000000000 65535 f \n")
  for (let i = 1; i <= maxId; i += 1) {
    const off = offsets[i] || 0
    pushStr(`${String(off).padStart(10, "0")} 00000 n \n`)
  }
  pushStr("trailer\n")
  pushStr(`<<\n/Size ${maxId + 1}\n/Root ${catalogObjId} 0 R\n>>\n`)
  pushStr("startxref\n")
  pushStr(`${xrefStart}\n`)
  pushStr("%%EOF")

  return Buffer.concat(parts)
}

function clampList<T>(items: T[], max: number) {
  if (items.length <= max) return { items, remaining: 0 }
  return { items: items.slice(0, max), remaining: items.length - max }
}

async function ensureCronOrAdmin(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const headerSecret = req.headers.get("x-cron-secret") || req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  if (secret && headerSecret && headerSecret === secret) return { ok: true as const, mode: "cron" as const }

  const session = await getServerSession(authOptions)
  if (!session) return { ok: false as const, status: 401, error: "Não autorizado" }
  if (session.user.role !== UserRole.ADMIN) return { ok: false as const, status: 403, error: "Sem permissão" }
  return { ok: true as const, mode: "user" as const }
}

const requestSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().email().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const auth = await ensureCronOrAdmin(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const json = await req.json().catch(() => ({}))
    const body = requestSchema.parse(json)

    const now = new Date()
    const target = body.date ? new Date(`${body.date}T12:00:00`) : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0)
    if (!Number.isFinite(target.getTime())) {
      return NextResponse.json({ error: "Data inválida" }, { status: 400 })
    }

    const y = target.getFullYear()
    const mIndex0 = target.getMonth()
    const dayStart = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 0, 0, 0, 0)
    const dayEnd = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 23, 59, 59, 999)
    const targetKey = dateKey(target)
    const todayKey = dateKey(new Date())
    const overdueDay = targetKey < todayKey

    const toEmail = body.to || process.env.FINANCE_DAILY_EMAIL_TO || "business.gabrielferreira@gmail.com"

    const smtpHost = process.env.SMTP_HOST
    const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined
    const smtpUser = process.env.SMTP_USER
    const smtpPass = process.env.SMTP_PASS
    const smtpFrom = process.env.SMTP_FROM || smtpUser || ""
    const smtpSecure = process.env.SMTP_SECURE === "true"

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !smtpFrom) {
      return NextResponse.json(
        { error: "SMTP não configurado. Defina SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS e SMTP_FROM." },
        { status: 400 }
      )
    }

    const subscriptions = await (prisma as any).subscription.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        group: true,
        clients: {
          include: {
            client: { select: { id: true, name: true, email: true } },
          },
        },
      },
    })

    const dueSubscriptions: Array<{
      clientName: string
      subscriptionName: string
      groupName?: string | null
      amount: number
      dueDate: Date
      status: "PENDING" | "PAID"
      paidAt?: Date | null
    }> = []

    for (const s of subscriptions as any[]) {
      for (const link of (s.clients || []) as any[]) {
        const dueDay = typeof link.dueDay === "number" ? link.dueDay : null
        if (dueDay === null) continue
        if (!s.isActive) continue
        if ((link.status || "").toUpperCase() !== "ACTIVE") continue

        const startedAt = link.startedAt ? new Date(link.startedAt) : null
        const endedAt = link.endedAt ? new Date(link.endedAt) : null
        const monthStartKey = `${y}-${String(mIndex0 + 1).padStart(2, "0")}-01`
        const monthEndKey = dateKey(new Date(y, mIndex0 + 1, 0, 12, 0, 0, 0))
        if (endedAt && dateKey(endedAt) < monthStartKey) continue
        if (startedAt && dateKey(startedAt) > monthEndKey) continue

        const due = dueDateForMonth(y, mIndex0, dueDay)
        if ((s.billingCycle || "MONTHLY") === "YEARLY") {
          const cycleMonth = startedAt ? startedAt.getMonth() : mIndex0
          if (cycleMonth !== mIndex0) continue
        }

        if (dateKey(due) !== targetKey) continue

        const paidFor = link.lastPaidFor ? new Date(link.lastPaidFor) : null
        const paidAt = link.paidAt ? new Date(link.paidAt) : null
        const isPaid = paidFor ? dateKey(paidFor) === targetKey : false
        const amount = typeof s.price === "number" ? s.price : 0

        dueSubscriptions.push({
          clientName: link.client?.name || "Cliente",
          subscriptionName: s.name,
          groupName: s.group?.name ?? null,
          amount,
          dueDate: due,
          status: isPaid ? "PAID" : "PENDING",
          paidAt: isPaid ? paidAt : null,
        })
      }
    }

    const payments = await prisma.payment.findMany({
      where: {
        paymentDate: { gte: dayStart, lte: dayEnd },
        status: { in: [PaymentStatus.PENDING, PaymentStatus.COMPLETED] },
      },
      include: {
        client: { select: { id: true, name: true, email: true, company: true } },
        paymentProjects: { include: { project: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    })

    const duePayments = payments.map((p) => {
      const clientName = (p.client as any)?.company || p.client?.name || "Cliente"
      const projectNames = (p.paymentProjects || []).map((pp) => pp.project?.name).filter(Boolean)
      return {
        clientName,
        description: p.description || "Cobrança avulsa",
        projectName: projectNames.length ? projectNames.join(", ") : null,
        amount: p.amount,
        status: p.status === PaymentStatus.COMPLETED ? "RECEIVED" : "PENDING",
      }
    })

    const db = prisma as any
    if (!db.expenseBill) {
      return NextResponse.json(
        { error: "Modelo ExpenseBill não está disponível no Prisma Client. Rode `yarn prisma generate` e aplique as migrations." },
        { status: 500 }
      )
    }

    const monthStart = new Date(y, mIndex0, 1, 0, 0, 0, 0)
    const monthEnd = new Date(y, mIndex0 + 1, 0, 23, 59, 59, 999)

    const bills = await db.expenseBill.findMany({
      where: {
        isActive: true,
        OR: [{ isRecurring: true }, { isRecurring: false, dueDate: { gte: monthStart, lte: monthEnd } }],
      },
      include: { project: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    })

    const billIds = bills.map((b: any) => b.id)
    const paidEntries = billIds.length
      ? await db.financialEntry.findMany({
          where: {
            expenseBillId: { in: billIds },
            type: "EXPENSE",
            date: { gte: monthStart, lte: monthEnd },
          },
          select: { id: true, expenseBillId: true, date: true, createdAt: true },
        })
      : []

    const paidMap = new Map<string, { id: string; paidAt: Date }>()
    for (const e of paidEntries) {
      const key = `${e.expenseBillId}:${dateKey(new Date(e.date))}`
      paidMap.set(key, { id: e.id, paidAt: new Date(e.createdAt) })
    }

    const dueExpenses: Array<{
      category: string
      description: string
      amount: number
      projectName?: string | null
      isRecurring: boolean
      recurringType?: string | null
      dueDate: Date
      status: "PENDING" | "PAID"
      paidAt?: Date | null
    }> = []

    for (const b of bills) {
      if (b.isRecurring) {
        const start = b.startDate ? new Date(b.startDate) : null
        if (!start) continue
        const startYM = start.getFullYear() * 12 + start.getMonth()
        const ym = y * 12 + mIndex0
        if (ym < startYM) continue

        const rt = String(b.recurringType || "MONTHLY").toUpperCase()
        if (rt === "YEARLY" && start.getMonth() !== mIndex0) continue
        if (rt === "QUARTERLY") {
          const diff = ym - startYM
          if (diff % 3 !== 0) continue
        }

        const dueDay = typeof b.dueDay === "number" ? b.dueDay : start.getDate()
        const due = dueDateForMonth(y, mIndex0, dueDay)
        if (dateKey(due) !== targetKey) continue
        const k = `${b.id}:${targetKey}`
        const paid = paidMap.get(k) || null
        dueExpenses.push({
          category: b.category,
          description: b.description,
          amount: b.amount,
          projectName: b.project?.name ?? null,
          isRecurring: true,
          recurringType: b.recurringType ?? "MONTHLY",
          dueDate: due,
          status: paid ? "PAID" : "PENDING",
          paidAt: paid?.paidAt ?? null,
        })
        continue
      }

      const due = b.dueDate ? new Date(b.dueDate) : null
      if (!due) continue
      if (dateKey(due) !== targetKey) continue
      const k = `${b.id}:${targetKey}`
      const paid = paidMap.get(k) || null
      dueExpenses.push({
        category: b.category,
        description: b.description,
        amount: b.amount,
        projectName: b.project?.name ?? null,
        isRecurring: false,
        recurringType: null,
        dueDate: due,
        status: paid ? "PAID" : "PENDING",
        paidAt: paid?.paidAt ?? null,
      })
    }

    const dayEntries = await db.financialEntry.findMany({
      where: { date: { gte: dayStart, lte: dayEnd } },
      include: { project: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    })

    const entryIncome = (dayEntries as any[]).filter((e) => e.type === "INCOME").reduce((acc, e) => acc + (e.amount || 0), 0)
    const entryExpense = (dayEntries as any[]).filter((e) => e.type === "EXPENSE").reduce((acc, e) => acc + (e.amount || 0), 0)

    const receivePending = [...dueSubscriptions, ...duePayments.filter((p) => p.status === "PENDING").map((p) => ({
      clientName: p.clientName,
      subscriptionName: p.description,
      groupName: p.projectName,
      amount: p.amount,
      dueDate: target,
      status: "PENDING" as const,
      paidAt: null,
    }))].filter((i) => i.status === "PENDING")

    const receiveDone = [
      ...dueSubscriptions.filter((s) => s.status === "PAID").map((s) => ({ label: `${s.clientName} · ${s.subscriptionName}`, amount: s.amount })),
      ...duePayments.filter((p) => p.status === "RECEIVED").map((p) => ({ label: `${p.clientName} · ${p.description}`, amount: p.amount })),
    ]

    const totalReceivePending = receivePending.reduce((acc, i) => acc + i.amount, 0)
    const totalReceiveDone = receiveDone.reduce((acc, i) => acc + i.amount, 0)
    const totalPayPending = dueExpenses.filter((e) => e.status === "PENDING").reduce((acc, e) => acc + e.amount, 0)
    const totalPayDone = dueExpenses.filter((e) => e.status === "PAID").reduce((acc, e) => acc + e.amount, 0)

    const agendaReceiveRows = [...dueSubscriptions, ...duePayments.map((p) => ({
      clientName: p.clientName,
      subscriptionName: p.description,
      groupName: p.projectName,
      amount: p.amount,
      dueDate: target,
      status: p.status === "RECEIVED" ? ("PAID" as const) : ("PENDING" as const),
      paidAt: null as Date | null,
    }))]
      .sort((a, b) => a.clientName.localeCompare(b.clientName))
      .map((i) => ({
        name: `${i.clientName} · ${i.subscriptionName}${i.groupName ? ` (${i.groupName})` : ""}`,
        amount: i.amount,
        status: i.status,
        paidAt: i.paidAt,
      }))

    const agendaPayRows = dueExpenses
      .sort((a, b) => (a.category || "").localeCompare(b.category || ""))
      .map((e) => ({
        name: `${e.category} · ${e.description}${e.projectName ? ` (${e.projectName})` : ""}${e.isRecurring ? ` · Recorrente (${recurringLabel(e.recurringType)})` : ""}`,
        amount: e.amount,
        status: e.status,
        overdue: e.status === "PENDING" && overdueDay,
        paidAt: e.paidAt,
      }))

    const entriesRows = (dayEntries as any[]).map((e) => ({
      type: e.type,
      category: e.category,
      description: e.description,
      amount: e.amount,
      projectName: e.project?.name ?? null,
      createdAt: e.createdAt ? new Date(e.createdAt) : null,
    }))

    const subject = `Resumo financeiro do dia ${formatDateBR(target)}`
    const headerTitle = `Resumo financeiro · ${formatDateBR(target)}`

    const receivePdfList = clampList(agendaReceiveRows, 25)
    const payPdfList = clampList(agendaPayRows, 25)
    const entriesPdfList = clampList(entriesRows, 25)

    const textLines: string[] = []
    textLines.push(`Resumo financeiro - ${formatDateBR(target)}`)
    textLines.push(overdueDay ? "Dia vencido (atenção em pendências)." : "Dia dentro do prazo.")
    textLines.push("")
    textLines.push(`A receber: ${formatBRL(totalReceivePending)}`)
    textLines.push(`Recebido: ${formatBRL(totalReceiveDone)}`)
    textLines.push(`A pagar: ${formatBRL(totalPayPending)}`)
    textLines.push(`Pago: ${formatBRL(totalPayDone)}`)
    textLines.push(`Entradas (Financeiro): ${formatBRL(entryIncome)}`)
    textLines.push(`Saídas (Financeiro): ${formatBRL(entryExpense)}`)
    textLines.push(`Saldo do dia: ${formatBRL(entryIncome - entryExpense)}`)
    textLines.push("")
    textLines.push("Agenda - Receber:")
    if (!agendaReceiveRows.length) textLines.push("- Sem itens")
    for (const r of agendaReceiveRows) {
      textLines.push(`- [${r.status === "PAID" ? "PAGO" : "PENDENTE"}] ${r.name} - ${formatBRL(r.amount)}`)
    }
    textLines.push("")
    textLines.push("Agenda - Pagar:")
    if (!agendaPayRows.length) textLines.push("- Sem itens")
    for (const r of agendaPayRows) {
      const st = r.status === "PAID" ? "PAGO" : r.overdue ? "VENCIDO" : "A PAGAR"
      textLines.push(`- [${st}] ${r.name} - ${formatBRL(r.amount)}`)
    }
    textLines.push("")
    textLines.push("Movimentações (Financeiro):")
    if (!entriesRows.length) textLines.push("- Sem movimentações")
    for (const r of entriesRows) {
      const sign = r.type === "EXPENSE" ? "-" : ""
      const label = r.type === "EXPENSE" ? "Saída" : "Entrada"
      textLines.push(`- [${label}] ${r.category || ""} · ${r.description || ""}${r.projectName ? ` (${r.projectName})` : ""} - ${sign}${formatBRL(r.amount || 0)}`)
    }
    textLines.push("")
    textLines.push(`Enviado em ${formatDateTimeBR(new Date())}`)

    const pdfLines: string[] = []
    pdfLines.push(`Resumo financeiro - ${formatDateBR(target)}`)
    pdfLines.push(overdueDay ? "Dia vencido (atenção em pendências)." : "Dia dentro do prazo.")
    pdfLines.push("")
    pdfLines.push(`A receber: ${formatBRL(totalReceivePending)} | Recebido: ${formatBRL(totalReceiveDone)}`)
    pdfLines.push(`A pagar: ${formatBRL(totalPayPending)} | Pago: ${formatBRL(totalPayDone)}`)
    pdfLines.push(`Entradas: ${formatBRL(entryIncome)} | Saídas: ${formatBRL(entryExpense)} | Saldo: ${formatBRL(entryIncome - entryExpense)}`)
    pdfLines.push("")
    pdfLines.push("AGENDA - RECEBER")
    if (!agendaReceiveRows.length) pdfLines.push("  - Sem itens")
    for (const r of receivePdfList.items) {
      pdfLines.push(`  - [${r.status === "PAID" ? "PAGO" : "PENDENTE"}] ${r.name} - ${formatBRL(r.amount)}`)
    }
    if (receivePdfList.remaining > 0) pdfLines.push(`  ... (+${receivePdfList.remaining} itens)`)
    pdfLines.push("")
    pdfLines.push("AGENDA - PAGAR")
    if (!agendaPayRows.length) pdfLines.push("  - Sem itens")
    for (const r of payPdfList.items) {
      const st = r.status === "PAID" ? "PAGO" : r.overdue ? "VENCIDO" : "A PAGAR"
      pdfLines.push(`  - [${st}] ${r.name} - ${formatBRL(r.amount)}`)
    }
    if (payPdfList.remaining > 0) pdfLines.push(`  ... (+${payPdfList.remaining} itens)`)
    pdfLines.push("")
    pdfLines.push("MOVIMENTAÇÕES (FINANCEIRO)")
    if (!entriesRows.length) pdfLines.push("  - Sem movimentações")
    for (const r of entriesPdfList.items) {
      const sign = r.type === "EXPENSE" ? "-" : ""
      const label = r.type === "EXPENSE" ? "Saída" : "Entrada"
      pdfLines.push(`  - [${label}] ${r.category || ""} - ${r.description || ""}${r.projectName ? ` (${r.projectName})` : ""} - ${sign}${formatBRL(r.amount || 0)}`)
    }
    if (entriesPdfList.remaining > 0) pdfLines.push(`  ... (+${entriesPdfList.remaining} itens)`)
    pdfLines.push("")
    pdfLines.push(`Enviado em ${formatDateTimeBR(new Date())}`)

    const summaryPairs = [
      { label: "A receber", value: formatBRL(totalReceivePending) },
      { label: "A pagar", value: formatBRL(totalPayPending) },
      { label: "Entradas (dia)", value: formatBRL(entryIncome) },
      { label: "Saídas (dia)", value: formatBRL(entryExpense) },
    ]

    const pdfReceiveRows = agendaReceiveRows.map((r) => ({
      name: r.name,
      amount: formatBRL(r.amount),
      status: r.status === "PAID" ? "Pago" : "Pendente",
    }))
    const pdfPayRows = agendaPayRows.map((r) => ({
      name: r.name,
      amount: formatBRL(r.amount),
      status: r.status === "PAID" ? "Pago" : r.overdue ? "Vencido" : "A pagar",
    }))
    const pdfEntriesRows = entriesRows.map((r) => {
      const label = r.type === "EXPENSE" ? "Saída" : "Entrada"
      const sign = r.type === "EXPENSE" ? "-" : ""
      return {
        name: `${r.category || ""} · ${r.description || ""}${r.projectName ? ` (${r.projectName})` : ""}`,
        amount: `${sign}${formatBRL(r.amount || 0)}`,
        status: label,
      }
    })

    const pdfBuffer = buildStyledPdf({
      dateLabel: `Agenda do dia ${formatDateBR(target)}`,
      summary: summaryPairs,
      receiveRows: pdfReceiveRows,
      payRows: pdfPayRows,
      entriesRows: pdfEntriesRows,
    })

    const html = `
      <div style="font-family: Arial, sans-serif; font-size: 14px; color: #111;">
        <h2 style="margin: 0 0 12px 0;">${headerTitle}</h2>
        <div style="margin: 0 0 16px 0; color: #444;">
          ${overdueDay ? "Dia vencido (atenção em pendências)." : "Dia dentro do prazo."}
        </div>

        <table style="border-collapse: collapse; width: 100%; margin-bottom: 18px;">
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>A receber</strong><br>${formatBRL(totalReceivePending)}</td>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Recebido</strong><br>${formatBRL(totalReceiveDone)}</td>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>A pagar</strong><br>${formatBRL(totalPayPending)}</td>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Pago</strong><br>${formatBRL(totalPayDone)}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Entradas (Financeiro)</strong><br>${formatBRL(entryIncome)}</td>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Saídas (Financeiro)</strong><br>${formatBRL(entryExpense)}</td>
            <td style="padding: 10px; border: 1px solid #ddd;" colspan="2"><strong>Saldo do dia</strong><br>${formatBRL(entryIncome - entryExpense)}</td>
          </tr>
        </table>

        <h3 style="margin: 0 0 8px 0;">Agenda · Receber</h3>
        ${agendaReceiveRows.length ? `
          <table style="border-collapse: collapse; width: 100%; margin-bottom: 18px;">
            ${agendaReceiveRows.map(r => `
              <tr>
                <td style="padding: 8px; border: 1px solid #eee;">${r.name}</td>
                <td style="padding: 8px; border: 1px solid #eee; text-align: right;">${formatBRL(r.amount)}</td>
                <td style="padding: 8px; border: 1px solid #eee; text-align: center;">${r.status === "PAID" ? "Pago" : "Pendente"}</td>
              </tr>
            `).join("")}
          </table>
        ` : `<div style="margin: 0 0 18px 0; color: #555;">Sem itens.</div>`}

        <h3 style="margin: 0 0 8px 0;">Agenda · Pagar</h3>
        ${agendaPayRows.length ? `
          <table style="border-collapse: collapse; width: 100%; margin-bottom: 18px;">
            ${agendaPayRows.map(r => `
              <tr>
                <td style="padding: 8px; border: 1px solid #eee;">${r.name}</td>
                <td style="padding: 8px; border: 1px solid #eee; text-align: right;">${formatBRL(r.amount)}</td>
                <td style="padding: 8px; border: 1px solid #eee; text-align: center;">${r.status === "PAID" ? "Pago" : (r.overdue ? "Vencido" : "A pagar")}</td>
              </tr>
            `).join("")}
          </table>
        ` : `<div style="margin: 0 0 18px 0; color: #555;">Sem itens.</div>`}

        <h3 style="margin: 0 0 8px 0;">Movimentações (Financeiro)</h3>
        ${entriesRows.length ? `
          <table style="border-collapse: collapse; width: 100%; margin-bottom: 6px;">
            ${entriesRows.map(r => `
              <tr>
                <td style="padding: 8px; border: 1px solid #eee;">${r.category || ""} · ${r.description || ""}${r.projectName ? ` (${r.projectName})` : ""}</td>
                <td style="padding: 8px; border: 1px solid #eee; text-align: right;">${r.type === "EXPENSE" ? "-" : ""}${formatBRL(r.amount || 0)}</td>
                <td style="padding: 8px; border: 1px solid #eee; text-align: center;">${r.type === "EXPENSE" ? "Saída" : "Entrada"}</td>
              </tr>
            `).join("")}
          </table>
        ` : `<div style="margin: 0; color: #555;">Sem movimentações registradas.</div>`}

        <div style="margin-top: 16px; color: #666; font-size: 12px;">
          Enviado em ${formatDateTimeBR(new Date())}
        </div>
      </div>
    `

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: { user: smtpUser, pass: smtpPass },
    })

    await transporter.sendMail({
      from: smtpFrom,
      to: toEmail,
      subject,
      text: textLines.join("\n"),
      html,
      attachments: [
        {
          filename: `resumo_financeiro_${targetKey}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    })

    return NextResponse.json({ ok: true, to: toEmail, date: targetKey })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos", details: error.issues }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
