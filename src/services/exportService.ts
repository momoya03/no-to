'use client'

import { NoteDocument, NotePage } from '@/types'
import { sanitizeFileName } from '@/lib/utils'

export function exportToTXT(noteDocument: NoteDocument): void {
  let content = `ファイル名：${noteDocument.fileName}\n`
  content += `作成日：${noteDocument.createdAt.toLocaleString('ja-JP')}\n`
  content += `総ページ数：${noteDocument.totalPages}\n`
  content += `${'='.repeat(50)}\n\n`

  noteDocument.pages.forEach((page) => {
    content += page.noteContent
    content += '\n\n'
  })

  downloadFile(content, `${sanitizeFileName(noteDocument.fileName)}.txt`, 'text/plain')
}

export function exportToPDF(noteDocument: NoteDocument): void {
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    alert('ポップアップがブロックされました。ポップアップを許可してください。')
    return
  }

  let htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${noteDocument.fileName}</title>
      <style>
        body {
          font-family: "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif;
          line-height: 1.8;
          padding: 20mm;
          max-width: 210mm;
          margin: 0 auto;
        }
        h1 {
          font-size: 24px;
          border-bottom: 2px solid #333;
          padding-bottom: 10px;
          margin-top: 30px;
          margin-bottom: 20px;
        }
        h2 {
          font-size: 18px;
          margin-top: 25px;
          margin-bottom: 10px;
        }
        ul {
          padding-left: 20px;
        }
        li {
          margin-bottom: 8px;
        }
        .header {
          border-bottom: 1px solid #ccc;
          padding-bottom: 15px;
          margin-bottom: 20px;
        }
        .page-break {
          page-break-after: always;
        }
        @media print {
          body {
            padding: 15mm;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1 style="border: none; margin: 0;">${noteDocument.fileName}</h1>
        <p>作成日：${noteDocument.createdAt.toLocaleString('ja-JP')}</p>
        <p>総ページ数：${noteDocument.totalPages}</p>
      </div>
  `

  noteDocument.pages.forEach((page, index) => {
    const formattedContent = formatNoteContentForHTML(page.noteContent)
    htmlContent += formattedContent
    
    if (index < noteDocument.pages.length - 1) {
      htmlContent += '<div class="page-break"></div>'
    }
  })

  htmlContent += `
    </body>
    </html>
  `

  printWindow.document.write(htmlContent)
  printWindow.document.close()
  
  setTimeout(() => {
    printWindow.print()
  }, 500)
}

function formatNoteContentForHTML(content: string): string {
  let html = content
    .replace(/^#\s+(.+)$/gm, '<h1>$1</h1>')
    .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
    .replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
    .replace(/^・(.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(.+)$/gm, (match, p1) => {
      if (!p1.startsWith('<') && p1.trim()) {
        return `<p>${p1}</p>`
      }
      return match
    })

  return html
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  
  if (navigator.share) {
    const file = new File([blob], filename, { type: mimeType })
    navigator.share({
      files: [file],
      title: filename,
    }).catch(() => {
      fallbackDownload(a, url)
    })
  } else {
    fallbackDownload(a, url)
  }
}

function fallbackDownload(a: HTMLAnchorElement, url: string): void {
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text)
}

export function getNotesAsText(noteDocument: NoteDocument): string {
  let content = ''
  noteDocument.pages.forEach((page) => {
    content += page.noteContent + '\n\n'
  })
  return content
}
