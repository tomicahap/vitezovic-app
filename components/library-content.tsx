"use client"

import { useState, useMemo, useRef } from "react"
import {
  Search, Plus, BookOpen, X, ChevronLeft, ChevronRight,
  Loader2, BookMarked, Newspaper, Edit3, Trash2, Save,
  User, BookCopy, ArrowLeftRight, Check, Filter, Download, 
  Paperclip, Image, File, FileType2, ZoomIn, Lock, 
  Mail, MessageSquare, ScanLine, HardDrive
} from "lucide-react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useLibrary, Book, Journal } from "@/contexts/library-context"
import { useMembers } from "@/contexts/members-context"
import { useAuth } from "@/contexts/auth-context"
import { generateId } from "@/lib/utils"

// ─── Helpers ──────────────────────────────────────────────────────────────────
function FileIcon({ fileType }: { fileType: string }) {
  if (fileType === "image") return <Image className="h-5 w-5 text-blue-500" />
  if (fileType === "pdf") return <FileType2 className="h-5 w-5 text-red-500" />
  return <File className="h-5 w-5 text-indigo-500" />
}

function formatBytes(bytes?: number): string {
  if (!bytes) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function Lightbox({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  const [zoom, setZoom] = useState(false)
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4" onClick={onClose}>
      <button className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" onClick={onClose}><X className="h-5 w-5" /></button>
      <img src={url} alt={name} onClick={e => { e.stopPropagation(); setZoom(!zoom) }}
        className={`max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-2xl transition-all ${zoom ? "scale-110 cursor-zoom-out" : "cursor-zoom-in"}`} />
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-4 py-1.5 text-xs text-white backdrop-blur">{name}</div>
    </div>
  )
}

// ─── Constants ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 15

// ─── Book Detail Dialog ───────────────────────────────────────────────────────

function BookDetailDialog({ book: initial, onClose }: { book: Book; onClose: () => void }) {
  const { updateBook, deleteBook } = useLibrary()
  const { members } = useMembers()
  const { user } = useAuth()
  const canEdit = user?.role === "admin" || user?.accessRights?.library?.edit === true

  const [book, setBook] = useState<Book>(initial)
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [loanSearch, setLoanSearch] = useState("")
  const [tab, setTab] = useState<"info" | "loan" | "rights" | "attachments">("info")
  const [uploading, setUploading] = useState(false)
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function patch(u: Partial<Book>) { setBook(prev => ({ ...prev, ...u })); setIsDirty(true) }

  async function handleSave() {
    setIsSaving(true)
    await updateBook(book.id, book)
    setIsSaving(false)
    setIsDirty(false)
  }

  async function handleDelete() {
    if (!confirm("Sigurno obrišeš ovu knjigu iz evidencije?")) return
    await deleteBook(book.id)
    onClose()
  }

  function returnBook() {
    patch({ loan_member_id: undefined, loan_member_name: "", loan_date: "", loan_return_date: "", loan_notes: "" })
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch("/api/meetings/upload", { method: "POST", body: form })
      if (res.ok) {
        const { url, name, fileType, size } = await res.json()
        patch({ attachments: [...(book.attachments || []), { id: generateId(), name, url, fileType, size }] })
      }
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const isLoaned = !!(book.loan_member_name)
  const filteredMembers = loanSearch
    ? members.filter(m => m.name.toLowerCase().includes(loanSearch.toLowerCase()))
    : members.filter(m => m.status === "active").slice(0, 10)

  const attachCount = (book.attachments || []).length

  return (
    <>
      {lightbox && <Lightbox url={lightbox.url} name={lightbox.name} onClose={() => setLightbox(null)} />}
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-start gap-4 border-b border-border p-6">
          <div className="flex h-12 w-10 flex-shrink-0 items-center justify-center rounded bg-accent/10 text-accent">
            <BookOpen className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="mb-1 flex items-center gap-2">
              {book.broj && <span className="text-xs font-mono text-muted-foreground">#{book.broj}</span>}
              {isLoaned && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">POSUDBA</span>}
            </div>
            <h2 className="font-serif text-xl font-bold leading-tight">{book.naslov}</h2>
            {book.autor && <p className="mt-0.5 text-sm text-muted-foreground">{book.autor}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-6">
          {[
            { id: "info", label: "Bibliografski podaci", icon: BookMarked },
            { id: "loan", label: isLoaned ? "Posudba ✓" : "Posudba", icon: ArrowLeftRight },
            { id: "rights", label: "Prava korištenja", icon: Lock },
            { id: "attachments", label: `Prilozi (${attachCount})`, icon: Paperclip },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className={`flex items-center gap-1.5 border-b-2 px-4 py-3 text-xs font-medium transition-colors ${tab === t.id ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <t.icon className="h-3 w-3" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === "info" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Naslov", key: "naslov", full: true },
                  { label: "Podnaslov", key: "podnaslov", full: true },
                  { label: "Autor(i)", key: "autor", full: true },
                  { label: "Izdavač", key: "izdavac" },
                  { label: "Mjesto izdanja", key: "mjesto" },
                  { label: "Godina", key: "godina" },
                  { label: "ISBN", key: "isbn" },
                  { label: "Uvez", key: "uvez" },
                  { label: "Stranice", key: "stranice" },
                  { label: "Jezik", key: "jezik" },
                  { label: "Signatura", key: "signatura" },
                  { label: "Polica", key: "polica" },
                ].map(({ label, key, full }) => (
                  <div key={key} className={full ? "col-span-2" : ""}>
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</label>
                    {canEdit ? (
                      <input value={(book as any)[key] ?? ""} onChange={e => patch({ [key]: e.target.value } as any)}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
                    ) : (
                      <p className="text-sm text-foreground">{(book as any)[key] || <span className="text-muted-foreground/50 italic">—</span>}</p>
                    )}
                  </div>
                ))}
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Napomena</label>
                {canEdit ? (
                  <textarea value={book.napomena ?? ""} onChange={e => patch({ napomena: e.target.value })} rows={3}
                    className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
                ) : (
                  <p className="text-sm text-muted-foreground">{book.napomena || <span className="italic">Bez napomene.</span>}</p>
                )}
              </div>
            </div>
          )}


          {tab === "loan" && (
            <div className="space-y-4">
              {isLoaned ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <ArrowLeftRight className="h-4 w-4 text-amber-600" />
                    <p className="font-medium text-amber-800">Knjiga je trenutno posuđena</p>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p><span className="text-muted-foreground">Posudba:</span> <span className="font-medium">{book.loan_member_name}</span></p>
                    {book.loan_date && <p><span className="text-muted-foreground">Datum posudbe:</span> {new Date(book.loan_date).toLocaleDateString("hr-HR")}</p>}
                    {book.loan_return_date && <p><span className="text-muted-foreground">Rok povrata:</span> {new Date(book.loan_return_date).toLocaleDateString("hr-HR")}</p>}
                    {book.loan_notes && <p><span className="text-muted-foreground">Napomena:</span> {book.loan_notes}</p>}
                  </div>
                  {canEdit && (
                    <Button variant="outline" size="sm" className="mt-3 gap-2 border-amber-300 text-amber-700 hover:bg-amber-100" onClick={returnBook}>
                      <Check className="h-3.5 w-3.5" /> Označi kao vraćeno
                    </Button>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border p-4 text-center">
                  <BookCopy className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">Knjiga je dostupna za posudbu</p>
                </div>
              )}

              {canEdit && (
                <div className="space-y-3">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {isLoaned ? "Promjena posuditelja" : "Evidentirati posudbu"}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Posuditelj</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <input value={loanSearch || book.loan_member_name || ""}
                          onChange={e => { setLoanSearch(e.target.value); patch({ loan_member_name: e.target.value }) }}
                          placeholder="Pretraži ili upiši ime..."
                          className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
                      </div>
                      {loanSearch && filteredMembers.length > 0 && (
                        <div className="mt-1 max-h-32 overflow-y-auto rounded-lg border border-border bg-background shadow">
                          {filteredMembers.map(m => (
                            <button key={m.id} type="button" onMouseDown={() => { patch({ loan_member_id: m.id, loan_member_name: m.name }); setLoanSearch("") }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary">
                              <span className="font-medium">{m.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Datum posudbe</label>
                      <input type="date" value={book.loan_date ?? ""} onChange={e => patch({ loan_date: e.target.value })}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Rok povrata</label>
                      <input type="date" value={book.loan_return_date ?? ""} onChange={e => patch({ loan_return_date: e.target.value })}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
                    </div>
                    <div className="col-span-2">
                      <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Napomena posudbe</label>
                      <input value={book.loan_notes ?? ""} onChange={e => patch({ loan_notes: e.target.value })}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "rights" && (
            <div className="space-y-6">
              <div className="rounded-xl bg-accent/5 p-4 border border-accent/10">
                <h3 className="text-sm font-semibold mb-1">Evidencija autorskih prava</h3>
                <p className="text-xs text-muted-foreground">Pratite komunikaciju s autorima i izdavačima za potrebe posudbe unutar društva.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-3 p-4 rounded-lg border border-border bg-card/40">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Kontaktiran autor/izdavač</Label>
                    <button onClick={() => patch({ rights_contacted: book.rights_contacted === 1 ? 0 : 1 })}
                      className={`h-5 w-10 rounded-full transition-colors relative ${book.rights_contacted === 1 ? "bg-accent" : "bg-muted"}`}>
                      <div className={`absolute top-1 h-3 w-3 rounded-full bg-white transition-all ${book.rights_contacted === 1 ? "left-6" : "left-1"}`} />
                    </button>
                  </div>
                  {book.rights_contacted === 1 && (
                    <div className="animate-in fade-in slide-in-from-top-1">
                      <Label className="text-xs mb-1 block">Datum prvog kontakta</Label>
                      <Input type="date" value={book.rights_contact_date || ""} onChange={e => patch({ rights_contact_date: e.target.value })} />
                    </div>
                  )}
                </div>

                <div className="col-span-2 space-y-3 p-4 rounded-lg border border-border bg-card/40">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Odgovor zaprimljen</Label>
                    <button onClick={() => patch({ rights_responded: book.rights_responded === 1 ? 0 : 1 })}
                      className={`h-5 w-10 rounded-full transition-colors relative ${book.rights_responded === 1 ? "bg-accent" : "bg-muted"}`}>
                      <div className={`absolute top-1 h-3 w-3 rounded-full bg-white transition-all ${book.rights_responded === 1 ? "left-6" : "left-1"}`} />
                    </button>
                  </div>
                  {book.rights_responded === 1 && (
                    <div className="animate-in fade-in slide-in-from-top-1">
                      <Label className="text-xs mb-1 block">Datum odgovora</Label>
                      <Input type="date" value={book.rights_response_date || ""} onChange={e => patch({ rights_response_date: e.target.value })} />
                    </div>
                  )}
                </div>

                <div className={`col-span-2 p-4 rounded-lg border transition-colors ${book.rights_consent === 1 ? "border-green-200 bg-green-50" : "border-border bg-card/40"}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">DOZVOLA ZA POSUDBU</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">Pristanak autora za korištenje unutar društva</p>
                    </div>
                    <button onClick={() => patch({ rights_consent: book.rights_consent === 1 ? 0 : 1 })}
                      className={`h-6 w-12 rounded-full transition-colors relative ${book.rights_consent === 1 ? "bg-green-600" : "bg-muted"}`}>
                      <div className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${book.rights_consent === 1 ? "left-7" : "left-1"}`} />
                    </button>
                  </div>
                </div>

                <div className="col-span-1 p-4 rounded-lg border border-border bg-card/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">SKENIRANO</Label>
                      <p className="text-[10px] text-muted-foreground">Fizički skenirano</p>
                    </div>
                    <button onClick={() => patch({ is_scanned: book.is_scanned === 1 ? 0 : 1 })}
                      className={`h-5 w-10 rounded-full transition-colors relative ${book.is_scanned === 1 ? "bg-orange-500" : "bg-muted"}`}>
                      <div className={`absolute top-1 h-3 w-3 rounded-full bg-white transition-all ${book.is_scanned === 1 ? "left-6" : "left-1"}`} />
                    </button>
                  </div>
                </div>

                <div className="col-span-1 p-4 rounded-lg border border-border bg-card/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">DIGITALIZIRANO</Label>
                      <p className="text-[10px] text-muted-foreground">Obogaćeno OCR-om</p>
                    </div>
                    <button onClick={() => patch({ is_digitized: book.is_digitized === 1 ? 0 : 1 })}
                      className={`h-5 w-10 rounded-full transition-colors relative ${book.is_digitized === 1 ? "bg-teal-500" : "bg-muted"}`}>
                      <div className={`absolute top-1 h-3 w-3 rounded-full bg-white transition-all ${book.is_digitized === 1 ? "left-6" : "left-1"}`} />
                    </button>
                  </div>
                </div>

                <div className="col-span-2 space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Skenirani pristanak / Dokumentacija</Label>
                  {book.rights_attachment ? (
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-background">
                       <div className="flex items-center gap-2">
                         <File className="h-4 w-4 text-accent" />
                         <span className="text-sm font-medium truncate max-w-[200px]">{JSON.parse(book.rights_attachment).name}</span>
                       </div>
                       <div className="flex gap-2">
                         <a href={JSON.parse(book.rights_attachment).url} target="_blank" rel="noreferrer" className="p-1.5 hover:bg-secondary rounded"><Download className="h-4 w-4" /></a>
                         {canEdit && <button onClick={() => patch({ rights_attachment: undefined })} className="p-1.5 hover:bg-red-50 text-red-600 rounded"><Trash2 className="h-4 w-4" /></button>}
                       </div>
                    </div>
                  ) : (
                    <button onClick={async () => {
                      const input = document.createElement('input')
                      input.type = 'file'
                      input.onchange = async (e: any) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        setUploading(true)
                        try {
                          const form = new FormData()
                          form.append("file", file)
                          const res = await fetch("/api/meetings/upload", { method: "POST", body: form })
                          if (res.ok) {
                            const data = await res.json()
                            patch({ rights_attachment: JSON.stringify(data) })
                          }
                        } finally { setUploading(false) }
                      }
                      input.click()
                    }} disabled={uploading}
                    className="w-full flex flex-col items-center justify-center py-8 border-2 border-dashed border-border rounded-xl hover:border-accent hover:bg-accent/5 transition-all">
                      <Paperclip className="h-6 w-6 text-muted-foreground mb-2" />
                      <span className="text-xs font-medium">{uploading ? "Slanje..." : "Priloži dokaz o dozvoli"}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === "attachments" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Digitalni prilozi</h3>
                  <p className="text-xs text-muted-foreground">Slike korica, PDF sažeci ili dokumenti.</p>
                </div>
                {canEdit && (
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => fileRef.current?.click()} disabled={uploading}>
                    {uploading ? "Slanje..." : <><Plus className="h-4 w-4" /> Dodaj datoteku</>}
                  </Button>
                )}
                <input ref={fileRef} type="file" className="hidden" accept="image/*,.pdf,.doc,.docx" onChange={handleFileUpload} />
              </div>

              {attachCount === 0 ? (
                <div className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-12 text-center hover:border-accent"
                  onClick={() => canEdit && fileRef.current?.click()}>
                  <Paperclip className="mb-3 h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">{canEdit ? "Klikni za upload datoteke" : "Nema priloga."}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Image Grid */}
                  {book.attachments?.some(a => a.fileType === "image") && (
                    <div className="grid grid-cols-2 gap-2">
                      {book.attachments.filter(a => a.fileType === "image").map(att => (
                        <div key={att.id} className="group relative aspect-video overflow-hidden rounded-lg border border-border bg-secondary">
                          <img src={att.url} alt={att.name} className="h-full w-full object-cover cursor-pointer" onClick={() => setLightbox({ url: att.url, name: att.name })} />
                          <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 bg-black/40 transition-opacity">
                            <button onClick={() => setLightbox({ url: att.url, name: att.name })} className="rounded-full bg-white p-1.5 shadow-lg hover:scale-110 transiton-transform"><ZoomIn className="h-3.5 w-3.5" /></button>
                            {canEdit && <button onClick={() => patch({ attachments: book.attachments?.filter(a => a.id !== att.id) })} className="rounded-full bg-red-500 p-1.5 text-white shadow-lg hover:bg-red-600"><Trash2 className="h-3.5 w-3.5" /></button>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Document List */}
                  {book.attachments?.filter(a => a.fileType !== "image").map(att => (
                    <div key={att.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-sm hover:shadow transition-shadow">
                      <FileIcon fileType={att.fileType} />
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium">{att.name}</p>
                        {att.size && <p className="text-[10px] text-muted-foreground">{formatBytes(att.size)}</p>}
                      </div>
                      <a href={att.url} download target="_blank" rel="noreferrer" className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary"><Download className="h-4 w-4" /></a>
                      {canEdit && <button onClick={() => patch({ attachments: book.attachments?.filter(a => a.id !== att.id) })} className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          {canEdit ? (
            <Button variant="outline" size="sm" className="gap-2 text-red-600 hover:bg-red-50" onClick={handleDelete}>
              <Trash2 className="h-4 w-4" /> Obriši
            </Button>
          ) : <div />}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Zatvori</Button>
            {isDirty && (
              <Button size="sm" className="gap-2" onClick={handleSave} disabled={isSaving}>
                <Save className="h-4 w-4" />{isSaving ? "Spremanje…" : "Spremi"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Journal Detail Dialog ────────────────────────────────────────────────────

function JournalDetailDialog({ journal: initial, onClose }: { journal: Journal; onClose: () => void }) {
  const { updateJournal, deleteJournal } = useLibrary()
  const { user } = useAuth()
  const canEdit = user?.role === "admin" || user?.accessRights?.library?.edit === true
  const [journal, setJournal] = useState<Journal>(initial)
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch("/api/meetings/upload", { method: "POST", body: form })
      if (res.ok) {
        const { url, name, fileType, size } = await res.json()
        patch({ attachments: [...(journal.attachments || []), { id: generateId(), name, url, fileType, size }] })
      }
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const attachCount = (journal.attachments || []).length

  return (
    <>
      {lightbox && <Lightbox url={lightbox.url} name={lightbox.name} onClose={() => setLightbox(null)} />}
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-background shadow-2xl">
        <div className="flex items-start gap-4 border-b border-border p-6">
          <div className="flex h-12 w-10 flex-shrink-0 items-center justify-center rounded bg-accent/10 text-accent"><Newspaper className="h-5 w-5" /></div>
          <div className="flex-1 min-w-0">
            {journal.broj && <span className="mb-1 block text-xs font-mono text-muted-foreground">#{journal.broj}</span>}
            <h2 className="font-serif text-xl font-bold leading-tight">{journal.naslov}</h2>
            {journal.svesci && <p className="mt-0.5 text-sm text-muted-foreground">{journal.svesci}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-6">
          {[
            { id: "info", label: "Podaci", icon: BookMarked },
            { id: "attachments", label: `Prilozi (${attachCount})`, icon: Paperclip },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className={`flex items-center gap-1.5 border-b-2 px-4 py-3 text-xs font-medium transition-colors ${tab === t.id ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <t.icon className="h-3 w-3" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tab === "info" && (
            <div className="space-y-4">
              {[
                { label: "Naziv časopisa", key: "naslov", full: true },
                { label: "Svesci / Godišta", key: "svesci", full: true },
                { label: "Područje", key: "podrucje" },
                { label: "Izdavač", key: "izdavac" },
                { label: "ISSN", key: "issn" },
              ].map(({ label, key, full }) => (
                <div key={key} className={full ? "" : "inline-block w-1/2 pr-2"}>
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</label>
                  {canEdit ? (
                    <input value={(journal as any)[key] ?? ""} onChange={e => patch({ [key]: e.target.value } as any)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
                  ) : (
                    <p className="text-sm">{(journal as any)[key] || <span className="italic text-muted-foreground">—</span>}</p>
                  )}
                </div>
              ))}
              <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Napomena</label>
                {canEdit ? (
                  <textarea value={journal.napomena ?? ""} onChange={e => patch({ napomena: e.target.value })} rows={3}
                    className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
                ) : (
                  <p className="text-sm text-muted-foreground">{journal.napomena || <span className="italic">Bez napomene.</span>}</p>
                )}
              </div>
            </div>
          )}

          {tab === "attachments" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Digitalni prilozi</h3>
                  <p className="text-xs text-muted-foreground">PDF i dokumenti časopisa.</p>
                </div>
                {canEdit && (
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => fileRef.current?.click()} disabled={uploading}>
                    {uploading ? "Slanje..." : <><Plus className="h-4 w-4" /> Dodaj datoteku</>}
                  </Button>
                )}
                <input ref={fileRef} type="file" className="hidden" accept="image/*,.pdf,.doc,.docx" onChange={handleFileUpload} />
              </div>

              {attachCount === 0 ? (
                <div className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-12 text-center hover:border-accent"
                  onClick={() => canEdit && fileRef.current?.click()}>
                  <Paperclip className="mb-3 h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground text-center px-4">{canEdit ? "Klikni za upload PDF-a ili dokumenta" : "Nema priloga."}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {journal.attachments?.map(att => (
                    <div key={att.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-sm hover:shadow transition-shadow">
                      <FileIcon fileType={att.fileType} />
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium">{att.name}</p>
                        {att.size && <p className="text-[10px] text-muted-foreground">{formatBytes(att.size)}</p>}
                      </div>
                      <a href={att.url} download target="_blank" rel="noreferrer" className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary"><Download className="h-4 w-4" /></a>
                      {canEdit && <button onClick={() => patch({ attachments: journal.attachments?.filter(a => a.id !== att.id) })} className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          {canEdit ? (
            <Button variant="outline" size="sm" className="gap-2 text-red-600 hover:bg-red-50" onClick={async () => { if (!confirm("Obriši?")) return; await deleteJournal(journal.id); onClose() }}>
              <Trash2 className="h-4 w-4" /> Obriši
            </Button>
          ) : <div />}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Zatvori</Button>
            {isDirty && (
              <Button size="sm" className="gap-2" onClick={async () => { setIsSaving(true); await updateJournal(journal.id, journal); setIsSaving(false); setIsDirty(false) }} disabled={isSaving}>
                <Save className="h-4 w-4" />{isSaving ? "Spremanje…" : "Spremi"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Add Book Dialog ──────────────────────────────────────────────────────────

function AddBookDialog({ onClose }: { onClose: () => void }) {
  const { addBook, books } = useLibrary()
  const [form, setForm] = useState({ broj: (Math.max(0, ...books.map(b => b.broj ?? 0)) + 1).toString(), naslov: "", autor: "", izdavac: "", godina: "", isbn: "" })
  const [submitting, setSubmitting] = useState(false)
  function patch(u: any) { setForm(prev => ({ ...prev, ...u })) }
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <div><h2 className="font-serif text-xl font-bold">Dodaj novu knjigu</h2><p className="text-sm text-muted-foreground">Unesi bibliografske podatke</p></div>
          <button onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4 p-6">
          <div className="grid grid-cols-3 gap-3">
            <div><label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Br. *</label>
              <input type="number" value={form.broj} onChange={e => patch({ broj: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent" /></div>
            <div className="col-span-2"><label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">ISBN</label>
              <input value={form.isbn} onChange={e => patch({ isbn: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent" /></div>
          </div>
          {[{ label: "Naslov *", key: "naslov" }, { label: "Autor(i)", key: "autor" }, { label: "Izdavač / Mjesto i godina", key: "izdavac" }].map(({ label, key }) => (
            <div key={key}><label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</label>
              <input autoFocus={key === "naslov"} value={(form as any)[key]} onChange={e => patch({ [key]: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent" /></div>
          ))}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={onClose}>Odustani</Button>
            <Button className="gap-2 bg-primary text-primary-foreground" disabled={submitting || !form.naslov.trim()} onClick={async () => { if (!form.naslov.trim()) return; setSubmitting(true); await addBook({ broj: parseInt(form.broj) || undefined, naslov: form.naslov.trim(), autor: form.autor || undefined, izdavac: form.izdavac || undefined, isbn: form.isbn || undefined }); setSubmitting(false); onClose() }}>
              <Plus className="h-4 w-4" />{submitting ? "Spremanje…" : "Dodaj knjigu"}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Add Journal Dialog ───────────────────────────────────────────────────────

function AddJournalDialog({ onClose }: { onClose: () => void }) {
  const { addJournal, journals } = useLibrary()
  const [form, setForm] = useState({ broj: (Math.max(0, ...journals.map(j => j.broj ?? 0)) + 1).toString(), naslov: "", svesci: "", izdavac: "" })
  const [submitting, setSubmitting] = useState(false)
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <div><h2 className="font-serif text-xl font-bold">Dodaj novi časopis</h2></div>
          <button onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4 p-6">
          <div className="grid grid-cols-4 gap-3">
            <div><label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Br.</label>
              <input type="number" value={form.broj} onChange={e => setForm(p => ({ ...p, broj: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent" /></div>
            <div className="col-span-3"><label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Naziv *</label>
              <input autoFocus value={form.naslov} onChange={e => setForm(p => ({ ...p, naslov: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent" /></div>
          </div>
          {[{ label: "Svesci / Godišta", key: "svesci" }, { label: "Izdavač", key: "izdavac" }].map(({ label, key }) => (
            <div key={key}><label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</label>
              <input value={(form as any)[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent" /></div>
          ))}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={onClose}>Odustani</Button>
            <Button className="gap-2 bg-primary text-primary-foreground" disabled={submitting || !form.naslov.trim()} onClick={async () => { setSubmitting(true); await addJournal({ broj: parseInt(form.broj) || undefined, naslov: form.naslov.trim(), svesci: form.svesci || undefined, izdavac: form.izdavac || undefined }); setSubmitting(false); onClose() }}>
              <Plus className="h-4 w-4" />{submitting ? "Spremanje…" : "Dodaj"}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function LibraryContent() {
  const { books, journals, isLoadingBooks, isLoadingJournals } = useLibrary()
  const { user } = useAuth()
  const canEdit = user?.role === "admin" || user?.accessRights?.library?.edit === true

  const [activeTab, setActiveTab] = useState<"books" | "journals">("books")
  const [search, setSearch] = useState("")
  const [loanedOnly, setLoanedOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)
  const [selectedJournal, setSelectedJournal] = useState<Journal | null>(null)
  const [showAddBook, setShowAddBook] = useState(false)
  const [showAddJournal, setShowAddJournal] = useState(false)
  const [rightsFilter, setRightsFilter] = useState<'all' | 'with' | 'without'>('all')

  const filteredBooks = useMemo(() => books.filter(b => {
    const s = !search || b.naslov.toLowerCase().includes(search.toLowerCase()) ||
      (b.autor ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (b.isbn ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (b.broj?.toString() ?? "").includes(search)
    const l = !loanedOnly || !!b.loan_member_name
    const r = rightsFilter === 'all' ? true : 
              rightsFilter === 'with' ? b.rights_consent === 1 : 
              rightsFilter === 'scanned' ? b.is_scanned === 1 :
              rightsFilter === 'digitized' ? b.is_digitized === 1 :
              b.rights_consent !== 1
    return s && l && r
  }), [books, search, loanedOnly, rightsFilter])

  const filteredJournals = useMemo(() => journals.filter(j =>
    !search || j.naslov.toLowerCase().includes(search.toLowerCase()) || (j.svesci ?? "").toLowerCase().includes(search.toLowerCase())
  ), [journals, search])

  const pagedBooks = filteredBooks.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const pagedJournals = filteredJournals.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const totalBookPages = Math.ceil(filteredBooks.length / PAGE_SIZE)
  const totalJournalPages = Math.ceil(filteredJournals.length / PAGE_SIZE)

  const loanedCount = books.filter(b => !!b.loan_member_name).length

  // Sync selected book/journal with live data
  const liveBook = selectedBook ? books.find(b => b.id === selectedBook.id) ?? selectedBook : null
  const liveJournal = selectedJournal ? journals.find(j => j.id === selectedJournal.id) ?? selectedJournal : null

  return (
    <main className="flex-1 overflow-auto">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-4 sm:px-8 py-4">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Pretraži po naslovu, autoru, ISBN, broju..."
              className="border-border bg-card pl-10" value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }} />
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            {search && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setPage(1) }} className="gap-1.5 text-muted-foreground">
                <X className="h-3.5 w-3.5" /> Očisti
              </Button>
            )}
            {canEdit && (
              <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => activeTab === "books" ? setShowAddBook(true) : setShowAddJournal(true)}>
                <Plus className="h-4 w-4" /> {activeTab === "books" ? "Nova knjiga" : "Novi časopis"}
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="p-4 sm:p-8">
        {/* Title + stats */}
        <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold">Knjižnica društva</h2>
            <p className="mt-2 text-sm text-muted-foreground">Katalog knjiga i periodike u vlasništvu društva.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto">
            {[
              { value: books.length, label: "Knjiga" },
              { value: books.filter(b => b.is_scanned === 1).length, label: "Skenirano" },
              { value: books.filter(b => b.is_digitized === 1).length, label: "Digitalizirano" },
              { value: loanedCount, label: "Posuđeno" },
            ].map(s => (
              <div key={s.label} className="rounded-lg border border-border bg-card p-3 sm:p-4 text-center">
                <p className="text-xl sm:text-2xl font-bold text-accent">{s.value}</p>
                <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex rounded-xl border border-border bg-muted p-1 gap-1 overflow-x-auto whitespace-nowrap scrollbar-none max-w-full">
            {[
              { id: "books", label: `Knjige (${books.length})`, icon: BookOpen },
              { id: "journals", label: `Časopisi (${journals.length})`, icon: Newspaper },
            ].map(t => {
              const Icon = t.icon
              return (
                <button key={t.id} onClick={() => { setActiveTab(t.id as any); setPage(1); setSearch("") }}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${activeTab === t.id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  <Icon className="h-4 w-4" /> {t.label}
                </button>
              )
            })}
          </div>
          {activeTab === "books" && (
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              <button onClick={() => { setLoanedOnly(v => !v); setPage(1) }}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${loanedOnly ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:border-accent/30"}`}>
                <ArrowLeftRight className="h-3.5 w-3.5" />
                {loanedOnly ? "Dostupno za posudbu" : "Filtriraj posuđene"}
              </button>
              <div className="flex flex-wrap flex-1 sm:flex-none rounded-lg border border-border bg-card p-1 justify-center">
                {[
                  { id: 'all', label: 'Sva prava' },
                  { id: 'with', label: 'S pravima', icon: Check },
                  { id: 'scanned', label: 'Skenirano', icon: ScanLine },
                  { id: 'digitized', label: 'Digitalizirano', icon: HardDrive }
                ].map(f => (
                  <button key={f.id} onClick={() => { setRightsFilter(f.id as any); setPage(1) }}
                    className={`flex items-center gap-1.5 rounded px-3 py-1 text-xs font-medium transition-all ${rightsFilter === f.id ? "bg-accent text-accent-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                    {f.icon && <f.icon className="h-3 w-3" />}
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── BOOKS ── */}
        {activeTab === "books" && (
          <>
            {isLoadingBooks ? (
              <div className="flex flex-col items-center justify-center py-24">
                <Loader2 className="mb-4 h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Učitavanje kataloga ({books.length} knjiga)…</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto w-full rounded-xl border border-border">
                  <table className="w-full text-sm min-w-[800px]">
                    <thead>
                      <tr className="border-b border-border bg-muted/50 text-left">
                        <th className="px-4 py-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground w-12">Br.</th>
                        <th className="px-4 py-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Naslov</th>
                        <th className="hidden px-4 py-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground md:table-cell">Autor(i)</th>
                        <th className="hidden px-4 py-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground lg:table-cell">Izdavač</th>
                        <th className="px-4 py-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground w-40 text-center">Status / Prava</th>
                        <th className="px-4 py-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground w-24">Posudba</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {pagedBooks.length === 0 ? (
                        <tr><td colSpan={6} className="py-16 text-center text-muted-foreground">
                          <BookOpen className="mx-auto mb-2 h-8 w-8 opacity-30" />
                          <p>Nema rezultata</p>
                        </td></tr>
                      ) : pagedBooks.map(book => (
                        <tr key={book.id} onClick={() => setSelectedBook(book)}
                          className="cursor-pointer transition-colors hover:bg-secondary/30">
                          <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{book.broj ?? "—"}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <p className="font-medium text-foreground line-clamp-1">{book.naslov}</p>
                                {book.isbn && <p className="text-xs text-muted-foreground/70">ISBN: {book.isbn}</p>}
                              </div>
                              
                              {/* Attachments Indicators */}
                              {(book.attachments || []).length > 0 && (
                                <div className="flex items-center gap-2 pr-2">
                                  {(book.attachments || []).filter(a => a.fileType === 'image').length > 0 && (
                                    <span className="flex items-center gap-1 text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-1 rounded" title="Slike">
                                      <Image className="h-2.5 w-2.5" /> {(book.attachments || []).filter(a => a.fileType === 'image').length}
                                    </span>
                                  )}
                                  {(book.attachments || []).filter(a => a.fileType !== 'image').length > 0 && (
                                    <span className="flex items-center gap-1 text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-100 px-1 rounded" title="Dokumenti">
                                      <Paperclip className="h-2.5 w-2.5" /> {(book.attachments || []).filter(a => a.fileType !== 'image').length}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{book.autor ?? "—"}</td>
                          <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">{book.izdavac ?? "—"}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-2">
                              {/* 1. Kontaktiran */}
                              <div title={book.rights_contacted === 1 ? `Kontaktiran: ${book.rights_contact_date || '?'}` : "Nije kontaktiran"} 
                                className={`flex h-6 w-6 items-center justify-center rounded-md border transition-colors ${book.rights_contacted === 1 ? "border-blue-200 bg-blue-50 text-blue-600" : "border-slate-100 bg-slate-50 text-slate-300"}`}>
                                <Mail className="h-3.5 w-3.5" />
                              </div>
                              
                              {/* 2. Odgovoreno */}
                              <div title={book.rights_responded === 1 ? `Odgovoreno: ${book.rights_response_date || '?'}` : "Nema odgovora"} 
                                className={`flex h-6 w-6 items-center justify-center rounded-md border transition-colors ${book.rights_responded === 1 ? "border-purple-200 bg-purple-50 text-purple-600" : "border-slate-100 bg-slate-50 text-slate-300"}`}>
                                <MessageSquare className="h-3.5 w-3.5" />
                              </div>

                              {/* 3. Dozvola / Pristanak */}
                              <div title={book.rights_consent === 1 ? "Dopuštena posudba" : "Nema dozvole"} 
                                className={`flex h-6 w-6 items-center justify-center rounded-md border transition-colors ${book.rights_consent === 1 ? "border-green-200 bg-green-50 text-green-600" : "border-red-50 bg-red-50/50 text-red-200"}`}>
                                {book.rights_consent === 1 ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                              </div>

                              {/* 4. Skenirano */}
                              <div title={book.is_scanned === 1 ? "Skenirano" : "Nije skenirano"} 
                                className={`flex h-6 w-6 items-center justify-center rounded-md border transition-colors ${book.is_scanned === 1 ? "border-orange-200 bg-orange-50 text-orange-600" : "border-slate-100 bg-slate-50 text-slate-300"}`}>
                                <ScanLine className="h-3.5 w-3.5" />
                              </div>

                              {/* 5. Digitalizirano */}
                              <div title={book.is_digitized === 1 ? "Digitalizirano" : "Nije digitalizirano"} 
                                className={`flex h-6 w-6 items-center justify-center rounded-md border transition-colors ${book.is_digitized === 1 ? "border-teal-200 bg-teal-50 text-teal-600" : "border-slate-100 bg-slate-50 text-slate-300"}`}>
                                <HardDrive className="h-3.5 w-3.5" />
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {book.loan_member_name ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                                <ArrowLeftRight className="h-2.5 w-2.5" /> {book.loan_member_name.split(" ")[0]}
                              </span>
                            ) : (
                              <span className="text-[10px] text-green-600">Dostupno</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination books */}
                {totalBookPages > 1 && (
                  <div className="mt-6 flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredBooks.length)}</span> od <span className="font-medium">{filteredBooks.length}</span>
                    </p>
                    <div className="flex items-center gap-1">
                      <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="rounded p-2 hover:bg-secondary disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                      {Array.from({ length: Math.min(totalBookPages, 7) }, (_, i) => {
                        const p = i + Math.max(1, Math.min(page - 3, totalBookPages - 6))
                        return <button key={p} onClick={() => setPage(p)} className={`h-8 w-8 rounded text-sm ${page === p ? "bg-primary text-primary-foreground font-medium" : "hover:bg-secondary"}`}>{p}</button>
                      })}
                      <button disabled={page === totalBookPages} onClick={() => setPage(p => p + 1)} className="rounded p-2 hover:bg-secondary disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── JOURNALS ── */}
        {activeTab === "journals" && (
          <>
            {isLoadingJournals ? (
              <div className="flex flex-col items-center justify-center py-24">
                <Loader2 className="mb-4 h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Učitavanje časopisa…</p>
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {pagedJournals.length === 0 ? (
                    <div className="col-span-3 py-16 text-center">
                      <Newspaper className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
                      <p className="text-muted-foreground">Nema rezultata</p>
                    </div>
                  ) : pagedJournals.map(journal => (
                    <div key={journal.id} onClick={() => setSelectedJournal(journal)}
                      className="group cursor-pointer rounded-xl border border-border bg-card p-5 transition-all hover:border-accent/40 hover:shadow-md">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <span className="text-xs font-mono text-muted-foreground">#{journal.broj}</span>
                      </div>
                      <h3 className="font-serif font-bold leading-tight group-hover:text-accent transition-colors">{journal.naslov}</h3>
                      {journal.svesci && (
                        <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">{journal.svesci}</p>
                      )}
                      
                      <div className="mt-3 flex items-center justify-between pt-3 border-t border-border/50">
                        {journal.izdavac ? <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{journal.izdavac}</p> : <div />}
                        
                        {/* Attachments Indicators */}
                        {(journal.attachments || []).length > 0 && (
                          <div className="flex items-center gap-2">
                            {(journal.attachments || []).filter(a => a.fileType === 'image').length > 0 && (
                              <span className="flex items-center gap-1 text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                <Image className="h-3 w-3" /> {(journal.attachments || []).filter(a => a.fileType === 'image').length}
                              </span>
                            )}
                            {(journal.attachments || []).filter(a => a.fileType !== 'image').length > 0 && (
                              <span className="flex items-center gap-1 text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                                <Paperclip className="h-3 w-3" /> {(journal.attachments || []).filter(a => a.fileType !== 'image').length}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {totalJournalPages > 1 && (
                  <div className="mt-6 flex items-center justify-center gap-1">
                    <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="rounded p-2 hover:bg-secondary disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                    {Array.from({ length: totalJournalPages }, (_, i) => i + 1).map(p => (
                      <button key={p} onClick={() => setPage(p)} className={`h-8 w-8 rounded text-sm ${page === p ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}>{p}</button>
                    ))}
                    <button disabled={page === totalJournalPages} onClick={() => setPage(p => p + 1)} className="rounded p-2 hover:bg-secondary disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Dialogs */}
      {liveBook && <BookDetailDialog book={liveBook} onClose={() => setSelectedBook(null)} />}
      {liveJournal && <JournalDetailDialog journal={liveJournal} onClose={() => setSelectedJournal(null)} />}
      {showAddBook && <AddBookDialog onClose={() => setShowAddBook(false)} />}
      {showAddJournal && <AddJournalDialog onClose={() => setShowAddJournal(false)} />}
    </main>
  )
}
