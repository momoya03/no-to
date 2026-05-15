import { Converter } from './types'
import { renderPPTX } from '@/services/pptxRenderer'
import { jsPDF } from 'jspdf'

async function convert(
  file: File,
  onProgress: (msg: string, pct: number) => void,
) {
  // Preview at low res
  onProgress('解析中...', 10)
  const slides = await renderPPTX(file, 0.7, (s, t) => {
    onProgress(`スライド解析 ${s}/${t}`, 10 + Math.round((s/t) * 20))
  })

  // Re-render at high res for PDF
  onProgress('高解像度レンダリング中...', 30)
  const hiRes = await renderPPTX(file, 2.0, (s, t) => {
    onProgress(`レンダリング ${s}/${t}`, 30 + Math.round((s/t) * 60))
  })

  onProgress('PDF生成中...', 90)
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  for (let i = 0; i < hiRes.length; i++) {
    if (i > 0) doc.addPage()
    doc.addImage(hiRes[i].canvas.toDataURL('image/png'), 'PNG', 0, 0, 297, 210)
  }

  const previewUrls = slides.map(s => s.dataUrl)
  const blob = doc.output('blob')
  return { blob, fileName: file.name.replace(/\.pptx?$/i, '.pdf'), previewUrls }
}

export const pptToPdf: Converter = {
  id: 'pptx-to-pdf',
  label: 'PPT → PDF',
  fromExt: 'pptx',
  toExt: 'pdf',
  acceptExt: '.pptx',
  acceptMime: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  available: true,
  convert,
}
