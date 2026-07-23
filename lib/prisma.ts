import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function prismaClientReady(client: PrismaClient) {
  const d = client as unknown as { whatsAppInstance?: { findMany?: unknown } }
  return typeof d.whatsAppInstance?.findMany === "function"
}

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query"] : [],
  })
}

const candidate = globalForPrisma.prisma ?? createPrismaClient()

export const prisma = prismaClientReady(candidate) ? candidate : createPrismaClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
