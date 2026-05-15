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

  // Preview: render all pages of text to canvas
  const linesPerPage = 40
  const totalPreviewPages = Math.ceil(previewLines.length / linesPerPage) || 1
  const previewUrls: string[] = []
  for (let p = 0; p < totalPreviewPages; p++) {
    const pc = document.createElement('canvas')
    pc.width = 842; pc.height = 595
    const pctx = pc.getContext('2d')!
    pctx.fillStyle = '#fff'; pctx.fillRect(0, 0, 842, 595)
    pctx.fillStyle = '#000'
    pctx.font = '12px "Hiragino Sans","Noto Sans JP","Yu Gothic",sans-serif'
    const pageLines = previewLines.slice(p*linesPerPage, (p+1)*linesPerPage)
    pageLines.forEach((l, i) => pctx.fillText(l.slice(0, 120), 20, 20 + (i+1)*14))
    pctx.fillStyle = '#999'
    pctx.fillText(`${p+1}/${totalPreviewPages}`, 780, 580)
    previewUrls.push(pc.toDataURL('image/jpeg', 0.7))
  }

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
