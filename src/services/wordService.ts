import mammoth from 'mammoth'

export async function extractWordText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  const text = result.value.trim()

  if (!text) {
    throw new Error('Wordファイルからテキストを抽出できませんでした')
  }

  return text
}
