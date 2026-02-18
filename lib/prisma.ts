import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const candidate =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
  })

const hasNoteDelegate = 'note' in (candidate as unknown as Record<string, unknown>)

export const prisma = hasNoteDelegate
  ? candidate
  : new PrismaClient({
      log: ['query'],
    })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
