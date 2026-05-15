'use client'

import React, { useCallback, useState } from 'react'
import { Upload, File, X } from 'lucide-react'
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
        "border-2 border-dashed transition-all duration-200",
        isDragging ? "border-primary bg-primary/5 scale-[1.02]" : "border-border hover:border-primary/30 hover:bg-muted/20",
        disabled && "opacity-50 cursor-not-allowed"
      )}>
        <CardContent className="p-0">
          {!selectedFile ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className="flex flex-col items-center justify-center text-center"
            >
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
                disabled={disabled}
              />

              {/* Full-area clickable upload button */}
              <label
                htmlFor="file-upload"
                className="cursor-pointer w-full flex flex-col items-center py-12 px-6"
              >
                <div className="w-24 h-24 mb-5 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                  <Upload className="w-11 h-11 text-primary" />
                </div>
                <div className="bg-primary text-primary-foreground rounded-full px-8 py-3.5 text-base font-bold inline-flex items-center gap-2.5 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:scale-105 transition-all active:scale-95">
                  <Upload className="h-5 w-5" />
                  PDF を選択
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  ドラッグ＆ドロップでも追加できます
                </p>
              </label>
            </div>
          ) : (
            <div className="flex items-center justify-between p-6">
              <div className="flex items-center gap-4">
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
