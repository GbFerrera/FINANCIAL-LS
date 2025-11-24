'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Upload,
  File,
  Folder,
  Download,
  Trash2,
  Eye,
  Edit,
  Share,
  Clock,
  User,
  Calendar,
  Search,
  Filter,
  Plus,
  FolderPlus,
  Image,
  FileText,
  Archive,
  Video,
  Music
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import toast from 'react-hot-toast'
import { parseISO } from 'date-fns'

interface FileItem {
  id: string
  name: string
  type: 'file' | 'folder'
  size?: number
  mimeType?: string
  url?: string
  uploadedBy: string
  uploadedAt: string
  lastModified: string
  projectId?: string
  projectName?: string
  versions?: FileVersion[]
  shared: boolean
  permissions: string[]
}

interface FileVersion {
  id: string
  version: number
  uploadedBy: string
  uploadedAt: string
  size: number
  comment?: string
}

export default function FilesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<FileItem[]>([])
  const [currentPath, setCurrentPath] = useState('/')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null)
  const [showFileDetails, setShowFileDetails] = useState(false)

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/auth/signin')
      return
    }
    fetchFiles()
  }, [session, status, router, currentPath])

  const fetchFiles = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        path: currentPath,
        type: filterType
      })
      
      const response = await fetch(`/api/files?${params}`)
      
      if (!response.ok) {
        throw new Error('Falha ao carregar arquivos')
      }
      
      const data = await response.json()
      setFiles(data.files)
    } catch (error) {
      console.error('Erro ao carregar arquivos:', error)
      toast.error('Erro ao carregar arquivos')
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files
    if (!selectedFiles || selectedFiles.length === 0) return

    setUploading(true)
    try {
      for (const file of Array.from(selectedFiles)) {
        // Simular upload
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        const newFile: FileItem = {
          id: `file_${Date.now()}_${Math.random()}`,
          name: file.name,
          type: 'file',
          size: file.size,
          mimeType: file.type,
          url: `/files/${file.name}`,
          uploadedBy: session?.user?.name || 'Usuário',
          uploadedAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          shared: false,
          permissions: ['read', 'write'],
          versions: [
            {
              id: 'v1',
              version: 1,
              uploadedBy: session?.user?.name || 'Usuário',
              uploadedAt: new Date().toISOString(),
              size: file.size,
              comment: 'Upload inicial'
            }
          ]
        }
        
        setFiles(prev => [newFile, ...prev])
      }
      
      alert('Arquivos enviados com sucesso!')
    } catch (error) {
      console.error('Erro no upload:', error)
      alert('Erro ao enviar arquivos')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return
    
    const newFolder: FileItem = {
      id: `folder_${Date.now()}`,
      name: newFolderName,
      type: 'folder',
      uploadedBy: session?.user?.name || 'Usuário',
      uploadedAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      shared: false,
      permissions: ['read', 'write']
    }
    
    setFiles(prev => [newFolder, ...prev])
    setNewFolderName('')
    setShowCreateFolder(false)
  }

  const handleDeleteFile = async (fileId: string) => {
    if (confirm('Tem certeza que deseja excluir este item?')) {
      setFiles(prev => prev.filter(file => file.id !== fileId))
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getFileIcon = (file: FileItem) => {
    if (file.type === 'folder') {
      return <Folder className="h-8 w-8 text-blue-500" />
    }
    
    if (file.mimeType?.startsWith('image/')) {
      return <Image className="h-8 w-8 text-green-500" />
    } else if (file.mimeType?.startsWith('video/')) {
      return <Video className="h-8 w-8 text-red-500" />
    } else if (file.mimeType?.startsWith('audio/')) {
      return <Music className="h-8 w-8 text-purple-500" />
    } else if (file.mimeType?.includes('pdf')) {
      return <FileText className="h-8 w-8 text-red-600" />
    } else if (file.mimeType?.includes('zip') || file.mimeType?.includes('rar')) {
      return <Archive className="h-8 w-8 text-yellow-600" />
    } else {
      return <File className="h-8 w-8 text-gray-500" />
    }
  }

  const filteredFiles = files.filter(file => {
    const matchesSearch = file.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = filterType === 'all' || 
      (filterType === 'folders' && file.type === 'folder') ||
      (filterType === 'images' && file.mimeType?.startsWith('image/')) ||
      (filterType === 'documents' && (file.mimeType?.includes('pdf') || file.mimeType?.includes('doc'))) ||
      (filterType === 'shared' && file.shared)
    
    return matchesSearch && matchesFilter
  })

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gerenciamento de Arquivos</h1>
            <p className="text-gray-600">Organize, compartilhe e controle versões dos seus arquivos</p>
          </div>
          
          <div className="flex space-x-2">
            <button
              onClick={() => setShowCreateFolder(true)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <FolderPlus className="h-4 w-4 mr-2" />
              Nova Pasta
            </button>
            
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? 'Enviando...' : 'Upload'}
            </button>
            
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </div>

        {/* Filtros e Busca */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar arquivos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">Todos os arquivos</option>
            <option value="folders">Pastas</option>
            <option value="images">Imagens</option>
            <option value="documents">Documentos</option>
            <option value="shared">Compartilhados</option>
          </select>
          
          <div className="flex border border-gray-300 rounded-md">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-2 text-sm font-medium ${
                viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Grade
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-2 text-sm font-medium border-l border-gray-300 ${
                viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Lista
            </button>
          </div>
        </div>

        {/* Lista/Grade de Arquivos */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {filteredFiles.map((file) => (
              <div
                key={file.id}
                className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => {
                  setSelectedFile(file)
                  setShowFileDetails(true)
                }}
              >
                <div className="flex flex-col items-center text-center">
                  {getFileIcon(file)}
                  <h3 className="mt-2 text-sm font-medium text-gray-900 truncate w-full" title={file.name}>
                    {file.name}
                  </h3>
                  {file.size && (
                    <p className="text-xs text-gray-500 mt-1">{formatFileSize(file.size)}</p>
                  )}
                  <div className="flex items-center mt-2 space-x-1">
                    {file.shared && <Share className="h-3 w-3 text-blue-500" />}
                    {file.versions && file.versions.length > 1 && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-1 rounded">
                        v{file.versions.length}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {filteredFiles.map((file) => (
                <li key={file.id}>
                  <div className="px-4 py-4 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-center">
                      {getFileIcon(file)}
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900">{file.name}</p>
                        <div className="flex items-center text-sm text-gray-500 space-x-4">
                          <span className="flex items-center">
                            <User className="h-3 w-3 mr-1" />
                            {file.uploadedBy}
                          </span>
                          <span className="flex items-center">
                            <Calendar className="h-3 w-3 mr-1" />
                            {parseISO(file.uploadedAt).toLocaleDateString('pt-BR')}
                          </span>
                          {file.size && (
                            <span>{formatFileSize(file.size)}</span>
                          )}
                          {file.projectName && (
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                              {file.projectName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {file.shared && <Share className="h-4 w-4 text-blue-500" />}
                      {file.versions && file.versions.length > 1 && (
                        <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">
                          {file.versions.length} versões
                        </span>
                      )}
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedFile(file)
                          setShowFileDetails(true)
                        }}
                        className="p-1 text-gray-400 hover:text-gray-600"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      
                      {file.url && (
                        <a
                          href={file.url}
                          download
                          onClick={(e) => e.stopPropagation()}
                          className="p-1 text-gray-400 hover:text-gray-600"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      )}
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteFile(file.id)
                        }}
                        className="p-1 text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {filteredFiles.length === 0 && (
          <div className="text-center py-12">
            <File className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum arquivo encontrado</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm ? 'Tente ajustar sua busca' : 'Comece fazendo upload de alguns arquivos'}
            </p>
          </div>
        )}

        {/* Modal de Criar Pasta */}
        {showCreateFolder && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Criar Nova Pasta</h3>
                
                <input
                  type="text"
                  placeholder="Nome da pasta"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 mb-4"
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
                />
                
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={() => {
                      setShowCreateFolder(false)
                      setNewFolderName('')
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCreateFolder}
                    disabled={!newFolderName.trim()}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    Criar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Detalhes do Arquivo */}
        {showFileDetails && selectedFile && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-10 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center">
                    {getFileIcon(selectedFile)}
                    <div className="ml-3">
                      <h3 className="text-lg font-medium text-gray-900">{selectedFile.name}</h3>
                      <p className="text-sm text-gray-500">
                        {selectedFile.size && formatFileSize(selectedFile.size)} • 
                        Enviado por {selectedFile.uploadedBy} em {parseISO(selectedFile.uploadedAt).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => setShowFileDetails(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ×
                  </button>
                </div>
                
                {/* Informações do Arquivo */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Tipo</label>
                    <p className="text-sm text-gray-900">{selectedFile.mimeType || 'Pasta'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Última modificação</label>
                    <p className="text-sm text-gray-900">
                      {new Date(selectedFile.lastModified).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  {selectedFile.projectName && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Projeto</label>
                      <p className="text-sm text-gray-900">{selectedFile.projectName}</p>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Compartilhado</label>
                    <p className="text-sm text-gray-900">{selectedFile.shared ? 'Sim' : 'Não'}</p>
                  </div>
                </div>
                
                {/* Histórico de Versões */}
                {selectedFile.versions && selectedFile.versions.length > 0 && (
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-3 flex items-center">
                      <Clock className="h-4 w-4 mr-2" />
                      Histórico de Versões
                    </h4>
                    
                    <div className="space-y-3">
                      {selectedFile.versions.map((version) => (
                        <div key={version.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              Versão {version.version}
                            </p>
                            <p className="text-xs text-gray-500">
                              {version.uploadedBy} • {new Date(version.uploadedAt).toLocaleString('pt-BR')} • {formatFileSize(version.size)}
                            </p>
                            {version.comment && (
                              <p className="text-xs text-gray-600 mt-1">{version.comment}</p>
                            )}
                          </div>
                          
                          <div className="flex space-x-2">
                            <button className="text-blue-600 hover:text-blue-800 text-sm">
                              Baixar
                            </button>
                            {version.version < selectedFile.versions!.length && (
                              <button className="text-green-600 hover:text-green-800 text-sm">
                                Restaurar
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="flex justify-end space-x-2 mt-6">
                  {selectedFile.url && (
                    <a
                      href={selectedFile.url}
                      download
                      className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Baixar
                    </a>
                  )}
                  
                  <button
                    onClick={() => setShowFileDetails(false)}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}