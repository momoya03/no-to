'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Loader2, FileText, Scan, Sparkles } from 'lucide-react'

interface ProcessingIndicatorProps {
  step: string
  progress: number
  totalSteps?: number
}

export function ProcessingIndicator({ step, progress, totalSteps = 4 }: ProcessingIndicatorProps) {
  const steps = [
    { icon: FileText, label: 'PDF 読み込み中' },
    { icon: Scan, label: 'OCR 処理中' },
    { icon: Sparkles, label: 'ノート生成中' },
    { icon: FileText, label: '完了' }
  ]

  const currentStepIndex = Math.min(Math.floor(progress / 25), steps.length - 1)

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          処理中...
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          {steps.map((s, index) => (
            <div
              key={index}
              className={`flex items-center gap-3 ${
                index < currentStepIndex
                  ? 'text-primary'
                  : index === currentStepIndex
                  ? 'text-foreground'
                  : 'text-muted-foreground'
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                index < currentStepIndex
                  ? 'bg-primary border-primary text-primary-foreground'
                  : index === currentStepIndex
                  ? 'border-primary'
                  : 'border-muted-foreground'
              }`}>
                {index < currentStepIndex ? (
                  <span className="text-sm">✓</span>
                ) : (
                  <s.icon className="h-4 w-4" />
                )}
              </div>
              <span className="text-sm font-medium">{s.label}</span>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <Progress value={progress} className="w-full" />
          <p className="text-sm text-muted-foreground text-center">{step}</p>
        </div>
      </CardContent>
    </Card>
  )
}
