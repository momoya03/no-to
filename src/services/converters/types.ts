export interface ConvertResult {
  blob: Blob
  fileName: string
  previewUrls?: string[]
}

export interface Converter {
  id: string
  label: string
  fromExt: string
  toExt: string
  acceptExt: string
  acceptMime: string[]
  available: boolean
  unavailableReason?: string
  convert: (
    file: File,
    onProgress: (msg: string, pct: number) => void,
  ) => Promise<ConvertResult>
}
