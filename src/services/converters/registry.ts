import { Converter } from './types'
import { pdfToWord } from './pdfToWord'
import { wordToPdf } from './wordToPdf'
import { pdfToPpt } from './pdfToPpt'
import { pptToPdf } from './pptToPdf'
import { pdfToExcel } from './pdfToExcel'
import { excelToPdf } from './excelToPdf'
import { pdfToImage } from './pdfToImage'
import { imageToPdf } from './imageToPdf'
import { pdfToCad } from './pdfToCad'
import { cadToPdf } from './cadToPdf'

export const ALL_CONVERTERS: Converter[] = [
  pdfToWord,
  wordToPdf,
  pdfToPpt,
  pptToPdf,
  pdfToExcel,
  excelToPdf,
  pdfToImage,
  imageToPdf,
  pdfToCad,
  cadToPdf,
]

export function findConverter(from: string, to: string): Converter | undefined {
  return ALL_CONVERTERS.find(c => c.fromExt === from && c.toExt === to)
}
