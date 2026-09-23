/**
 * Restaura projectId das tasks que caíram todas em Link Callendar após revert.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const PROJECT = {
  calendar: 'cmnhenfhr002tp4202x1aw096',
  eats: 'cmltidb5000awp81xkssz2a26',
  clinic: 'cmr984gs9000jpj263e3g0igv',
  control: 'cms643jgp000qob2bt1l5roc7',
  message: 'cmqkwp2gr008eqs2pv9m6ie5f',
  ceo: '', // preenchido abaixo
} as const

/** taskId → projectId de entrega (Esteira A) */
const RESTORE: Record<string, string> = {
  cmtt0kbvo000jmz2dmikfiicn: PROJECT.calendar,
  cmt97sjlb00xwnv2cxxy7hlm8: PROJECT.calendar,
  cmu3g2icb003xtf2b0hx3tphi: PROJECT.calendar,
  cmr97wcko000bpj26lwxtsfsq: PROJECT.calendar,

  cmub5u6jp00smtf2i43i1u3d5: PROJECT.clinic,
  cmu1n0xdv00ajkd2b9yxiz4n6: PROJECT.clinic,
  cmu2mrpl80056n126l1617ngk: PROJECT.clinic,
  cmu2m6x2n004fn126i5d6fuyj: PROJECT.clinic,
  cmu2mfc530051n126a7u0jbvk: PROJECT.clinic,
  cmu3ao90s002ktf2b7k0r4atl: PROJECT.clinic,

  cmsrl99lu006inv2ctdhil9t5: PROJECT.eats,
  cmu2so3yk0009tf2bxktuj2eg: PROJECT.eats,
  cmtw1x4rn0061td2nnu4quvjk: PROJECT.eats,
  cmtw879dk006ltd2ng4lkrsmh: PROJECT.eats,
  cmu3cbfmx002rtf2bmagnqm5n: PROJECT.eats,
  cmtxj7vyf009ftd2ntaqmg0yb: PROJECT.eats,
  cmu3dby5i0033tf2b534lx6lz: PROJECT.eats,
  cms4q3wio0005qd2ad1w1eosg: PROJECT.eats,
  cmsdm18cr001mnv2cv6w15dq5: PROJECT.eats,
  cmu2mwsvk005gn126vy30pegn: PROJECT.eats,
  cmu2msjzp005bn126hilb22k2: PROJECT.eats,
  cmqkwgljx008aqs2p5u2fv893: PROJECT.eats,
  cmtw085mx005xtd2nusr49ndy: PROJECT.eats,

  cmqkwqmzt008iqs2pfv9n2u7n: PROJECT.message,
  cmu3ebdq2003stf2b165cyn7o: PROJECT.message,
  cmrzdknf10003nz2bdq3ojfl4: PROJECT.message,
  cmu63menz001vtf2ieud9tlt5: PROJECT.message,
  cmrj9lq78000qnu2arq3o6sxe: PROJECT.message,

  cmttbtqx2000ytd2nzygf25w8: PROJECT.control,
  cmttbhql4000wtd2n47ezbmp9: PROJECT.control,
  cmu2m4aas0040n126zp12bb43: PROJECT.control,
  cmu2m52yz0045n12616tla7fx: PROJECT.control,
  cmu2m9b7b004ln1262af6t617: PROJECT.control,
  cmu2mat4e004qn126b1910qa4: PROJECT.control,
  cmu2m5soj004an1265utz8v2b: PROJECT.control,
  cmu2linfs003vn1265yv4l7g4: PROJECT.control,
  cmu2mx84p005ln126846r44y3: PROJECT.control,
  cmu2n4uhm005wn1261bndt6qr: PROJECT.control,
  cmttb2k0y000std2nolydmany: PROJECT.control,
  cmu2n5lb40061n126iyah4jxc: PROJECT.control,
}

async function syncPrimary(taskId: string, projectId: string) {
  await prisma.taskProject.deleteMany({ where: { taskId } })
  await prisma.taskProject.create({
    data: { taskId, projectId, isPrimary: true },
  })
}

async function main() {
  const calendarProjectId = PROJECT.calendar
  const stuck = await prisma.task.findMany({
    where: { projectId: calendarProjectId, isArchived: false },
    select: { id: true, title: true },
  })

  console.log(`Tasks em Link Callendar: ${stuck.length}`)

  let restored = 0
  let unknown = 0

  for (const task of stuck) {
    const target = RESTORE[task.id]
    if (!target || target === calendarProjectId) {
      if (!RESTORE[task.id]) {
        unknown++
        console.log(`? sem mapa: ${task.title} (${task.id})`)
      }
      continue
    }

    await prisma.$transaction(async (tx) => {
      await tx.task.update({
        where: { id: task.id },
        data: {
          projectId: target,
          kanbanColumnId: null,
          updatedAt: new Date(),
        },
      })
    })
    await syncPrimary(task.id, target)
    restored++
    console.log(`✓ ${task.title}`)
  }

  console.log(`Restauradas: ${restored}, sem mapa: ${unknown}`)

  const summary = await prisma.task.groupBy({
    by: ['projectId'],
    where: {
      isArchived: false,
      projectId: { in: Object.values(PROJECT).filter(Boolean) },
    },
    _count: true,
  })
  for (const row of summary) {
    const name = await prisma.project.findUnique({
      where: { id: row.projectId },
      select: { name: true },
    })
    console.log(`  ${name?.name}: ${row._count}`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
