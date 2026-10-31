import { NextResponse } from 'next/server'

/** Keep in sync with package.json version (deploy smoke test). */
const APP_VERSION = '0.1.1'

export async function GET() {
  try {
    // Simple health check without database dependency
    return NextResponse.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      service: 'financial-app',
      version: APP_VERSION,
    }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ 
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    }, { status: 500 })
  }
}
