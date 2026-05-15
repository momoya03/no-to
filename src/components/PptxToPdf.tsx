'use client'

import React, { useState, useCallback, useRef } from 'react'
import { jsPDF } from 'jspdf'
import { extractPPTXText } from '@/services/pptxService'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileText, Download, Loader2, AlertCircle, Eye, X } from 'lucide-react'

type Status = 'idle' | 'extracting' | 'preview' | 'generating' | 'done' | 'error'

// Render Japanese text to canvas → data URL (avoids font embedding issues)
function renderPageToDataUrl(
  text: string,
  pageNum: number,
  totalPages: number,
): string {
  const canvas = document.createElement('canvas')
  const W = 1684 // A4 landscape at ~144dpi
  const H = 1190
  const scale = 2
  canvas.width = W
  canvas.height = H

  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = '#000'
  ctx.font = `${14 * scale}px "Hiragino Sans", "Noto Sans JP", "Yu Gothic", sans-serif`
  const lineH = 22 * scale
  const margin = 30 * scale
  const maxW = W - margin * 2
  const maxLines = Math.floor((H - margin * 2) / lineH)

  // Simple word wrap for CJK text
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    if (paragraph === '') { lines.push(''); continue }
    let line = ''
    for (const char of paragraph) {
      const test = line + char
      if (ctx.measureText(test).width > maxW && line.length > 0) {
        lines.push(line)
        line = char
      } else {
        line = test
      }
    }
    if (line) lines.push(line)
  }

  // Paginate
  const start = pageNum * maxLines
  const pageLines = lines.slice(start, start + maxLines)

  ctx.fillStyle = '#000'
  pageLines.forEach((line, i) => {
    ctx.fillText(line, margin, margin + (i + 1) * lineH)
  })

  // Page number
  ctx.font = `${10 * scale}px sans-serif`
  ctx.fillStyle = '#999'
  ctx.fillText(`${pageNum + 1} / ${totalPages}`, W - margin, H - margin / 2)

  return canvas.toDataURL('image/jpeg', 0.85)
}

export default function PptxToPdf() {
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState('')
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
  const [fileName, setFileName] = useState('')
  const [previewText, setPreviewText] = useState('')
  const [slideCount, setSlideCount] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const extractedTextRef = useRef('')

  const handleExtract = useCallback(async (file: File) => {
    setStatus('extracting')
    setProgress(0)
    setMessage('テキスト抽出中...')
    setPdfBlob(null)
    setPreviewText('')
    setFileName(file.name.replace(/\.pptx?$/i, '.pdf'))

    try {
      const text = await extractPPTXText(file, (slide, total) => {
        setProgress(Math.round((slide / total) * 100))
        setMessage(`スライド ${slide}/${total} を解析中...`)
        setSlideCount(total)
      })

      if (!text) throw new Error('PPTXからテキストを抽出できませんでした')

      extractedTextRef.current = text

      // Show preview (first 2000 chars)
      const slides = text.split(/--- Slide \d+ ---/).filter(Boolean)
      const preview = slides.length > 0
        ? slides.map((s, i) => `◆ Slide ${i + 1}\n${s.trim()}`).join('\n\n')
        : text
      setPreviewText(preview.slice(0, 3000) + (preview.length > 3000 ? '\n...（省略）' : ''))
      setStatus('preview')
      setMessage(`${slides.length || 1}ページのテキストを抽出しました`)
    } catch (err) {
      console.error('PPTX extraction error:', err)
      setStatus('error')
      setMessage(err instanceof Error ? err.message : '抽出に失敗しました')
    }
  }, [])

  const handleGeneratePdf = useCallback(async () => {
    setStatus('generating')
    setProgress(0)
    setMessage('PDFを生成中...')

    try {
      const text = extractedTextRef.current
      const slides = text.split(/--- Slide \d+ ---/).filter(Boolean)
      const pages = slides.length > 0 ? slides.map(s => s.trim()) : [text]

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

      for (let i = 0; i < pages.length; i++) {
        if (i > 0) doc.addPage()
        setMessage(`ページ ${i + 1}/${pages.length} をレンダリング中...`)
        setProgress(Math.round(((i + 1) / pages.length) * 100))

        const dataUrl = renderPageToDataUrl(pages[i], i, pages.length)
        doc.addImage(dataUrl, 'JPEG', 0, 0, 297, 210)
      }

      setProgress(100)
      const blob = doc.output('blob')
      setPdfBlob(blob)
      setStatus('done')
      setMessage('PDFの生成が完了しました')
    } catch (err) {
      console.error('PDF generation error:', err)
      setStatus('error')
      setMessage(err instanceof Error ? err.message : 'PDF生成に失敗しました')
    }
  }, [])

  const handleReset = useCallback(() => {
    setStatus('idle')
    setProgress(0)
    setMessage('')
    setPdfBlob(null)
    setPreviewText('')
    extractedTextRef.current = ''
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleExtract(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [handleExtract])

  const handleDownload = useCallback(() => {
    if (!pdfBlob) return
    const url = URL.createObjectURL(pdfBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
  }, [pdfBlob, fileName])

  return (
    <Card className="border-border">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">PPT → PDF 変換</span>
        </div>

        {status === 'idle' && (
          <div className="flex flex-col gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              onChange={handleFileChange}
              className="hidden"
              id="pptx-to-pdf-input2"
            />
            <label htmlFor="pptx-to-pdf-input2">
              <Button variant="outline" size="sm" className="w-full cursor-pointer" asChild>
                <span>PPTXファイルを選択</span>
              </Button>
            </label>
            <p className="text-xs text-muted-foreground">
              スライドのテキストを抽出してPDFに変換します
            </p>
          </div>
        )}

        {status === 'extracting' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{message}</span>
            </div>
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {status === 'preview' && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">{message}</p>
            <div className="max-h-48 overflow-y-auto rounded-lg border bg-muted/30 p-3">
              <pre className="text-xs whitespace-pre-wrap font-sans text-foreground/80">
                {previewText}
              </pre>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleGeneratePdf} size="sm" className="flex-1 gap-2">
                <Download className="h-4 w-4" />
                PDFをダウンロード
              </Button>
              <Button onClick={handleReset} variant="ghost" size="sm" className="gap-1">
                <X className="h-4 w-4" />
                取消
              </Button>
            </div>
          </div>
        )}

        {status === 'generating' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{message}</span>
            </div>
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {status === 'done' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-green-600" />
              <p className="text-sm text-green-600 font-medium">{message}</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleDownload} size="sm" className="flex-1 gap-2">
                <Download className="h-4 w-4" />
                ダウンロード
              </Button>
              <Button onClick={handleReset} variant="ghost" size="sm">
                やり直す
              </Button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-950/20 rounded-lg p-3">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{message}</span>
            </div>
            <Button onClick={handleReset} variant="outline" size="sm" className="w-full">
              やり直す
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
