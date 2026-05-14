'use client'

import * as pdfjsLib from 'pdfjs-dist'
import { PDFPage } from '@/types'

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

export async function extractPDFText(file: File, onProgress?: (page: number, total: number) => void): Promise<PDFPage[]> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const pages: PDFPage[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const textItems = textContent.items as any[]
    const text = textItems.map((item: any) => item.str).join('\n')

    const scale = 2.0
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    canvas.height = viewport.height
    canvas.width = viewport.width

    await page.render({
      canvasContext: context!,
      viewport: viewport
    }).promise

    const imageData = canvas.toDataURL('image/png')

    pages.push({
      pageNumber: i,
      text: text.trim(),
      isOcr: text.trim().length === 0,
      imageData
    })

    if (onProgress) {
      onProgress(i, pdf.numPages)
    }
  }

  return pages
}
