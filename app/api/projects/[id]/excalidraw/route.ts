import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
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
  try {
    // Usa consulta raw parametrizada para evitar problemas de tipos do Prisma
    const rows = await prisma.$queryRaw<{ excalidrawScene: any }[]>(Prisma.sql`
      SELECT "excalidrawScene"
      FROM "public"."projects"
      WHERE "id" = ${projectId}
      LIMIT 1
    `)

    const sceneFromDb = rows?.[0]?.excalidrawScene
    if (sceneFromDb !== undefined && sceneFromDb !== null) {
      return NextResponse.json(sceneFromDb, { status: 200 })
    }

    // Se existir projeto mas sem cena no banco, tentar fallback para FS
    const fsSceneIfEmpty = await readFromFS(projectId)
    return NextResponse.json(fsSceneIfEmpty ?? null, { status: 200 })
  } catch (err) {
    // fallback to FS when schema doesn't have column yet
  }

  const fsScene = await readFromFS(projectId)
  return NextResponse.json(fsScene ?? null, { status: 200 })
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await ctx.params
  const body = await req.json()
  const scene = body?.scene ?? body ?? null
  try {
    // Atualiza coluna via SQL raw com parâmetro JSONB
    await prisma.$executeRaw(Prisma.sql`
      UPDATE "public"."projects"
      SET "excalidrawScene" = ${scene}
      WHERE "id" = ${projectId}
    `)
    return NextResponse.json({ ok: true, source: 'db' })
  } catch (err) {
    await writeToFS(projectId, scene)
    return NextResponse.json({ ok: true, source: 'fs' })
  }
}