'use client'

import { io, Socket } from 'socket.io-client'

type WindowWithSocket = Window & { __linkTeamSocket?: Socket }

type GlobalTeamSocket = typeof globalThis & {
  __linkTeamSocket?: Socket | null
  __linkTeamSocketBootstrapped?: boolean
  __linkTeamSocketBootstrapping?: Promise<Socket> | null
}

const globalStore = globalThis as GlobalTeamSocket

const statusListeners = new Set<(connected: boolean) => void>()

let disconnectDebounceTimer: ReturnType<typeof setTimeout> | null = null
let lastNotifiedConnected = false

function getWindow(): WindowWithSocket | null {
  return typeof window !== 'undefined' ? (window as WindowWithSocket) : null
}

function readStoredSocket(): Socket | null {
  return getWindow()?.__linkTeamSocket ?? globalStore.__linkTeamSocket ?? null
}

function storeSocket(instance: Socket | null) {
  globalStore.__linkTeamSocket = instance
  const win = getWindow()
  if (win) win.__linkTeamSocket = instance ?? undefined
}

function notifyStatus(connected: boolean) {
  if (connected) {
    if (disconnectDebounceTimer) {
      clearTimeout(disconnectDebounceTimer)
      disconnectDebounceTimer = null
    }
    if (lastNotifiedConnected) return
    lastNotifiedConnected = true
    statusListeners.forEach((listener) => listener(true))
    return
  }

  if (!lastNotifiedConnected) return

  if (disconnectDebounceTimer) clearTimeout(disconnectDebounceTimer)
  disconnectDebounceTimer = setTimeout(() => {
    disconnectDebounceTimer = null
    if (readStoredSocket()?.connected) return
    lastNotifiedConnected = false
    statusListeners.forEach((listener) => listener(false))
  }, 1200)
}

export function subscribeSocketStatus(listener: (connected: boolean) => void) {
  statusListeners.add(listener)
  listener(Boolean(readStoredSocket()?.connected))
  return () => {
    statusListeners.delete(listener)
  }
}

export function getTeamSocket(): Socket | null {
  return readStoredSocket()
}

async function bootstrapServer() {
  if (globalStore.__linkTeamSocketBootstrapped) return
  try {
    await fetch('/api/realtime/init', { method: 'POST' })
  } catch {
    // Socket.IO já pode estar ativo — segue conexão do client
  }
  globalStore.__linkTeamSocketBootstrapped = true
}

function attachStatusHandlers(instance: Socket) {
  if ((instance as Socket & { __linkStatusHandlers?: boolean }).__linkStatusHandlers) return
  ;(instance as Socket & { __linkStatusHandlers?: boolean }).__linkStatusHandlers = true

  instance.on('connect', () => notifyStatus(true))
  instance.on('disconnect', () => notifyStatus(false))
  instance.io.on('reconnect', () => notifyStatus(true))
}

function createSocketInstance(): Socket {
  const instance = io({
    path: '/api/socket',
    addTrailingSlash: false,
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    autoConnect: false,
  })
  storeSocket(instance)
  attachStatusHandlers(instance)
  return instance
}

function getOrCreateSocket(): Socket {
  const existing = readStoredSocket()
  if (existing) return existing
  return createSocketInstance()
}

function startConnection(instance: Socket) {
  if (instance.connected || instance.active) return
  instance.connect()
}

export async function ensureTeamSocket(): Promise<Socket> {
  const existing = readStoredSocket()
  if (existing?.connected) {
    notifyStatus(true)
    return existing
  }

  if (globalStore.__linkTeamSocketBootstrapping) {
    return globalStore.__linkTeamSocketBootstrapping
  }

  globalStore.__linkTeamSocketBootstrapping = (async () => {
    await bootstrapServer()
    const instance = getOrCreateSocket()
    startConnection(instance)

    if (instance.connected) {
      notifyStatus(true)
      return instance
    }

    await new Promise<void>((resolve) => {
      if (instance.connected) {
        resolve()
        return
      }

      const timeout = setTimeout(() => {
        cleanup()
        resolve()
      }, 12000)

      const onConnect = () => {
        cleanup()
        resolve()
      }

      const cleanup = () => {
        clearTimeout(timeout)
        instance.off('connect', onConnect)
      }

      instance.once('connect', onConnect)
    })

    if (instance.connected) notifyStatus(true)
    return instance
  })()

  try {
    return await globalStore.__linkTeamSocketBootstrapping
  } finally {
    globalStore.__linkTeamSocketBootstrapping = null
  }
}

export function authenticateTeamSocket(user: {
  id: string
  name?: string | null
  role?: string
}) {
  const instance = readStoredSocket()
  if (!instance?.connected) return
  instance.emit('authenticate', {
    userId: user.id,
    userName: user.name,
    userRole: user.role,
  })
}

export function disconnectTeamSocket() {
  const instance = readStoredSocket()
  if (instance) {
    instance.disconnect()
  }
  storeSocket(null)
  globalStore.__linkTeamSocketBootstrapped = false
  globalStore.__linkTeamSocketBootstrapping = null
  if (disconnectDebounceTimer) {
    clearTimeout(disconnectDebounceTimer)
    disconnectDebounceTimer = null
  }
  lastNotifiedConnected = false
  statusListeners.forEach((listener) => listener(false))
}
