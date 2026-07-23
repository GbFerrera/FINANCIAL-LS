/**
 * Audita e corrige lastPaidFor de assinaturas afetadas pelo bug de "pular mês".
 *
 * Uso:
 *   npx tsx scripts/reconcile-subscription-billing.ts           # dry-run (padrão)
 *   npx tsx scripts/reconcile-subscription-billing.ts --apply     # aplica correções automáticas (AHEAD_ONE_MONTH)
 *   npx tsx scripts/reconcile-subscription-billing.ts --apply --id=<clientSubscriptionId>
 *
 * Requer DATABASE_URL no ambiente (prod: rode no host/Coolify com .env de produção).
 */
import { PrismaClient } from "@prisma/client"
import { auditClientSubscription, dateKey } from "../lib/subscription-billing"

const prisma = new PrismaClient()

const args = process.argv.slice(2)
const apply = args.includes("--apply")
const idArg = args.find((a) => a.startsWith("--id="))
const onlyId = idArg ? idArg.split("=")[1] : null

async function main() {
  console.log(apply ? "🔧 Modo APPLY — alterações serão gravadas\n" : "👀 Modo dry-run — nenhuma alteração\n")

  const links = await prisma.clientSubscription.findMany({
    where: {
      status: "ACTIVE",
      ...(onlyId ? { id: onlyId } : {}),
    },
    include: {
      client: { select: { name: true } },
      subscription: { select: { name: true, billingCycle: true, isActive: true } },
    },
    orderBy: { updatedAt: "desc" },
  })

  let fixable = 0
  let fixed = 0
  let withIssues = 0

  for (const link of links) {
    if (!link.subscription.isActive) continue

    const billingCycle = link.subscription.billingCycle as "MONTHLY" | "YEARLY"
    const audit = auditClientSubscription({
      dueDay: link.dueDay,
      startedAt: link.startedAt,
      lastPaidFor: link.lastPaidFor,
      paidAt: link.paidAt,
      billingCycle,
    })

    const autoFix = audit.issues.find((i) => i.code === "AHEAD_ONE_MONTH" && i.suggestedLastPaidFor)
    const hasOther = audit.issues.some((i) => i.code !== "AHEAD_ONE_MONTH")

    if (audit.issues.length === 0) continue

    withIssues += 1

    const label = `${link.client.name} • ${link.subscription.name} (${link.id.slice(0, 8)}…)`
    console.log("—".repeat(60))
    console.log(label)
    console.log(`  dueDay: ${link.dueDay}  billing: ${billingCycle}`)
    console.log(
      `  lastPaidFor: ${link.lastPaidFor ? dateKey(new Date(link.lastPaidFor)) : "—"}  paidAt: ${
        link.paidAt ? dateKey(new Date(link.paidAt)) : "—"
      }`
    )
    if (audit.nextUnpaid) {
      console.log(`  próximo em aberto (regra corrigida): ${dateKey(audit.nextUnpaid)}`)
    }
    if (audit.openDues.length > 0) {
      const open = audit.openDues.slice(0, 6).map((d) => dateKey(d))
      console.log(`  ciclos em aberto no período: ${open.join(", ")}${audit.openDues.length > 6 ? "…" : ""}`)
    }
    for (const issue of audit.issues) {
      console.log(`  ⚠ ${issue.code}: ${issue.message}`)
      if (issue.suggestedLastPaidFor) {
        console.log(`    → sugerido lastPaidFor: ${dateKey(issue.suggestedLastPaidFor)}`)
      }
    }

    if (autoFix?.suggestedLastPaidFor) {
      fixable += 1
      const suggested = autoFix.suggestedLastPaidFor
      if (apply) {
        await prisma.clientSubscription.update({
          where: { id: link.id },
          data: { lastPaidFor: suggested },
        })
        fixed += 1
        console.log(`  ✅ Corrigido lastPaidFor → ${dateKey(suggested)}`)
      } else {
        console.log(`  💡 Rodar com --apply para corrigir automaticamente (AHEAD_ONE_MONTH)`)
      }
    } else if (hasOther) {
      console.log(`  ℹ Revisão manual: marque o mês correto no painel ou ajuste lastPaidFor no banco.`)
    }
  }

  console.log("\n" + "=".repeat(60))
  console.log(`Assinaturas ativas analisadas: ${links.length}`)
  console.log(`Com alertas: ${withIssues}`)
  console.log(`Correção automática disponível: ${fixable}`)
  if (apply) console.log(`Registros atualizados: ${fixed}`)
  else if (fixable > 0) console.log(`\nPara aplicar: npx tsx scripts/reconcile-subscription-billing.ts --apply`)

  if (withIssues === 0) {
    console.log("\nNenhum caso suspeito encontrado com as heurísticas atuais.")
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
