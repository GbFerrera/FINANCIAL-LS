/**
 * Testa Pix copia e cola em lembrete de cobrança avulsa.
 * Uso: npx tsx scripts/test-payment-reminder-pix.ts [email]
 */
import { config } from "dotenv"
config({ path: ".env.local" })
config()

import { prisma } from "../lib/prisma"
import { runReminderDispatch } from "../lib/run-reminder-dispatch"

const email = process.argv[2] || "business.gabrielferreira@gmail.com"
const dryRun = process.argv.includes("--dry-run")

async function main() {
  const client = await prisma.client.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  })
  if (!client) throw new Error(`Cliente não encontrado: ${email}`)

  let payment = await prisma.payment.findFirst({
    where: {
      clientId: client.id,
      status: "PENDING",
      reminderSendEmail: true,
    },
    orderBy: { createdAt: "desc" },
  })

  if (!payment?.reminderIncludePix || !payment.pixKey) {
    const due = new Date()
    due.setDate(due.getDate() + 1)
    payment = await prisma.payment.create({
      data: {
        clientId: client.id,
        amount: 97,
        description: "Teste cobrança Pix local",
        paymentDate: due,
        status: "PENDING",
        method: "PIX",
        reminderSendEmail: true,
        reminderSendWhatsApp: false,
        reminderDaysBefore: 3,
        reminderSendTime: "09:00",
        reminderIncludePix: true,
        pixKey: "64c2591a-b8be-4c71-bc8c-674486ca86fd",
        pixKeyType: "random",
        pixReceiverName: "50122718 GABRIEL FERREI",
        pixCity: "Niquelandia",
        pixTxid: "5012271800000675390941ASA",
      },
    })
    console.log("Cobrança teste criada:", payment.id)
  }

  const sendDate = payment.paymentDate.toISOString().slice(0, 10)
  const result = await runReminderDispatch({
    dryRun,
    skipSendTimeCheck: true,
    onlyPaymentId: payment.id,
    date: sendDate,
    forceResend: !dryRun,
  })

  console.log(JSON.stringify(result, null, 2))

  const emailRow = result.results.find((r) => r.channel === "EMAIL" && r.status === (dryRun ? "preview" : "sent"))
  if (!emailRow) {
    console.error("E-mail não disparado")
    process.exit(1)
  }

  console.log(dryRun ? "Preview Pix OK" : "Envio com Pix OK")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
