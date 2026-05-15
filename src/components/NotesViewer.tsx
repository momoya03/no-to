'use client'

import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { NoteDocument } from '@/types'
import { Button } from '@/components/ui/button'
import { FileText, Copy, Download } from 'lucide-react'

interface NotesViewerProps {
  noteDocument: NoteDocument
  currentPage: number
  displayMode: 'page' | 'all'
  onDisplayModeChange: (mode: 'page' | 'all') => void
  onCopy: () => void
  onExportPDF: () => void
  onExportTXT: () => void
}

export function NotesViewer({
  noteDocument,
  currentPage,
  displayMode,
  onDisplayModeChange,
  onCopy,
  onExportPDF,
  onExportTXT
}: NotesViewerProps) {
  const displayPages = noteDocument.pages

  const highlightImportantNumbers = (text: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = []
    let lastIndex = 0
    // group1: prefix (~/≈/約), group2: number, group3: unit
    const regex = /(～|≈|約|约)?(\d+(?:\.\d+)?)([点年月日円万円億兆%kmkg人社回頁ページptcmmm倍割千百十])?/g
    let match

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index))
      }

      const hasPrefix = !!match[1]
      const numberStr = match[2]
      const hasUnit = !!match[3]
      const isLargeNumber = numberStr.replace(/[,.]/g, '').length >= 3

      if ((hasPrefix || hasUnit || isLargeNumber) && !/1949|1978/.test(match[0])) {
        parts.push(
          <span
            key={match.index}
            className="bg-yellow-200 dark:bg-yellow-800 px-1.5 py-0.5 rounded-md font-semibold text-yellow-900 dark:text-yellow-100"
          >
            {match[0]}
          </span>
        )
      } else {
        parts.push(match[0])
      }

      lastIndex = match.index + match[0].length
    }

    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex))
    }

    return parts
  }

  const highlightChildren = (children: React.ReactNode): React.ReactNode => {
    if (typeof children === 'string') {
      const result = highlightImportantNumbers(children)
      return result.length === 0 ? children : result
    }
    if (Array.isArray(children)) {
      return children.map((child, i) =>
        typeof child === 'string'
          ? <React.Fragment key={i}>{highlightImportantNumbers(child)}</React.Fragment>
          : child
      )
    }
    return children
  }

  const renderNoteContent = (content: string) => {
    // Wrap annotations in light-blue styled spans
    const processed = content.replace(
      /（注：[^）]*）/g,
      '<span class="text-sky-400 dark:text-sky-300 font-medium">$&</span>'
    )
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          h1: ({ children, ...props }) => (
            <h1
              className="text-3xl font-bold mt-10 mb-6 text-gray-900 dark:text-gray-100 border-b-2 border-primary/30 pb-3"
              {...props}
            >
              {highlightChildren(children)}
            </h1>
          ),
          h2: ({ children, ...props }) => (
            <h2
              className="text-2xl font-semibold mt-8 mb-4 text-gray-800 dark:text-gray-200 border-l-4 border-primary pl-4"
              {...props}
            >
              {highlightChildren(children)}
            </h2>
          ),
          h3: ({ children, ...props }) => (
            <h3
              className="text-xl font-medium mt-6 mb-3 text-gray-700 dark:text-gray-300"
              {...props}
            >
              {highlightChildren(children)}
            </h3>
          ),
          h4: ({ children, ...props }) => (
            <h4
              className="text-lg font-medium mt-5 mb-2 text-gray-600 dark:text-gray-400"
              {...props}
            >
              {highlightChildren(children)}
            </h4>
          ),
          p: ({ children, ...props }) => (
            <p
              className="mb-4 leading-8 tracking-wide text-gray-700 dark:text-gray-300"
              {...props}
            >
              {highlightChildren(children)}
            </p>
          ),
          ul: ({ ...props }) => (
            <ul
              className="list-disc pl-8 mb-4 space-y-2"
              {...props}
            />
          ),
          ol: ({ ...props }) => (
            <ol
              className="list-decimal pl-8 mb-4 space-y-2"
              {...props}
            />
          ),
          li: ({ children, ...props }) => (
            <li
              className="leading-8 text-gray-700 dark:text-gray-300"
              {...props}
            >
              {highlightChildren(children)}
            </li>
          ),
          blockquote: ({ ...props }) => (
            <blockquote
              className="border-l-2 border-gray-300 dark:border-gray-600 pl-4 py-1 my-3 text-gray-600 dark:text-gray-400"
              {...props}
            />
          ),
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '')
            return (
              <code
                className={`${
                  match
                    ? 'block bg-gray-50 dark:bg-gray-800/50 px-4 py-3 my-3 overflow-x-auto text-sm font-mono text-gray-800 dark:text-gray-200'
                    : 'bg-gray-50 dark:bg-gray-800/50 px-1.5 py-0.5 rounded text-sm font-mono text-primary'
                }`}
                {...props}
              >
                {children}
              </code>
            )
          },
          pre: ({ ...props }) => (
            <pre
              className="bg-gray-50 dark:bg-gray-800/50 p-4 my-3 overflow-x-auto"
              {...props}
            />
          ),
          table: ({ ...props }) => (
            <div className="my-4 overflow-x-auto">
              <table
                className="w-full border-collapse"
                {...props}
              />
            </div>
          ),
          thead: ({ ...props }) => (
            <thead
              className="border-b border-gray-300 dark:border-gray-600"
              {...props}
            />
          ),
          th: ({ children, ...props }) => (
            <th
              className="px-4 py-2 text-left font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700"
              {...props}
            >
              {highlightChildren(children)}
            </th>
          ),
          td: ({ children, ...props }) => (
            <td
              className="px-4 py-2 text-gray-700 dark:text-gray-300"
              {...props}
            >
              {highlightChildren(children)}
            </td>
          ),
          hr: ({ ...props }) => (
            <hr
              className="my-6 border-t border-gray-200 dark:border-gray-700"
              {...props}
            />
          ),
          strong: ({ ...props }) => (
            <strong
              className="font-bold text-primary"
              {...props}
            />
          ),
          em: ({ ...props }) => (
            <em
              className="italic text-gray-600 dark:text-gray-400"
              {...props}
            />
          ),
          input: ({ ...props }) => (
            <input
              className="mr-3 h-4 w-4 text-primary rounded border-gray-300 dark:border-gray-600 focus:ring-primary"
              type="checkbox"
              {...props}
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-2 border-b bg-muted/10 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold truncate">{noteDocument.fileName}</h2>
            <p className="text-xs text-muted-foreground">
              ノート {noteDocument.pages.length}ページ
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            <Button variant="outline" size="sm" onClick={onCopy} className="h-8 text-xs">
              <Copy className="h-3 w-3 mr-1" />
              コピー
            </Button>
            <Button variant="outline" size="sm" onClick={onExportTXT} className="h-8 text-xs">
              <FileText className="h-3 w-3 mr-1" />
              TXT
            </Button>
            <Button variant="outline" size="sm" onClick={onExportPDF} className="h-8 text-xs">
              <Download className="h-3 w-3 mr-1" />
              PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-4xl mx-auto space-y-8">
          {displayPages.map((page) => (
            <div key={page.pageNumber} className="py-2">
              {renderNoteContent(page.noteContent)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
