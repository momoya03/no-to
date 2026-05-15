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
  const previewLines: string[] = []

  for (let i = 1; i <= totalPages; i++) {
    onProgress(`テキスト抽出 ${i}/${totalPages}`, Math.round((i/totalPages)*80))
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()

    const items = content.items
      .filter((item: any) => item.str?.trim())
      .sort((a: any, b: any) => {
        const yDiff = Math.abs(a.transform[5] - b.transform[5])
        return yDiff < 2 ? a.transform[4] - b.transform[4] : b.transform[5] - a.transform[5]
      })

    previewLines.push(`── Page ${i} ──`)
    paragraphs.push(new Paragraph({
      children: [new TextRun({ text: `--- Page ${i} ---`, bold: true, size: 20 })],
      spacing: { before: i === 1 ? 200 : 400, after: 100 },
    }))

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
          previewLines.push(lineText.trim())
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
      previewLines.push(lineText.trim())
    }
  }

  onProgress('DOCXを生成中...', 85)
  const doc = new Document({
    sections: [{ properties: {}, children: paragraphs }],
  })
  const blob = await Packer.toBlob(doc)

  // Preview: render collected text to canvas
  const previewCanvas = document.createElement('canvas')
  previewCanvas.width = 842; previewCanvas.height = 595
  const pctx = previewCanvas.getContext('2d')!
  pctx.fillStyle = '#fff'; pctx.fillRect(0, 0, 842, 595)
  pctx.fillStyle = '#000'
  pctx.font = '12px "Hiragino Sans","Noto Sans JP","Yu Gothic",sans-serif'
  for (let i = 0; i < Math.min(previewLines.length, 35); i++) {
    pctx.fillText(previewLines[i].slice(0, 120), 20, 20 + (i+1)*14)
  }
  const previewUrls = [previewCanvas.toDataURL('image/jpeg', 0.7)]

  return { blob, fileName: file.name.replace(/\.pdf$/i, '.docx'), previewUrls }
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
