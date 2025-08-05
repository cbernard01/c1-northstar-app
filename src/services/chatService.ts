interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  metadata?: {
    accountId?: string
    accountName?: string
    confidence?: number
    sources?: string[]
    suggestedActions?: string[]
  }
}

interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  context?: {
    accountId?: string
    accountName?: string
    currentFilter?: Record<string, unknown>
  }
  createdAt: Date
  updatedAt: Date
}

interface FlowiseConfig {
  apiUrl: string
  chatFlowId: string
  apiKey?: string
}

class ChatService {
  private config: FlowiseConfig
  private sessions: Map<string, ChatSession> = new Map()
  private currentSessionId: string | null = null
  
  constructor() {
    this.config = {
      apiUrl: process.env.NEXT_PUBLIC_FLOWISE_API_URL || 'http://localhost:3000',
      chatFlowId: process.env.NEXT_PUBLIC_FLOWISE_CHATFLOW_ID || 'default-flow',
      apiKey: process.env.NEXT_PUBLIC_FLOWISE_API_KEY
    }
  }

  async sendMessage(
    message: string,
    sessionId?: string,
    context?: { accountId?: string; accountName?: string }
  ): Promise<{
    response: ChatMessage
    sessionId: string
    suggestions?: string[]
  }> {
    const session = sessionId ? this.getSession(sessionId) : this.createSession(context)
    
    // Add user message to session
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      role: 'user',
      content: message,
      timestamp: new Date(),
      metadata: context
    }
    
    session.messages.push(userMessage)
    session.updatedAt = new Date()

