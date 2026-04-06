import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Simple health check without database dependency
    return NextResponse.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      service: 'financial-app'
    }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ 
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    }, { status: 500 })
  }
}
