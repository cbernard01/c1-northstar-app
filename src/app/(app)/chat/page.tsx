'use client'

import { MessageSquare, Send, Bot, User } from 'lucide-react'
import React from 'react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export default function ChatPage() {
  const [inputValue, setInputValue] = React.useState('')

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] space-y-6">
      <div>
        <h1 className="text-h1 text-foreground mb-2">
          AI Assistant
        </h1>
        <p className="text-body text-muted-foreground">
          Chat with AI about your accounts, get insights, and receive personalized recommendations.
        </p>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex space-x-3 mb-6">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <Bot className="h-4 w-4 text-primary-foreground" />
              </div>
            </div>
            <div className="bg-muted px-4 py-3 rounded-lg max-w-2xl">
              <p className="text-sm leading-relaxed">
                Hello! I am your AI assistant for sales intelligence. I can help you analyze accounts, understand insights, and provide recommendations. What would you like to know?
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-border">
          <div className="flex space-x-3">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask about accounts, insights, or get recommendations..."
              className="flex-1"
            />
            <Button className="flex-shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </Card>
    </div>
  )
}