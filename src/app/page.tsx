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

const LANG_OPTIONS: Record<string, string> = {
  ja: '日本語',
  zh: '中文',
  en: 'English',
  ko: '한국어',
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

【数字強調】重要な数値（統計、割合、金額、年号、数量）は必ず **太字**

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

【数字强调】重要数字（统计、比例、金额、年份、数量）必须用 **加粗**

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

【Number Highlighting】Important numbers (statistics, percentages, amounts, years, quantities) must be **bold**

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

【숫자 강조】중요한 숫자(통계, 비율, 금액, 연도, 수량)는 반드시 **굵게**

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

  return `${l.title} 元のPDFは${LANG_OPTIONS[pdfLang] || '日本語'}で書かれています。${l.dir}

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

      if (!aiNotes) {
        const { generateNotesLocal } = await import('@/services/aiService')
        const localNotes = generateNotesLocal(pdfPages)
        aiNotes = localNotes.map(p => p.noteContent).join('\n\n')
      } else {
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

          <div className="flex justify-center mb-4">
            <div className="inline-flex items-center gap-4 px-5 py-3 bg-muted/30 rounded-xl border">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground whitespace-nowrap">PDF言語</span>
              </div>
              <select
                value={pdfLang}
                onChange={(e) => setPdfLang(e.target.value)}
                className="text-sm bg-background border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-primary"
              >
                {Object.entries(LANG_OPTIONS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <span className="text-muted-foreground">→</span>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground whitespace-nowrap">ノート言語</span>
              </div>
              <select
                value={noteLang}
                onChange={(e) => setNoteLang(e.target.value)}
                className="text-sm bg-background border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-primary"
              >
                {Object.entries(LANG_OPTIONS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
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
