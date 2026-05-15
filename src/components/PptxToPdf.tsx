'use client'

import React, { useState, useCallback, useRef } from 'react'
import { jsPDF } from 'jspdf'
import { renderPPTX, RenderedSlide } from '@/services/pptxRenderer'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileText, Download, Loader2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'

type Status = 'idle' | 'extracting' | 'preview' | 'generating' | 'done' | 'error'

export default function PptxToPdf() {
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState('')
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
  const [fileName, setFileName] = useState('')
  const [slides, setSlides] = useState<RenderedSlide[]>([])
  const [currentSlide, setCurrentSlide] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExtract = useCallback(async (file: File) => {
    setStatus('extracting')
    setProgress(0)
    setMessage('スライドを解析中...')
    setPdfBlob(null)
    setSlides([])
    setCurrentSlide(0)
    setFileName(file.name.replace(/\.pptx?$/i, '.pdf'))

    try {
      const rendered = await renderPPTX(file, 0.7, (slide, total) => {
        setProgress(Math.round((slide / total) * 100))
        setMessage(`スライド ${slide}/${total} をレンダリング中...`)
      })

      if (rendered.length === 0) {
        throw new Error('スライドが見つかりませんでした')
      }

      setSlides(rendered)
      setStatus('preview')
      setMessage(`${rendered.length}枚のスライドを読み込みました`)
    } catch (err) {
      console.error('PPTX render error:', err)
      setStatus('error')
      setMessage(err instanceof Error ? err.message : '解析に失敗しました')
    }
  }, [])

  const handleGeneratePdf = useCallback(async () => {
    if (slides.length === 0) return
    setStatus('generating')
    setProgress(0)
    setMessage('PDFを生成中...')

    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      // A4 landscape = 297 x 210 mm

      for (let i = 0; i < slides.length; i++) {
        if (i > 0) doc.addPage()
        setMessage(`ページ ${i + 1}/${slides.length} を追加中...`)
        setProgress(Math.round(((i + 1) / slides.length) * 100))

        // Use existing preview data URL
        const img = slides[i].dataUrl
        doc.addImage(img, 'JPEG', 0, 0, 297, 210)
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
  }, [slides])

  const handleReset = useCallback(() => {
    setStatus('idle'); setProgress(0); setMessage('')
    setPdfBlob(null); setSlides([]); setCurrentSlide(0)
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
    a.href = url; a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
  }, [pdfBlob, fileName])

  const prevSlide = () => setCurrentSlide(s => Math.max(0, s - 1))
  const nextSlide = () => setCurrentSlide(s => Math.min(slides.length - 1, s + 1))

  return (
    <Card className="border-border">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">PPT → PDF 変換</span>
        </div>

        {status === 'idle' && (
          <div className="flex flex-col gap-2">
            <input ref={fileInputRef} type="file"
              accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              onChange={handleFileChange} className="hidden" id="pptx2pdf-input"
            />
            <label htmlFor="pptx2pdf-input">
              <Button variant="outline" size="sm" className="w-full cursor-pointer" asChild>
                <span>PPTXファイルを選択</span>
              </Button>
            </label>
            <p className="text-xs text-muted-foreground">
              スライドをそのままPDFに変換します（画像・レイアウト保持）
            </p>
          </div>
        )}

        {status === 'extracting' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> <span>{message}</span>
            </div>
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {status === 'preview' && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">{message}</p>

            {/* Slide preview */}
            <div className="relative bg-muted/20 rounded-lg border overflow-hidden">
              <img
                src={slides[currentSlide]?.dataUrl}
                alt={`Slide ${currentSlide + 1}`}
                className="w-full"
              />
              {/* Nav arrows */}
              {slides.length > 1 && (
                <>
                  <button
                    onClick={prevSlide}
                    disabled={currentSlide === 0}
                    className="absolute left-1 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-1 disabled:opacity-20 hover:bg-black/70"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={nextSlide}
                    disabled={currentSlide >= slides.length - 1}
                    className="absolute right-1 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-1 disabled:opacity-20 hover:bg-black/70"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
              {/* Slide counter */}
              <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
                {currentSlide + 1} / {slides.length}
              </div>
            </div>

            {/* Thumbnail row */}
            {slides.length > 1 && (
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {slides.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentSlide(i)}
                    className={`shrink-0 w-14 h-10 rounded border-2 overflow-hidden transition-all ${
                      i === currentSlide ? 'border-primary ring-1 ring-primary' : 'border-border opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={s.dataUrl} alt={`Thumb ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={handleGeneratePdf} size="sm" className="flex-1 gap-2">
                <Download className="h-4 w-4" /> PDFをダウンロード
              </Button>
              <Button onClick={handleReset} variant="ghost" size="sm">取消</Button>
            </div>
          </div>
        )}

        {status === 'generating' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> <span>{message}</span>
            </div>
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {status === 'done' && (
          <div className="space-y-2">
            <p className="text-sm text-green-600 font-medium">{message}</p>
            <div className="flex gap-2">
              <Button onClick={handleDownload} size="sm" className="flex-1 gap-2">
                <Download className="h-4 w-4" /> ダウンロード
              </Button>
              <Button onClick={handleReset} variant="ghost" size="sm">やり直す</Button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-950/20 rounded-lg p-3">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /> <span>{message}</span>
            </div>
            <Button onClick={handleReset} variant="outline" size="sm" className="w-full">やり直す</Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