    try {
      // In production, this would call the actual Flowise API
      // For now, we'll simulate the API call with mock data
      const assistantResponse = await this.callFlowiseAPI(message, session)
      
      session.messages.push(assistantResponse)
      this.sessions.set(session.id, session)
      this.currentSessionId = session.id

      return {
        response: assistantResponse,
        sessionId: session.id,
        suggestions: this.generateSuggestions(message, context)
      }
    } catch (error) {
      console.error('Failed to send message to Flowise:', error)
      
      // Fallback response
      const errorResponse: ChatMessage = {
        id: `msg_${Date.now()}_error`,
        role: 'assistant',
        content: 'I apologize, but I encountered an error processing your request. Please try again or contact support if the issue persists.',
        timestamp: new Date(),
        metadata: { confidence: 0 }
      }
      
      session.messages.push(errorResponse)
      this.sessions.set(session.id, session)
      
      return {
        response: errorResponse,
        sessionId: session.id
      }
    }
  }

  private async callFlowiseAPI(message: string, session: ChatSession): Promise<ChatMessage> {
    // Mock implementation - in production, this would call the actual Flowise API
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000))
    
    // Generate mock responses based on message content
    const mockResponse = this.generateMockResponse(message, session.context)
    
    return {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      role: 'assistant',
      content: mockResponse.content,
      timestamp: new Date(),
      metadata: {
        confidence: mockResponse.confidence,
        sources: mockResponse.sources,
        suggestedActions: mockResponse.suggestedActions,
        ...session.context
      }
    }
  }

  private generateMockResponse(message: string, context?: ChatSession['context']) {
    const lowerMessage = message.toLowerCase()
    
    // Account-specific responses
    if (context?.accountName) {
      if (lowerMessage.includes('technology') || lowerMessage.includes('tech stack')) {
        return {
          content: `Based on our analysis of ${context.accountName}, here are the key technologies I've identified:\n\n• **Frontend**: React, TypeScript, Next.js\n• **Backend**: Node.js, PostgreSQL\n• **Cloud**: AWS (EC2, RDS, S3)\n• **Analytics**: Google Analytics, Mixpanel\n• **Marketing**: HubSpot, Salesforce\n\nThis tech stack suggests they're a modern company with strong development capabilities. They might be interested in advanced analytics tools or cloud optimization services.`,
          confidence: 0.85,
          sources: ['Company website analysis', 'Job postings', 'Tech stack detection'],
          suggestedActions: ['Prepare cloud migration proposal', 'Suggest analytics upgrade', 'Schedule technical demo']
        }
      }
      
      if (lowerMessage.includes('contact') || lowerMessage.includes('decision maker')) {
        return {
          content: `For ${context.accountName}, here are the key contacts I recommend reaching out to:\n\n**Primary Decision Makers:**\n• Sarah Johnson - CTO (sarah.johnson@company.com)\n• Mike Chen - VP Engineering (mike.chen@company.com)\n\n**Secondary Contacts:**\n• Lisa Rodriguez - Head of Operations\n• David Park - Senior DevOps Engineer\n\n**Best Approach:** Start with Sarah Johnson as she's been actively posting about modernizing their tech infrastructure. Mike Chen would be a good secondary contact for technical discussions.`,
          confidence: 0.78,
          sources: ['LinkedIn analysis', 'Company directory', 'Recent activity'],
          suggestedActions: ['Connect on LinkedIn', 'Send personalized email', 'Request intro through mutual connection']
        }
      }
      
      if (lowerMessage.includes('pain point') || lowerMessage.includes('challenge')) {
        return {
          content: `Based on my analysis of ${context.accountName}, here are the main pain points I've identified:\n\n**Technical Challenges:**\n• Legacy system integration issues\n• Scaling database performance\n• Security compliance requirements\n\n**Business Challenges:**\n• Manual reporting processes\n• Limited real-time analytics\n• Cross-team collaboration inefficiencies\n\n**Evidence:** Recent job postings mention "system modernization" and "digital transformation." Their CTO has posted about infrastructure challenges on LinkedIn.`,
          confidence: 0.82,
          sources: ['Job postings analysis', 'Social media monitoring', 'Technical blog posts'],
          suggestedActions: ['Prepare ROI calculator', 'Create custom demo', 'Share relevant case studies']
        }
      }
    }
    
    // General responses
    if (lowerMessage.includes('account') && lowerMessage.includes('summary')) {
      return {
        content: `I can provide detailed account summaries including:\n\n• Company overview and key metrics\n• Technology stack analysis\n• Decision maker identification\n• Pain points and opportunities\n• Competitive landscape\n• Recommended approach\n\nWhich specific account would you like me to analyze? You can ask about any company in your database.`,
        confidence: 0.9,
        sources: ['Account database', 'Real-time analysis'],
        suggestedActions: ['Select specific account', 'Filter by industry', 'View recent insights']
      }
    }
    
    if (lowerMessage.includes('insight') || lowerMessage.includes('recommendation')) {
      return {
        content: `Here are some key insights from your recent account data:\n\n**Trending Technologies:**\n• 45% increase in companies adopting AI/ML\n• Growing interest in cloud-native solutions\n• Security compliance becoming top priority\n\n**Market Opportunities:**\n• Mid-market companies (100-500 employees) showing highest engagement\n• Healthcare and FinTech verticals are most active\n• Q1 2024 budget cycles starting soon\n\n**Recommended Actions:**\n• Focus on AI/ML messaging for tech companies\n• Develop security-focused content for regulated industries\n• Prepare Q1 budget justification materials`,
        confidence: 0.88,
        sources: ['Market analysis', 'Account trends', 'Industry reports'],
        suggestedActions: ['Update messaging strategy', 'Create industry-specific content', 'Schedule Q1 planning session']
      }
    }
    
    // Default response
    return {
      content: `I'm here to help you analyze accounts, identify opportunities, and provide insights based on your sales data. I can help with:\n\n• **Account Analysis** - Deep dive into specific companies\n• **Technology Insights** - Identify tech stacks and opportunities\n• **Contact Research** - Find decision makers and warm intro paths\n• **Market Intelligence** - Industry trends and competitive analysis\n• **Sales Strategy** - Personalized outreach recommendations\n\nWhat would you like to explore? You can ask me about specific accounts, request market insights, or get help with your sales strategy.`,
      confidence: 0.95,
      sources: ['Knowledge base', 'Account database'],
      suggestedActions: ['Ask about specific account', 'Request market analysis', 'Get sales recommendations']
    }
  }

  private generateSuggestions(message: string, context?: { accountId?: string; accountName?: string }): string[] {
    if (context?.accountName) {
      return [
        `Tell me more about ${context.accountName}'s competitors`,
        `What are the best talking points for ${context.accountName}?`,
        `Show me similar companies to ${context.accountName}`,
        `Create an outreach sequence for ${context.accountName}`
      ]
    }
    
    return [
      'Show me accounts with the highest potential',
      'What are the trending technologies this quarter?',
      'Help me prioritize my pipeline',
      'Generate a market intelligence report'
    ]
  }

  createSession(context?: { accountId?: string; accountName?: string }): ChatSession {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const title = context?.accountName 
      ? `Chat about ${context.accountName}`
      : `Chat Session ${new Date().toLocaleDateString()}`
    
    const session: ChatSession = {
      id: sessionId,
      title,
      messages: [],
      context,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    // Add system message
    const systemMessage: ChatMessage = {
      id: `msg_${Date.now()}_system`,
      role: 'system',
      content: context?.accountName 
        ? `Context: Analyzing ${context.accountName}. I have access to their company data, technology stack, contacts, and market intelligence.`
        : 'I\'m your AI sales intelligence assistant. I can help analyze accounts, identify opportunities, and provide strategic insights.',
      timestamp: new Date(),
      metadata: context
    }
    
    session.messages.push(systemMessage)
    this.sessions.set(sessionId, session)
    
    return session
  }

  getSession(sessionId: string): ChatSession {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error('Session not found')
    }
    return session
  }

  getAllSessions(): ChatSession[] {
    return Array.from(this.sessions.values()).sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
    )
  }

  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId)
    if (this.currentSessionId === sessionId) {
      this.currentSessionId = null
    }
  }

  getCurrentSessionId(): string | null {
    return this.currentSessionId
  }

  setCurrentSession(sessionId: string): void {
    if (this.sessions.has(sessionId)) {
      this.currentSessionId = sessionId
    }
  }

  clearAllSessions(): void {
    this.sessions.clear()
    this.currentSessionId = null
  }

  // Streaming support for real-time responses
  async *streamMessage(
    message: string,
    sessionId?: string,
    context?: { accountId?: string; accountName?: string }
  ): AsyncGenerator<{ type: 'token' | 'complete'; content: string; sessionId: string }> {
    const session = sessionId ? this.getSession(sessionId) : this.createSession(context)
    
    // Add user message
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      role: 'user',
      content: message,
      timestamp: new Date(),
      metadata: context
    }
    
    session.messages.push(userMessage)
    
    // Simulate streaming response
    const mockResponse = this.generateMockResponse(message, session.context)
    const words = mockResponse.content.split(' ')
    
    let accumulated = ''
    
    for (let i = 0; i < words.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100))
      
      accumulated += (i > 0 ? ' ' : '') + words[i]
      
      yield {
        type: 'token',
        content: accumulated,
        sessionId: session.id
      }
    }
    
    // Add complete message to session
    const assistantMessage: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      role: 'assistant',
      content: mockResponse.content,
      timestamp: new Date(),
      metadata: {
        confidence: mockResponse.confidence,
        sources: mockResponse.sources,
        suggestedActions: mockResponse.suggestedActions,
        ...session.context
      }
    }
    
    session.messages.push(assistantMessage)
    session.updatedAt = new Date()
    this.sessions.set(session.id, session)
    this.currentSessionId = session.id
    
    yield {
      type: 'complete',
      content: mockResponse.content,
      sessionId: session.id
    }
  }

  // Export chat history
  exportChatHistory(sessionId: string, format: 'json' | 'txt' = 'txt'): string {
    const session = this.getSession(sessionId)
    
    if (format === 'json') {
      return JSON.stringify(session, null, 2)
    }
    
    // Text format
    let output = `Chat Session: ${session.title}\n`
    output += `Created: ${session.createdAt.toLocaleString()}\n`
    if (session.context?.accountName) {
      output += `Account: ${session.context.accountName}\n`
    }
    output += '\n' + '='.repeat(50) + '\n\n'
    
    session.messages.forEach(msg => {
      if (msg.role !== 'system') {
        output += `[${msg.timestamp.toLocaleTimeString()}] ${msg.role.toUpperCase()}:\n`
        output += `${msg.content}\n\n`
        
        if (msg.metadata?.suggestedActions?.length) {
          output += `Suggested Actions:\n`
          msg.metadata.suggestedActions.forEach(action => {
            output += `• ${action}\n`
          })
          output += '\n'
        }
      }
    })
    
    return output
  }
}

export const chatService = new ChatService()
export type { ChatMessage, ChatSession }