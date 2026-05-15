'use client'

import React, { useCallback, useState } from 'react'
import { Upload, File, X, ArrowUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatFileSize } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface FileUploadProps {
  onFileSelect: (file: File) => void
  disabled?: boolean
}

export function FileUpload({ onFileSelect, disabled = false }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    const pdfFile = files.find(f => f.type === 'application/pdf')

    if (pdfFile) {
      setSelectedFile(pdfFile)
      onFileSelect(pdfFile)
    }
  }, [onFileSelect])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file)
      onFileSelect(file)
    }
  }, [onFileSelect])

  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedFile(null)
  }, [])

  return (
    <div className="w-full">
      <Card className={cn(
        "border-2 border-dashed transition-all duration-200 cursor-pointer",
        isDragging ? "border-primary bg-primary/5 scale-[1.02]" : "border-border hover:border-primary/40 hover:bg-muted/30",
        disabled && "opacity-50 cursor-not-allowed"
      )}>
        <CardContent className="p-8">
          {!selectedFile ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className="flex flex-col items-center justify-center text-center"
            >
              <div className="w-20 h-20 mb-5 rounded-2xl bg-primary/10 flex items-center justify-center relative group-hover:bg-primary/20 transition-colors">
                <Upload className="w-9 h-9 text-primary" />
              </div>
              <p className="text-lg font-semibold mb-1">PDFをアップロード</p>
              <p className="text-sm text-muted-foreground mb-5">
                クリックまたはドラッグ＆ドロップ
              </p>
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
                disabled={disabled}
              />
              <Button asChild disabled={disabled} size="lg" className="rounded-full px-6">
                <label htmlFor="file-upload" className="cursor-pointer flex items-center gap-2">
                  <ArrowUp className="h-4 w-4" />
                  ファイルを選択
                </label>
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <File className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold truncate max-w-[200px] sm:max-w-[300px]">
                    {selectedFile.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClear}
                disabled={disabled}
                className="rounded-full"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
