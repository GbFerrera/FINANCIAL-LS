'use client'

import React, { useState, useRef, forwardRef, useImperativeHandle } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Upload, 
  File, 
  Image, 
  FileText, 
  X, 
  Eye,
  Download,
  AlertCircle
} from 'lucide-react'
import { toast } from 'react-hot-toast'

interface FileInfo {
  id: string
  originalName: string
  fileName: string
  filePath: string
  fileSize: number
  fileType: string
  uploadedAt: string
  taskId?: string
  file?: File // Arquivo original para upload posterior
}

interface FileUploadProps {
  taskId?: string
  noteId?: string
  clientId?: string
  userId?: string
  existingFiles?: FileInfo[]
  onFilesChange?: (files: FileInfo[]) => void
  onUploadFiles?: (files: FileInfo[]) => Promise<FileInfo[]>
  maxFiles?: number
  disabled?: boolean
  className?: string
}

export const FileUpload = forwardRef<
  { 
    handleUpload: (taskIdOverride?: string) => Promise<FileInfo[]>
    openFileDialog: () => void
    clearFiles: () => void
  },
  FileUploadProps
>(({ 
  taskId, 
  noteId,
  clientId,
  userId,
  existingFiles = [], 
  onFilesChange, 
  onUploadFiles,
  maxFiles = 5,
  disabled = false,
  className
}, ref) => {
  const [files, setFiles] = useState<FileInfo[]>(existingFiles)
  const filesRef = useRef<FileInfo[]>(existingFiles)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Função para processar arquivos (seleção ou colagem)
  const processFiles = (fileList: File[], source: 'select' | 'paste' = 'select') => {
    if (fileList.length === 0) return

    // Verificar limite de arquivos
    if (filesRef.current.length + fileList.length > maxFiles) {
      toast.error(`Máximo ${maxFiles} arquivos permitidos`)
      return
    }

    // Apenas criar preview dos arquivos, não fazer upload ainda
    const previewFiles: FileInfo[] = []

    fileList.forEach((file, index) => {
      // Validar tipo de arquivo
      const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/jpg', 
        'image/png',
        'image/gif',
        'image/webp'
      ]

      if (!allowedTypes.includes(file.type)) {
        toast.error(`Tipo de arquivo não permitido: ${file.name}`)
        return
      }

      // Validar tamanho
      if (file.size > 10 * 1024 * 1024) { // 10MB
        toast.error(`Arquivo muito grande: ${file.name}`)
        return
      }

      // Criar preview do arquivo
      const previewFile: FileInfo = {
        id: `preview-${Date.now()}-${Math.random()}-${index}`,
        originalName: file.name || `${source === 'paste' ? 'Screenshot' : 'Arquivo'}-${Date.now()}.${file.type.split('/')[1]}`,
        fileName: file.name || `screenshot-${Date.now()}.${file.type.split('/')[1]}`,
        filePath: URL.createObjectURL(file), // URL temporária para preview
        fileSize: file.size,
        fileType: file.type,
        uploadedAt: new Date().toISOString(),
        taskId: taskId,
        file: file // Guardar o arquivo original para upload posterior
      }

      previewFiles.push(previewFile)
    })

    // Atualizar lista com previews
    const newFiles = [...filesRef.current, ...previewFiles]
    setFiles(newFiles)
    filesRef.current = newFiles
    onFilesChange?.(newFiles)

    if (source === 'paste' && previewFiles.length > 0) {
      toast.success(`${previewFiles.length} imagem(ns) colada(s) com sucesso!`)
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || [])
    processFiles(selectedFiles, 'select')

    // Limpar input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Handler para colar imagens
  const handlePaste = (event: React.ClipboardEvent) => {
    if (disabled || uploading) return

    const clipboardItems = event.clipboardData?.items
    if (!clipboardItems) return

    const imageFiles: File[] = []

    // Procurar por imagens no clipboard
    for (let i = 0; i < clipboardItems.length; i++) {
      const item = clipboardItems[i]
      
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) {
          imageFiles.push(file)
        }
      }
    }

    if (imageFiles.length > 0) {
      event.preventDefault()
      processFiles(imageFiles, 'paste')
    }
  }

  // Adicionar event listener para paste quando o componente montar
  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleGlobalPaste = (event: ClipboardEvent) => {
      // Verificar se o container está focado ou se o mouse está sobre ele
      if (container.contains(document.activeElement) || container.matches(':hover')) {
        const clipboardItems = event.clipboardData?.items
        if (!clipboardItems) return

        const imageFiles: File[] = []

        for (let i = 0; i < clipboardItems.length; i++) {
          const item = clipboardItems[i]
          
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile()
            if (file) {
              imageFiles.push(file)
            }
          }
        }

        if (imageFiles.length > 0) {
          event.preventDefault()
          processFiles(imageFiles, 'paste')
        }
      }
    }

    document.addEventListener('paste', handleGlobalPaste)
    return () => document.removeEventListener('paste', handleGlobalPaste)
  }, [disabled, uploading, maxFiles]) // Removed files.length dependency as we use filesRef

  const removeFile = (fileId: string) => {
    const fileToRemove = filesRef.current.find(f => f.id === fileId)
    if (fileToRemove?.filePath.startsWith('blob:')) {
      // Liberar URL temporária se for preview
      URL.revokeObjectURL(fileToRemove.filePath)
    }
    const newFiles = filesRef.current.filter(f => f.id !== fileId)
    setFiles(newFiles)
    filesRef.current = newFiles
    onFilesChange?.(newFiles)
  }

  // Função para fazer upload dos arquivos (será chamada externamente)
  const uploadFiles = async (overrideTaskId?: string): Promise<FileInfo[]> => {
    const filesToUpload = filesRef.current.filter(f => f.file) // Apenas arquivos com preview
    if (filesToUpload.length === 0) return filesRef.current

    setUploading(true)
    setUploadProgress(0)

    try {
      const uploadedFiles: FileInfo[] = []

      for (let i = 0; i < filesToUpload.length; i++) {
        const fileInfo = filesToUpload[i]
        const file = fileInfo.file!
        
        setUploadProgress(((i + 1) / filesToUpload.length) * 100)

        const formData = new FormData()
        formData.append('file', file)
        const finalId = overrideTaskId || taskId || noteId || clientId || userId
        if (finalId) {
          let key: 'taskId' | 'noteId' | 'clientId' | 'userId' = 'taskId'
          if (userId) {
            key = 'userId'
          } else if (clientId) {
            key = 'clientId'
          } else if (noteId && !taskId) {
            key = 'noteId'
          }
          formData.append(key, finalId)
        }

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        })

        const result = await response.json()

        if (response.ok) {
          // Liberar URL temporária
          URL.revokeObjectURL(fileInfo.filePath)
          uploadedFiles.push(result.file)
        } else {
          throw new Error(result.error || 'Erro no upload')
        }
      }

      // Manter arquivos já enviados + novos enviados
      const finalFiles = [
        ...filesRef.current.filter(f => !f.file), // Arquivos já enviados
        ...uploadedFiles // Novos arquivos enviados
      ]

      setFiles(finalFiles)
      filesRef.current = finalFiles
      onFilesChange?.(finalFiles)
      return finalFiles

    } catch (error) {
      console.error('Erro no upload:', error)
      throw error
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  // Função pública para fazer upload (será chamada externamente)
  const handleUpload = async (taskIdOverride?: string) => {
    return await uploadFiles(taskIdOverride)
  }

  // Expor função através de ref
  useImperativeHandle(ref, () => ({
    handleUpload,
    openFileDialog: () => fileInputRef.current?.click(),
    clearFiles: () => {
      setFiles([])
      filesRef.current = []
      onFilesChange?.([])
    }
  }))

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <Image className="w-4 h-4 text-primary" />
    } else if (fileType === 'application/pdf') {
      return <FileText className="w-4 h-4 text-destructive" />
    }
    return <File className="w-4 h-4 text-muted-foreground" />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getFileTypeLabel = (fileType: string) => {
    if (fileType.startsWith('image/')) return 'Imagem'
    if (fileType === 'application/pdf') return 'PDF'
    return 'Arquivo'
  }

  return (
    <div 
      ref={containerRef}
      className={`space-y-3 ${className || ''}`}
      tabIndex={0}
      onPaste={handlePaste}
    >
      <div className="border border-dashed border-input rounded-md p-3 text-center hover:border-primary/40 transition-colors bg-background">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled || uploading}
        />
        
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-3">
            <Upload className="w-4 h-4 text-muted-foreground" />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || uploading || files.length >= maxFiles}
            >
              {uploading ? 'Enviando...' : 'Adicionar Arquivos'}
            </Button>
            <span className="text-xs text-muted-foreground">
              {files.length}/{maxFiles}
            </span>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            ou pressione <kbd className="px-1 py-0.5 bg-muted border border-input rounded text-xs">
              {typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac') ? 'Cmd+V' : 'Ctrl+V'}
            </kbd> para colar screenshot
          </p>
        </div>

        {uploading && (
          <div className="mt-2">
            <Progress value={uploadProgress} className="w-full h-1" />
            <p className="text-xs text-muted-foreground mt-1">
              {Math.round(uploadProgress)}%
            </p>
          </div>
        )}
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-foreground">
            Anexos ({files.length})
          </h4>
          
          <div className="space-y-1 max-h-32 overflow-y-auto border border-border rounded p-1 bg-card">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-2 bg-card rounded border border-input text-xs"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {getFileIcon(file.fileType)}
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {file.originalName}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{getFileTypeLabel(file.fileType)}</span>
                      <span>•</span>
                      <span>{formatFileSize(file.fileSize)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {file.fileType.startsWith('image/') && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => {
                        // Se é preview (blob URL), abrir diretamente
                        if (file.filePath.startsWith('blob:')) {
                          window.open(file.filePath, '_blank')
                        } else {
                          // Se é arquivo já enviado, usar API
                          window.open(`/api/files/${file.filePath}`, '_blank')
                        }
                      }}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => {
                      const link = document.createElement('a')
                      
                      // Se é preview (blob URL), baixar diretamente
                      if (file.filePath.startsWith('blob:')) {
                        link.href = file.filePath
                      } else {
                        // Se é arquivo já enviado, usar API
                        link.href = `/api/files/${file.filePath}`
                      }
                      
                      link.download = file.originalName
                      link.click()
                    }}
                  >
                    <Download className="w-4 h-4" />
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => removeFile(file.id)}
                    disabled={disabled}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {files.length >= maxFiles && (
        <div className="flex items-center gap-2 p-3 bg-muted/20 border border-border rounded-lg">
          <AlertCircle className="w-4 h-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Limite máximo de {maxFiles} arquivos atingido
          </p>
        </div>
      )}
    </div>
  )
})

FileUpload.displayName = 'FileUpload'
