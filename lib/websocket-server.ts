import { WebSocket, WebSocketServer } from 'ws'
import { IncomingMessage } from 'http'
import { parse } from 'url'

interface ExtendedWebSocket extends WebSocket {
  userId?: string
  userRole?: string
  isAlive?: boolean
}

interface TimerEvent {
  type: 'timer_start' | 'timer_pause' | 'timer_stop' | 'timer_update' | 'task_complete'
  userId: string
  userName: string
  taskId: string
  taskTitle: string
  projectName: string
  sprintName?: string
  timestamp: string
  duration?: number // em segundos
  totalTime?: number // tempo total acumulado em segundos
}

class WebSocketManager {
  private wss: WebSocketServer | null = null
  private clients: Map<string, ExtendedWebSocket> = new Map()
  private timers: Map<string, NodeJS.Timeout> = new Map() // taskId -> timer

  initialize(server: any) {
    this.wss = new WebSocketServer({ server })

    this.wss.on('connection', (ws: ExtendedWebSocket, request: IncomingMessage) => {
      const { query } = parse(request.url || '', true)
      const userId = query.userId as string
      const userRole = query.userRole as string

      if (!userId) {
        ws.close(1008, 'userId é obrigatório')
        return
      }

      ws.userId = userId
      ws.userRole = userRole
      ws.isAlive = true

      // Adicionar cliente à lista
      this.clients.set(userId, ws)

      console.log(`WebSocket conectado: ${userId} (${userRole})`)

      // Heartbeat
      ws.on('pong', () => {
        ws.isAlive = true
      })

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString())
          this.handleMessage(ws, message)
        } catch (error) {
          console.error('Erro ao processar mensagem WebSocket:', error)
        }
      })

      ws.on('close', () => {
        this.clients.delete(userId)
        console.log(`WebSocket desconectado: ${userId}`)
      })

      ws.on('error', (error) => {
        console.error(`Erro WebSocket ${userId}:`, error)
      })
    })

    // Heartbeat interval
    const interval = setInterval(() => {
      this.wss?.clients.forEach((ws: ExtendedWebSocket) => {
        if (!ws.isAlive) {
          ws.terminate()
          if (ws.userId) {
            this.clients.delete(ws.userId)
          }
          return
        }
        ws.isAlive = false
        ws.ping()
      })
    }, 30000)

    this.wss.on('close', () => {
      clearInterval(interval)
    })
  }

  private handleMessage(ws: ExtendedWebSocket, message: any) {
    switch (message.type) {
      case 'timer_start':
        this.handleTimerStart(ws, message)
        break
      case 'timer_pause':
        this.handleTimerPause(ws, message)
        break
      case 'timer_stop':
        this.handleTimerStop(ws, message)
        break
      case 'task_complete':
        this.handleTaskComplete(ws, message)
        break
    }
  }

  private handleTimerStart(ws: ExtendedWebSocket, message: any) {
    const { taskId, taskTitle, projectName, sprintName, userName } = message

    // Parar timer anterior se existir
    if (this.timers.has(taskId)) {
      clearInterval(this.timers.get(taskId)!)
    }

    // Iniciar novo timer que atualiza a cada segundo
    let seconds = 0
    const timer = setInterval(() => {
      seconds++
      
      const timerEvent: TimerEvent = {
        type: 'timer_update',
        userId: ws.userId!,
        userName,
        taskId,
        taskTitle,
        projectName,
        sprintName,
        timestamp: new Date().toISOString(),
        duration: seconds
      }

      // Enviar para supervisores
      this.broadcastToSupervisors(timerEvent)
    }, 1000)

    this.timers.set(taskId, timer)

    // Enviar evento de início
    const startEvent: TimerEvent = {
      type: 'timer_start',
      userId: ws.userId!,
      userName,
      taskId,
      taskTitle,
      projectName,
      sprintName,
      timestamp: new Date().toISOString(),
      duration: 0
    }

    this.broadcastToSupervisors(startEvent)
  }

  private handleTimerPause(ws: ExtendedWebSocket, message: any) {
    const { taskId, taskTitle, projectName, sprintName, userName, duration } = message

    // Parar timer
    if (this.timers.has(taskId)) {
      clearInterval(this.timers.get(taskId)!)
      this.timers.delete(taskId)
    }

    const pauseEvent: TimerEvent = {
      type: 'timer_pause',
      userId: ws.userId!,
      userName,
      taskId,
      taskTitle,
      projectName,
      sprintName,
      timestamp: new Date().toISOString(),
      duration
    }

    this.broadcastToSupervisors(pauseEvent)
  }

  private handleTimerStop(ws: ExtendedWebSocket, message: any) {
    const { taskId, taskTitle, projectName, sprintName, userName, duration, totalTime } = message

    // Parar timer
    if (this.timers.has(taskId)) {
      clearInterval(this.timers.get(taskId)!)
      this.timers.delete(taskId)
    }

    const stopEvent: TimerEvent = {
      type: 'timer_stop',
      userId: ws.userId!,
      userName,
      taskId,
      taskTitle,
      projectName,
      sprintName,
      timestamp: new Date().toISOString(),
      duration,
      totalTime
    }

    this.broadcastToSupervisors(stopEvent)
  }

  private handleTaskComplete(ws: ExtendedWebSocket, message: any) {
    const { taskId, taskTitle, projectName, sprintName, userName, totalTime } = message

    // Parar timer se estiver rodando
    if (this.timers.has(taskId)) {
      clearInterval(this.timers.get(taskId)!)
      this.timers.delete(taskId)
    }

    const completeEvent: TimerEvent = {
      type: 'task_complete',
      userId: ws.userId!,
      userName,
      taskId,
      taskTitle,
      projectName,
      sprintName,
      timestamp: new Date().toISOString(),
      totalTime
    }

    this.broadcastToSupervisors(completeEvent)
  }

  private broadcastToSupervisors(event: TimerEvent) {
    this.clients.forEach((client, userId) => {
      if (client.userRole === 'ADMIN' && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(event))
      }
    })
  }

  // Método público para enviar eventos
  public sendEvent(event: TimerEvent) {
    this.broadcastToSupervisors(event)
  }

  public getConnectedClients() {
    return Array.from(this.clients.keys())
  }
}

export const wsManager = new WebSocketManager()
