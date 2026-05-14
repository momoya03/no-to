'use client'

import React from 'react'
import { NoteDocument, NotePage } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { FileText, BookOpen, Copy, Download } from 'lucide-react'
import { copyToClipboard } from '@/services/exportService'

interface NotesViewerProps {
  noteDocument: NoteDocument
  currentPage: number
  viewMode: 'detailed' | 'exam'
  displayMode: 'page' | 'all'
  onViewModeChange: (mode: 'detailed' | 'exam') => void
  onDisplayModeChange: (mode: 'page' | 'all') => void
  onCopy: () => void
  onExportPDF: () => void
  onExportTXT: () => void
}

export function NotesViewer({
  noteDocument,
  currentPage,
  viewMode,
  displayMode,
  onViewModeChange,
  onDisplayModeChange,
  onCopy,
  onExportPDF,
  onExportTXT
}: NotesViewerProps) {
  const displayPages = displayMode === 'page'
    ? noteDocument.pages.filter(p => p.pageNumber === currentPage)
    : noteDocument.pages

  const renderNoteContent = (content: string) => {
    return content.split('\n').map((line, index) => {
      if (line.startsWith('# ')) {
        return <h1 key={index} className="text-xl font-bold mt-4 mb-2 text-primary">{line.slice(2)}</h1>
      } else if (line.startsWith('## ')) {
        return <h2 key={index} className="text-lg font-semibold mt-3 mb-1">{line.slice(3)}</h2>
      } else if (line.startsWith('### ')) {
        return <h3 key={index} className="text-md font-medium mt-2 mb-1">{line.slice(4)}</h3>
      } else if (line.startsWith('・')) {
        return <li key={index} className="ml-4 mb-1 list-disc">{line.slice(1)}</li>
      } else if (line.trim()) {
        return <p key={index} className="mb-1">{line}</p>
      }
      return <br key={index} />
    })
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b bg-muted/20">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold truncate">{noteDocument.fileName}</h2>
            <p className="text-sm text-muted-foreground">
              {noteDocument.totalPages}ページ
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={onCopy}>
              <Copy className="h-4 w-4 mr-1" />
              コピー
            </Button>
            <Button variant="outline" size="sm" onClick={onExportTXT}>
              <FileText className="h-4 w-4 mr-1" />
              TXT
            </Button>
            <Button variant="outline" size="sm" onClick={onExportPDF}>
              <Download className="h-4 w-4 mr-1" />
              PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4 border-b">
        <div className="flex flex-col sm:flex-row gap-4">
          <Tabs value={viewMode} onValueChange={(v) => onViewModeChange(v as 'detailed' | 'exam')} className="w-full sm:w-auto">
            <TabsList>
              <TabsTrigger value="detailed">
                <BookOpen className="h-4 w-4 mr-1" />
                詳細モード
              </TabsTrigger>
              <TabsTrigger value="exam">
                <FileText className="h-4 w-4 mr-1" />
                試験モード
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Tabs value={displayMode} onValueChange={(v) => onDisplayModeChange(v as 'page' | 'all')} className="w-full sm:w-auto">
            <TabsList>
              <TabsTrigger value="page">ページごと</TabsTrigger>
              <TabsTrigger value="all">全体表示</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {displayPages.map((page) => (
            <Card key={page.pageNumber}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  第 {page.pageNumber} ページ
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {renderNoteContent(page.noteContent)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
