import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'Use POST /api/reports para gerar relatórios' },
    { status: 410 }
  )
}
