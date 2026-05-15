import { Converter } from './types'
import JSZip from 'jszip'

async function convert(
  file: File,
  onProgress: (msg: string, pct: number) => void,
) {
  onProgress('PDFを解析中...', 5)

  // Use pdfjs-dist to render pages
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const totalPages = pdf.numPages

  const zip = new JSZip()
  const previewUrls: string[] = []

  for (let i = 1; i <= totalPages; i++) {
    onProgress(`ページ ${i}/${totalPages} をレンダリング中`, Math.round((i/totalPages)*95))
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 2.0 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')!
    await page.render({ canvasContext: ctx, viewport }).promise

    const dataUrl = canvas.toDataURL('image/png')
    const base64 = dataUrl.split(',')[1]
    zip.file(`page_${String(i).padStart(3,'0')}.png`, base64, { base64: true })

    // Low-res preview (avoid memory crash for large PDFs)
    const pvCanvas = document.createElement('canvas')
    const pvScale = Math.min(400 / canvas.width, 300 / canvas.height)
    pvCanvas.width = canvas.width * pvScale
    pvCanvas.height = canvas.height * pvScale
    pvCanvas.getContext('2d')!.drawImage(canvas, 0, 0, pvCanvas.width, pvCanvas.height)
    previewUrls.push(pvCanvas.toDataURL('image/jpeg', 0.6))
  }

  onProgress('ZIPを作成中...', 97)
  const blob = await zip.generateAsync({ type: 'blob' })
  return {
    blob,
    fileName: file.name.replace(/\.pdf$/i, '_images.zip'),
    previewUrls,
  }
}

export const pdfToImage: Converter = {
  id: 'pdf-to-image',
  label: 'PDF → 画像',
  fromExt: 'pdf',
  toExt: 'image',
  acceptExt: '.pdf',
  acceptMime: ['application/pdf'],
  available: true,
  convert,
}
