"use client"

import { useState, useEffect, useMemo } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useMembers, Member } from "@/contexts/members-context"
import { useActivityLog } from "@/contexts/activity-log-context"
import { 
  User, Mail, Shield, Save, Plus, Trash2, Check, 
  StickyNote, ListChecks, Calendar, Clock, Loader2,
  ExternalLink, ArrowRight, Zap, Target, BookMarked,
  LayoutDashboard, Users, Mic, Library, FolderKanban,
  Star, Hash, CheckCircle2, Circle, Activity,
  Paperclip, FileText, Image, X
} from "lucide-react"
import { generateId } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import Link from "next/link"

export function PersonalContent() {
  const { user } = useAuth()
  const { members, rawMembers, updatePersonalData } = useMembers()
  const { getUserLogs } = useActivityLog()
  
  const currentMember = useMemo(() => {
    if (!user) return null
    // Prioritize matching by email as it's the most reliable link between auth and member record
    // Use rawMembers instead of members, so we can find the admin account which is filtered out from derivedMembers
    const searchArray = rawMembers || members;
    return searchArray.find(m => 
      (m.email && user.email && m.email.toLowerCase() === user.email.toLowerCase()) || 
      m.id === user.id
    )
  }, [rawMembers, members, user])
  const userLogs = useMemo(() => {
    if (!user) return []
    const logs = getUserLogs(user.id.toString())
    // Also include logs where name matches if it was a system-level action
    return logs.slice(0, 5)
  }, [user, getUserLogs])
  
  const [notes, setNotes] = useState("")
  const [todos, setTodos] = useState<{ 
    id: string; 
    text: string; 
    done: boolean; 
    priority?: boolean;
    files?: { name: string; url: string; fileType: 'image' | 'pdf' | 'word'; size?: number }[];
  }[]>([])
  const [newTodo, setNewTodo] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [isNotesDirty, setIsNotesDirty] = useState(false)
  const [uploadingIds, setUploadingIds] = useState<Record<string, boolean>>({})

  // Sync state with member data
  useEffect(() => {
    if (currentMember) {
      setNotes(currentMember.personal_notes || "")
      setTodos(currentMember.personal_todos || [])
    }
  }, [currentMember])

  const handleSave = async () => {
    if (!user) return
    setIsSaving(true)
    await updatePersonalData(notes, todos)
    setIsSaving(false)
    setLastSaved(new Date())
    setIsNotesDirty(false)
  }

  const addTodo = () => {
    if (!newTodo.trim()) return
    const updated = [...todos, { id: generateId(), text: newTodo.trim(), done: false, priority: false }]
    setTodos(updated)
    setNewTodo("")
    updatePersonalData(notes, updated)
  }

  const toggleTodo = (id: string) => {
    const updated = todos.map(t => t.id === id ? { ...t, done: !t.done } : t)
    setTodos(updated)
    updatePersonalData(notes, updated)
  }

  const togglePriority = (id: string) => {
    const updated = todos.map(t => t.id === id ? { ...t, priority: !t.priority } : t)
    setTodos(updated)
    updatePersonalData(notes, updated)
  }

  const deleteTodo = (id: string) => {
    const updated = todos.filter(t => t.id !== id)
    setTodos(updated)
    updatePersonalData(notes, updated)
  }

  const handleFileUpload = async (todoId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadingIds(prev => ({ ...prev, [todoId]: true }))

    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/meetings/upload", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errData = await response.json()
        alert(errData.error || "Greška pri učitavanju datoteke.")
        return
      }

      const uploadedFile = await response.json()
      
      const updated = todos.map(t => {
        if (t.id === todoId) {
          const existingFiles = t.files || []
          return { ...t, files: [...existingFiles, uploadedFile] }
        }
        return t
      })

      setTodos(updated)
      await updatePersonalData(notes, updated)
    } catch (error) {
      console.error("Upload error:", error)
      alert("Došlo je do greške prilikom prijenosa datoteke.")
    } finally {
      setUploadingIds(prev => ({ ...prev, [todoId]: false }))
      // Reset input
      event.target.value = ""
    }
  }

  const handleRemoveFile = async (todoId: string, fileIndex: number) => {
    const updated = todos.map(t => {
      if (t.id === todoId) {
        const existingFiles = t.files || []
        return { ...t, files: existingFiles.filter((_, idx) => idx !== fileIndex) }
      }
      return t
    })

    setTodos(updated)
    await updatePersonalData(notes, updated)
  }

  if (!user) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!currentMember) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center bg-background">
        <div className="max-w-md space-y-4">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-50 text-amber-500">
            <Zap className="h-10 w-10 transition-transform hover:scale-110" />
          </div>
          <h2 className="text-3xl font-serif font-bold">Moj Kutak se sinkronizira</h2>
          <p className="text-slate-500 leading-relaxed">
            Sustav upravo povezuje vaše podatke s bazom društva. Molimo pričekajte nekoliko trenutaka dok se vaš profil ne osvježi.
          </p>
          <div className="pt-4 flex justify-center gap-3">
             <Button variant="outline" className="rounded-xl" onClick={() => window.location.reload()}>Osvježi stranicu</Button>
             <Link href="/"><Button className="rounded-xl">Povratak na početnu</Button></Link>
          </div>
        </div>
      </div>
    )
  }

  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase()
  const stats = {
    pendingTodos: todos.filter(t => !t.done).length,
    completedTodos: todos.filter(t => t.done).length,
    priorityTodos: todos.filter(t => !t.done && t.priority).length,
  }

  return (
    <div className="flex-1 overflow-auto bg-[#F8FAFC]">
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-40">
        <div className="absolute -top-[10%] -right-[10%] w-[40%] h-[40%] bg-blue-100 rounded-full blur-[120px]" />
        <div className="absolute top-[20%] -left-[5%] w-[30%] h-[30%] bg-indigo-50 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 p-4 md:p-8 space-y-8 max-w-[1600px] mx-auto">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between mb-2">
          <div className="space-y-1">
            <div className="flex items-center gap-3 text-blue-600 mb-1">
              <Star className="h-5 w-5 fill-current" />
              <span className="text-sm font-bold tracking-widest uppercase">Osobni prostor</span>
            </div>
            <h1 className="text-5xl font-serif font-bold tracking-tight text-slate-900">
              Dobrodošli natrag, {user.name.split(' ')[0]}!
            </h1>
            <p className="text-slate-500 text-lg">
              Pregledajte svoje obaveze, zapišite ideje i upravljajte svojim kutkom Administracije.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end mr-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Današnji datum</span>
              <span className="text-lg font-medium text-slate-700">
                {new Date().toLocaleDateString("hr-HR", { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
            <Button 
              onClick={handleSave} 
              disabled={isSaving}
              className={`h-14 px-8 rounded-2xl shadow-xl transition-all duration-300 ${
                isNotesDirty || isSaving 
                ? "bg-blue-600 hover:bg-blue-700 shadow-blue-200" 
                : "bg-slate-900 hover:bg-slate-800 shadow-slate-200"
              }`}
            >
              {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
              {isSaving ? "Spremanje..." : "Spremi bilješke"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-white border-blue-100/50 shadow-sm rounded-2xl hover:shadow-md transition-shadow">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                <Target className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Prioriteti</p>
                <p className="text-2xl font-bold text-slate-900">{stats.priorityTodos} zadatka</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white border-emerald-100/50 shadow-sm rounded-2xl hover:shadow-md transition-shadow">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                <ListChecks className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Preostalo todo</p>
                <p className="text-2xl font-bold text-slate-900">{stats.pendingTodos} zadataka</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-100/50 shadow-sm rounded-2xl hover:shadow-md transition-shadow">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-slate-50 flex items-center justify-center text-slate-600">
                <Calendar className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Mjesec</p>
                <p className="text-2xl font-bold text-slate-900 capitalize">{new Date().toLocaleString("hr-HR", { month: 'long' })}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-indigo-100/50 shadow-sm rounded-2xl hover:shadow-md transition-shadow">
            <CardContent className="p-6 flex items-center gap-4">
              <Avatar className="h-12 w-12 border-2 border-white shadow-sm ring-2 ring-indigo-50">
                <AvatarImage src={user.avatar} />
                <AvatarFallback className="bg-indigo-600 text-white font-bold text-xs">{initials}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Uloga</p>
                <Badge className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-none capitalize">{user.role}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-12 xl:col-span-7 space-y-8">
            <Card className="border-none shadow-2xl rounded-[32px] overflow-hidden bg-white ring-1 ring-slate-200/50">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 px-8 py-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-blue-600 border border-slate-100">
                      <StickyNote className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl font-serif font-bold text-slate-900">Osobne bilješke</CardTitle>
                      <CardDescription className="text-slate-500">Privatni prostor za vaše misli i planiranje.</CardDescription>
                    </div>
                  </div>
                  {isNotesDirty && (
                    <Badge className="bg-blue-50 text-blue-600 border-none animate-pulse">Nespremljeno</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0 relative">
                <textarea
                  value={notes}
                  onChange={(e) => { setNotes(e.target.value); setIsNotesDirty(true); }}
                  placeholder="Zapišite ovdje bilo što što želite sačuvati..."
                  className="min-h-[480px] w-full resize-none border-none bg-transparent px-10 py-10 text-xl leading-relaxed text-slate-700 focus:outline-none placeholder:text-slate-200"
                />
                <div className="bg-slate-50/30 px-8 py-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-4">
                    <span>{notes.length} znakova</span>
                    <span>{notes.trim().split(/\s+/).filter(Boolean).length} riječi</span>
                  </div>
                  {lastSaved && (
                    <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> Zadnje spremanje: {lastSaved.toLocaleTimeString("hr-HR")}</span>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { title: "Nadzorna ploča", icon: LayoutDashboard, href: "/", color: "text-indigo-600", bg: "bg-indigo-50" },
                { title: "Registar članova", icon: Users, href: "/members", color: "text-emerald-600", bg: "bg-emerald-50" },
                { title: "Predavanja", icon: Mic, href: "/lectures", color: "text-purple-600", bg: "bg-purple-50" },
              ].map((link) => (
                <Link key={link.title} href={link.href}>
                  <Card className="hover:border-slate-300 transition-all cursor-pointer group shadow-sm hover:shadow-md h-full rounded-2xl border-slate-100">
                    <CardContent className="p-5 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`h-11 w-11 rounded-xl ${link.bg} ${link.color} flex items-center justify-center transition-transform group-hover:scale-110`}>
                          <link.icon className="h-5 w-5" />
                        </div>
                        <span className="font-bold text-slate-700">{link.title}</span>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-slate-900 transition-all group-hover:translate-x-1" />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>

            {/* Recent Activity Card */}
            <Card className="border-none shadow-xl rounded-[28px] overflow-hidden bg-white ring-1 ring-slate-200/50">
              <CardHeader className="bg-slate-50/20 border-b border-slate-100/50 px-8 py-5">
                <div className="flex items-center gap-3">
                  <Activity className="h-5 w-5 text-slate-400" />
                  <CardTitle className="text-lg font-bold text-slate-800">Moja zadnja aktivnost</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-50">
                  {userLogs.length === 0 ? (
                    <p className="p-8 text-center text-slate-400 text-sm italic">Nema zabilježenih aktivnosti.</p>
                  ) : (
                    userLogs.map((log) => (
                      <div key={log.id} className="p-4 px-8 hover:bg-slate-50/50 transition-colors flex items-start gap-4">
                         <div className="mt-1 h-2 w-2 rounded-full bg-blue-400" />
                         <div className="flex-1">
                            <p className="text-sm font-medium text-slate-800">{log.action}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{log.details}</p>
                         </div>
                         <span className="text-[10px] uppercase tracking-tighter text-slate-400 font-bold">
                            {log.timestamp.toLocaleDateString("hr-HR")}
                         </span>
                      </div>
                    ))
                  )}
                </div>
                <div className="bg-slate-50/50 p-4 px-8 border-t border-slate-50">
                   <Link href="/logs" className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 w-fit">
                      Pogledaj sve zapise <ArrowRight className="h-3 w-3" />
                   </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-12 xl:col-span-5">
            <Card className="border-none shadow-2xl rounded-[32px] overflow-hidden bg-white h-full flex flex-col ring-1 ring-slate-200/50">
              <CardHeader className="bg-emerald-50/30 border-b border-emerald-100/50 px-8 py-6">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-emerald-600 border border-emerald-100">
                    <ListChecks className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl font-serif font-bold text-slate-900">Privatni Todos</CardTitle>
                    <CardDescription className="text-slate-500">Zadaci vidljivi samo vama.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="p-8 flex-1 flex flex-col gap-6">
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Hash className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
                    <Input 
                      value={newTodo}
                      onChange={(e) => setNewTodo(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addTodo()}
                      placeholder="Novi zadatak..."
                      className="bg-slate-50 border-none h-14 rounded-2xl text-lg pl-12 focus-visible:ring-emerald-500/30 shadow-inner"
                    />
                  </div>
                  <Button 
                    onClick={addTodo} 
                    className="h-14 w-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-100 p-0 transition-transform active:scale-95"
                  >
                    <Plus className="h-7 w-7" />
                  </Button>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
                  {todos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                      <div className="h-20 w-20 rounded-full bg-slate-50 flex items-center justify-center text-slate-200">
                        <CheckCircle2 className="h-10 w-10" />
                      </div>
                      <p className="text-slate-400 font-medium">Sve je obavljeno!</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Non-completed priority first */}
                      {todos.filter(t => !t.done && t.priority).map((todo) => (
                        <TodoItem 
                          key={todo.id} 
                          todo={todo} 
                          onToggle={() => toggleTodo(todo.id)}
                          onDelete={() => deleteTodo(todo.id)}
                          onPriority={() => togglePriority(todo.id)}
                          onFileUpload={(e) => handleFileUpload(todo.id, e)}
                          onRemoveFile={(idx) => handleRemoveFile(todo.id, idx)}
                          isUploading={!!uploadingIds[todo.id]}
                        />
                      ))}
                      {/* Non-completed standard */}
                      {todos.filter(t => !t.done && !t.priority).map((todo) => (
                        <TodoItem 
                          key={todo.id} 
                          todo={todo} 
                          onToggle={() => toggleTodo(todo.id)}
                          onDelete={() => deleteTodo(todo.id)}
                          onPriority={() => togglePriority(todo.id)}
                          onFileUpload={(e) => handleFileUpload(todo.id, e)}
                          onRemoveFile={(idx) => handleRemoveFile(todo.id, idx)}
                          isUploading={!!uploadingIds[todo.id]}
                        />
                      ))}
                      {/* Completed section */}
                      {todos.some(t => t.done) && (
                        <div className="pt-6 space-y-3">
                          <div className="flex items-center gap-3 ml-4">
                             <div className="h-px flex-1 bg-slate-100" />
                             <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300">Završeno</span>
                             <div className="h-px flex-1 bg-slate-100" />
                          </div>
                          {todos.filter(t => t.done).map((todo) => (
                            <TodoItem 
                              key={todo.id} 
                              todo={todo} 
                              onToggle={() => toggleTodo(todo.id)}
                              onDelete={() => deleteTodo(todo.id)}
                              onPriority={() => togglePriority(todo.id)}
                              onFileUpload={(e) => handleFileUpload(todo.id, e)}
                              onRemoveFile={(idx) => handleRemoveFile(todo.id, idx)}
                              isUploading={!!uploadingIds[todo.id]}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

function getFileIcon(fileType: string) {
  switch (fileType) {
    case 'image':
      return <Image className="h-4 w-4 text-orange-500" />
    case 'pdf':
      return <FileText className="h-4 w-4 text-red-500" />
    case 'word':
      return <FileText className="h-4 w-4 text-blue-600" />
    default:
      return <FileText className="h-4 w-4 text-slate-500" />
  }
}

function formatBytes(bytes: number, decimals = 1) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

function TodoItem({ 
  todo, 
  onToggle, 
  onDelete, 
  onPriority,
  onFileUpload,
  onRemoveFile,
  isUploading
}: { 
  todo: { 
    id: string; 
    text: string; 
    done: boolean; 
    priority?: boolean;
    files?: { name: string; url: string; fileType: 'image' | 'pdf' | 'word'; size?: number }[];
  }; 
  onToggle: () => void; 
  onDelete: () => void;
  onPriority: () => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: (idx: number) => void;
  isUploading: boolean;
}) {
  return (
    <div className={`group flex flex-col gap-3 p-4 rounded-2xl border transition-all duration-300 ${
      todo.done 
        ? "bg-slate-50/50 border-transparent opacity-60" 
        : todo.priority 
          ? "bg-white border-amber-200 shadow-amber-50 shadow-md ring-1 ring-amber-100" 
          : "bg-white border-slate-100 hover:border-slate-200 shadow-sm"
    }`}>
      <div className="flex items-center gap-4">
        <button 
          onClick={onToggle}
          className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${
            todo.done 
            ? "bg-emerald-500 border-emerald-500" 
            : "border-slate-200 hover:border-emerald-500 bg-white"
          }`}
        >
          {todo.done ? <Check className="h-3.5 w-3.5 text-white" /> : <Circle className="h-3.5 w-3.5 text-transparent" />}
        </button>
        
        <span className={`flex-1 text-base font-medium transition-all ${
          todo.done ? "line-through text-slate-400" : "text-slate-700"
        }`}>
          {todo.text}
        </span>

        <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0">
          {isUploading ? (
            <div className="p-2 text-blue-500">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : (
            <label className="p-2 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors block">
              <Paperclip className="h-4 w-4" />
              <input 
                type="file" 
                className="hidden" 
                onChange={onFileUpload} 
                accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              />
            </label>
          )}
          <button 
            onClick={onPriority}
            className={`p-2 transition-colors rounded-lg ${
              todo.priority ? "text-amber-500 bg-amber-50" : "text-slate-300 hover:text-amber-500 hover:bg-slate-50"
            }`}
          >
            <Star className={`h-4 w-4 ${todo.priority ? "fill-current" : ""}`} />
          </button>
          <button 
            onClick={onDelete}
            className="text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors p-2 rounded-lg"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Files section */}
      {todo.files && todo.files.length > 0 && (
        <div className="flex flex-wrap gap-2 w-full border-t border-slate-100/50 pt-3 mt-1">
          {todo.files.map((file, idx) => (
            <div 
              key={idx} 
              className="group/file flex items-center gap-2 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/50 rounded-xl px-3 py-2 transition-all text-xs"
            >
              {getFileIcon(file.fileType)}
              <a 
                href={file.url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-slate-600 hover:text-blue-600 font-medium truncate max-w-[130px] sm:max-w-[220px] transition-colors"
                title={file.name}
              >
                {file.name}
              </a>
              {file.size && (
                <span className="text-[10px] text-slate-400 font-normal">
                  ({formatBytes(file.size)})
                </span>
              )}
              <button 
                onClick={(e) => { e.preventDefault(); onRemoveFile(idx); }}
                className="text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg p-1 transition-colors ml-1"
                title="Ukloni dokument"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
