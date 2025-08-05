interface WebSocketMessage {
  type: string
  payload: unknown
  timestamp: number
}

interface JobUpdate {
  id: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'pending'
  progress: number
  message?: string
  result?: unknown
}

interface NotificationMessage {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  timestamp: number
  read: boolean
}

type WebSocketEventCallback = (data: unknown) => void

class WebSocketService {
  private ws: WebSocket | null = null
  private listeners: Map<string, WebSocketEventCallback[]> = new Map()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private isConnecting = false
  private url: string

  constructor() {
    // Disable WebSocket for now until server is running
    this.url = process.env.NODE_ENV === 'production' 
      ? `wss://${window.location.host}/ws`
      : 'ws://localhost:3001/ws'
  }

  connect(): Promise<void> {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.CONNECTING)) {
      return Promise.resolve()
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve()
    }

    this.isConnecting = true

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url)

        this.ws.onopen = () => {
          console.log('WebSocket connected')
          this.isConnecting = false
          this.reconnectAttempts = 0
          this.emit('connected', {})
          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data)
            this.handleMessage(message)
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error)
          }
        }

        this.ws.onclose = (event) => {
          console.log('WebSocket disconnected:', event.code, event.reason)
          this.isConnecting = false
          this.emit('disconnected', { code: event.code, reason: event.reason })
          
          // Attempt to reconnect unless it was a manual close
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect()
          }
        }

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error)
          this.isConnecting = false
          this.emit('error', error)
          reject(error)
        }
      } catch (error) {
        this.isConnecting = false
        reject(error)
      }
    })
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect')
      this.ws = null
    }
    this.listeners.clear()
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
    
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
    
    setTimeout(() => {
      this.connect().catch(error => {
        console.error('Reconnection failed:', error)
      })
    }, delay)
  }

  private handleMessage(message: WebSocketMessage): void {
    console.log('WebSocket message received:', message.type)
    
    switch (message.type) {
      case 'job-update':
        this.emit('job-update', message.payload as JobUpdate)
        break
      
      case 'notification':
        this.emit('notification', message.payload as NotificationMessage)
        break
        
      case 'account-updated':
        this.emit('account-updated', message.payload)
        break
        
      case 'insight-generated':
        this.emit('insight-generated', message.payload)
        break
        
      case 'system-status':
        this.emit('system-status', message.payload)
        break
        
      default:
        this.emit(message.type, message.payload)
        break
    }
  }

  on(event: string, callback: WebSocketEventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(callback)

    // Return cleanup function
    return () => {
      const eventListeners = this.listeners.get(event)
      if (eventListeners) {
        const index = eventListeners.indexOf(callback)
        if (index > -1) {
          eventListeners.splice(index, 1)
        }
      }
    }
  }

  off(event: string, callback?: WebSocketEventCallback): void {
    if (!callback) {
      this.listeners.delete(event)
      return
    }

    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      const index = eventListeners.indexOf(callback)
      if (index > -1) {
        eventListeners.splice(index, 1)
      }
    }
  }

  private emit(event: string, data: unknown): void {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error(`Error in WebSocket event listener for ${event}:`, error)
        }
      })
    }
  }

  send(type: string, payload: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message: WebSocketMessage = {
        type,
        payload,
        timestamp: Date.now()
      }
      this.ws.send(JSON.stringify(message))
    } else {
      console.warn('WebSocket is not connected. Message not sent:', type)
    }
  }

  // Convenience methods for specific message types
  subscribeToJobUpdates(callback: (update: JobUpdate) => void): () => void {
    return this.on('job-update', (data) => callback(data as JobUpdate))
  }

  subscribeToNotifications(callback: (notification: NotificationMessage) => void): () => void {
    return this.on('notification', (data) => callback(data as NotificationMessage))
  }

  requestJobStatus(jobId: string): void {
    this.send('get-job-status', { jobId })
  }

  joinJobRoom(jobId: string): void {
    this.send('join-job-room', { jobId })
  }

  leaveJobRoom(jobId: string): void {
    this.send('leave-job-room', { jobId })
  }

  getConnectionState(): string {
    if (!this.ws) return 'disconnected'
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting'
      case WebSocket.OPEN:
        return 'connected'
      case WebSocket.CLOSING:
        return 'closing'
      case WebSocket.CLOSED:
        return 'disconnected'
      default:
        return 'unknown'
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
}

// Singleton instance
export const websocketService = new WebSocketService()

// Auto-connect when the service is imported (in browser environment)
// Disabled for now - WebSocket server not running
// if (typeof window !== 'undefined') {
//   websocketService.connect().catch(error => {
//     console.warn('Initial WebSocket connection failed:', error)
//   })
// }

export type { WebSocketMessage, JobUpdate, NotificationMessage }