import { Converter } from './types'

export const cadToPdf: Converter = {
  id: 'cad-to-pdf',
  label: 'CAD → PDF',
  fromExt: 'dxf',
  toExt: 'pdf',
  acceptExt: '.dxf,.dwg',
  acceptMime: ['application/dxf', 'image/vnd.dwg'],
  available: false,
  unavailableReason: 'CAD変換には専用ソフトが必要です。LibreOffice等が使える環境でお試しください。',
  convert: async () => { throw new Error('この変換は現在利用できません') },
}
