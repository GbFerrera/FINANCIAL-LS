import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { promises as fs } from 'fs'
import path from 'path'

const baseDir = path.join(process.cwd(), 'uploads', 'excalidraw')

async function readFromFS(projectId: string) {
  try {
    await fs.mkdir(baseDir, { recursive: true })
    const file = path.join(baseDir, `${projectId}.json`)
    const buf = await fs.readFile(file, 'utf-8')
    return JSON.parse(buf)
  } catch (_) {
    return null
  }
}

async function writeToFS(projectId: string, scene: any) {
  await fs.mkdir(baseDir, { recursive: true })
  const file = path.join(baseDir, `${projectId}.json`)
  await fs.writeFile(file, JSON.stringify(scene ?? null, null, 2), 'utf-8')
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await ctx.params
  
  console.log('🔍 Loading canvas for project:', projectId)
  
  try {
    // First try to get from database using standard Prisma query
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { excalidrawScene: true }
    })

    if (project?.excalidrawScene) {
      console.log('✅ Canvas loaded from database')
      return NextResponse.json(project.excalidrawScene, { 
        status: 200,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
    }

    // If no scene in database, try filesystem fallback
    const fsScene = await readFromFS(projectId)
    if (fsScene) {
      console.log('✅ Canvas loaded from filesystem')
      return NextResponse.json(fsScene, { 
        status: 200,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
    }

    // Return empty scene if nothing found
    console.log('📄 No canvas found, returning empty scene')
    return NextResponse.json(null, { status: 200 })
    
  } catch (error) {
    console.error('❌ Error loading canvas:', error)
    
    // Try filesystem as fallback
    try {
      const fsScene = await readFromFS(projectId)
      return NextResponse.json(fsScene ?? null, { status: 200 })
    } catch (fsError) {
      console.error('❌ Filesystem fallback failed:', fsError)
      return NextResponse.json({ error: 'Failed to load canvas' }, { status: 500 })
    }
  }
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await ctx.params
  
  // Parse body once at the start
  let scene: any = null
  try {
    const body = await req.json()
    scene = body?.scene ?? body ?? null
  } catch (parseError) {
    console.error('❌ Failed to parse request body:', parseError)
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  
  console.log('💾 Saving canvas for project:', projectId, scene ? 'with data' : 'empty')
  
  // Try database first
  try {
    await prisma.project.update({
      where: { id: projectId },
      data: { excalidrawScene: scene }
    })
    
    console.log('✅ Canvas saved to database successfully')
    
    // Also save to filesystem as backup (non-blocking)
    writeToFS(projectId, scene).catch(err => 
      console.warn('⚠️ Filesystem backup failed:', err)
    )
    
    return NextResponse.json({ 
      ok: true, 
      source: 'db',
      timestamp: new Date().toISOString()
    })
    
  } catch (dbError) {
    console.error('❌ Database save failed:', dbError)
    
    // Fallback to filesystem only
    try {
      await writeToFS(projectId, scene)
      console.log('✅ Canvas saved to filesystem (fallback)')
      return NextResponse.json({ 
        ok: true, 
        source: 'fs',
        timestamp: new Date().toISOString()
      })
    } catch (fsError) {
      console.error('❌ Filesystem fallback failed:', fsError)
      return NextResponse.json({ 
        error: 'Failed to save canvas',
        details: dbError instanceof Error ? dbError.message : 'Unknown error'
      }, { status: 500 })
    }
  }
}