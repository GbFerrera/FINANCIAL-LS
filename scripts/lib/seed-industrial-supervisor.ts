import { PrismaClient, TaskStatus, TimerEventType } from '@prisma/client'
import { DEMO_TEAM } from '../data/industrial-automation-demo'

function atDayTime(daysAgo: number, hour: number, minute = 0) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(hour, minute, 0, 0)
  return d
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000)
}

function isWeekday(date: Date) {
  const day = date.getDay()
  return day >= 1 && day <= 5
}

/** Sessões típicas por dia (minutos): manhã + tarde */
const DAILY_SESSIONS = [
  { startHour: 8, startMin: 30, durationMin: 95 },
  { startHour: 10, startMin: 15, durationMin: 70 },
  { startHour: 14, startMin: 0, durationMin: 120 },
  { startHour: 16, startMin: 30, durationMin: 45 },
]

export async function seedIndustrialSupervisorHistory(prisma: PrismaClient) {
  console.log('👁️ Histórico supervisão (colaboradores)...')

  const teamUsers = await prisma.user.findMany({
    where: { email: { in: DEMO_TEAM.map((t) => t.email) } },
  })

  if (teamUsers.length === 0) {
    console.log('   Nenhum colaborador demo — rode seed industrial primeiro')
    return { users: 0, timeEntries: 0, timerEvents: 0 }
  }

  const teamIds = teamUsers.map((u) => u.id)

  await prisma.timeEntry.deleteMany({ where: { userId: { in: teamIds } } })
  await prisma.timerEvent.deleteMany({ where: { userId: { in: teamIds } } })

  let allTasks = await prisma.task.findMany({
    where: { assigneeId: { in: teamIds } },
    include: { project: { select: { name: true } }, sprint: { select: { name: true } } },
  })

  if (allTasks.length < teamUsers.length * 3) {
    const pool = await prisma.task.findMany({
      where: { assigneeId: null, status: { not: 'COMPLETED' } },
      include: { project: { select: { name: true } }, sprint: { select: { name: true } } },
      take: 40,
    })
    for (let i = 0; i < pool.length; i++) {
      const user = teamUsers[i % teamUsers.length]
      await prisma.task.update({
        where: { id: pool[i].id },
        data: { assigneeId: user.id, status: TaskStatus.IN_PROGRESS },
      })
    }
    allTasks = await prisma.task.findMany({
      where: { assigneeId: { in: teamIds } },
      include: { project: { select: { name: true } }, sprint: { select: { name: true } } },
    })
  }

  if (allTasks.length === 0) {
    console.log('   Sem tarefas para vincular')
    return { users: teamUsers.length, timeEntries: 0, timerEvents: 0 }
  }

  let timeEntryCount = 0
  let timerEventCount = 0
  const sessionId = () => `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  async function recordSession(
    user: (typeof teamUsers)[0],
    task: (typeof allTasks)[0],
    start: Date,
    durationMin: number,
    options?: { active?: boolean; createTimerEvents?: boolean }
  ) {
    const end = options?.active ? null : addMinutes(start, durationMin)
    const durationSec = durationMin * 60

    await prisma.timeEntry.create({
      data: {
        userId: user.id,
        taskId: task.id,
        startTime: start,
        endTime: end,
        duration: options?.active ? null : durationSec,
        isActive: !!options?.active,
        description: `Sessão demo — ${task.title}`,
      },
    })
    timeEntryCount++

    if (options?.createTimerEvents !== false) {
      const sid = sessionId()
      const projectName = task.project?.name ?? 'Sem projeto'
      const sprintName = task.sprint?.name ?? undefined

      await prisma.timerEvent.create({
        data: {
          type: TimerEventType.TIMER_START,
          userId: user.id,
          userName: user.name,
          taskId: task.id,
          taskTitle: task.title,
          projectName,
          sprintName,
          sessionId: sid,
          timestamp: start,
        },
      })
      timerEventCount++

      if (!options?.active && end) {
        await prisma.timerEvent.create({
          data: {
            type: TimerEventType.TIMER_STOP,
            userId: user.id,
            userName: user.name,
            taskId: task.id,
            taskTitle: task.title,
            projectName,
            sprintName,
            duration: durationSec,
            totalTime: durationSec,
            sessionId: sid,
            timestamp: end,
          },
        })
        timerEventCount++
      }
    }
  }

  // —— Histórico 30 dias ——
  for (let daysAgo = 29; daysAgo >= 1; daysAgo--) {
    const day = atDayTime(daysAgo, 12)
    if (!isWeekday(day)) continue

    for (let ui = 0; ui < teamUsers.length; ui++) {
      const user = teamUsers[ui]
      const userTasks = allTasks.filter((t) => t.assigneeId === user.id)
      const tasks = userTasks.length ? userTasks : allTasks

      const sessionsToUse =
        daysAgo % 7 === 0 ? DAILY_SESSIONS.slice(0, 2) : DAILY_SESSIONS.slice(0, 3)

      for (let si = 0; si < sessionsToUse.length; si++) {
        const slot = sessionsToUse[si]
        const task = tasks[(daysAgo + si + ui) % tasks.length]
        const start = atDayTime(daysAgo, slot.startHour, slot.startMin)
        const jitter = (ui * 7 + si * 3) % 20
        const duration = Math.max(30, slot.durationMin - jitter)

        await recordSession(user, task, addMinutes(start, jitter % 10), duration)

        if (si === 0 && daysAgo % 5 === ui % 5) {
          await prisma.timerEvent.create({
            data: {
              type: TimerEventType.TASK_COMPLETE,
              userId: user.id,
              userName: user.name,
              taskId: task.id,
              taskTitle: task.title,
              projectName: task.project?.name ?? 'Sem projeto',
              sprintName: task.sprint?.name ?? undefined,
              timestamp: addMinutes(start, duration),
            },
          })
          timerEventCount++

          await prisma.task.update({
            where: { id: task.id },
            data: {
              status: TaskStatus.COMPLETED,
              completedAt: addMinutes(start, duration),
            },
          })
        }
      }
    }
  }

  // —— Hoje: agenda + 1 colaborador ativo ——
  const todayPlans: Array<{
    userIndex: number
    blocks: Array<{ hour: number; min: number; dur: number; active?: boolean }>
  }> = [
    {
      userIndex: 0,
      blocks: [
        { hour: 8, min: 15, dur: 105 },
        { hour: 10, min: 30, dur: 75 },
        { hour: 14, min: 0, dur: 90, active: true },
      ],
    },
    {
      userIndex: 1,
      blocks: [
        { hour: 8, min: 0, dur: 120 },
        { hour: 11, min: 0, dur: 60 },
        { hour: 13, min: 30, dur: 100 },
      ],
    },
    {
      userIndex: 2,
      blocks: [
        { hour: 9, min: 0, dur: 90 },
        { hour: 11, min: 30, dur: 80 },
        { hour: 15, min: 0, dur: 55, active: true },
      ],
    },
    {
      userIndex: 3,
      blocks: [
        { hour: 8, min: 45, dur: 85 },
        { hour: 10, min: 0, dur: 95 },
        { hour: 14, min: 30, dur: 70 },
      ],
    },
  ]

  for (const plan of todayPlans) {
    const user = teamUsers[plan.userIndex]
    if (!user) continue

    const tasks = allTasks.filter((t) => t.assigneeId === user.id)
    const taskPool = tasks.length ? tasks : allTasks

    for (let bi = 0; bi < plan.blocks.length; bi++) {
      const block = plan.blocks[bi]
      const task = taskPool[bi % taskPool.length]
      const start = atDayTime(0, block.hour, block.min)

      if (block.active) {
        await prisma.task.update({
          where: { id: task.id },
          data: { status: TaskStatus.IN_PROGRESS, assigneeId: user.id },
        })
      }

      await recordSession(user, task, start, block.dur, { active: block.active })
    }

    const completedTask = taskPool[(plan.blocks.length + 1) % taskPool.length]
    const doneAt = atDayTime(0, 11, 45)
    await prisma.task.update({
      where: { id: completedTask.id },
      data: {
        status: TaskStatus.COMPLETED,
        completedAt: doneAt,
        assigneeId: user.id,
      },
    })
    await prisma.timerEvent.create({
      data: {
        type: TimerEventType.TASK_COMPLETE,
        userId: user.id,
        userName: user.name,
        taskId: completedTask.id,
        taskTitle: completedTask.title,
        projectName: completedTask.project?.name ?? 'Sem projeto',
        sprintName: completedTask.sprint?.name ?? undefined,
        timestamp: doneAt,
      },
    })
    timerEventCount++
  }

  console.log(
    `   ${teamUsers.length} colaboradores · ${timeEntryCount} time entries · ${timerEventCount} timer events`
  )

  return {
    users: teamUsers.length,
    timeEntries: timeEntryCount,
    timerEvents: timerEventCount,
  }
}
