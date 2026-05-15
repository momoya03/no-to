import { Converter } from './types'
import { jsPDF } from 'jspdf'
import * as XLSX from 'xlsx'

async function convert(
  file: File,
  onProgress: (msg: string, pct: number) => void,
) {
  onProgress('Excelを解析中...', 10)
  const arrayBuffer = await file.arrayBuffer()
  const wb = XLSX.read(arrayBuffer, { type: 'array' })

  onProgress('PDFを生成中...', 40)
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  let firstCanvas: HTMLCanvasElement | null = null

  const sheetNames = wb.SheetNames
  for (let si = 0; si < sheetNames.length; si++) {
    if (si > 0) doc.addPage()
    const ws = wb.Sheets[sheetNames[si]]
    const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 })

    onProgress(`シート "${sheetNames[si]}" を処理中...`, 40 + Math.round((si/sheetNames.length)*55))

    // Render with canvas for CJK support
    const canvas = document.createElement('canvas')
    const scale = 2
    const margin = 15 * scale
    const colW = 60 * scale
    const rowH = 18 * scale
    const maxCols = 10
    const maxRows = 40

    const cols = Math.min(data[0]?.length || 4, maxCols)
    const rows = Math.min(data.length, maxRows)

    canvas.width = margin*2 + cols*colW
    canvas.height = margin*2 + (rows+1)*rowH
    if (!firstCanvas) firstCanvas = canvas
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.font = `${9*scale}px "Hiragino Sans","Noto Sans JP","Yu Gothic",sans-serif`

    // Header row
    ctx.fillStyle = '#e5e7eb'
    ctx.fillRect(margin, margin, cols*colW, rowH)
    ctx.fillStyle = '#000'
    for (let c = 0; c < cols; c++) {
      ctx.strokeRect(margin + c*colW, margin, colW, rowH)
      const hdr = String(data[0]?.[c] ?? String.fromCharCode(65+c))
      ctx.fillText(hdr, margin + c*colW + 4*scale, margin + rowH*0.7)
    }

    // Data rows
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const val = String(data[r]?.[c] ?? '')
        ctx.strokeRect(margin + c*colW, margin + (r+1)*rowH, colW, rowH)
        ctx.fillText(val, margin + c*colW + 4*scale, margin + (r+1.7)*rowH)
      }
    }

    // Fit to page
    const pageW = 297, pageH = 210
    const scaleFit = Math.min((pageW-10)/(canvas.width/3.78), (pageH-10)/(canvas.height/3.78))
    const imgW = (canvas.width/3.78)*scaleFit
    const imgH = (canvas.height/3.78)*scaleFit
    doc.addImage(canvas.toDataURL('image/png'), 'PNG', (pageW-imgW)/2, (pageH-imgH)/2, imgW, imgH)
  }

  const blob = doc.output('blob')
  const previewUrls = firstCanvas
    ? [firstCanvas.toDataURL('image/jpeg', 0.7)]
    : undefined
  return { blob, fileName: file.name.replace(/\.xlsx?$/i, '.pdf'), previewUrls }
}

export const excelToPdf: Converter = {
  id: 'excel-to-pdf',
  label: 'Excel → PDF',
  fromExt: 'xlsx',
  toExt: 'pdf',
  acceptExt: '.xlsx,.xls',
  acceptMime: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
  available: true,
  convert,
}
