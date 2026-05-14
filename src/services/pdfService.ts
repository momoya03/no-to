'use client'

import * as pdfjsLib from 'pdfjs-dist'
import { PDFPage } from '@/types'

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'


export async function extractPDFText(file: File, onProgress?: (page: number, total: number) => void): Promise<PDFPage[]> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const pages: PDFPage[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const textItems = textContent.items as any[]
    
    const text = extractTextWithLayout(textItems)

    let imageData: string | undefined
    if (text.trim().length === 0) {
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

      imageData = canvas.toDataURL('image/png')
    }

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

function extractTextWithLayout(textItems: any[]): string {
  if (textItems.length === 0) return ''

  const itemsWithPosition = textItems.map((item, index) => {
    const transform = item.transform
    const x = transform[4]
    const y = transform[5]
    return {
      str: item.str,
      x,
      y,
      width: item.width || 0,
      height: item.height || 0
    }
  })

  itemsWithPosition.sort((a, b) => {
    const yDiff = b.y - a.y
    if (Math.abs(yDiff) > 2) {
      return yDiff
    }
    return a.x - b.x
  })

  const lines: string[] = []
  let currentLine = ''
  let lastY = itemsWithPosition[0].y
  let lastX = itemsWithPosition[0].x

  for (const item of itemsWithPosition) {
    if (!item.str || item.str.trim() === '') continue

    const yDiff = Math.abs(item.y - lastY)
    const xDiff = item.x - lastX

    if (yDiff > 2) {
      if (currentLine) {
        lines.push(currentLine)
      }
      currentLine = item.str
      lastY = item.y
      lastX = item.x + (item.width || 0)
    } else {
      if (xDiff > 2 && currentLine) {
        currentLine += ' ' + item.str
      } else {
        currentLine += item.str
      }
      lastX = item.x + (item.width || 0)
    }
  }

  if (currentLine) {
    lines.push(currentLine)
  }

  return mergeFragmentedLines(lines)
}

function mergeFragmentedLines(lines: string[]): string {
  if (lines.length <= 1) return lines.join('\n')

  const merged: string[] = []
  let current = lines[0]

  for (let i = 1; i < lines.length; i++) {
    const next = lines[i]

    if (shouldMerge(current, next)) {
      current += next
    } else {
      merged.push(current)
      current = next
    }
  }
  merged.push(current)

  return merged.join('\n')
}

function shouldMerge(prev: string, current: string): boolean {
  if (current.length < 5) return true

  const prevEnd = prev.slice(-1)
  const curStart = current.slice(0, 1)

  const continuationEnds = ['、', '，', ',', '（', '(', '「', '『', '[', '《', '〈', 'で', 'に', 'を', 'が', 'は', 'の', 'も', 'から', 'まで', 'より', 'や', 'と', 'へ', 'や', 'か', 'し', 'て', 'た', 'な', 'ので', 'から', 'そして', 'また', 'または']
  for (const end of continuationEnds) {
    if (prev.endsWith(end)) return true
  }

  const continuationStarts = ['）', ')', '」', '』', ']', '》', '〉', '、', '，', ',', '。', '.', '！', '?', '？', 'て', 'た', 'で', 'に', 'を', 'は', 'が', 'の', 'も']
  for (const start of continuationStarts) {
    if (current.startsWith(start)) return true
  }

  const prevEndsSentence = ['。', '！', '？', '.', '!', '?', '…', '：', ':', '）', ')', '」', '』'].some(e => prev.endsWith(e))
  if (!prevEndsSentence) return true

  return false
}
