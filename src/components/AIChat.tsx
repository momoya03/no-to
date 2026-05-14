'use client'

import React, { useRef, useEffect, useState } from 'react'
import { Message, PDFPage, NotePage } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Send, Bot, User, Trash2, Sparkles } from 'lucide-react'
import { createMessage, generateQAResponseLocal } from '@/services/aiService'

interface AIChatProps {
  messages: Message[]
  isProcessing: boolean
  pdfPages: PDFPage[]
  notePages: NotePage[]
  currentPage: number
  onSendMessage: (message: string) => void
  onClearMessages: () => void
}

export function AIChat({
  messages,
  isProcessing,
  pdfPages,
  notePages,
  currentPage,
  onSendMessage,
  onClearMessages
}: AIChatProps) {
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = () => {
    if (input.trim() && !isProcessing) {
      onSendMessage(input.trim())
      setInput('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const quickQuestions = [
    `このページ（第${currentPage}ページ）の内容を教えて`,
    'この講義の重要ポイントは？',
    '全体を要約して'
  ]

  return (
    <div className="h-full flex flex-col">
      <CardHeader className="pb-2 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI アシスタント
          </CardTitle>
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClearMessages}
              title="会話をクリア"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="mb-4">PDFの内容について質問してください</p>
            <div className="space-y-2">
              {quickQuestions.map((q, i) => (
                <Button
                  key={i}
                  variant="outline"
                  size="sm"
                  className="w-full text-left justify-start h-auto py-2"
                  onClick={() => {
                    setInput(q)
                    inputRef.current?.focus()
                  }}
                >
                  {q}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}>
                  {message.role === 'user' ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </div>
                <div className={`max-w-[80%] ${message.role === 'user' ? 'items-end' : ''}`}>
                  <Card className={message.role === 'user' ? 'bg-primary text-primary-foreground' : ''}>
                    <CardContent className="p-3 text-sm whitespace-pre-wrap">
                      {message.content}
                    </CardContent>
                  </Card>
                  <p className="text-xs text-muted-foreground mt-1 px-1">
                    {message.timestamp.toLocaleTimeString('ja-JP')}
                  </p>
                </div>
              </div>
            ))}
            {isProcessing && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4" />
                </div>
                <Card>
                  <CardContent className="p-3">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="質問を入力..."
            disabled={isProcessing}
          />
          <Button onClick={handleSend} disabled={!input.trim() || isProcessing}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
