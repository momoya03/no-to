'use client'

import React, { useState, useCallback } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react'

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`

interface PDFViewerProps {
  file: File
  currentPage: number
  onPageChange: (page: number) => void
}

export function PDFViewer({ file, currentPage, onPageChange }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [scale, setScale] = useState(1.0)

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
  }, [])

  const goToPrevPage = useCallback(() => {
    onPageChange(Math.max(currentPage - 1, 1))
  }, [currentPage, onPageChange])

  const goToNextPage = useCallback(() => {
    onPageChange(Math.min(currentPage + 1, numPages))
  }, [currentPage, numPages, onPageChange])

  const zoomIn = useCallback(() => {
    setScale(s => Math.min(s + 0.25, 2.5))
  }, [])

  const zoomOut = useCallback(() => {
    setScale(s => Math.max(s - 0.25, 0.5))
  }, [])

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
            {currentPage} / {numPages || '-'}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={goToNextPage}
            disabled={currentPage >= numPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
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
      </div>
      <div className="flex-1 overflow-auto p-4">
        <Card className="mx-auto max-w-full">
          <CardContent className="p-0 flex justify-center">
            <Document
              file={file}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={<div className="p-8 text-center">読み込み中...</div>}
              error={<div className="p-8 text-center text-red-500">PDFの読み込みに失敗しました</div>}
            >
              <Page
                pageNumber={currentPage}
                scale={scale}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            </Document>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
