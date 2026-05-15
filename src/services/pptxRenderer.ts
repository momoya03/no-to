import JSZip from 'jszip'

interface SlideElement {
  type: 'text' | 'image'
  x: number; y: number; w: number; h: number
  text?: string
  imageUrl?: string
  fontSize?: number   // in pt
  bold?: boolean
  color?: string
}

interface SlideData {
  elements: SlideElement[]
  width: number   // EMU
  height: number  // EMU
}

// EMU to px at given DPI (default 96)
function emuToPx(emu: number, scale: number = 1): number {
  return (emu / 9525) * scale
}

// Parse slide XML → array of positioned elements
async function parseSlide(
  slideXml: string,
  relsXml: string,
  zip: JSZip,
): Promise<SlideData> {
  const parser = new DOMParser()
  const slideDoc = parser.parseFromString(slideXml, 'text/xml')
  const relsDoc = parser.parseFromString(relsXml, 'text/xml')

  // Slide dimensions
  const sldSz = slideDoc.querySelector('p\\:sldSz, sldSz')
  const sw = parseInt(sldSz?.getAttribute('cx') || '12192000')
  const sh = parseInt(sldSz?.getAttribute('cy') || '6858000')

  // Build relationship map: rId → target path
  const relMap = new Map<string, string>()
  relsDoc.querySelectorAll('Relationship').forEach(rel => {
    const id = rel.getAttribute('Id')
    const target = rel.getAttribute('Target')
    if (id && target) relMap.set(id, target)
  })

  const elements: SlideElement[] = []

  // Process shapes (p:sp) — text boxes
  const shapes = slideDoc.querySelectorAll('p\\:sp, sp')
  shapes.forEach(shape => {
    const xfrm = shape.querySelector('a\\:xfrm, xfrm')
    if (!xfrm) return

    const off = xfrm.querySelector('a\\:off, off')
    const ext = xfrm.querySelector('a\\:ext, ext')
    if (!off || !ext) return

    const x = parseInt(off.getAttribute('x') || '0')
    const y = parseInt(off.getAttribute('y') || '0')
    const w = parseInt(ext.getAttribute('cx') || '0')
    const h = parseInt(ext.getAttribute('cy') || '0')

    // Extract text runs
    const runs = shape.querySelectorAll('a\\:r, r')
    const textParts: string[] = []
    let fontSize = 12
    let bold = false
    let color = '#000'

    runs.forEach(run => {
      const rPr = run.querySelector('a\\:rPr, rPr')
      if (rPr) {
        const sz = rPr.getAttribute('sz')
        if (sz) fontSize = parseInt(sz) / 100
        if (rPr.getAttribute('b') === '1') bold = true
        const srgb = rPr.querySelector('a\\:solidFill a\\:srgbClr, solidFill srgbClr')
        if (srgb) {
          const val = srgb.getAttribute('val')
          if (val) color = `#${val}`
        }
      }
      const t = run.querySelector('a\\:t, t')
      if (t?.textContent) textParts.push(t.textContent)
    })

    const text = textParts.join('')
    if (text.trim()) {
      elements.push({ type: 'text', x, y, w, h, text, fontSize, bold, color })
    }
  })

  // Process pictures (p:pic)
  const pics = slideDoc.querySelectorAll('p\\:pic, pic')
  for (const pic of pics) {
    const xfrm = pic.querySelector('a\\:xfrm, xfrm')
    if (!xfrm) continue
    const off = xfrm.querySelector('a\\:off, off')
    const ext = xfrm.querySelector('a\\:ext, ext')
    if (!off || !ext) continue

    const x = parseInt(off.getAttribute('x') || '0')
    const y = parseInt(off.getAttribute('y') || '0')
    const w = parseInt(ext.getAttribute('cx') || '0')
    const h = parseInt(ext.getAttribute('cy') || '0')

    // Find image reference
    const blip = pic.querySelector('a\\:blip, blip')
    const embedId = blip?.getAttribute('r:embed') || blip?.getAttribute('embed')
    if (!embedId || !relMap.has(embedId)) continue

    const relPath = relMap.get(embedId)!
    // Resolve relative path: "../media/image1.png" → "ppt/media/image1.png"
    const parts = relPath.split('/')
    const mediaPath = 'ppt/media/' + parts[parts.length - 1]

    try {
      const imgFile = zip.file(mediaPath)
      if (imgFile) {
        const imgData = await imgFile.async('base64')
        const ext = mediaPath.split('.').pop()?.toLowerCase()
        const mime = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png'
        const imageUrl = `data:${mime};base64,${imgData}`
        elements.push({ type: 'image', x, y, w, h, imageUrl })
      }
    } catch {
      // image not found, skip
    }
  }

  return { elements, width: sw, height: sh }
}

