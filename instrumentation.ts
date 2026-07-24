export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startReminderQueue } = await import("./lib/reminder-queue")
    await startReminderQueue()
  }
}
