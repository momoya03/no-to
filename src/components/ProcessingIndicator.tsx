'use client'

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Loader2 } from 'lucide-react'

interface ProcessingIndicatorProps {
  step: string
  progress: number
}

export function ProcessingIndicator({ step, progress }: ProcessingIndicatorProps) {
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-2xl font-bold">{progress}%</span>
        </div>

        <Progress value={progress} className="w-full" />

        <p className="text-base text-center font-semibold py-2 px-4 bg-primary/10 rounded-md">{step}</p>
      </CardContent>
    </Card>
  )
}
