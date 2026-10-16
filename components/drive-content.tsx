"use client"

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { 
  Search, Folder, FileText, Image, Upload, Download, 
  MoreVertical, ExternalLink, Cloud, Settings, ChevronRight, 
  ArrowLeft, Plus, Trash2, Loader2, File as FileIcon, 
  AlertCircle, FolderPlus, FileUp, FolderUp,
  LayoutGrid, List, ArrowUpDown, ArrowUp, ArrowDown,
  FileSpreadsheet, FileArchive, Film, Music, X
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useSettings } from "@/contexts/settings-context"
import { useAuth } from "@/contexts/auth-context"
import { useActivityLog } from "@/contexts/activity-log-context"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface DriveFile {
  id: string
  name: string
  mimeType: string
  modifiedTime: string
  size?: string
  webViewLink?: string
  webContentLink?: string
  iconLink?: string
}

interface QuotaInfo {
  limit: string
  usage: string
  free?: string
  fileCount?: number
  folderCount?: number
}

export function DriveContent() {
  const { settings } = useSettings()
  const { user } = useAuth()
  const { addLog } = useActivityLog()
  
  const [files, setFiles] = useState<DriveFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [path, setPath] = useState<{id: string, name: string}[]>([])
  const [quota, setQuota] = useState<QuotaInfo | null>(null)
  
  // Selection, View & UI State
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<'details' | 'grid'>('details')
  const [sortField, setSortField] = useState<'name' | 'modifiedTime' | 'size'>('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  
  const [newFolderName, setNewFolderName] = useState("")
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false)
  
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const folderUploadInputRef = useRef<HTMLInputElement>(null)

  const selectedFile = files.find(f => f.id === selectedFileId)

  const fetchQuota = async () => {
    try {
      const response = await fetch('/api/drive/files?action=quota', {
        headers: { 'Authorization': `Bearer ${user?.role || 'member'}` }
      })
      const data = await response.json()
      if (data.quota) {
        setQuota(data.quota)
      }
    } catch (err) {
      console.error("Quota fetch failed", err)
    }
  }

  const fetchFiles = useCallback(async (folderId: string | null = null) => {
    setLoading(true)
    setError("")
    setSelectedFileId(null)
    try {
      const url = folderId ? `/api/drive/files?folderId=${folderId}` : '/api/drive/files'
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${user?.role || 'member'}`
        }
      })
      const data = await response.json()
      if (data.files) {
        setFiles(data.files)
        if (data.currentFolderId) {
          setCurrentFolderId(data.currentFolderId)
        }
      } else if (data.error) {
        setError(data.error)
      }
      fetchQuota()
    } catch (err) {
      setError("Greška pri dohvaćanju datoteka iz Google Drive-a.")
    } finally {
      setLoading(false)
    }
  }, [user?.role])

  useEffect(() => {
    if (settings.googleServiceAccountJson && settings.googleDriveFolderId) {
      fetchFiles(null)
      setPath([{ id: settings.googleDriveFolderId, name: "Početna" }])
    } else {
      setLoading(false)
    }
  }, [settings.googleServiceAccountJson, settings.googleDriveFolderId, fetchFiles])

  const handleFolderOpen = (folder: DriveFile) => {
    fetchFiles(folder.id)
    setPath(prev => [...prev, { id: folder.id, name: folder.name }])
  }

  const handleBack = () => {
    if (path.length <= 1) return
    const newPath = [...path]
    newPath.pop()
    const parent = newPath[newPath.length - 1]
    fetchFiles(parent.id)
    setPath(newPath)
  }

  const handleBreadcrumbClick = (index: number) => {
    const newPath = path.slice(0, index + 1)
    const target = newPath[newPath.length - 1]
    fetchFiles(target.id)
    setPath(newPath)
  }

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return
    setIsCreatingFolder(true)
    try {
      const response = await fetch('/api/drive/files', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.role}`
        },
        body: JSON.stringify({
          name: newFolderName,
          parentId: currentFolderId || settings.googleDriveFolderId
        })
      })
      
      if (response.ok) {
        if (user) addLog({ userId: user.id.toString(), userName: user.name, userRole: user.role, action: 'Google Drive - Nova mapa', details: `Kreirana mapa: "${newFolderName}"` })
        setNewFolderName("")
        setIsFolderModalOpen(false)
        fetchFiles(currentFolderId)
      } else {
        const data = await response.json()
        alert(data.error || "Greška pri kreiranju mape")
      }
    } catch (error) {
      alert("Došlo je do pogreške.")
    } finally {
      setIsCreatingFolder(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files
    if (!fileList || fileList.length === 0) return

    setUploadLoading(true)
    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i]
        const formData = new FormData()
        formData.append('file', file)
        formData.append('parentId', currentFolderId || settings.googleDriveFolderId!)

        const response = await fetch('/api/drive/files', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${user?.role}`
          },
          body: formData
        })

        if (!response.ok) {
          const data = await response.json()
          alert(`Greška pri učitavanju ${file.name}: ${data.error}`)
          break
        }
      }
      fetchFiles(currentFolderId)
      if (user) addLog({ userId: user.id.toString(), userName: user.name, userRole: user.role, action: 'Google Drive - Upload', details: `Učitano ${fileList.length} datoteka u Drive.` })
    } catch (error) {
      alert("Došlo je do pogreške tijekom učitavanja.")
    } finally {
      setUploadLoading(false)
      if (event.target) event.target.value = ''
    }
  }

  const handleDelete = async (fileIdToDelete?: string) => {
    const id = fileIdToDelete || selectedFileId
    if (!id) return
    if (!confirm("Jeste li sigurni da želite obrisati ovu stavku?")) return

    try {
      const response = await fetch(`/api/drive/files?fileId=${id}&role=${user?.role}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${user?.role}`
        }
      })

      if (response.ok) {
        const file = files.find(f => f.id === id)
        if (user) addLog({ userId: user.id.toString(), userName: user.name, userRole: user.role, action: 'Google Drive - Brisanje', details: `Obrisana stavka: ${file?.name || id}` })
        if (id === selectedFileId) setSelectedFileId(null)
        fetchFiles(currentFolderId)
      } else {
        const data = await response.json()
        alert(data.error || "Greška pri brisanju")
      }
    } catch (error) {
      alert("Došlo je do pogreške.")
    }
  }

  const handleDownload = async (fileToDownload?: DriveFile) => {
    const file = fileToDownload || selectedFile
    if (!file) return
     
    try {
      if (user) addLog({ 
        userId: user.id.toString(), 
        userName: user.name, 
        userRole: user.role, 
        action: 'Google Drive - Preuzimanje', 
        details: `Preuzeto: ${file.name}` 
      })
      
      const response = await fetch(`/api/drive/files?action=download&fileId=${file.id}`, {
        headers: { 'Authorization': `Bearer ${user?.role || 'member'}` }
      })
      
      if (!response.ok) throw new Error("Download failed")
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      alert("Greška pri preuzimanju datoteke.")
    }
  }

  // Formatiranje veličine za prikaz kvote
  const formatBytes = (bytes: string | number) => {
    const b = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes
    if (isNaN(b) || b <= 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(b) / Math.log(k))
    const val = parseFloat((b / Math.pow(k, i)).toFixed(i >= 2 ? 1 : 0))
    return val + ' ' + sizes[i]
  }

  const formatFileSize = (bytes?: string) => {
    if (!bytes) return "—"
    const b = parseInt(bytes, 10)
    if (isNaN(b) || b === 0) return "0 B"
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(b) / Math.log(k))
    return parseFloat((b / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "—"
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return "—"
      return d.toLocaleDateString('hr-HR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateStr
    }
  }

  const getFileTypeLabel = (file: DriveFile) => {
    const mime = file.mimeType.toLowerCase()
    const name = file.name.toLowerCase()

    if (mime.includes('folder') || mime === 'application/vnd.google-apps.folder') return "Mapa"
    if (mime.includes('pdf')) return "PDF dokument"
    if (mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('sheet') || name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) return "Tablica"
    if (mime.includes('word') || mime.includes('document') || name.endsWith('.docx') || name.endsWith('.doc')) return "Dokument"
    if (mime.includes('presentation') || mime.includes('powerpoint') || name.endsWith('.pptx') || name.endsWith('.ppt')) return "Prezentacija"
    if (mime.startsWith('image/')) return "Slika"
    if (mime.startsWith('video/')) return "Videozapis"
    if (mime.startsWith('audio/')) return "Audiozapis"
    if (mime.includes('zip') || mime.includes('compressed') || name.match(/\.(zip|rar|7z|tar|gz)$/i)) return "Arhiva"
    if (mime.includes('text/plain') || name.endsWith('.txt')) return "Tekstualna datoteka"
    return "Datoteka"
  }

  const getFileIcon = (file: DriveFile, sizeClass = "h-5 w-5") => {
    const mime = file.mimeType.toLowerCase()
    const name = file.name.toLowerCase()

    if (mime.includes('folder') || mime === 'application/vnd.google-apps.folder') {
      return <Folder className={cn(sizeClass, "text-amber-500 fill-amber-500/20 flex-shrink-0")} />
    }
    if (mime.includes('pdf')) {
      return <FileText className={cn(sizeClass, "text-rose-500 flex-shrink-0")} />
    }
    if (mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('sheet') || name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
      return <FileSpreadsheet className={cn(sizeClass, "text-emerald-600 flex-shrink-0")} />
    }
    if (mime.includes('word') || mime.includes('document') || name.endsWith('.docx') || name.endsWith('.doc')) {
      return <FileText className={cn(sizeClass, "text-blue-600 flex-shrink-0")} />
    }
    if (mime.startsWith('image/') || name.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i)) {
      return <Image className={cn(sizeClass, "text-violet-500 flex-shrink-0")} />
    }
    if (mime.startsWith('video/') || name.match(/\.(mp4|avi|mov|mkv|webm)$/i)) {
      return <Film className={cn(sizeClass, "text-pink-500 flex-shrink-0")} />
    }
    if (mime.startsWith('audio/') || name.match(/\.(mp3|wav|ogg|flac|m4a)$/i)) {
      return <Music className={cn(sizeClass, "text-purple-500 flex-shrink-0")} />
    }
    if (mime.includes('zip') || mime.includes('compressed') || name.match(/\.(zip|rar|7z|tar|gz)$/i)) {
      return <FileArchive className={cn(sizeClass, "text-amber-600 flex-shrink-0")} />
    }
    return <FileIcon className={cn(sizeClass, "text-slate-400 flex-shrink-0")} />
  }

  const toggleSort = (field: 'name' | 'modifiedTime' | 'size') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const filteredFiles = useMemo(() => {
    let result = files
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(f => f.name.toLowerCase().includes(q))
    }

    return [...result].sort((a, b) => {
      const aIsFolder = a.mimeType.includes('folder') || a.mimeType === 'application/vnd.google-apps.folder'
      const bIsFolder = b.mimeType.includes('folder') || b.mimeType === 'application/vnd.google-apps.folder'

      // Mape uvijek ostaju pri vrhu (kao u Google Drive i Exploreru)
      if (aIsFolder && !bIsFolder) return -1
      if (!aIsFolder && bIsFolder) return 1

      if (sortField === 'name') {
        const cmp = a.name.localeCompare(b.name, 'hr', { sensitivity: 'base' })
        return sortDirection === 'asc' ? cmp : -cmp
      } else if (sortField === 'modifiedTime') {
        const tA = a.modifiedTime ? new Date(a.modifiedTime).getTime() : 0
        const tB = b.modifiedTime ? new Date(b.modifiedTime).getTime() : 0
        return sortDirection === 'asc' ? tA - tB : tB - tA
      } else if (sortField === 'size') {
        const sA = a.size ? parseInt(a.size, 10) : 0
        const sB = b.size ? parseInt(b.size, 10) : 0
        return sortDirection === 'asc' ? sA - sB : sB - sA
      }
      return 0
    })
  }, [files, searchQuery, sortField, sortDirection])

  const usagePercent = useMemo(() => {
    if (!quota) return 0
    const limitNum = parseInt(quota.limit, 10)
    const usageNum = parseInt(quota.usage, 10)
    if (isNaN(limitNum) || isNaN(usageNum) || limitNum <= 0) return 0
    return (usageNum / limitNum) * 100
  }, [quota])

  return (
    <main 
      className="flex-1 overflow-auto bg-[#F8F9FA] select-none min-h-screen" 
      onClick={() => setSelectedFileId(null)}
    >
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-md" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-3.5 flex flex-col gap-3">
          {/* Breadcrumbs & Title */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
               {path.length > 1 && (
                 <Button 
                   variant="ghost" 
                   size="icon" 
                   onClick={handleBack} 
                   className="rounded-full h-8 w-8 hover:bg-slate-100 text-slate-600"
                   title="Natrag na prethodnu mapu"
                 >
                   <ArrowLeft className="h-4 w-4" />
                 </Button>
               )}
               <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 overflow-hidden max-w-lg">
                  <Cloud className="h-4 w-4 text-blue-500 flex-shrink-0" />
                  {path.map((p, i) => (
                    <React.Fragment key={p.id}>
                      {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-300 flex-shrink-0" />}
                      <button 
                        onClick={() => handleBreadcrumbClick(i)}
                        className={cn(
                          "hover:text-primary transition-colors truncate",
                          i === path.length - 1 ? 'text-slate-900 font-bold' : 'text-slate-400'
                        )}
                      >
                        {p.name}
                      </button>
                    </React.Fragment>
                  ))}
               </div>
            </div>

            <div className="flex items-center gap-4">
              {quota && (
                <div 
                  className="hidden md:flex flex-col items-end gap-1 select-none"
                  title={`Zauzeto: ${formatBytes(quota.usage)} | Slobodno: ${formatBytes(quota.free || Math.max(0, parseInt(quota.limit) - parseInt(quota.usage)))} | Ukupno: ${formatBytes(quota.limit)}${quota.fileCount !== undefined ? ` (${quota.fileCount} datoteka, ${quota.folderCount} mapa)` : ''}`}
                >
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                    <span>
                      Skladište: <strong className="text-slate-800 font-bold">{formatBytes(quota.usage)}</strong> / {formatBytes(quota.limit)}
                    </span>
                    <span className="text-slate-400 font-normal hidden xl:inline">
                      ({formatBytes(quota.free || Math.max(0, parseInt(quota.limit) - parseInt(quota.usage)))} slobodno)
                    </span>
                    <span className={cn(
                      "px-1.5 py-0.5 rounded-full text-[9px] font-bold",
                      usagePercent > 90 ? "bg-red-100 text-red-600" : usagePercent > 75 ? "bg-amber-100 text-amber-700" : "bg-blue-50 text-blue-600"
                    )}>
                      {usagePercent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-36 lg:w-48 h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50 shadow-inner">
                    <div 
                      className={cn(
                        "h-full transition-all duration-1000 ease-out",
                        usagePercent > 90 ? "bg-red-500" : usagePercent > 75 ? "bg-amber-500" : "bg-blue-500"
                      )}
                      style={{ width: `${Math.min(Math.max(usagePercent, 1), 100)}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="relative group">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Pretraži stavke..."
                  className="w-48 sm:w-64 border-slate-200 bg-slate-50 pl-9 pr-8 h-8 text-xs focus:bg-white transition-all shadow-none rounded-lg"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery("")} 
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between border-t border-slate-100 pt-2.5 gap-2">
            <div className="flex items-center gap-2">
              {!settings.googleDriveOnlyDownload && (
                <>
                  <Dialog open={isFolderModalOpen} onOpenChange={setIsFolderModalOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2 h-8 bg-white border-slate-200 hover:border-slate-300 shadow-sm font-medium text-xs">
                        <FolderPlus className="h-3.5 w-3.5 text-amber-500" />
                        Nova mapa
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Nova mapa</DialogTitle>
                      </DialogHeader>
                      <div className="py-4">
                        <Label htmlFor="folder-name">Naziv mape</Label>
                        <Input 
                          id="folder-name" 
                          value={newFolderName} 
                          onChange={(e) => setNewFolderName(e.target.value)}
                          placeholder="npr. Fotografije 1945"
                          className="mt-2"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCreateFolder()
                          }}
                        />
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsFolderModalOpen(false)}>Odustani</Button>
                        <Button onClick={handleCreateFolder} disabled={isCreatingFolder}>
                          {isCreatingFolder ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          Kreiraj
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <div className="flex items-center bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden h-8">
                    <input 
                      type="file" 
                      ref={uploadInputRef}
                      className="hidden" 
                      multiple
                      onChange={handleFileUpload}
                      disabled={uploadLoading}
                    />
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="gap-1.5 h-8 px-2.5 text-xs border-r border-slate-100 rounded-none hover:bg-slate-50 font-medium"
                      onClick={() => uploadInputRef.current?.click()}
                      disabled={uploadLoading}
                    >
                      <FileUp className="h-3.5 w-3.5 text-blue-500" />
                      Datoteka
                    </Button>
                    
                    <input 
                      type="file" 
                      ref={folderUploadInputRef}
                      className="hidden" 
                      // @ts-ignore
                      webkitdirectory="" 
                      // @ts-ignore
                      directory=""
                      onChange={handleFileUpload}
                      disabled={uploadLoading}
                    />
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="gap-1.5 h-8 px-2.5 text-xs rounded-none hover:bg-slate-50 font-medium"
                      onClick={() => folderUploadInputRef.current?.click()}
                      disabled={uploadLoading}
                    >
                      <FolderUp className="h-3.5 w-3.5 text-blue-600" />
                      Mapa
                    </Button>
                  </div>

                  {uploadLoading && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium ml-1">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
                      Učitavanje...
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Selection Actions */}
              {selectedFile && (
                <div className="flex items-center gap-1.5 bg-blue-50/70 border border-blue-200/80 rounded-lg px-2 py-0.5 animate-in fade-in-50 duration-200">
                  <span className="text-xs text-blue-700 font-medium max-w-[130px] sm:max-w-[180px] truncate mr-1">
                    {selectedFile.name}
                  </span>
                  
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 px-2 text-xs text-slate-700 hover:text-blue-700 hover:bg-white"
                    onClick={() => window.open(selectedFile.webViewLink, '_blank')}
                    title="Otvori na Google Drive-u"
                  >
                    <ExternalLink className="h-3.5 w-3.5 mr-1 text-slate-500" />
                    Otvori
                  </Button>

                  {!selectedFile.mimeType.includes('folder') && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 px-2 text-xs text-slate-700 hover:text-blue-700 hover:bg-white"
                      onClick={() => handleDownload()}
                      title="Preuzmi datoteku"
                    >
                      <Download className="h-3.5 w-3.5 mr-1 text-blue-600" />
                      Preuzmi
                    </Button>
                  )}

                  {user?.role === 'admin' && !settings.googleDriveOnlyDownload && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDelete()}
                      title="Obriši"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              )}

              {/* View Switcher: Details (default) vs Grid */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/80">
                <button
                  type="button"
                  onClick={() => setViewMode('details')}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer",
                    viewMode === 'details' 
                      ? "bg-white text-blue-600 shadow-sm" 
                      : "text-slate-500 hover:text-slate-800"
                  )}
                  title="Prikaz s detaljima (tablica)"
                >
                  <List className="h-3.5 w-3.5" />
                  <span>Detalji</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer",
                    viewMode === 'grid' 
                      ? "bg-white text-blue-600 shadow-sm" 
                      : "text-slate-500 hover:text-slate-800"
                  )}
                  title="Prikaz ikona (mreža)"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  <span>Mreža</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-28 bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="relative">
               <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
               <div className="absolute inset-0 flex items-center justify-center">
                  <Cloud className="h-4 w-4 text-blue-300" />
               </div>
            </div>
            <p className="mt-4 text-slate-500 text-sm font-medium">Učitavanje stavki iz Google Drive-a...</p>
          </div>
        ) : error ? (
          <div className="p-12 bg-white rounded-2xl border border-red-100 shadow-sm text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 border border-red-100 mb-4">
               <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Greška u sinkronizaciji</h3>
            <p className="text-slate-500 text-sm mb-6 max-w-md mx-auto leading-relaxed">{error}</p>
            {user?.role === 'admin' && (
              <Button onClick={() => window.location.href = '/settings?tab=integrations'} variant="default" className="px-6 shadow-sm">
                Konfiguriraj integraciju
              </Button>
            )}
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-20 bg-white rounded-2xl border-2 border-dashed border-slate-200">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 mb-4">
               <Folder className="h-8 w-8 text-slate-300" />
            </div>
            <h3 className="text-base font-bold text-slate-800 mb-1">Ova mapa je prazna</h3>
            <p className="text-slate-400 text-xs mb-6 max-w-xs text-center font-medium">
              Prenesite datoteke ili stvorite podmape za organizaciju.
            </p>
            {!settings.googleDriveOnlyDownload && (
              <Button 
                variant="outline" 
                size="sm"
                className="border-slate-200 text-slate-600 hover:bg-slate-50 text-xs" 
                onClick={() => uploadInputRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                Učitaj datoteku
              </Button>
            )}
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 bg-white rounded-2xl border border-slate-200 text-center">
            <Search className="h-10 w-10 text-slate-300 mb-3" />
            <h3 className="text-base font-semibold text-slate-800">Nema pronađenih stavki</h3>
            <p className="text-xs text-slate-400 mt-1 mb-4">Nema stavki koje odgovaraju pojmu "{searchQuery}"</p>
            <Button variant="outline" size="sm" onClick={() => setSearchQuery("")} className="text-xs">
              Poništi pretragu
            </Button>
          </div>
        ) : viewMode === 'details' ? (
          /* DETAILS VIEW (TABLE) */
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/75 border-b border-slate-200">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[45%] min-w-[260px] py-3 pl-4 sm:pl-6 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      <button 
                        onClick={() => toggleSort('name')} 
                        className="flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer text-left font-semibold"
                      >
                        <span>Naziv</span>
                        {sortField === 'name' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3.5 w-3.5 text-blue-600" /> : <ArrowDown className="h-3.5 w-3.5 text-blue-600" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 text-slate-400" />
                        )}
                      </button>
                    </TableHead>
                    <TableHead className="w-[18%] min-w-[110px] py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider hidden sm:table-cell">
                      <span>Vrsta</span>
                    </TableHead>
                    <TableHead className="w-[20%] min-w-[140px] py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider hidden md:table-cell">
                      <button 
                        onClick={() => toggleSort('modifiedTime')} 
                        className="flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer font-semibold"
                      >
                        <span>Zadnja izmjena</span>
                        {sortField === 'modifiedTime' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3.5 w-3.5 text-blue-600" /> : <ArrowDown className="h-3.5 w-3.5 text-blue-600" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 text-slate-400" />
                        )}
                      </button>
                    </TableHead>
                    <TableHead className="w-[10%] min-w-[90px] py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider hidden sm:table-cell">
                      <button 
                        onClick={() => toggleSort('size')} 
                        className="flex items-center gap-1.5 ml-auto hover:text-slate-900 transition-colors cursor-pointer font-semibold"
                      >
                        <span>Veličina</span>
                        {sortField === 'size' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3.5 w-3.5 text-blue-600" /> : <ArrowDown className="h-3.5 w-3.5 text-blue-600" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 text-slate-400" />
                        )}
                      </button>
                    </TableHead>
                    <TableHead className="w-[7%] min-w-[60px] py-3 pr-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      <span className="sr-only">Opcije</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFiles.map((file) => {
                    const isFolder = file.mimeType.includes('folder') || file.mimeType === 'application/vnd.google-apps.folder'
                    const isSelected = selectedFileId === file.id

                    return (
                      <TableRow 
                        key={file.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedFileId(file.id)
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation()
                          if (isFolder) {
                            handleFolderOpen(file)
                          } else if (file.webViewLink) {
                            window.open(file.webViewLink, '_blank')
                          }
                        }}
                        className={cn(
                          "cursor-pointer border-b border-slate-100 transition-colors select-none group",
                          isSelected 
                            ? "bg-blue-50/90 hover:bg-blue-50 font-medium" 
                            : "hover:bg-slate-50/70"
                        )}
                      >
                        {/* Name Column */}
                        <TableCell className="py-2.5 pl-4 sm:pl-6">
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0">
                              {getFileIcon(file, "h-5 w-5")}
                            </div>
                            <span 
                              className={cn(
                                "text-sm truncate max-w-[200px] sm:max-w-xs md:max-w-md lg:max-w-lg transition-colors",
                                isSelected ? "text-blue-900 font-semibold" : "text-slate-800 group-hover:text-slate-900",
                                isFolder && "font-medium"
                              )} 
                              title={file.name}
                            >
                              {file.name}
                            </span>
                          </div>
                        </TableCell>

                        {/* Type Column */}
                        <TableCell className="py-2.5 text-xs text-slate-500 hidden sm:table-cell">
                          {getFileTypeLabel(file)}
                        </TableCell>

                        {/* Modified Time Column */}
                        <TableCell className="py-2.5 text-xs text-slate-500 whitespace-nowrap hidden md:table-cell">
                          {formatDate(file.modifiedTime)}
                        </TableCell>

                        {/* File Size Column */}
                        <TableCell className="py-2.5 text-xs text-slate-500 text-right whitespace-nowrap font-mono hidden sm:table-cell">
                          {isFolder ? "—" : formatFileSize(file.size)}
                        </TableCell>

                        {/* Actions Column */}
                        <TableCell className="py-2.5 pr-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100">
                            {file.webViewLink && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-md text-slate-400 hover:text-blue-600 hover:bg-white"
                                onClick={() => window.open(file.webViewLink, '_blank')}
                                title="Otvori na Google Drive-u"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Button>
                            )}

                            {!isFolder && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-md text-slate-400 hover:text-blue-600 hover:bg-white"
                                onClick={() => {
                                  setSelectedFileId(file.id)
                                  handleDownload(file)
                                }}
                                title="Preuzmi"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                            )}

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 rounded-md text-slate-400 hover:text-slate-700 hover:bg-white"
                                >
                                  <MoreVertical className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44 p-1 shadow-lg border-slate-200">
                                {file.webViewLink && (
                                  <DropdownMenuItem 
                                    className="text-xs cursor-pointer" 
                                    onClick={() => window.open(file.webViewLink, '_blank')}
                                  >
                                    <ExternalLink className="mr-2 h-3.5 w-3.5 text-slate-400" /> Otvori u Drive-u
                                  </DropdownMenuItem>
                                )}
                                {!isFolder && (
                                  <DropdownMenuItem 
                                    className="text-xs cursor-pointer" 
                                    onClick={() => {
                                      setSelectedFileId(file.id)
                                      handleDownload(file)
                                    }}
                                  >
                                    <Download className="mr-2 h-3.5 w-3.5 text-blue-500" /> Preuzmi datoteku
                                  </DropdownMenuItem>
                                )}
                                {user?.role === 'admin' && !settings.googleDriveOnlyDownload && (
                                  <DropdownMenuItem 
                                    className="text-xs text-red-600 cursor-pointer focus:bg-red-50 focus:text-red-700" 
                                    onClick={() => {
                                      setSelectedFileId(file.id)
                                      handleDelete(file.id)
                                    }}
                                  >
                                    <Trash2 className="mr-2 h-3.5 w-3.5" /> Obriši
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="px-4 py-2 bg-slate-50/75 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
              <span>Ukupno stavki: {filteredFiles.length}</span>
              {searchQuery && (
                <span className="text-slate-400">Filtrirano od ukupno {files.length}</span>
              )}
            </div>
          </div>
        ) : (
          /* GRID VIEW (ICONS) */
          <div>
            <div className="grid gap-3.5 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
              {filteredFiles.map((file) => {
                const isFolder = file.mimeType.includes('folder') || file.mimeType === 'application/vnd.google-apps.folder'
                const isSelected = selectedFileId === file.id

                return (
                  <div 
                    key={file.id} 
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedFileId(file.id)
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      if (isFolder) {
                        handleFolderOpen(file)
                      } else {
                        window.open(file.webViewLink, '_blank')
                      }
                    }}
                    className={cn(
                      "group relative cursor-pointer rounded-xl border p-3.5 transition-all duration-200 flex flex-col items-center gap-3 select-none",
                      isSelected 
                        ? "bg-blue-50/90 border-blue-400 shadow-sm ring-1 ring-blue-400/30" 
                        : "bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-md"
                    )}
                  >
                    {/* Icon Container */}
                    <div className={cn(
                      "relative h-16 w-16 flex items-center justify-center rounded-xl transition-all",
                      isSelected ? "bg-white shadow-inner" : "bg-slate-50 group-hover:bg-white group-hover:shadow-sm"
                    )}>
                      {getFileIcon(file, "h-9 w-9")}
                    </div>

                    {/* Text Info */}
                    <div className="w-full text-center space-y-0.5">
                      <h4 
                        className={cn(
                          "text-xs font-semibold truncate px-1 transition-colors", 
                          isSelected ? "text-blue-700" : "text-slate-700 group-hover:text-slate-900"
                        )} 
                        title={file.name}
                      >
                        {file.name}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-medium block">
                        {isFolder ? 'Mapa' : formatFileSize(file.size)}
                      </span>
                    </div>

                    {/* Dropdown for options */}
                    <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-slate-100">
                            <MoreVertical className="h-3 w-3 text-slate-500" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40 p-1 shadow-lg border-slate-200">
                          <DropdownMenuItem className="text-xs" onClick={() => window.open(file.webViewLink, '_blank')}>
                            <ExternalLink className="mr-2 h-3.5 w-3.5 text-slate-400" /> Pregledaj
                          </DropdownMenuItem>
                          {!isFolder && (
                            <DropdownMenuItem className="text-xs" onClick={() => {
                              setSelectedFileId(file.id)
                              handleDownload(file)
                            }}>
                              <Download className="mr-2 h-3.5 w-3.5 text-blue-500" /> Preuzmi
                            </DropdownMenuItem>
                          )}
                          {user?.role === 'admin' && !settings.googleDriveOnlyDownload && (
                            <DropdownMenuItem 
                              className="text-xs text-red-600 focus:bg-red-50" 
                              onClick={() => {
                                setSelectedFileId(file.id)
                                handleDelete(file.id)
                              }}
                            >
                              <Trash2 className="mr-2 h-3.5 w-3.5" /> Obriši
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Dynamic Checkmark/Badge */}
                    {isSelected && (
                      <div className="absolute top-2 left-2 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white shadow-sm">
                        <div className="h-1.5 w-1.5 rounded-full bg-white" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="mt-4 px-2 text-xs text-slate-400 text-right">
              Ukupno stavki: {filteredFiles.length}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}