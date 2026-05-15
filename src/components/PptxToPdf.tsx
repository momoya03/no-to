'use client'

import React, { useState, useCallback, useRef } from 'react'
import { jsPDF } from 'jspdf'
import { extractPPTXText } from '@/services/pptxService'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileText, Download, Loader2, AlertCircle } from 'lucide-react'

type Status = 'idle' | 'converting' | 'done' | 'error'

export default function PptxToPdf() {
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState('')
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
  const [fileName, setFileName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleConvert = useCallback(async (file: File) => {
    // Reset
    setStatus('converting')
    setProgress(0)
    setMessage('テキスト抽出中...')
    setPdfBlob(null)
    setFileName(file.name.replace(/\.pptx?$/i, '.pdf'))

    try {
      // Step 1: Extract text from PPTX (isolated — failure here only affects this component)
      const text = await extractPPTXText(file, (slide, total) => {
        setProgress(Math.round((slide / total) * 50))
        setMessage(`スライド ${slide}/${total} を解析中...`)
      })

      if (!text) {
        throw new Error('PPTXからテキストを抽出できませんでした')
      }

      // Step 2: Generate PDF
      setProgress(60)
      setMessage('PDFを生成中...')

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const slides = text.split(/--- Slide \d+ ---/).filter(Boolean)

      if (slides.length === 0) {
        // Single block of text — paginate manually
        const lines = doc.splitTextToSize(text, 260)
        doc.text(lines, 15, 15)
      } else {
        for (let i = 0; i < slides.length; i++) {
          if (i > 0) doc.addPage()
          const lines = doc.splitTextToSize(slides[i].trim(), 260)
          doc.text(lines, 15, 15)
          // Slide number
          doc.setFontSize(8)
          doc.text(`${i + 1}`, 287, 200)
          doc.setFontSize(11)
          setProgress(60 + Math.round(((i + 1) / slides.length) * 35))
        }
      }

      setProgress(98)
      setMessage('完了')

      const blob = doc.output('blob')
      setPdfBlob(blob)
      setStatus('done')
      setMessage('変換完了！ダウンロードボタンを押してください')
    } catch (err) {
      // Isolated error — does NOT affect any other feature
      console.error('PPTX→PDF conversion error:', err)
      setStatus('error')
      setMessage(err instanceof Error ? err.message : '変換に失敗しました')
    }
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleConvert(file)
    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [handleConvert])

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
          <span className="text-xs text-muted-foreground">（試験的機能）</span>
        </div>

        {status === 'idle' && (
          <div className="flex flex-col gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              onChange={handleFileChange}
              className="hidden"
              id="pptx-to-pdf-input"
            />
            <label htmlFor="pptx-to-pdf-input">
              <Button variant="outline" size="sm" className="w-full cursor-pointer" asChild>
                <span>PPTXファイルを選択</span>
              </Button>
            </label>
            <p className="text-xs text-muted-foreground">
              スライドのテキストを抽出してPDFに変換します
            </p>
          </div>
        )}

        {status === 'converting' && (
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
            <p className="text-sm text-green-600 font-medium">変換完了</p>
            <Button onClick={handleDownload} size="sm" className="w-full gap-2">
              <Download className="h-4 w-4" />
              PDFをダウンロード
            </Button>
          </div>
        )}

        {status === 'error' && (
          <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-950/20 rounded-lg p-3">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{message}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
