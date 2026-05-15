import JSZip from 'jszip'

function extractTextFromSlideXml(xml: string): string {
  const matches = xml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g)
  if (!matches) return ''
  return matches
    .map(m => m.replace(/<a:t[^>]*>/, '').replace(/<\/a:t>/, ''))
    .filter(Boolean)
    .join(' ')
}

export async function extractPPTXText(
  file: File,
  onProgress?: (slide: number, total: number) => void
): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(arrayBuffer)

  const slideFiles = Object.keys(zip.files)
    .filter(name => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)/i)?.[1] || '0')
      const nb = parseInt(b.match(/slide(\d+)/i)?.[1] || '0')
      return na - nb
    })

  if (slideFiles.length === 0) {
    throw new Error('PPTXファイルからスライドが見つかりませんでした')
  }

  const parts: string[] = []
  for (let i = 0; i < slideFiles.length; i++) {
    const xml = await zip.file(slideFiles[i])?.async('string') || ''
    const text = extractTextFromSlideXml(xml).trim()
    if (text) {
      parts.push(`--- Slide ${i + 1} ---\n${text}`)
    }
    onProgress?.(i + 1, slideFiles.length)
  }

  const result = parts.join('\n\n').trim()
  if (!result) {
    throw new Error('PPTXファイルからテキストを抽出できませんでした')
  }

  return result
}
