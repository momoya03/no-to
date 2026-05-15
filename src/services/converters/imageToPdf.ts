import { Converter } from './types'
import { jsPDF } from 'jspdf'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

async function convert(
  file: File,
  onProgress: (msg: string, pct: number) => void,
) {
  onProgress('画像を読み込み中...', 20)
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  const img = await loadImage(dataUrl)

  onProgress('PDFを生成中...', 50)

  // Fit image to A4 landscape
  const pageW = 297, pageH = 210
  const margin = 10
  const maxW = pageW - margin*2, maxH = pageH - margin*2
  const scale = Math.min(maxW / (img.width/3.78), maxH / (img.height/3.78), 1)
  // img.width/height in px; 1mm ≈ 3.78px at 96dpi
  const imgW = (img.width/3.78) * scale
  const imgH = (img.height/3.78) * scale

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  doc.addImage(dataUrl, file.type === 'image/png' ? 'PNG' : 'JPEG',
    (pageW - imgW)/2, (pageH - imgH)/2, imgW, imgH)

  onProgress('完了', 100)
  const blob = doc.output('blob')
  return {
    blob,
    fileName: file.name.replace(/\.(png|jpe?g|gif|webp|bmp)$/i, '.pdf'),
    previewUrls: [dataUrl],
  }
}

export const imageToPdf: Converter = {
  id: 'image-to-pdf',
  label: '画像 → PDF',
  fromExt: 'image',
  toExt: 'pdf',
  acceptExt: '.png,.jpg,.jpeg,.gif,.webp,.bmp',
  acceptMime: ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp'],
  available: true,
  convert,
}
