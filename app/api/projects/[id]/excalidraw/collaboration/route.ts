import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Server as ServerIO } from 'socket.io'
import { Server as NetServer } from 'http'

// Tipos para colaboração
interface ExcalidrawCollaborationEvent {
  type: 'scene_update' | 'cursor_update' | 'user_join' | 'user_leave'
  projectId: string
  userId: string
  userName: string
  data?: any
  timestamp: string
}

interface CollaboratorInfo {
  userId: string
  userName: string
  cursor?: { x: number; y: number }
  color: string
  lastSeen: string
}

// Store para colaboradores ativos por projeto
const activeCollaborators = new Map<string, Map<string, CollaboratorInfo>>()

// Cores para colaboradores
const collaboratorColors = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
]

function getCollaboratorColor(userId: string): string {
  const hash = userId.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0)
    return a & a
  }, 0)
  return collaboratorColors[Math.abs(hash) % collaboratorColors.length]
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await ctx.params
  const body = await req.json()
  const { type, userId, userName, data } = body as ExcalidrawCollaborationEvent

  try {
    // Verificar se o usuário tem acesso ao projeto
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { createdBy: userId },
          { team: { some: { id: userId } } }
        ]
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Acesso negado ao projeto' }, { status: 403 })
    }

    // Gerenciar colaboradores ativos
    if (!activeCollaborators.has(projectId)) {
      activeCollaborators.set(projectId, new Map())
    }

    const projectCollaborators = activeCollaborators.get(projectId)!

    switch (type) {
      case 'user_join':
        projectCollaborators.set(userId, {
          userId,
          userName,
          color: getCollaboratorColor(userId),
          lastSeen: new Date().toISOString()
        })
        break

      case 'user_leave':
        projectCollaborators.delete(userId)
        break

      case 'cursor_update':
        if (projectCollaborators.has(userId)) {
          const collaborator = projectCollaborators.get(userId)!
          collaborator.cursor = data.cursor
          collaborator.lastSeen = new Date().toISOString()
        }
        break

      case 'scene_update':
        // Salvar mudanças no banco de dados
        await prisma.project.update({
          where: { id: projectId },
          data: { excalidrawScene: data.scene }
        })

        if (projectCollaborators.has(userId)) {
          const collaborator = projectCollaborators.get(userId)!
          collaborator.lastSeen = new Date().toISOString()
        }
        break
    }

    // Broadcast para outros colaboradores (implementaremos WebSocket depois)
    const collaboratorsList = Array.from(projectCollaborators.values())

    return NextResponse.json({
      success: true,
      collaborators: collaboratorsList,
      event: {
        type,
        projectId,
        userId,
        userName,
        data,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Erro na colaboração Excalidraw:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await ctx.params
  const url = new URL(req.url)
  const userId = url.searchParams.get('userId')

  if (!userId) {
    return NextResponse.json({ error: 'userId é obrigatório' }, { status: 400 })
  }

  try {
    // Verificar acesso ao projeto
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { userId: userId },
          { team: { some: { id: userId } } }
        ]
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Acesso negado ao projeto' }, { status: 403 })
    }

    // Retornar colaboradores ativos
    const projectCollaborators = activeCollaborators.get(projectId) || new Map()
    const collaboratorsList = Array.from(projectCollaborators.values())

    // Limpar colaboradores inativos (mais de 30 segundos)
    const now = new Date()
    collaboratorsList.forEach(collaborator => {
      const lastSeen = new Date(collaborator.lastSeen)
      if (now.getTime() - lastSeen.getTime() > 30000) {
        projectCollaborators.delete(collaborator.userId)
      }
    })

    return NextResponse.json({
      collaborators: Array.from(projectCollaborators.values()),
      projectId
    })

  } catch (error) {
    console.error('Erro ao buscar colaboradores:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
