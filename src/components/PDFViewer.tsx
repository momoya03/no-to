'use client'

import React, { useState, useCallback } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, FileText } from 'lucide-react'

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`

interface PDFViewerProps {
  file: File
  currentPage: number
  totalPages?: number
  onPageChange: (page: number) => void
}

export function PDFViewer({ file, currentPage, totalPages = 0, onPageChange }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [scale, setScale] = useState(1.0)
  const [hasError, setHasError] = useState(false)

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    setHasError(false)
  }, [])

  const onDocumentLoadError = useCallback(() => {
    setHasError(true)
  }, [])

  const goToPrevPage = useCallback(() => {
    onPageChange(Math.max(currentPage - 1, 1))
  }, [currentPage, onPageChange])

  const goToNextPage = useCallback(() => {
    const maxPage = numPages || totalPages || 1
    onPageChange(Math.min(currentPage + 1, maxPage))
  }, [currentPage, numPages, totalPages, onPageChange])

  const zoomIn = useCallback(() => {
    setScale(s => Math.min(s + 0.25, 2.5))
  }, [])

  const zoomOut = useCallback(() => {
    setScale(s => Math.max(s - 0.25, 0.5))
  }, [])

  const displayMaxPages = numPages || totalPages || 0

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={goToPrevPage}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">
            {currentPage} / {displayMaxPages || '-'}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={goToNextPage}
            disabled={!!displayMaxPages && currentPage >= displayMaxPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {!hasError && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={zoomOut}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm">{Math.round(scale * 100)}%</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={zoomIn}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-auto p-4">
        <Card className="mx-auto max-w-full h-full">
          <CardContent className="p-0 flex justify-center h-full">
            {hasError || !file.size ? (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">PDF プレビュー</h3>
                <p className="text-muted-foreground mb-4">
                  ページ {currentPage} / {displayMaxPages || '-'}
                </p>
                <p className="text-sm text-muted-foreground">
                  右側のノートを参照してください
                </p>
              </div>
            ) : (
              <Document
                file={file}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={<div className="p-8 text-center">読み込み中...</div>}
              >
                <Page
                  pageNumber={currentPage}
                  scale={scale}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />
              </Document>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
