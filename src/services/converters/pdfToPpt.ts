import { Converter } from './types'
import JSZip from 'jszip'

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

  const zip = new JSZip()
  const previewUrls: string[] = []

  // PPTX template structure
  const slideW = 12192000  // EMU for 16:9
  const slideH = 6858000

  // [Content_Types].xml
  let contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
  contentTypes += '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n'
  contentTypes += '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\n'
  contentTypes += '<Default Extension="xml" ContentType="application/xml"/>\n'
  for (let i = 1; i <= totalPages; i++) {
    contentTypes += `<Override PartName="/ppt/slides/slide${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>\n`
    contentTypes += `<Override PartName="/ppt/media/image${i}.png" ContentType="image/png"/>\n`
  }
  contentTypes += '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation+xml"/>\n'
  contentTypes += '</Types>'
  zip.file('[Content_Types].xml', contentTypes)

  // _rels/.rels
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`)

  // ppt/_rels/presentation.xml.rels
  let presRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
  presRels += '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n'
  for (let i = 1; i <= totalPages; i++) {
    presRels += `<Relationship Id="rId${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i}.xml"/>\n`
  }
  presRels += '</Relationships>'
  zip.file('ppt/_rels/presentation.xml.rels', presRels)

  // ppt/presentation.xml
  let presXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
  presXml += '<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">\n'
  presXml += `<p:sldIdLst>\n`
  for (let i = 1; i <= totalPages; i++) {
    presXml += `<p:sldId id="256${i}" r:id="rId${i}"/>\n`
  }
  presXml += `</p:sldIdLst>\n`
  presXml += `<p:sldSz cx="${slideW}" cy="${slideH}"/>\n`
  presXml += '</p:presentation>'
  zip.file('ppt/presentation.xml', presXml)

  // Render each PDF page as PNG image
  for (let i = 1; i <= totalPages; i++) {
    onProgress(`ページ ${i}/${totalPages} をレンダリング中`, Math.round((i/totalPages)*90))
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 2.0 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')!
    await page.render({ canvasContext: ctx, viewport }).promise

    const imgBase64 = canvas.toDataURL('image/png').split(',')[1]
    zip.file(`ppt/media/image${i}.png`, imgBase64, { base64: true })

    // Slide XML with image
    const scaleEmu = Math.min(slideW / viewport.width, slideH / viewport.height)
    const imgW = Math.round(viewport.width * scaleEmu)
    const imgH = Math.round(viewport.height * scaleEmu)
    const offX = Math.round((slideW - imgW) / 2)
    const offY = Math.round((slideH - imgH) / 2)

    const slideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
       xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:pic>
        <p:nvPicPr>
          <p:cNvPr id="${i}" name="Page ${i}"/>
          <p:cNvPicPr/>
        </p:nvPicPr>
        <p:blipFill>
          <a:blip r:embed="rId1"/>
          <a:stretch><a:fillRect/></a:stretch>
        </p:blipFill>
        <p:spPr>
          <a:xfrm>
            <a:off x="${offX}" y="${offY}"/>
            <a:ext cx="${imgW}" cy="${imgH}"/>
          </a:xfrm>
        </p:spPr>
      </p:pic>
    </p:spTree>
  </p:cSld>
</p:sld>`
    zip.file(`ppt/slides/slide${i}.xml`, slideXml)

    // Slide rels
    zip.file(`ppt/slides/_rels/slide${i}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${i}.png"/>
</Relationships>`)

    if (i <= 3) previewUrls.push(canvas.toDataURL('image/jpeg', 0.7))
  }

  onProgress('PPTXを作成中...', 95)
  const blob = await zip.generateAsync({ type: 'blob' })
  return { blob, fileName: file.name.replace(/\.pdf$/i, '.pptx'), previewUrls }
}

export const pdfToPpt: Converter = {
  id: 'pdf-to-ppt',
  label: 'PDF → PPT',
  fromExt: 'pdf',
  toExt: 'pptx',
  acceptExt: '.pdf',
  acceptMime: ['application/pdf'],
  available: true,
  convert,
}
