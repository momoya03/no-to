'use client'

import Tesseract from 'tesseract.js'
import { PDFPage } from '@/types'

export async function performOCR(pages: PDFPage[], onProgress?: (page: number, total: number, status: string) => void): Promise<PDFPage[]> {
  const ocrPages: PDFPage[] = []

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]

    if (page.isOcr && page.imageData) {
      if (onProgress) {
        onProgress(i + 1, pages.length, `OCR 処理中... (${i + 1}/${pages.length})`)
      }

      try {
        const result = await Tesseract.recognize(
          page.imageData,
          'jpn',
          {
            logger: (m) => {
              if (onProgress && m.status === 'recognizing text') {
                onProgress(i + 1, pages.length, `OCR 認識中... ${Math.round(m.progress * 100)}%`)
              }
            }
          }
        )

        ocrPages.push({
          ...page,
          text: result.data.text.trim() || '判読が難しい',
          isOcr: true
        })
      } catch (error) {
        console.error('OCR error:', error)
        ocrPages.push({
          ...page,
          text: '判読が難しい',
          isOcr: true
        })
      }
    } else {
      ocrPages.push(page)
    }
  }

  return ocrPages
}
