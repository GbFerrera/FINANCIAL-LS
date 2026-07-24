const DEFAULT_INTERVAL_MS = 5 * 60 * 1000
const STARTUP_DELAY_MS = 45 * 1000

let started = false
let running = false

async function runReminderTick() {
  if (running) return
  running = true
  try {
    const secret = process.env.CRON_SECRET
    if (!secret) {
      console.warn("[reminder-scheduler] CRON_SECRET ausente — lembretes não disparam automaticamente")
      return
    }

    const port = process.env.PORT || "3000"
    const res = await fetch(`http://127.0.0.1:${port}/api/financial/subscription-reminders/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": secret,
      },
      body: "{}",
    })

    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      console.error("[reminder-scheduler] falha", res.status, body)
      return
    }

    const sent = typeof body.sent === "number" ? body.sent : 0
    const errors = typeof body.errors === "number" ? body.errors : 0
    if (sent > 0 || errors > 0) {
      console.info(`[reminder-scheduler] ok sent=${sent} errors=${errors}`)
    }
  } catch (err) {
    console.error("[reminder-scheduler]", err)
  } finally {
    running = false
  }
}

export function startReminderScheduler() {
  if (started) return
  if (process.env.DISABLE_REMINDER_SCHEDULER === "1") return
  if (process.env.NODE_ENV !== "production") return

  started = true
  const intervalMs = Number(process.env.REMINDER_CRON_INTERVAL_MS || DEFAULT_INTERVAL_MS)
  if (!Number.isFinite(intervalMs) || intervalMs < 60_000) {
    console.warn("[reminder-scheduler] intervalo inválido, usando 5 min")
  }

  const tickEvery = Number.isFinite(intervalMs) && intervalMs >= 60_000 ? intervalMs : DEFAULT_INTERVAL_MS

  console.info(
    `[reminder-scheduler] ativo — primeira execução em ${STARTUP_DELAY_MS / 1000}s, depois a cada ${tickEvery / 1000}s`
  )

  setTimeout(() => {
    void runReminderTick()
    setInterval(() => void runReminderTick(), tickEvery)
  }, STARTUP_DELAY_MS)
}
