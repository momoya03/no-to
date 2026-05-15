'use client'

import React, { useState, useCallback, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileText, Download, Loader2, AlertCircle, ChevronLeft, ChevronRight, ArrowRight, X } from 'lucide-react'
import { ALL_CONVERTERS, findConverter } from '@/services/converters/registry'
import { Converter, ConvertResult } from '@/services/converters/types'

const FROM_FORMATS = [
  { ext: 'pdf', label: 'PDF' },
  { ext: 'docx', label: 'Word (.docx)' },
  { ext: 'pptx', label: 'PowerPoint (.pptx)' },
  { ext: 'xlsx', label: 'Excel (.xlsx)' },
  { ext: 'image', label: '画像 (.png/.jpg)' },
]

const TO_FORMATS = [
  { ext: 'pdf', label: 'PDF' },
  { ext: 'docx', label: 'Word (.docx)' },
  { ext: 'pptx', label: 'PowerPoint (.pptx)' },
  { ext: 'xlsx', label: 'Excel (.xlsx)' },
  { ext: 'image', label: '画像 (.png)' },
]

type Status = 'idle' | 'converting' | 'preview' | 'done' | 'error'

export default function ConversionPanel() {
  const [fromExt, setFromExt] = useState('pdf')
  const [toExt, setToExt] = useState('docx')
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<ConvertResult | null>(null)
  const [previewIdx, setPreviewIdx] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const converter = findConverter(fromExt, toExt)

  const resetConverter = useCallback(() => {
    setStatus('idle'); setProgress(0); setMessage('')
    setResult(null); setPreviewIdx(0); setErrorMsg('')
  }, [])

  const handleFromChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setFromExt(e.target.value)
    // Auto-switch toExt if same
    setToExt(prev => prev === e.target.value ? (e.target.value === 'pdf' ? 'docx' : 'pdf') : prev)
    resetConverter()
  }, [resetConverter])

  const handleToChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setToExt(e.target.value)
    resetConverter()
  }, [resetConverter])

  const handleFile = useCallback(async (file: File) => {
    if (!converter) return
    setStatus('converting')
    setProgress(0)
    setMessage('変換中...')
    setResult(null)
    setErrorMsg('')

    try {
      // Primary try-catch: isolates this converter from everything else
      const res = await converter.convert(file, (msg, pct) => {
        setMessage(msg)
        setProgress(pct)
      })
      setResult(res)
      setStatus(res.previewUrls?.length ? 'preview' : 'done')
      setMessage('変換完了')
    } catch (err) {
      console.error(`[${converter.id}] error:`, err)
      // Isolated — does NOT propagate
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : '変換に失敗しました')
    }
  }, [converter])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [handleFile])

  const handleDownload = useCallback(() => {
    if (!result) return
    const url = URL.createObjectURL(result.blob)
    const a = document.createElement('a')
    a.href = url; a.download = result.fileName
    a.click()
    URL.revokeObjectURL(url)
  }, [result])

  const acceptStr = converter?.acceptExt || ''

  return (
    <Card className="border-border">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">ファイル変換</span>
        </div>

        {/* Format selectors */}
        <div className="flex items-center gap-2 text-sm">
          <select value={fromExt} onChange={handleFromChange}
            className="border rounded px-2 py-1.5 bg-background text-sm flex-1"
          >
            {FROM_FORMATS.map(f => (
              <option key={f.ext} value={f.ext}>{f.label}</option>
            ))}
          </select>
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
          <select value={toExt} onChange={handleToChange}
            className="border rounded px-2 py-1.5 bg-background text-sm flex-1"
          >
            {TO_FORMATS.filter(t => t.ext !== fromExt).map(t => (
              <option key={t.ext} value={t.ext}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Error from previous run */}
        {status === 'error' && (
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-950/20 rounded-lg p-3">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
            <Button onClick={resetConverter} variant="outline" size="sm" className="w-full">
              やり直す
            </Button>
          </div>
        )}

        {/* Upload button / progress */}
        {(status === 'idle' || status === 'error') && (
          <div className="flex flex-col gap-2">
            <input ref={fileInputRef} type="file" accept={acceptStr}
              onChange={handleFileChange} className="hidden" id="conversion-input"
            />
            <label htmlFor="conversion-input">
              <Button variant="outline" size="sm" className="w-full cursor-pointer" asChild>
                <span>ファイルを選択</span>
              </Button>
            </label>
            <p className="text-xs text-muted-foreground">
              {converter?.label} — 対応形式: {acceptStr}
            </p>
          </div>
        )}

        {/* Converting */}
        {status === 'converting' && (
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

        {/* Preview */}
        {status === 'preview' && result?.previewUrls && result.previewUrls.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">{message}</p>
            <div className="relative bg-muted/20 rounded-lg border overflow-hidden">
              <img src={result.previewUrls[previewIdx]} alt="Preview"
                className="w-full" />
              {result.previewUrls.length > 1 && (
                <>
                  <button onClick={() => setPreviewIdx(p => Math.max(0, p-1))}
                    disabled={previewIdx === 0}
                    className="absolute left-1 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-1 disabled:opacity-20 hover:bg-black/70"
                  ><ChevronLeft className="h-5 w-5" /></button>
                  <button onClick={() => setPreviewIdx(p => Math.min(result.previewUrls!.length-1, p+1))}
                    disabled={previewIdx >= result.previewUrls.length-1}
                    className="absolute right-1 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-1 disabled:opacity-20 hover:bg-black/70"
                  ><ChevronRight className="h-5 w-5" /></button>
                </>
              )}
              <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
                {previewIdx + 1} / {result.previewUrls.length}
              </div>
            </div>

            {/* Thumbnail row */}
            {result.previewUrls.length > 1 && (
              <div className="flex gap-1 overflow-x-auto pb-1">
                {result.previewUrls.map((url, i) => (
                  <button key={i} onClick={() => setPreviewIdx(i)}
                    className={`shrink-0 w-12 h-9 rounded border-2 overflow-hidden ${
                      i === previewIdx ? 'border-primary ring-1 ring-primary' : 'border-border opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={url} alt={`Page ${i+1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={handleDownload} size="sm" className="flex-1 gap-2">
                <Download className="h-4 w-4" /> {result.fileName}
              </Button>
              <Button onClick={resetConverter} variant="ghost" size="sm"><X className="h-4 w-4" /></Button>
            </div>
          </div>
        )}

        {/* Done (no preview) */}
        {status === 'done' && result && (
          <div className="space-y-2">
            <p className="text-sm text-green-600 font-medium">{message}</p>
            <div className="flex gap-2">
              <Button onClick={handleDownload} size="sm" className="flex-1 gap-2">
                <Download className="h-4 w-4" /> {result.fileName}
              </Button>
              <Button onClick={resetConverter} variant="ghost" size="sm">やり直す</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
