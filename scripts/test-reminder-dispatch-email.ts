/**
 * Testa dispatch de lembretes filtrando por e-mail do cliente.
 * Uso: npx tsx scripts/test-reminder-dispatch-email.ts business.gabrielferreira@gmail.com
 */
import { config } from "dotenv"
config({ path: ".env.local" })
config()

import { prisma } from "../lib/prisma"
import { runReminderDispatch } from "../lib/run-reminder-dispatch"

const email = process.argv[2] || "business.gabrielferreira@gmail.com"
const dryRun = process.argv.includes("--dry-run")
const dateArg = process.argv.find((a) => a.startsWith("--date="))?.slice("--date=".length)

async function main() {
  console.log(`Teste lembretes → ${email} (dryRun=${dryRun}${dateArg ? `, date=${dateArg}` : ""})`)

  const client = await prisma.client.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, name: true, email: true },
  })
  if (!client) {
    throw new Error(`Cliente não encontrado: ${email}`)
  }
  console.log("Cliente:", client)

  const result = await runReminderDispatch({
    dryRun,
    skipSendTimeCheck: true,
    onlyClientEmail: email,
    date: dateArg,
  })

  console.log(JSON.stringify(result, null, 2))

  const emailSent = result.results.some(
    (r) => r.channel === "EMAIL" && r.destination.toLowerCase() === email.toLowerCase() && r.status === "sent"
  )
  const emailPreview = result.results.some(
    (r) => r.channel === "EMAIL" && r.destination.toLowerCase() === email.toLowerCase() && r.status === "preview"
  )

  if (!dryRun && !emailSent && result.sent === 0) {
    const alreadySent = result.results.length === 0
    if (alreadySent) {
      console.log("Nenhum candidato (pode já ter sido enviado hoje ou sem vencimento no período).")
      process.exit(0)
    }
    process.exit(1)
  }

  if (dryRun && !emailPreview && result.results.length === 0) {
    console.log("Nenhum lembrete previsto para este cliente hoje.")
    process.exit(0)
  }

  console.log(dryRun ? "Preview OK" : "Envio OK")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
