'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { NotesViewer } from '@/components/NotesViewer'
import { Button } from '@/components/ui/button'
import { Moon, Sun, ArrowLeft } from 'lucide-react'
import { useTheme } from 'next-themes'
import { NoteDocument, PDFPage, AppState, NoteSection } from '@/types'
import { exportToPDF, exportToTXT, copyToClipboard, getNotesAsText } from '@/services/exportService'

export default function NotesPage() {
  const { theme, setTheme } = useTheme()
  const router = useRouter()

  const [state, setState] = useState<AppState>({
    pdfFile: null,
    pdfPages: [],
    noteDocument: null,
    currentPage: 1,
    displayMode: 'all',
    isProcessing: false,
    processingProgress: 0,
    processingStep: '',
    error: null
  })

  // Extract structured sections from noteDocument if available
  const noteSections: NoteSection[] | undefined = state.noteDocument?.pages[0]?.structuredNote?.sections

  const [mounted, setMounted] = useState(false)
  const [aiUsed, setAiUsed] = useState<boolean | null>(null)

  useEffect(() => {
    setMounted(true)
    
    try {
      const pdfPagesData = sessionStorage.getItem('pdfPages')
      const noteDocumentData = sessionStorage.getItem('noteDocument')
      const pdfFileData = sessionStorage.getItem('pdfFile')

      if (pdfPagesData && noteDocumentData) {
        const pdfPages: PDFPage[] = JSON.parse(pdfPagesData)
        const noteDocument: NoteDocument = JSON.parse(noteDocumentData)
        noteDocument.createdAt = new Date(noteDocument.createdAt)

        const aiUsedData = sessionStorage.getItem('aiUsed')
        if (aiUsedData) setAiUsed(JSON.parse(aiUsedData))

        setState(prev => ({
          ...prev,
          pdfPages,
          noteDocument,
          pdfFile: pdfFileData ? JSON.parse(pdfFileData) : null
        }))
      } else {
        setState(prev => ({
          ...prev,
          error: 'セッションデータが見つかりません。トップページからPDFをアップロードしてください。'
        }))
      }
    } catch (error) {
      console.error('データ読み込みエラー:', error)
      setState(prev => ({
        ...prev,
        error: 'データの読み込みに失敗しました。トップページからやり直してください。'
      }))
    }
  }, [])

  const handlePageChange = useCallback((page: number) => {
    setState(prev => ({ ...prev, currentPage: page }))
  }, [])

  const handleDisplayModeChange = useCallback((mode: 'page' | 'all' | 'outline') => {
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

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>読み込み中...</p>
      </div>
    )
  }

  if (state.error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="max-w-md w-full text-center">
          <div className="mb-6">
            <svg className="w-16 h-16 mx-auto text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            エラーが発生しました
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            {state.error}
          </p>
          <Button
            onClick={() => router.push('/')}
            className="w-full"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            トップページに戻る
          </Button>
        </div>
      </div>
    )
  }

  if (!state.noteDocument) {
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
          </div>
        </div>
      </header>

      {aiUsed === false && (
        <div className="bg-yellow-50 dark:bg-yellow-950/30 border-b border-yellow-200 dark:border-yellow-800 px-4 py-2 text-center text-sm text-yellow-700 dark:text-yellow-400">
          AI生成に失敗したため、簡易生成モードで表示しています。管理者にお問い合わせください。
        </div>
      )}
      {aiUsed === true && (
        <div className="bg-green-50 dark:bg-green-950/30 border-b border-green-200 dark:border-green-800 px-4 py-2 text-center text-sm text-green-700 dark:text-green-400">
          AI生成モード
        </div>
      )}

      <main className="flex-1 overflow-hidden">
        <div className="w-full h-full overflow-hidden">
          <NotesViewer
            noteDocument={state.noteDocument}
            currentPage={state.currentPage}
            displayMode={state.displayMode}
            onDisplayModeChange={handleDisplayModeChange}
            onCopy={handleCopy}
            onExportPDF={handleExportPDF}
            onExportTXT={handleExportTXT}
            noteSections={noteSections}
          />
        </div>
      </main>
    </div>
  )
}
