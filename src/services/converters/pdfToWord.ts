import { Converter } from './types'
import { Document, Packer, Paragraph, TextRun } from 'docx'

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

  const paragraphs: Paragraph[] = []

  for (let i = 1; i <= totalPages; i++) {
    onProgress(`テキスト抽出 ${i}/${totalPages}`, Math.round((i/totalPages)*80))
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()

    // Group text items by Y position (lines)
    const items = content.items
      .filter((item: any) => item.str?.trim())
      .sort((a: any, b: any) => {
        const yDiff = Math.abs(a.transform[5] - b.transform[5])
        return yDiff < 2 ? a.transform[4] - b.transform[4] : b.transform[5] - a.transform[5]
      })

    if (i === 1) {
      // Page marker
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: `--- Page ${i} ---`, bold: true, size: 20 })],
          spacing: { before: 200, after: 100 },
        })
      )
    } else {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: `--- Page ${i} ---`, bold: true, size: 20 })],
          spacing: { before: 400, after: 100 },
        })
      )
    }

    let currentY = -1
    let lineText = ''
    for (const item of items) {
      const y = Math.round((item as any).transform[5])
      if (currentY !== -1 && Math.abs(y - currentY) > 3) {
        if (lineText.trim()) {
          paragraphs.push(new Paragraph({
            children: [new TextRun(lineText.trim())],
            spacing: { after: 60 },
          }))
        }
        lineText = (item as any).str + ' '
      } else {
        lineText += (item as any).str + ' '
      }
      currentY = y
    }
    if (lineText.trim()) {
      paragraphs.push(new Paragraph({
        children: [new TextRun(lineText.trim())],
        spacing: { after: 60 },
      }))
    }
  }

  onProgress('DOCXを生成中...', 85)
  const doc = new Document({
    sections: [{ properties: {}, children: paragraphs }],
  })

  const blob = await Packer.toBlob(doc)
  return { blob, fileName: file.name.replace(/\.pdf$/i, '.docx') }
}

export const pdfToWord: Converter = {
  id: 'pdf-to-word',
  label: 'PDF → Word',
  fromExt: 'pdf',
  toExt: 'docx',
  acceptExt: '.pdf',
  acceptMime: ['application/pdf'],
  available: true,
  convert,
}
