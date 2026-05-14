'use client'

import React, { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { FileUpload } from '@/components/FileUpload'
import { ProcessingIndicator } from '@/components/ProcessingIndicator'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Moon, Sun, FileText, Sparkles, Scan, Download } from 'lucide-react'
import { useTheme } from 'next-themes'
import { extractPDFText } from '@/services/pdfService'
import { performOCR } from '@/services/ocrService'
import { generateNotesLocal } from '@/services/aiService'
import { PDFPage, NoteDocument } from '@/types'
import { generateId } from '@/lib/utils'

export default function Home() {
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingProgress, setProcessingProgress] = useState(0)
  const [processingStep, setProcessingStep] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleFileSelect = useCallback(async (file: File) => {
    setIsProcessing(true)
    setProcessingProgress(0)
    setProcessingStep('PDFを読み込み中...')
    setError(null)

    try {
      let pdfPages: PDFPage[] = []

      setProcessingStep('PDFテキスト抽出中...')
      pdfPages = await extractPDFText(file, (page, total) => {
        setProcessingProgress(Math.round((page / total) * 30))
      })

      const needsOCR = pdfPages.some(p => p.isOcr)
      if (needsOCR) {
        setProcessingProgress(30)
        pdfPages = await performOCR(pdfPages, (page, total, status) => {
          setProcessingStep(status)
          setProcessingProgress(30 + Math.round((page / total) * 40))
        })
      } else {
        setProcessingProgress(70)
      }

      setProcessingStep('ノート生成中...')
      const notePages = generateNotesLocal(pdfPages, 'detailed')
      setProcessingProgress(90)

      const noteDocument: NoteDocument = {
        id: generateId(),
        fileName: file.name,
        totalPages: pdfPages.length,
        pages: notePages,
        createdAt: new Date()
      }

      setProcessingProgress(100)
      setProcessingStep('完了')

      sessionStorage.setItem('pdfFile', JSON.stringify({
        name: file.name,
        size: file.size,
        type: file.type
      }))
      sessionStorage.setItem('pdfPages', JSON.stringify(pdfPages))
      sessionStorage.setItem('noteDocument', JSON.stringify(noteDocument))

      setTimeout(() => {
        router.push('/notes')
      }, 500)

    } catch (err) {
      console.error('Processing error:', err)
      setError(err instanceof Error ? err.message : '処理中にエラーが発生しました')
      setIsProcessing(false)
    }
  }, [router])

  const features = [
    {
      icon: FileText,
      title: 'PDF アップロード',
      description: 'クリックまたはドラッグ＆ドロップで簡単にPDFをアップロード'
    },
    {
      icon: Scan,
      title: 'OCR 対応',
      description: '画像PDFやスキャン資料も日本語OCRで文字認識'
    },
    {
      icon: Sparkles,
      title: 'ノート自動生成',
      description: 'ページごとに整理された学習ノートを自動作成'
    },
    {
      icon: Download,
      title: 'エクスポート',
      description: 'PDFやTXT形式で保存、印刷も可能'
    }
  ]

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            PDF ノートメーカー
          </h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              日本語 PPT から<br />学習ノートを自動生成
            </h2>
            <p className="text-lg text-muted-foreground">
              授業資料をアップロードするだけで、整理されたノートが作成できます
            </p>
          </div>

          {!isProcessing ? (
            <div className="space-y-8">
              <FileUpload onFileSelect={handleFileSelect} />

              {error && (
                <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
                  <CardContent className="p-4 text-red-600 dark:text-red-400">
                    {error}
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
                {features.map((feature, i) => (
                  <Card key={i}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <feature.icon className="h-5 w-5 text-primary" />
                        </div>
                        <CardTitle className="text-lg">{feature.title}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <CardDescription>{feature.description}</CardDescription>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <ProcessingIndicator
              step={processingStep}
              progress={processingProgress}
            />
          )}
        </div>
      </main>

      <footer className="border-t py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>PDF ノートメーカー - 授業ノート作成をサポート</p>
        </div>
      </footer>
    </div>
  )
}
