'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSocket } from './useSocket'
import { useSession } from 'next-auth/react'

interface CollaboratorInfo {
  userId: string
  userName: string
  cursor?: { x: number; y: number }
  color: string
  lastSeen: string
}

interface ExcalidrawCollaborationHook {
  collaborators: CollaboratorInfo[]
  isConnected: boolean
  joinProject: (projectId: string) => void
  leaveProject: (projectId: string) => void
  updateScene: (projectId: string, scene: any, elements: any[], appState: any) => void
  updateCursor: (projectId: string, cursor: { x: number; y: number }) => void
  onSceneUpdate: (callback: (data: any) => void) => void
  onCursorUpdate: (callback: (data: any) => void) => void
  onUserJoined: (callback: (data: any) => void) => void
  onUserLeft: (callback: (data: any) => void) => void
}

export function useExcalidrawCollaboration(): ExcalidrawCollaborationHook {
  const { socket, isConnected } = useSocket()
  const { data: session } = useSession()
  const [collaborators, setCollaborators] = useState<CollaboratorInfo[]>([])
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null)

  // Callbacks para eventos
  const [sceneUpdateCallback, setSceneUpdateCallback] = useState<((data: any) => void) | null>(null)
  const [cursorUpdateCallback, setCursorUpdateCallback] = useState<((data: any) => void) | null>(null)
  const [userJoinedCallback, setUserJoinedCallback] = useState<((data: any) => void) | null>(null)
  const [userLeftCallback, setUserLeftCallback] = useState<((data: any) => void) | null>(null)

  // Configurar listeners do socket (padrão oficial Excalidraw)
  useEffect(() => {
    if (!socket || !isConnected) return

    // Inicialização da sala
    socket.on('init-room', () => {
      console.log('🏠 Sala inicializada')
    })

    // Primeiro usuário na sala
    socket.on('first-in-room', () => {
      console.log('🥇 Primeiro usuário na sala')
    })

    // Novo usuário entrou
    socket.on('new-user', (data: { socketId: string, userId: string, userName: string }) => {
      console.log('👋 Novo usuário entrou:', data.userName)
      userJoinedCallback?.(data)
    })

    // Usuário saiu
    socket.on('user-left', (data: { socketId: string, userId: string, userName: string }) => {
      console.log('👋 Usuário saiu:', data.userName)
      userLeftCallback?.(data)
    })

    // Mudança na lista de usuários da sala
    socket.on('room-user-change', (userIds: string[]) => {
      console.log('👥 Lista de usuários atualizada:', userIds)
      // Aqui você poderia buscar detalhes dos usuários se necessário
    })

    // Dados recebidos de outros colaboradores (criptografados)
    socket.on('client-broadcast', (data: { socketId: string, encryptedData: ArrayBuffer | string, iv?: ArrayBuffer }) => {
      console.log('📥 Dados recebidos de:', data.socketId)
      // Aqui você descriptografaria os dados e chamaria sceneUpdateCallback
      // Por simplicidade, vamos assumir que os dados não estão criptografados
      try {
        const decryptedData = typeof data.encryptedData === 'string' 
          ? JSON.parse(data.encryptedData)
          : data.encryptedData
        sceneUpdateCallback?.({
          socketId: data.socketId,
          ...decryptedData
        })
      } catch (error) {
        console.error('Erro ao processar dados recebidos:', error)
      }
    })

    // Cursor atualizado
    socket.on('cursor-update', (data: { socketId: string, pointer: { x: number, y: number }, userId: string, userName: string }) => {
      cursorUpdateCallback?.({
        socketId: data.socketId,
        cursor: data.pointer,
        userId: data.userId,
        userName: data.userName
      })
      
      // Atualizar cursor do colaborador na lista
      setCollaborators(prev => prev.map(collab => 
        collab.userId === data.userId 
          ? { ...collab, cursor: data.pointer, lastSeen: new Date().toISOString() }
          : collab
      ))
    })

    return () => {
      socket.off('init-room')
      socket.off('first-in-room')
      socket.off('new-user')
      socket.off('user-left')
      socket.off('room-user-change')
      socket.off('client-broadcast')
      socket.off('cursor-update')
    }
  }, [socket, isConnected, sceneUpdateCallback, cursorUpdateCallback, userJoinedCallback, userLeftCallback])

  // Entrar em uma sala (projeto)
  const joinProject = useCallback((projectId: string) => {
    if (!socket || !isConnected || !session?.user?.id) {
      console.warn('Socket não conectado ou usuário não autenticado')
      return
    }

    console.log('🚀 Entrando na sala Excalidraw:', projectId)
    setCurrentRoomId(projectId)
    socket.emit('join-room', { roomID: projectId })
  }, [socket, isConnected, session?.user?.id])

  // Sair de uma sala (projeto)
  const leaveProject = useCallback((projectId: string) => {
    if (!socket || !isConnected) return

    console.log('🚪 Saindo da sala Excalidraw:', projectId)
    socket.emit('leave-room', { roomID: projectId })
    setCurrentRoomId(null)
    setCollaborators([])
  }, [socket, isConnected])

  // Atualizar cena (broadcast para outros colaboradores)
  const updateScene = useCallback((projectId: string, scene: any, elements: any[], appState: any) => {
    if (!socket || !isConnected) return

    // Debounce otimizado para evitar muitas atualizações
    const debounceKey = `scene_update_${projectId}`
    clearTimeout((window as any)[debounceKey])
    
    ;(window as any)[debounceKey] = setTimeout(() => {
      try {
        // Preparar dados otimizados para broadcast
        const dataToSend = {
          elements: elements.slice(0, 1000), // Limitar elementos para performance
          appState: {
            // Enviar apenas propriedades essenciais do appState
            viewBackgroundColor: appState.viewBackgroundColor,
            currentItemStrokeColor: appState.currentItemStrokeColor,
            currentItemBackgroundColor: appState.currentItemBackgroundColor,
            currentItemFillStyle: appState.currentItemFillStyle,
            currentItemStrokeWidth: appState.currentItemStrokeWidth,
            currentItemRoughness: appState.currentItemRoughness,
            currentItemOpacity: appState.currentItemOpacity
          },
          timestamp: new Date().toISOString()
        }
        
        // Enviar dados compactados
        socket.emit('server-broadcast', {
          roomID: projectId,
          encryptedData: JSON.stringify(dataToSend)
        })
      } catch (error) {
        console.error('Erro no broadcast de cena:', error)
      }
    }, 500) // Aumentar debounce para 500ms para melhor performance
  }, [socket, isConnected])

  // Atualizar cursor com throttling otimizado
  const updateCursor = useCallback((projectId: string, cursor: { x: number; y: number }) => {
    if (!socket || !isConnected) return

    // Throttle mais agressivo para cursors para melhor performance
    const throttleKey = `cursor_update_${projectId}`
    if (!(window as any)[throttleKey]) {
      try {
        socket.emit('cursor-update', { 
          roomID: projectId, 
          pointer: cursor 
        })
        
        ;(window as any)[throttleKey] = true
        setTimeout(() => {
          ;(window as any)[throttleKey] = false
        }, 100) // Aumentar throttle para 100ms para reduzir overhead
      } catch (error) {
        console.error('Erro no update de cursor:', error)
      }
    }
  }, [socket, isConnected])

  // Registrar callbacks
  const onSceneUpdate = useCallback((callback: (data: any) => void) => {
    setSceneUpdateCallback(() => callback)
  }, [])

  const onCursorUpdate = useCallback((callback: (data: any) => void) => {
    setCursorUpdateCallback(() => callback)
  }, [])

  const onUserJoined = useCallback((callback: (data: any) => void) => {
    setUserJoinedCallback(() => callback)
  }, [])

  const onUserLeft = useCallback((callback: (data: any) => void) => {
    setUserLeftCallback(() => callback)
  }, [])

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      if (currentRoomId) {
        leaveProject(currentRoomId)
      }
    }
  }, [currentRoomId, leaveProject])

  return {
    collaborators,
    isConnected,
    joinProject,
    leaveProject,
    updateScene,
    updateCursor,
    onSceneUpdate,
    onCursorUpdate,
    onUserJoined,
    onUserLeft
  }
}
