import { Queue, Worker, type Job } from "bullmq"
import { getRedisConnection } from "@/lib/redis"
import { runReminderDispatch } from "@/lib/run-reminder-dispatch"

export const REMINDER_QUEUE_NAME = "financial-reminders"
export const REMINDER_DISPATCH_JOB = "dispatch"

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000

let queue: Queue | null = null
let worker: Worker | null = null
let started = false

function getIntervalMs() {
  const raw = Number(process.env.REMINDER_CRON_INTERVAL_MS || DEFAULT_INTERVAL_MS)
  return Number.isFinite(raw) && raw >= 60_000 ? raw : DEFAULT_INTERVAL_MS
}

export function getReminderQueue() {
  const connection = getRedisConnection()
  if (!connection) return null

  if (!queue) {
    queue = new Queue(REMINDER_QUEUE_NAME, { connection })
  }
  return queue
}

async function processDispatchJob(job: Job) {
  const dryRun = Boolean(job.data?.dryRun)
  const onlyClientEmail =
    typeof job.data?.onlyClientEmail === "string" ? job.data.onlyClientEmail : undefined

  const result = await runReminderDispatch({
    dryRun,
    skipSendTimeCheck: dryRun || Boolean(job.data?.skipSendTimeCheck),
    onlyClientEmail,
    date: typeof job.data?.date === "string" ? job.data.date : undefined,
  })

  if (result.sent > 0 || result.errors > 0) {
    console.info(
      `[reminder-queue] job=${job.id} sent=${result.sent} errors=${result.errors} skipped=${result.skipped}`
    )
  }

  return result
}

export async function enqueueReminderDispatch(input?: {
  dryRun?: boolean
  skipSendTimeCheck?: boolean
  onlyClientEmail?: string
  date?: string
}) {
  const q = getReminderQueue()
  if (!q) throw new Error("REDIS_URL não configurado")

  return q.add(
    REMINDER_DISPATCH_JOB,
    {
      dryRun: input?.dryRun ?? false,
      skipSendTimeCheck: input?.skipSendTimeCheck ?? false,
      onlyClientEmail: input?.onlyClientEmail,
      date: input?.date,
    },
    {
      removeOnComplete: 100,
      removeOnFail: 200,
      attempts: 3,
      backoff: { type: "exponential", delay: 30_000 },
    }
  )
}

export async function startReminderQueue() {
  if (started) return
  if (process.env.DISABLE_REMINDER_SCHEDULER === "1") return
  if (process.env.NODE_ENV !== "production") return

  const connection = getRedisConnection()
  if (!connection) {
    console.warn("[reminder-queue] REDIS_URL ausente — fila de lembretes desativada")
    return
  }

  started = true
  const intervalMs = getIntervalMs()

  worker = new Worker(REMINDER_QUEUE_NAME, processDispatchJob, {
    connection,
    concurrency: 1,
  })

  worker.on("failed", (job, err) => {
    console.error(`[reminder-queue] job ${job?.id} falhou:`, err.message)
  })

  const q = getReminderQueue()
  if (!q) return

  await q.add(
    REMINDER_DISPATCH_JOB,
    {},
    {
      repeat: { every: intervalMs },
      jobId: "reminder-dispatch-repeat",
      removeOnComplete: 50,
      removeOnFail: 100,
    }
  )

  console.info(`[reminder-queue] ativo — job repetível a cada ${intervalMs / 1000}s (BullMQ)`)
}

export async function stopReminderQueue() {
  await worker?.close()
  await queue?.close()
  worker = null
  queue = null
  started = false
}
