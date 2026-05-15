import { Converter } from './types'

export const pdfToCad: Converter = {
  id: 'pdf-to-cad',
  label: 'PDF → CAD',
  fromExt: 'pdf',
  toExt: 'dxf',
  acceptExt: '.pdf',
  acceptMime: ['application/pdf'],
  available: false,
  unavailableReason: 'CAD変換には専用ソフトが必要です。LibreOffice等が使える環境でお試しください。',
  convert: async () => { throw new Error('この変換は現在利用できません') },
}
