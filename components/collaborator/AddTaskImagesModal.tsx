'use client'

import { useRef, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { FileUpload } from '@/components/ui/file-upload'
import { ImagePlus } from 'lucide-react'

interface AddTaskImagesModalProps {
  token: string
  taskId: string
  onUpdated?: () => void
}

export function AddTaskImagesModal({ token, taskId, onUpdated }: AddTaskImagesModalProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  type UploadFileInfo = {
    id?: string
    originalName: string
    fileName?: string
    filePath: string
    fileSize: number
    fileType: string
    uploadedAt: string
    taskId?: string
    file?: File
  }
  const [files, setFiles] = useState<UploadFileInfo[]>([])
  const fileUploadRef = useRef<{ handleUpload: () => Promise<UploadFileInfo[]> } | null>(null)

  const handleOpen = () => setOpen(true)
  const handleClose = () => setOpen(false)

  const handleSave = async () => {
    if (isLoading) return
    setIsLoading(true)
    try {
      let uploadedFiles = files
      if (fileUploadRef.current && files.some(f => f.file)) {
        uploadedFiles = await fileUploadRef.current.handleUpload()
      }

      const res = await fetch(`/api/collaborator-portal/${token}/tasks/${taskId}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attachments: uploadedFiles })
      })

      if (res.ok) {
        onUpdated?.()
        setFiles([])
        setOpen(false)
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="flex items-center gap-2"
        onClick={handleOpen}
      >
        <ImagePlus className="w-4 h-4" />
        Adicionar Imagens
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Imagens à Tarefa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <FileUpload
              ref={(instance) => {
                fileUploadRef.current = instance as unknown as { handleUpload: () => Promise<UploadFileInfo[]> }
              }}
              taskId={taskId}
              onFilesChange={setFiles}
              maxFiles={5}
              disabled={isLoading}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleClose} disabled={isLoading}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={isLoading || files.length === 0}>
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
