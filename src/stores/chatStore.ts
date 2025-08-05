import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

export interface SourceAttribution {
  id: string
  title: string
  url?: string
  type: 'insight' | 'account' | 'document' | 'web'
  snippet?: string
  confidence?: number
}

export interface ChatMessage {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: Date
  sources?: SourceAttribution[]
  streaming?: boolean
  accountContext?: string
  metadata?: Record<string, unknown>
}

export interface ChatContext {
  accountId?: string
  accountName?: string
  sessionId: string
  startedAt: Date
  lastMessageAt: Date
  messageCount: number
}

interface ChatState {
  messages: ChatMessage[]
  currentContext: ChatContext | null
  isLoading: boolean
  isStreaming: boolean
  error: string | null
  suggestions: string[]
  
  // Input state
  inputValue: string
  isInputFocused: boolean
  
  // Actions
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void
  removeMessage: (id: string) => void
  clearMessages: () => void
  
  // Context actions
  setContext: (context: Partial<ChatContext>) => void
  clearContext: () => void
  
  // Input actions
  setInputValue: (value: string) => void
  setInputFocused: (focused: boolean) => void
  
  // Loading states
  setLoading: (loading: boolean) => void
  setStreaming: (streaming: boolean) => void
  setError: (error: string | null) => void
  
  // Suggestions
  setSuggestions: (suggestions: string[]) => void
  clearSuggestions: () => void
  
  // Computed
  getMessagesByContext: (accountId?: string) => ChatMessage[]
  getLastUserMessage: () => ChatMessage | null
  getLastAssistantMessage: () => ChatMessage | null
  hasActiveContext: () => boolean
}

export const useChatStore = create<ChatState>()(
  devtools(
    (set, get) => ({
      messages: [],
      currentContext: null,
      isLoading: false,
      isStreaming: false,
      error: null,
      suggestions: [
        "What are the key technology trends in this account?",
        "Summarize the latest insights for this company",
        "What are the best next steps for engagement?",
        "Show me the competitive landscape",
        "What value propositions would resonate most?"
      ],
      inputValue: '',
      isInputFocused: false,

      addMessage: (messageData) => {
        const message: ChatMessage = {
          ...messageData,
          id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date(),
        }
        
        const { messages, currentContext } = get()
        set({ messages: [...messages, message] })
        
        // Update context
        if (currentContext) {
          set({
            currentContext: {
              ...currentContext,
              lastMessageAt: message.timestamp,
              messageCount: currentContext.messageCount + 1,
            }
          })
        }
      },

      updateMessage: (id, updates) => {
        const { messages } = get()
        const updatedMessages = messages.map(message => 
          message.id === id ? { ...message, ...updates } : message
        )
        set({ messages: updatedMessages })
      },

      removeMessage: (id) => {
        const { messages } = get()
        const filteredMessages = messages.filter(message => message.id !== id)
        set({ messages: filteredMessages })
      },

      clearMessages: () => {
        set({ messages: [] })
      },

      setContext: (contextData) => {
        const { currentContext } = get()
        
        if (currentContext) {
          set({
            currentContext: { ...currentContext, ...contextData }
          })
        } else {
          const newContext: ChatContext = {
            sessionId: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            startedAt: new Date(),
            lastMessageAt: new Date(),
            messageCount: 0,
            ...contextData,
          }
          set({ currentContext: newContext })
        }
      },

      clearContext: () => {
        set({ currentContext: null })
      },

      setInputValue: (inputValue) => {
        set({ inputValue })
      },

      setInputFocused: (isInputFocused) => {
        set({ isInputFocused })
      },

      setLoading: (isLoading) => {
        set({ isLoading })
      },

      setStreaming: (isStreaming) => {
        set({ isStreaming })
      },

      setError: (error) => {
        set({ error })
      },

      setSuggestions: (suggestions) => {
        set({ suggestions })
      },

      clearSuggestions: () => {
        set({ suggestions: [] })
      },

      getMessagesByContext: (accountId) => {
        const { messages } = get()
        if (!accountId) return messages
        
        return messages.filter(message => message.accountContext === accountId)
      },

      getLastUserMessage: () => {
        const { messages } = get()
        const userMessages = messages.filter(m => m.type === 'user')
        return userMessages.length > 0 ? userMessages[userMessages.length - 1] : null
      },

      getLastAssistantMessage: () => {
        const { messages } = get()
        const assistantMessages = messages.filter(m => m.type === 'assistant')
        return assistantMessages.length > 0 ? assistantMessages[assistantMessages.length - 1] : null
      },

      hasActiveContext: () => {
        const { currentContext } = get()
        return currentContext !== null
      },
    }),
    {
      name: 'chat-store',
    }
  )
)