// Render a slide to canvas, return data URL
async function renderSlideToCanvas(
  data: SlideData,
  scale: number, // e.g. 0.5 for preview, 1.5 for PDF
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas')
  const w = emuToPx(data.width, scale)
  const h = emuToPx(data.height, scale)
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!

  // White background
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)

  // Draw images first (behind text)
  for (const el of data.elements) {
    if (el.type !== 'image' || !el.imageUrl) continue
    try {
      const img = await loadImage(el.imageUrl)
      ctx.drawImage(
        img,
        emuToPx(el.x, scale), emuToPx(el.y, scale),
        emuToPx(el.w, scale), emuToPx(el.h, scale),
      )
    } catch { /* skip broken images */ }
  }

  // Draw text
  for (const el of data.elements) {
    if (el.type !== 'text' || !el.text) continue
    const tx = emuToPx(el.x, scale)
    const ty = emuToPx(el.y, scale)
    const tw = emuToPx(el.w, scale)
    const fontSize = Math.max(6, (el.fontSize || 12) * scale)

    ctx.fillStyle = el.color || '#000'
    const fontWeight = el.bold ? 'bold  ' : ''
    ctx.font = `${fontWeight}${fontSize}px "Hiragino Sans", "Noto Sans JP", "Yu Gothic", sans-serif`

    // Word wrap within shape bounds
    const lines = wrapText(ctx, el.text, tw)
    const lineH = fontSize * 1.4
    lines.forEach((line, i) => {
      ctx.fillText(line, tx, ty + (i + 1) * lineH)
    })
  }

  return canvas
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    let line = ''
    for (const char of paragraph) {
      const test = line + char
      if (ctx.measureText(test).width > maxW && line.length > 0) {
        lines.push(line)
        line = char
      } else {
        line = test
      }
    }
    if (line) lines.push(line)
  }
  return lines
}

// ── Public API ──

export interface RenderedSlide {
  canvas: HTMLCanvasElement
  dataUrl: string
}

export async function renderPPTX(
  file: File,
  scale: number,
  onProgress?: (slide: number, total: number) => void,
): Promise<RenderedSlide[]> {
  const arrayBuffer = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(arrayBuffer)

  // Find slide files
  const slideNames = Object.keys(zip.files)
    .filter(name => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)/i)?.[1] || '0')
      const nb = parseInt(b.match(/slide(\d+)/i)?.[1] || '0')
      return na - nb
    })

  const results: RenderedSlide[] = []

  for (let i = 0; i < slideNames.length; i++) {
    const slideXml = await zip.file(slideNames[i])?.async('string') || ''

    // Corresponding rels file
    const num = slideNames[i].match(/slide(\d+)/i)?.[1] || ''
    const relsPath = `ppt/slides/_rels/slide${num}.xml.rels`
    const relsXml = await zip.file(relsPath)?.async('string') || ''

    const data = await parseSlide(slideXml, relsXml, zip)
    const canvas = await renderSlideToCanvas(data, scale)

    results.push({ canvas, dataUrl: canvas.toDataURL('image/jpeg', 0.9) })

    onProgress?.(i + 1, slideNames.length)
  }

  return results
}
