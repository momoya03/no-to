'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FileUpload } from '@/components/FileUpload'
import { ProcessingIndicator } from '@/components/ProcessingIndicator'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Moon, Sun, FileText, Sparkles, Scan, Download } from 'lucide-react'
import { useTheme } from 'next-themes'
import { createFullTextStream } from '@/services/aiService'
import { extractPDFText } from '@/services/pdfService'
import { PDFPage, NoteDocument, NotePage } from '@/types'
import { generateId } from '@/lib/utils'
import { getQuota, incrementQuota } from '@/lib/quota'

const GEMINI_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || ''

async function generateNotesWithAI(fullText: string, onProgress: (step: string, progress: number) => void): Promise<string> {
  onProgress('AIによるノート生成中...', 0)

  // Fall back to server API if no client-side key
  if (!GEMINI_KEY) {
    try {
      const response = await fetch('/api/generate-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: fullText })
      })
      if (response.ok) {
        const data = await response.json()
        return data.notes || ''
      }
    } catch {}
    return ''
  }

  // Call Gemini directly from client (bypass Vercel timeout)
  try {
    const SYSTEM_PROMPT = `あなたはプロフェッショナルなノート作成アシスタントです。中国人留学生向けの学習用ノートを生成してください。

【絶対禁止】
- 表（テーブル）禁止、箇条書き（-）と見出し（#、##）のみ
- 捏造禁止、不明点は「記載なし」
- 参考文献・引用文献・出典リストは絶対に出力しない
- 元テキスト・原文の丸写しセクション禁止
- ページ番号言及禁止

【数字強調】重要な数値（統計、割合、金額、年号、数量）は必ず **太字**

【出力構成】
1. タイトルと基本情報
2. 全体構成（目次）
3. セクションごとの重要ポイント
4. 重要キーワード一覧
5. 自己テスト問題3問（模範解答付き）`

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\n\n以下の資料テキストを解析し、学習ノートを生成してください：\n\n${fullText.slice(0, 40000)}` }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 8192 }
        })
      }
    )

    if (response.ok) {
      const data = await response.json()
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      return text
    }

    return ''
  } catch (error) {
    console.error('AI generation error:', error)
    return ''
  }
}

export default function Home() {
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingProgress, setProcessingProgress] = useState(0)
  const [processingStep, setProcessingStep] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [quota, setQuota] = useState({ date: '', count: 0 })

  useEffect(() => {
    getQuota().then(setQuota)
  }, [])

  const handleFileSelect = useCallback(async (file: File) => {
    setIsProcessing(true)
    setProcessingProgress(0)
    setProcessingStep('PDFを読み込み中...')
    setError(null)

    try {
      let pdfPages: PDFPage[] = []

      setProcessingStep('PDFテキスト抽出中...')
      pdfPages = await extractPDFText(file, (page, total) => {
        setProcessingProgress(Math.round((page / total) * 60))
      })

      const ocrCount = pdfPages.filter(p => p.isOcr).length
      if (ocrCount > 0) {
        setProcessingStep(`${ocrCount}ページが画像形式のためOCRできません`)
      }

      setProcessingStep('テキスト前処理中...')
      const fullText = createFullTextStream(pdfPages)
      setProcessingProgress(75)

      setProcessingStep('AIがノートを生成中...')
      setProcessingProgress(75)

      // Simulate incremental progress while waiting for AI response
      let tick = 0
      const aiProgressTimer = setInterval(() => {
        tick++
        const simulated = Math.min(75 + tick * 2, 88)
        setProcessingProgress(simulated)
        if (tick === 1) setProcessingStep('AIがノートを生成中...')
        if (tick === 3) setProcessingStep('重要なポイントを抽出中...')
        if (tick === 5) setProcessingStep('ノートを構成中...')
      }, 800)

      let aiNotes = ''
      try {
        aiNotes = await generateNotesWithAI(fullText, () => {})
      } catch (e) { console.error('AI generation failed:', e) }
      clearInterval(aiProgressTimer)
      setProcessingProgress(92)
      setProcessingStep('ノートを整形中...')

      if (!aiNotes) {
        const { generateNotesLocal } = await import('@/services/aiService')
        const localNotes = generateNotesLocal(pdfPages)
        aiNotes = localNotes.map(p => p.noteContent).join('\n\n')
      } else {
        setQuota(await incrementQuota())
      }
      setProcessingProgress(95)

      const notePage: NotePage = {
        pageNumber: 1,
        originalContent: fullText,
        noteContent: aiNotes
      }

      const noteDocument: NoteDocument = {
        id: generateId(),
        fileName: file.name,
        totalPages: pdfPages.length,
        pages: [notePage],
        createdAt: new Date()
      }

      setProcessingProgress(100)
      setProcessingStep('完了')

      const sanitizedPdfPages = pdfPages.map(page => ({
        pageNumber: page.pageNumber,
        text: page.text,
        isOcr: page.isOcr
      }))

      try {
        sessionStorage.setItem('pdfFile', JSON.stringify({
          name: file.name,
          size: file.size,
          type: file.type
        }))
        sessionStorage.setItem('pdfPages', JSON.stringify(sanitizedPdfPages))
        sessionStorage.setItem('noteDocument', JSON.stringify(noteDocument))
      } catch (storageError) {
        console.error('Storage quota exceeded:', storageError)
        setError('データサイズが大きすぎます。小さいPDFファイルをお試しください。')
        setIsProcessing(false)
        return
      }

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

          <div className="flex justify-center mb-6">
            <div className="inline-flex items-center gap-3 px-5 py-3 bg-muted/50 rounded-xl border">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">AI 変換枠</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-28 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, (quota.count / 1500) * 100)}%` }}
                  />
                </div>
                <span className="text-sm font-mono tabular-nums">
                  <span className="font-bold">{1500 - quota.count}</span>
                  <span className="text-muted-foreground">/1500</span>
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                残り約<span className="font-semibold text-foreground">{1500 - quota.count}</span>回変換可能
              </span>
            </div>
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
