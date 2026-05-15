'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FileUpload } from '@/components/FileUpload'
import { ProcessingIndicator } from '@/components/ProcessingIndicator'
import DogFrisbee from '@/components/DogFrisbee'
import ConversionPanel from '@/components/ConversionPanel'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Moon, Sun, FileText, Sparkles, ArrowRight } from 'lucide-react'
import { useTheme } from 'next-themes'
import { createFullTextStream } from '@/services/aiService'
import { extractPDFText } from '@/services/pdfService'
import { extractWordText } from '@/services/wordService'
import { extractPPTXText } from '@/services/pptxService'
import { PDFPage, NoteDocument, NotePage } from '@/types'
import { generateId } from '@/lib/utils'
import { getQuota, incrementQuota } from '@/lib/quota'

const GEMINI_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || ''

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

function buildSystemPrompt(pdfLang: string, noteLang: string): string {
  const labels: Record<string, { title: string; dir: string; rules: string; output: string }> = {
    ja: {
      title: 'あなたはプロフェッショナルなノート作成アシスタントです。',
      dir: '学習用ノートを生成してください。',
      rules: `【絶対禁止】
- 表（テーブル）禁止、箇条書き（-）と見出し（#、##）のみ
- 捏造禁止、不明点は「記載なし」
- 参考文献・引用文献・出典リストは絶対に出力しない
- 元テキスト・原文の丸写しセクション禁止
- ページ番号言及禁止

【重要強調】重要なポイントや数値は **太字** で強調

【出力構成】
1. タイトルと基本情報
2. 全体構成（目次）
3. セクションごとの重要ポイント
4. 自己テスト問題3問（模範解答付き）

【難解用語】特に難しい専門用語や特殊な読み方の漢字には、直後に（注：簡潔な説明or読み方）を付けてください。多用せず、本当に難しいものだけに。`,
      output: '以下の資料テキストを解析し、学習ノートを生成してください：',
    },
    zh: {
      title: '你是一名专业的笔记制作助手。',
      dir: '请生成学习笔记。',
      rules: `【绝对禁止】
- 禁止表格，仅使用列表（-）和标题（#、##）
- 禁止捏造，不明确处标注「未记载」
- 绝对不要输出参考文献、引用文献、出处列表
- 禁止原文照抄段落
- 禁止提及页码

【重点强调】重要内容和数字用 **加粗** 强调

【输出结构】
1. 标题与基本信息
2. 整体结构（目录）
3. 各章节重点
4. 自测题3道（附参考答案）

【难解术语】特别难的专业术语或罕见汉字，在其后添加（注：简要说明）。不要多用，仅在真正难解处。`,
      output: '请解析以下资料文本，生成学习笔记：',
    },
    en: {
      title: 'You are a professional note-taking assistant.',
      dir: 'Generate study notes.',
      rules: `【Strictly Forbidden】
- No tables — use bullet points (-) and headings (#, ##) only
- No fabrication — mark unclear items as "Not documented"
- Never output references, citations, or source lists
- No verbatim copying of the original text
- No page number mentions

【Highlighting】Important points and figures must be **bold**

【Output Structure】
1. Title & basic info
2. Table of contents
3. Key points per section
4. 3 self-test questions (with model answers)

【Difficult Terms】For particularly difficult technical terms or rare readings, add (注：brief explanation) right after. Use sparingly — only for truly difficult items.`,
      output: 'Analyze the following document and generate study notes:',
    },
    ko: {
      title: '당신은 전문적인 노트 작성 어시스턴트입니다.',
      dir: '학습 노트를 생성해 주세요.',
      rules: `【절대 금지】
- 표 금지, 글머리 기호(-)와 제목(#, ##)만 사용
- 날조 금지, 불명확한 사항은 「기재 없음」으로 표시
- 참고문헌·인용문헌·출처 목록 절대 출력 금지
- 원문 그대로 복사 금지
- 페이지 번호 언급 금지

【중요 강조】중요한 포인트와 수치는 **굵게**

【출력 구성】
1. 제목과 기본 정보
2. 전체 구성(목차)
3. 섹션별 중요 포인트
4. 자가 테스트 문제 3문(모범 답안 포함)

【어려운 용어】특히 어려운 전문 용어나 특수 읽기의 한자에는 바로 뒤에 (注：간결한 설명이나 읽기)를 붙여 주세요. 과도하게 사용하지 말고 정말 어려운 것만.`,
      output: '다음 자료 텍스트를 분석하여 학습 노트를 생성해 주세요:',
    },
  }

  const l = labels[noteLang] || labels.ja

  return `${l.title} 元の資料は${LANG_OPTIONS[pdfLang] || '日本語'}で書かれています。${l.dir}

${l.rules}

【出力言語】必ず${LANG_OPTIONS[noteLang] || '日本語'}で出力してください。`
}

async function generateNotesWithAI(
  fullText: string,
  pdfLang: string,
  noteLang: string,
  onProgress: (step: string, progress: number) => void
): Promise<string> {
  onProgress('AIによるノート生成中...', 0)

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

  try {
    const SYSTEM_PROMPT = buildSystemPrompt(pdfLang, noteLang)

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\n\n${fullText.slice(0, 40000)}` }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 8192 }
        })
      }
    )

    if (response.ok) {
      const data = await response.json()
      return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
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

      let aiNotes = ''
      try {
        aiNotes = await generateNotesWithAI(fullText, pdfLang, noteLang, () => {})
      } catch (e) { console.error('AI generation failed:', e) }
      clearInterval(aiProgressTimer)
      setProcessingProgress(96)
      setProcessingStep('ノートを整形中...')
      await new Promise(r => setTimeout(r, 300))

      let aiUsed = false
      if (!aiNotes) {
        const { generateNotesLocal } = await import('@/services/aiService')
        const localNotes = generateNotesLocal(pdfPages)
        aiNotes = localNotes.map(p => p.noteContent).join('\n\n')
      } else {
        aiUsed = true
        setQuota(await incrementQuota())
      }
      setProcessingProgress(100)
      setProcessingStep('完了')

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
                          style={{ width: `${Math.min(100, (quota.count / 1500) * 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-mono tabular-nums font-semibold">
                        {1500 - quota.count}
                        <span className="text-muted-foreground font-normal"> / 1500</span>
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
              <DogFrisbee />
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
