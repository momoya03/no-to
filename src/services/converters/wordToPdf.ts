import { Converter } from './types'
import { jsPDF } from 'jspdf'

async function convert(
  file: File,
  onProgress: (msg: string, pct: number) => void,
) {
  onProgress('Wordを解析中...', 10)
  const { extractWordText } = await import('@/services/wordService')
  const text = await extractWordText(file)

  onProgress('PDFを生成中...', 50)
  const canvas = document.createElement('canvas')
  const scale = 2
  canvas.width = 1684
  canvas.height = 1190
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#000'
  ctx.font = `${14*scale}px "Hiragino Sans","Noto Sans JP","Yu Gothic",sans-serif`
  const margin = 30 * scale
  const maxW = canvas.width - margin * 2
  const lineH = 22 * scale
  const maxLines = Math.floor((canvas.height - margin*2) / lineH)

  const lines: string[] = []
  for (const para of text.split('\n')) {
    if (!para) { lines.push(''); continue }
    let line = ''
    for (const ch of para) {
      if (ctx.measureText(line+ch).width > maxW && line.length) {
        lines.push(line); line = ch
      } else { line += ch }
    }
    if (line) lines.push(line)
  }

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const totalPages = Math.ceil(lines.length / maxLines) || 1

  for (let p = 0; p < totalPages; p++) {
    if (p > 0) doc.addPage()
    onProgress(`ページ ${p+1}/${totalPages}`, 50 + Math.round((p/totalPages)*45))
    // Clear and redraw page
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#000'
    const pageLines = lines.slice(p*maxLines, (p+1)*maxLines)
    pageLines.forEach((l, i) => ctx.fillText(l, margin, margin + (i+1)*lineH))
    ctx.font = `${10*scale}px sans-serif`
    ctx.fillStyle = '#999'
    ctx.fillText(`${p+1}/${totalPages}`, canvas.width-margin, canvas.height-margin/2)
    doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 297, 210)
  }

  const blob = doc.output('blob')

  // Preview: render first page of text
  const previewCanvas = document.createElement('canvas')
  previewCanvas.width = 842; previewCanvas.height = 595
  const pctx = previewCanvas.getContext('2d')!
  pctx.fillStyle = '#fff'; pctx.fillRect(0, 0, 842, 595)
  pctx.fillStyle = '#000'
  pctx.font = '12px "Hiragino Sans","Noto Sans JP","Yu Gothic",sans-serif'
  const firstLines = lines.slice(0, 30)
  firstLines.forEach((l, i) => pctx.fillText(l, 20, 20 + (i+1)*18))
  const previewUrls = [previewCanvas.toDataURL('image/jpeg', 0.7)]

  return { blob, fileName: file.name.replace(/\.docx?$/i, '.pdf'), previewUrls }
}

export const wordToPdf: Converter = {
  id: 'word-to-pdf',
  label: 'Word → PDF',
  fromExt: 'docx',
  toExt: 'pdf',
  acceptExt: '.docx',
  acceptMime: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  available: true,
  convert,
}
