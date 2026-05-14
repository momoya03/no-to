'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { PDFViewer } from '@/components/PDFViewer'
import { NotesViewer } from '@/components/NotesViewer'
import { AIChat } from '@/components/AIChat'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Moon, Sun, ArrowLeft, MessageSquare } from 'lucide-react'
import { useTheme } from 'next-themes'
import { NoteDocument, PDFPage, Message, AppState } from '@/types'
import { exportToPDF, exportToTXT, copyToClipboard, getNotesAsText } from '@/services/exportService'
import { createMessage, generateQAResponseLocal } from '@/services/aiService'

export default function NotesPage() {
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  
  const [state, setState] = useState<AppState>({
    pdfFile: null,
    pdfPages: [],
    noteDocument: null,
    currentPage: 1,
    viewMode: 'detailed',
    displayMode: 'page',
    isProcessing: false,
    processingProgress: 0,
    processingStep: '',
    messages: [],
    isAIProcessing: false,
    error: null
  })

  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    const pdfPagesData = sessionStorage.getItem('pdfPages')
    const noteDocumentData = sessionStorage.getItem('noteDocument')
    const pdfFileData = sessionStorage.getItem('pdfFile')

    if (pdfPagesData && noteDocumentData) {
      const pdfPages: PDFPage[] = JSON.parse(pdfPagesData)
      const noteDocument: NoteDocument = JSON.parse(noteDocumentData)
      noteDocument.createdAt = new Date(noteDocument.createdAt)

      setState(prev => ({
        ...prev,
        pdfPages,
        noteDocument,
        pdfFile: pdfFileData ? JSON.parse(pdfFileData) : null
      }))
    } else {
      router.push('/')
    }
  }, [router])

  const handlePageChange = useCallback((page: number) => {
    setState(prev => ({ ...prev, currentPage: page }))
  }, [])

  const handleViewModeChange = useCallback((mode: 'detailed' | 'exam') => {
    if (!state.pdfPages.length) return
    
    setState(prev => {
      const { generateNotesLocal } = require('@/services/aiService')
      const newNotePages = generateNotesLocal(prev.pdfPages, mode)
      return {
        ...prev,
        viewMode: mode,
        noteDocument: prev.noteDocument ? {
          ...prev.noteDocument,
          pages: newNotePages
        } : null
      }
    })
  }, [state.pdfPages])

  const handleDisplayModeChange = useCallback((mode: 'page' | 'all') => {
    setState(prev => ({ ...prev, displayMode: mode }))
  }, [])

  const handleCopy = useCallback(async () => {
    if (!state.noteDocument) return
    try {
      await copyToClipboard(getNotesAsText(state.noteDocument))
      alert('コピーしました！')
    } catch (err) {
      alert('コピーに失敗しました')
    }
  }, [state.noteDocument])

  const handleExportPDF = useCallback(() => {
    if (!state.noteDocument) return
    exportToPDF(state.noteDocument)
  }, [state.noteDocument])

  const handleExportTXT = useCallback(() => {
    if (!state.noteDocument) return
    exportToTXT(state.noteDocument)
  }, [state.noteDocument])

  const handleSendMessage = useCallback(async (content: string) => {
    if (!state.noteDocument) return

    const userMessage = createMessage('user', content)
    setState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isAIProcessing: true
    }))

    await new Promise(resolve => setTimeout(resolve, 500))

    const response = generateQAResponseLocal(
      content,
      state.pdfPages,
      state.noteDocument.pages,
      state.currentPage
    )

    const assistantMessage = createMessage('assistant', response)
    setState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage, assistantMessage],
      isAIProcessing: false
    }))
  }, [state.noteDocument, state.pdfPages, state.currentPage])

  const handleClearMessages = useCallback(() => {
    setState(prev => ({ ...prev, messages: [] }))
  }, [])

  if (!mounted || !state.noteDocument) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold truncate max-w-[200px] sm:max-w-md">
              {state.noteDocument.fileName}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <MessageSquare className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:w-[400px] p-0">
                <AIChat
                  messages={state.messages}
                  isProcessing={state.isAIProcessing}
                  pdfPages={state.pdfPages}
                  notePages={state.noteDocument.pages}
                  currentPage={state.currentPage}
                  onSendMessage={handleSendMessage}
                  onClearMessages={handleClearMessages}
                />
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <div className="w-full lg:w-1/2 h-[50vh] lg:h-auto border-b lg:border-b-0 lg:border-r overflow-hidden">
          <PDFViewer
            file={new File([], state.noteDocument.fileName)}
            currentPage={state.currentPage}
            onPageChange={handlePageChange}
          />
        </div>

        <div className="w-full lg:w-1/2 h-[50vh] lg:h-auto flex flex-col lg:flex-row overflow-hidden">
          <div className="w-full lg:flex-1 h-auto lg:h-full overflow-hidden">
            <NotesViewer
              noteDocument={state.noteDocument}
              currentPage={state.currentPage}
              viewMode={state.viewMode}
              displayMode={state.displayMode}
              onViewModeChange={handleViewModeChange}
              onDisplayModeChange={handleDisplayModeChange}
              onCopy={handleCopy}
              onExportPDF={handleExportPDF}
              onExportTXT={handleExportTXT}
            />
          </div>

          <div className="hidden lg:block w-80 border-l overflow-hidden">
            <AIChat
              messages={state.messages}
              isProcessing={state.isAIProcessing}
              pdfPages={state.pdfPages}
              notePages={state.noteDocument.pages}
              currentPage={state.currentPage}
              onSendMessage={handleSendMessage}
              onClearMessages={handleClearMessages}
            />
          </div>
        </div>
      </main>
    </div>
  )
}
