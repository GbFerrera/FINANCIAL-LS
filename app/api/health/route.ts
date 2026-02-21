import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const startedAt = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    const durationMs = Date.now() - startedAt
    return NextResponse.json({
      status: 'ok',
      checks: {
        database: 'ok',
      },
      durationMs,
      timestamp: new Date().toISOString(),
    })
  } catch (err: any) {
    const durationMs = Date.now() - startedAt
    return NextResponse.json(
      {
        status: 'error',
        checks: {
          database: 'error',
        },
        error: typeof err?.message === 'string' ? err.message : 'unknown error',
        durationMs,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
