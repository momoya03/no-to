'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FileUpload } from '@/components/FileUpload'
import { ProcessingIndicator } from '@/components/ProcessingIndicator'
import LoadingAnimation from '@/components/LoadingAnimation'
import ConversionPanel from '@/components/ConversionPanel'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Moon, Sun, FileText, Sparkles, ArrowRight } from 'lucide-react'
import { useTheme } from 'next-themes'
import { generateStructuredNotes, noteToMarkdown } from '@/services/noteGenerator'
import { createFullTextStream, enrichText } from '@/services/aiService'
import { extractPDFText } from '@/services/pdfService'
import { extractWordText } from '@/services/wordService'
import { extractPPTXText } from '@/services/pptxService'
import { PDFPage, NoteDocument, NotePage, StructuredNote } from '@/types'
import { generateId } from '@/lib/utils'
import { getQuota, incrementQuota } from '@/lib/quota'

const LANG_OPTIONS: Record<string, string> = {
  ja: '日本語',
  zh: '中文',
  en: 'English',
  ko: '한국어',
}

function getFileType(fileName: string): 'pdf' | 'word' | 'pptx' {
  const ext = fileName.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return 'pdf'
  if (ext === 'docx') return 'word'
  if (ext === 'pptx') return 'pptx'
  return 'pdf'
}

