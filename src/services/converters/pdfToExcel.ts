import { Converter } from './types'
import * as XLSX from 'xlsx'

async function convert(
  file: File,
  onProgress: (msg: string, pct: number) => void,
) {
  onProgress('PDFを解析中...', 5)
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const totalPages = pdf.numPages

  const rows: string[][] = []

  for (let i = 1; i <= totalPages; i++) {
    onProgress(`テキスト抽出 ${i}/${totalPages}`, Math.round((i/totalPages)*80))
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()

    // Group by Y position (rows)
    const items = content.items
      .filter((item: any) => item.str?.trim())
      .sort((a: any, b: any) => b.transform[5] - a.transform[5])

    const lineMap = new Map<number, string[]>()
    for (const item of items) {
      const y = Math.round((item as any).transform[5])
      if (!lineMap.has(y)) lineMap.set(y, [])
      lineMap.get(y)!.push((item as any).str)
    }

    // Sort by Y descending (top to bottom in PDF coords = higher Y first)
    const sortedYs = [...lineMap.keys()].sort((a, b) => b - a)
    for (const y of sortedYs) {
      rows.push(lineMap.get(y)!)
    }

    // Add blank row between pages
    if (i < totalPages) rows.push([])
  }

  onProgress('XLSXを生成中...', 85)
  const ws = XLSX.utils.aoa_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'PDF Content')
  const blob = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })

  return { blob: new Blob([blob]), fileName: file.name.replace(/\.pdf$/i, '.xlsx') }
}

export const pdfToExcel: Converter = {
  id: 'pdf-to-excel',
  label: 'PDF → Excel',
  fromExt: 'pdf',
  toExt: 'xlsx',
  acceptExt: '.pdf',
  acceptMime: ['application/pdf'],
  available: true,
  convert,
}
