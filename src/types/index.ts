export interface PDFPage {
  pageNumber: number
  text: string
  isOcr: boolean
  imageData?: string
}

export interface NoteSection {
  id: string
  heading: string
  bullets: string[]
}

export interface StructuredNote {
  title: string
  sections: NoteSection[]
}

export interface NotePage {
  pageNumber: number
  originalContent: string
  noteContent: string
  structuredNote?: StructuredNote
}

export interface NoteDocument {
  id: string
  fileName: string
  totalPages: number
  pages: NotePage[]
  createdAt: Date
}

export interface AppState {
  pdfFile: File | null
  pdfPages: PDFPage[]
  noteDocument: NoteDocument | null
  currentPage: number
  displayMode: 'page' | 'all' | 'outline'
  isProcessing: boolean
  processingProgress: number
  processingStep: string
  error: string | null
}

export type UploadState = 'idle' | 'uploading' | 'processing' | 'success' | 'error'