async function generateNotesWithAI(
  fullText: string,
  pdfLang: string,
  noteLang: string,
  onProgress: (step: string, progress: number) => void
): Promise<{ markdown: string; structuredNote: StructuredNote } | null> {
  onProgress('AIによるノート生成中...', 0)
  console.log('[DEBUG] generateNotesWithAI started, fullText length:', fullText.length)

  try {
    const { note, usedAI } = await generateStructuredNotes(fullText, pdfLang, noteLang, onProgress)

    if (!usedAI || !note.title || note.sections.length === 0) {
      console.warn('[DEBUG] generateStructuredNotes returned empty, usedAI:', usedAI)
      return null
    }

    const markdown = noteToMarkdown(note)
    console.log('[DEBUG] generateNotesWithAI OK, sections:', note.sections.length)
    return { markdown, structuredNote: note }
  } catch (e) {
    console.error('[DEBUG] generateNotesWithAI exception:', e)
    return null
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
  const [pdfLang, setPdfLang] = useState('ja')
  const [noteLang, setNoteLang] = useState('ja')

  useEffect(() => {
    getQuota().then(setQuota)
  }, [])

  const handleFileSelect = useCallback(async (file: File) => {
    setIsProcessing(true)
    setProcessingProgress(0)
    setProcessingStep('ファイルを読み込み中...')
    setError(null)

    try {
      const fileType = getFileType(file.name)
      let pdfPages: PDFPage[] = []

      setProcessingStep('テキスト抽出中...')

      if (fileType === 'pdf') {
        pdfPages = await extractPDFText(file, (page, total) => {
          setProcessingProgress(Math.round((page / total) * 60))
        })
        const ocrCount = pdfPages.filter(p => p.isOcr).length
        if (ocrCount > 0) {
          setProcessingStep(`${ocrCount}ページが画像形式のためOCRできません`)
        }
      } else if (fileType === 'word') {
        const text = await extractWordText(file)
        setProcessingProgress(60)
        pdfPages = [{ pageNumber: 1, text, isOcr: false }]
      } else {
        const text = await extractPPTXText(file, (slide, total) => {
          setProcessingProgress(Math.round((slide / total) * 60))
        })
        pdfPages = [{ pageNumber: 1, text, isOcr: false }]
      }

      setProcessingStep('テキスト前処理中...')
      const fullText = createFullTextStream(pdfPages)
      setProcessingProgress(75)

      setProcessingStep('AIがノートを生成中...')
      setProcessingProgress(75)

      // Time-based progress — never gets stuck, always moving
      const aiStartTime = Date.now()
      const aiProgressTimer = setInterval(() => {
        const elapsed = (Date.now() - aiStartTime) / 1000
        const progress = Math.min(75 + Math.round(elapsed * 0.65), 93)
        setProcessingProgress(progress)
        if (elapsed < 4) setProcessingStep('AIがノートを生成中...')
        else if (elapsed < 8) setProcessingStep('重要なポイントを抽出中...')
        else setProcessingStep('ノートを構成中...')
      }, 600)

      // Check quota BEFORE calling AI — save real API calls
      const currentQuota = await getQuota()
      const overLimit = currentQuota.count >= 200

      let aiNotes = ''
      let structuredNote: StructuredNote | undefined
      if (overLimit) {
        console.warn('[quota] 1日200回制限に達したためAIをスキップします')
      } else {
        try {
          const result = await generateNotesWithAI(fullText, pdfLang, noteLang, () => {})
          if (result) {
            aiNotes = result.markdown
            structuredNote = result.structuredNote
          }
        } catch (e) { console.error('AI generation failed:', e) }
      }
      clearInterval(aiProgressTimer)
      setProcessingProgress(96)
      setProcessingStep('ノートを整形中...')
      await new Promise(r => setTimeout(r, 300))

      let aiUsed = false
      if (!aiNotes) {
        const { generateNotesLocal } = await import('@/services/aiService')
        const localNotes = generateNotesLocal(pdfPages)
        aiNotes = localNotes.map(p => p.noteContent).join('\n\n')
        structuredNote = localNotes[0]?.structuredNote
      } else {
        aiUsed = true
        // Post-process: marker-style highlights
        // Numbers: yellow marker background
        aiNotes = aiNotes.replace(/(?<![-*#>\.\w#])(\d[\d,.]*)(%|円|ドル|元|人|回|年|月|日|倍|万|億|兆|個|件|社|歳|時|分|秒|m|km|kg|g|℃)?/g,
          (_: string, num: string, unit: string) =>
            `<span style="background-color:#fff9c4">${num}${unit || ''}</span>`)
        // Enrich with annotations
        aiNotes = enrichText(aiNotes)
        setQuota(await incrementQuota())
      }
      setProcessingProgress(100)
      setProcessingStep('完了')

      const notePage: NotePage = {
        pageNumber: 1,
        originalContent: fullText,
        noteContent: aiNotes,
        structuredNote
      }

      const noteDocument: NoteDocument = {
        id: generateId(),
        fileName: file.name,
        totalPages: pdfPages.length,
        pages: [notePage],
        createdAt: new Date()
      }

      sessionStorage.setItem('aiUsed', JSON.stringify(aiUsed))

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
  }, [router, pdfLang, noteLang])

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold tracking-tight">garood</h1>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-xl mx-auto px-6 py-12 sm:py-16">
          {!isProcessing ? (
            <div className="space-y-6">
              <FileUpload onFileSelect={handleFileSelect} />

              {/* Settings card */}
              <Card>
                <CardContent className="p-5 space-y-4">
                  {/* Language row */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                    <div className="flex items-center gap-2 flex-1">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm text-muted-foreground shrink-0">資料の言語</span>
                      <select
                        value={pdfLang}
                        onChange={(e) => setPdfLang(e.target.value)}
                        className="text-sm border rounded-md px-2.5 py-1.5 bg-background outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        {Object.entries(LANG_OPTIONS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground hidden sm:block" />
                    <div className="flex items-center gap-2 flex-1">
                      <Sparkles className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm text-muted-foreground shrink-0">ノートの言語</span>
                      <select
                        value={noteLang}
                        onChange={(e) => setNoteLang(e.target.value)}
                        className="text-sm border rounded-md px-2.5 py-1.5 bg-background outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        {Object.entries(LANG_OPTIONS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t" />

                  {/* Quota row */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">AI 変換枠</span>
                      <span className="text-xs text-muted-foreground">本日残り</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, (quota.count / 200) * 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-mono tabular-nums font-semibold">
                        {200 - quota.count}
                        <span className="text-muted-foreground font-normal"> / 200</span>
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <ConversionPanel />

              {error && (
                <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
                  <CardContent className="p-4 text-sm text-red-600 dark:text-red-400">
                    {error}
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <LoadingAnimation />
              <ProcessingIndicator
                step={processingStep}
                progress={processingProgress}
              />
            </div>
          )}
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-muted-foreground/50">
        garood
      </footer>
    </div>
  )
}
