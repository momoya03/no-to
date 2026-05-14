import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file || file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'PDFファイルが必要です' }, { status: 400 })
    }

    if (file.size > 30 * 1024 * 1024) {
      return NextResponse.json({ error: 'ファイルサイズは30MB以下にしてください' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)

    // pdfjs-dist legacy build for Node.js
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')

    const pdf = await getDocument({
      data: uint8Array,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    }).promise

    const pages = []
    const totalPages = pdf.numPages

    for (let i = 1; i <= totalPages; i++) {
      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()
      const text = textContent.items
        .map((item: any) => item.str || '')
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()

      pages.push({
        pageNumber: i,
        text,
        isOcr: text.length === 0,
      })

      // Free memory for large PDFs
      page.cleanup()
    }

    return NextResponse.json({ pages })
  } catch (error: any) {
    console.error('PDF extraction error:', error)
    return NextResponse.json(
      { error: error?.message || 'PDFの処理に失敗しました' },
      { status: 500 }
    )
  }
}
