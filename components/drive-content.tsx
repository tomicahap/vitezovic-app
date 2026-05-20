"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { 
  Search, Folder, FileText, Image, Video, Upload, Download, 
  MoreVertical, ExternalLink, Cloud, Settings, ChevronRight, 
  ArrowLeft, Plus, Trash2, Loader2, File as FileIcon, 
  AlertCircle, FolderPlus, FileUp, FolderUp 
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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

export function DriveContent() {
  const { settings } = useSettings()
  const { user } = useAuth()
  const { addLog } = useActivityLog()
  
  const [files, setFiles] = useState<DriveFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [path, setPath] = useState<{id: string, name: string}[]>([])
  const [quota, setQuota] = useState<{limit: string, usage: string} | null>(null)
  
  // Selection & UI State
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null)
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
        headers: { 'Authorization': `Bearer ${user?.role}` }
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
          break // Prekini kod prve kritične greške (npr. kvota)
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
    const id = fileIdToDelete || selectedFileId;
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
    const b = typeof bytes === 'string' ? parseInt(bytes) : bytes
    if (b === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(b) / Math.log(k))
    return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const usagePercent = quota && quota.limit !== "0" && quota.limit !== "-1"
    ? (parseInt(quota.usage) / parseInt(quota.limit)) * 100
    : 0

  return (
    <main 
      className="flex-1 overflow-auto bg-[#F8F9FA] select-none" 
      onClick={() => setSelectedFileId(null)}
    >
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur-md" onClick={(e) => e.stopPropagation()}>
        <div className="px-8 py-3 flex flex-col gap-3">
          {/* Breadcrumbs & Title */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
               {path.length > 1 && (
                 <Button variant="ghost" size="icon" onClick={handleBack} className="rounded-full h-8 w-8 hover:bg-slate-100">
                   <ArrowLeft className="h-4 w-4 text-slate-600" />
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

            <div className="flex items-center gap-6">
              {quota && quota.limit !== "-1" && (
                <div className="hidden md:flex flex-col items-end gap-1">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                    <span>Skladište: {formatBytes(quota.usage)} / {formatBytes(quota.limit)}</span>
                    <span className={cn(
                      "px-1.5 py-0.5 rounded-full text-[9px]",
                      usagePercent > 90 ? "bg-red-100 text-red-600" : "bg-blue-50 text-blue-600"
                    )}>
                      {usagePercent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-32 lg:w-48 h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50 shadow-inner">
                    <div 
                      className={cn(
                        "h-full transition-all duration-1000 ease-out",
                        usagePercent > 90 ? "bg-red-500" : "bg-blue-500"
                      )}
                      style={{ width: `${Math.min(usagePercent, 100)}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="relative group">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-colors" />
                <Input
                  placeholder="Pretraži arhivu..."
                  className="w-48 lg:w-72 border-slate-200 bg-slate-50 pl-9 h-8 text-xs focus:bg-white transition-all shadow-none"
                />
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-3 h-10">
            <div className="flex items-center gap-3">
              <Dialog open={isFolderModalOpen} onOpenChange={setIsFolderModalOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 h-9 bg-white border-slate-200 hover:border-slate-300 shadow-sm font-medium">
                    <FolderPlus className="h-4 w-4 text-amber-500" />
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

              <div className="flex items-center bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
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
                  className="gap-2 h-9 px-3 border-r border-slate-100 rounded-none hover:bg-slate-50 font-medium"
                  onClick={() => uploadInputRef.current?.click()}
                  disabled={uploadLoading}
                >
                  <FileUp className="h-4 w-4 text-blue-500" />
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
                  className="gap-2 h-9 px-3 rounded-none hover:bg-slate-50 font-medium"
                  onClick={() => folderUploadInputRef.current?.click()}
                  disabled={uploadLoading}
                >
                  <FolderUp className="h-4 w-4 text-blue-600" />
                  Mapa
                </Button>
              </div>

              {uploadLoading && (
                <div className="flex items-center gap-2 text-xs text-slate-400 font-medium ml-1">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  Učitavanje...
                </div>
              )}
            </div>

            {/* Selection Actions */}
            <div 
              className={cn(
                "flex items-center gap-3 transition-all duration-300", 
                selectedFileId ? "opacity-100 translate-x-0 pointer-events-auto" : "opacity-0 translate-x-10 pointer-events-none"
              )}
            >
              <div className="h-5 w-[1px] bg-slate-200 mx-1" />
              
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2 h-9 bg-white border-slate-200 shadow-sm text-slate-700 hover:bg-slate-50"
                onClick={() => selectedFile && window.open(selectedFile.webViewLink, '_blank')}
              >
                <ExternalLink className="h-4 w-4 text-slate-400" />
                Otvori
              </Button>

              {!selectedFile?.mimeType.includes('folder') && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2 h-9 bg-white border-slate-200 shadow-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => handleDownload()}
                >
                  <Download className="h-4 w-4 text-blue-400" />
                  Preuzmi
                </Button>
              )}

              {user?.role === 'admin' && (
                <Button 
                  variant="secondary" 
                  size="sm" 
                  className="gap-2 h-9 bg-red-50 text-red-600 hover:bg-red-100 border-red-100 shadow-none font-medium"
                  onClick={() => handleDelete()}
                >
                  <Trash2 className="h-4 w-4" />
                  Obriši
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="p-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-32 bg-white rounded-3xl border border-slate-100 shadow-sm">
            <div className="relative">
               <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
               <div className="absolute inset-0 flex items-center justify-center">
                  <Cloud className="h-5 w-5 text-blue-200" />
               </div>
            </div>
            <p className="mt-6 text-slate-400 font-medium animate-pulse">Povezivanje s Google Drive-om...</p>
          </div>
        ) : error ? (
          <div className="p-12 bg-white rounded-3xl border border-red-50 shadow-md text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-50 border border-red-100 mb-6">
               <AlertCircle className="h-10 w-10 text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-3">Greška u sinkronizaciji</h3>
            <p className="text-slate-500 mb-8 max-w-md mx-auto leading-relaxed">{error}</p>
            {user?.role === 'admin' && (
              <Button onClick={() => window.location.href = '/settings?tab=integrations'} variant="primary" className="px-8 shadow-blue-200 shadow-lg">
                Konfiguriraj integraciju
              </Button>
            )}
          </div>
        ) : files.length > 0 ? (
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
            {files.map((file) => (
              <div 
                key={file.id} 
                onClick={(e) => {
                   e.stopPropagation()
                   setSelectedFileId(file.id)
                }}
                onDoubleClick={(e) => {
                   e.stopPropagation()
                   if (file.mimeType.includes('folder')) {
                      handleFolderOpen(file)
                   } else {
                      window.open(file.webViewLink, '_blank')
                   }
                }}
                className={cn(
                  "group relative cursor-pointer rounded-2xl border p-4 transition-all duration-300 flex flex-col items-center gap-4",
                  selectedFileId === file.id 
                    ? "bg-blue-50 border-blue-400 shadow-md ring-1 ring-blue-400/20" 
                    : "bg-white border-white hover:border-slate-200 hover:shadow-lg"
                )}
              >
                 {/* Icon Container */}
                 <div className={cn(
                   "relative h-20 w-20 flex items-center justify-center rounded-2xl transition-all duration-500",
                   selectedFileId === file.id ? "bg-white shadow-inner scale-105" : "bg-slate-50 group-hover:bg-white group-hover:shadow-md"
                 )}>
                   {file.mimeType.includes('folder') ? (
                     <Folder className={cn("h-12 w-12 transition-colors duration-500", 
                       selectedFileId === file.id ? "text-blue-500 fill-blue-500/20" : "text-amber-400 fill-amber-400/5 group-hover:fill-amber-400/20"
                     )} />
                   ) : (
                     <div className="relative group-hover:scale-110 transition-transform duration-500">
                       {file.iconLink ? (
                         <img src={file.iconLink.replace('16', '128')} alt="" className="h-12 w-12 object-contain filter drop-shadow-sm" />
                       ) : (
                         <FileIcon className="h-12 w-12 text-slate-300" />
                       )}
                     </div>
                   )}
                 </div>

                 {/* Text Info */}
                 <div className="w-full text-center space-y-1">
                    <h4 
                      className={cn("text-xs font-bold truncate px-1 transition-colors", 
                        selectedFileId === file.id ? "text-blue-700" : "text-slate-700"
                      )} 
                      title={file.name}
                    >
                      {file.name}
                    </h4>
                    <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest block">
                      {file.mimeType.includes('folder') ? 'Mapa' : (file.size ? (parseInt(file.size) / 1024 / 1024).toFixed(1) + ' MB' : 'Datoteka')}
                    </span>
                 </div>

                 {/* Dropdown for options */}
                 <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-slate-100">
                          <MoreVertical className="h-3.5 w-3.5 text-slate-400" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44 p-1.5 shadow-xl border-slate-100">
                        <DropdownMenuItem className="rounded-md" onClick={() => window.open(file.webViewLink, '_blank')}>
                           <ExternalLink className="mr-2 h-4 w-4 text-slate-400" /> Pregledaj
                        </DropdownMenuItem>
                        {!file.mimeType.includes('folder') && (
                           <DropdownMenuItem className="rounded-md" onClick={() => {
                              setSelectedFileId(file.id)
                              handleDownload(file)
                           }}>
                             <Download className="mr-2 h-4 w-4 text-blue-400" /> Preuzmi
                           </DropdownMenuItem>
                        )}
                        {user?.role === 'admin' && (
                          <DropdownMenuItem 
                            className="text-red-500 font-medium focus:bg-red-50 rounded-md" 
                            onClick={() => {
                              setSelectedFileId(file.id)
                              handleDelete(file.id)
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Obriši
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                 </div>

                 {/* Dynamic Checkmark/Badge */}
                 {selectedFileId === file.id && (
                   <div className="absolute top-3 left-3 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white shadow-lg animate-in zoom-in-0 duration-300">
                      <div className="h-1.5 w-1.5 rounded-full bg-white" />
                   </div>
                 )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-24 bg-white rounded-3xl border-2 border-dashed border-slate-100">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-slate-50 mb-6 group">
               <Folder className="h-10 w-10 text-slate-200 group-hover:text-amber-200 transition-colors" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Mapa je prazna</h3>
            <p className="text-slate-400 mb-8 max-w-xs text-center font-medium">Učitajte prve povijesne zapise ili kreirajte podmape za organizaciju.</p>
            <Button variant="outline" className="border-slate-200 text-slate-500 hover:bg-slate-50" onClick={() => uploadInputRef.current?.click()}>
               Započni učitavanje
            </Button>
          </div>
        )}
      </div>
    </main>
  )
}