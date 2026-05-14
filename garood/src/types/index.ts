export interface PDFPage {
  pageNumber: number
  text: string
  isOcr: boolean
  imageData?: string
}

export interface NotePage {
  pageNumber: number
  originalContent: string
  noteContent: string
}

export interface NoteDocument {
  id: string
  fileName: string
  totalPages: number
  pages: NotePage[]
  createdAt: Date
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export interface AIProviderConfig {
  provider: 'openai' | 'gemini' | 'claude'
  apiKey: string
  model: string
}

export interface AppState {
  pdfFile: File | null
  pdfPages: PDFPage[]
  noteDocument: NoteDocument | null
  currentPage: number
  viewMode: 'detailed' | 'exam'
  displayMode: 'page' | 'all'
  isProcessing: boolean
  processingProgress: number
  processingStep: string
  messages: Message[]
  isAIProcessing: boolean
  error: string | null
}

export type UploadState = 'idle' | 'uploading' | 'processing' | 'success' | 'error'
