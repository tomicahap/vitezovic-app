"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useSettings } from "@/contexts/settings-context"
import { useMembers } from "@/contexts/members-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Inbox,
  Send,
  Trash2,
  Search,
  RefreshCw,
  PenSquare,
  MailOpen,
  AlertCircle,
  ChevronLeft,
  Star,
  FileText,
  Settings,
  X,
  Reply,
  ReplyAll,
  Forward,
  Loader2,
  Paperclip,
  Download,
  CheckCircle2,
  ShieldAlert,
  Archive,
  RotateCcw,
  Users,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link as LinkIcon,
  Image as ImageIcon,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Eye,
  Lock,
} from "lucide-react"
import Link from "next/link"

interface ParsedAttachment {
  attachmentId: string
  filename: string
  mimeType: string
  size: number
  contentId?: string
  isInline?: boolean
  inlineDataUrl?: string
}

interface EmailMessage {
  id: string
  threadId: string
  snippet: string
  from: string
  to: string
  cc?: string
  bcc?: string
  replyTo?: string
  subject: string
  date: string
  messageId?: string
  references?: string
  inReplyTo?: string
  unread: boolean
  starred?: boolean
  hasAttachments?: boolean
  internalDate?: number
  labelIds: string[]
  body?: { text: string; html: string }
  attachments?: ParsedAttachment[]
}

interface OutgoingAttachment {
  filename: string
  mimeType: string
  size: number
  contentBase64: string
}

const FOLDERS = [
  { id: "INBOX", label: "Primljeno", icon: Inbox },
  { id: "STARRED", label: "Sa zvjezdicom", icon: Star },
  { id: "SENT", label: "Poslano", icon: Send },
  { id: "DRAFT", label: "Skice", icon: FileText },
  { id: "SPAM", label: "Spam", icon: ShieldAlert },
  { id: "TRASH", label: "Smeće", icon: Trash2 },
  { id: "ALL", label: "Sva pošta", icon: Archive },
]

function formatDate(dateStr: string) {
  if (!dateStr) return ""
  try {
    const d = new Date(dateStr)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    const isThisYear = d.getFullYear() === now.getFullYear()
    if (isToday) {
      return d.toLocaleTimeString("hr-HR", { hour: "2-digit", minute: "2-digit" })
    }
    if (isThisYear) {
      return d.toLocaleDateString("hr-HR", { day: "numeric", month: "short" })
    }
    return d.toLocaleDateString("hr-HR", { day: "2-digit", month: "2-digit", year: "numeric" })
  } catch {
    return dateStr
  }
}

function formatFullDateTime(dateStr: string) {
  if (!dateStr) return ""
  try {
    const d = new Date(dateStr)
    return d.toLocaleString("hr-HR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return dateStr
  }
}

function formatSender(from: string) {
  if (!from) return "(nepoznat pošiljatelj)"
  const match = from.match(/^"?([^"<]+)"?\s*<.*>$/)
  return match ? match[1].trim() : from.replace(/<.*>/, "").trim() || from
}

function extractEmailAddress(raw: string): string {
  if (!raw) return ""
  const match = raw.match(/<([^>]+)>/)
  return match ? match[1].trim() : raw.trim()
}

function getInitials(from: string): string {
  const name = formatSender(from)
  const parts = name.replace(/[^a-zA-ZčćžšđČĆŽŠĐ0-9\s]/g, "").trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase() || "?"
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function buildInitialEditorHtml(signatureHtml?: string, initialTextOrHtml?: string): string {
  const bodyPart = initialTextOrHtml
    ? initialTextOrHtml.includes("<")
      ? initialTextOrHtml
      : initialTextOrHtml.replace(/\n/g, "<br/>")
    : "<div><br/></div>"

  if (!signatureHtml || !signatureHtml.trim()) {
    return bodyPart
  }

  return `${bodyPart}<br/><div class="gmail_signature" style="margin-top:12px;color:#475569;">--<br/>${signatureHtml}</div>`
}

interface ComposeInitialData {
  mode?: "new" | "reply" | "replyAll" | "forward"
  to?: string
  cc?: string
  bcc?: string
  subject?: string
  bodyHtml?: string
  quotedHtml?: string
  quotedHeader?: string
  inReplyTo?: string
  references?: string
  threadId?: string
}

/**
 * Safe, auto-resizing iframe renderer for email HTML so external images, inline CID images,
 * and rich newsletter/signature layouts render identically to Gmail.
 */
function EmailHtmlFrame({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const [height, setHeight] = useState(260)

  const updateHeight = useCallback(() => {
    const doc = iframeRef.current?.contentDocument
    if (!doc || !doc.body) return
    const newHeight = Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight, 140)
    setHeight(newHeight + 20)
  }, [])

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    const doc = iframe.contentDocument
    if (!doc) return

    const fullDoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="referrer" content="no-referrer" />
  <base target="_blank" />
  <style>
    html, body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #1e293b;
      background: transparent;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    img {
      max-width: 100%;
      height: auto;
    }
    a {
      color: #2563eb;
    }
    blockquote {
      margin: 8px 0 8px 8px;
      padding-left: 12px;
      border-left: 2px solid #cbd5e1;
      color: #475569;
    }
    pre {
      white-space: pre-wrap;
      word-break: break-word;
    }
  </style>
</head>
<body>${html}</body>
</html>`

    doc.open()
    doc.write(fullDoc)
    doc.close()

    updateHeight()
    const imgs = Array.from(doc.images || [])
    imgs.forEach((img) => {
      img.addEventListener("load", updateHeight)
      img.addEventListener("error", updateHeight)
    })

    const timer1 = setTimeout(updateHeight, 150)
    const timer2 = setTimeout(updateHeight, 600)
    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
    }
  }, [html, updateHeight])

  return (
    <iframe
      ref={iframeRef}
      title="Sadržaj e-pošte"
      style={{ height: `${height}px` }}
      className="w-full border-0 bg-transparent block"
      onLoad={updateHeight}
    />
  )
}

/**
 * Gmail-style Rich HTML Editor with formatting toolbar and inline image support
 */
function GmailRichEditor({
  editorRef,
  initialHtml,
  minHeight = "200px",
  placeholder = "Napišite poruku...",
}: {
  editorRef: React.RefObject<HTMLDivElement | null>
  initialHtml: string
  minHeight?: string
  placeholder?: string
}) {
  const inlineImageInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = initialHtml
    }
  }, [initialHtml, editorRef])

  const exec = (command: string, value?: string) => {
    editorRef.current?.focus()
    document.execCommand(command, false, value)
  }

  const handleInsertLink = () => {
    const url = window.prompt("Unesite URL poveznice (npr. https://rodoslovlje.hr):", "https://")
    if (url && url.trim()) {
      exec("createLink", url.trim())
    }
  }

  const handleInsertInlineImage = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      if (dataUrl) {
        exec("insertImage", dataUrl)
      }
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="flex flex-col flex-1">
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        style={{ minHeight }}
        className="flex-1 px-4 py-3 text-sm text-slate-900 bg-white outline-none overflow-y-auto leading-relaxed prose prose-sm max-w-none [&_img]:max-w-full [&_img]:h-auto"
      />

      {/* Formatting Toolbar (Gmail bottom style) */}
      <div className="flex flex-wrap items-center gap-0.5 px-3 py-1.5 bg-slate-50 border-t border-border text-slate-600">
        <button
          type="button"
          onClick={() => exec("bold")}
          className="p-1.5 rounded hover:bg-slate-200/70 transition-colors"
          title="Podebljano (Bold)"
        >
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => exec("italic")}
          className="p-1.5 rounded hover:bg-slate-200/70 transition-colors"
          title="Kurziv (Italic)"
        >
          <Italic className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => exec("underline")}
          className="p-1.5 rounded hover:bg-slate-200/70 transition-colors"
          title="Podcrtano (Underline)"
        >
          <Underline className="h-3.5 w-3.5" />
        </button>
        <div className="h-4 w-px bg-border mx-1" />
        <button
          type="button"
          onClick={() => exec("insertUnorderedList")}
          className="p-1.5 rounded hover:bg-slate-200/70 transition-colors"
          title="Natuknice"
        >
          <List className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => exec("insertOrderedList")}
          className="p-1.5 rounded hover:bg-slate-200/70 transition-colors"
          title="Numerirani popis"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </button>
        <div className="h-4 w-px bg-border mx-1" />
        <button
          type="button"
          onClick={handleInsertLink}
          className="p-1.5 rounded hover:bg-slate-200/70 transition-colors"
          title="Umetni poveznicu"
        >
          <LinkIcon className="h-3.5 w-3.5" />
        </button>
        <input
          ref={inlineImageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleInsertInlineImage(file)
            e.target.value = ""
          }}
        />
        <button
          type="button"
          onClick={() => inlineImageInputRef.current?.click()}
          className="p-1.5 rounded hover:bg-slate-200/70 transition-colors"
          title="Umetni sliku u tekst poruke"
        >
          <ImageIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

/**
 * Gmail-like Floating / Modal Compose Window
 */
function ComposeDialog({
  open,
  onClose,
  mailbox,
  signatureHtml,
  initial,
  onSent,
}: {
  open: boolean
  onClose: () => void
  mailbox: string
  signatureHtml: string
  initial?: ComposeInitialData
  onSent: () => void
}) {
  const { members } = useMembers()
  const editorRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [to, setTo] = useState(initial?.to ?? "")
  const [cc, setCc] = useState(initial?.cc ?? "")
  const [bcc, setBcc] = useState(initial?.bcc ?? "")
  const [showCcBcc, setShowCcBcc] = useState(Boolean(initial?.cc || initial?.bcc))
  const [subject, setSubject] = useState(initial?.subject ?? "")
  const [showQuoted, setShowQuoted] = useState(false)
  const [maximized, setMaximized] = useState(false)
  const [attachments, setAttachments] = useState<OutgoingAttachment[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [showMemberPicker, setShowMemberPicker] = useState(false)

  const initialEditorContent = buildInitialEditorHtml(signatureHtml, initial?.bodyHtml)

  useEffect(() => {
    setTo(initial?.to ?? "")
    setCc(initial?.cc ?? "")
    setBcc(initial?.bcc ?? "")
    setShowCcBcc(Boolean(initial?.cc || initial?.bcc))
    setSubject(initial?.subject ?? "")
    setShowQuoted(Boolean(initial?.mode === "forward"))
    setAttachments([])
    setError("")
    setShowMemberPicker(false)
  }, [initial, open])

  if (!open) return null

  const handleFileChange = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const newAttachments: OutgoingAttachment[] = []

    for (const file of Array.from(files)) {
      if (file.size > 18 * 1024 * 1024) {
        setError(`Datoteka "${file.name}" je prevelika (maksimalno 18 MB).`)
        continue
      }
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = (reader.result as string) || ""
          const clean = result.includes(",") ? result.split(",")[1] : result
          resolve(clean)
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      newAttachments.push({
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        contentBase64: base64,
      })
    }

    setAttachments((prev) => [...prev, ...newAttachments])
  }

  const addRecipient = (email: string) => {
    if (!email) return
    const current = to
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    if (!current.includes(email)) {
      setTo([...current, email].join(", "))
    }
  }

  const handleSend = async () => {
    if (!to.trim()) {
      setError("Primatelj (Za) je obavezan.")
      return
    }
    setSending(true)
    setError("")
    try {
      const editorHtml = editorRef.current?.innerHTML || ""
      const quotedBlock =
        initial?.quotedHtml
          ? `<br/><div class="gmail_quote"><div dir="ltr" style="color:#64748b;font-size:12px;margin-bottom:6px;">${
              initial.quotedHeader || ""
            }</div><blockquote style="margin:0 0 0 .8ex;border-left:1px #ccc solid;padding-left:1ex;">${
              initial.quotedHtml
            }</blockquote></div>`
          : ""

      const finalHtml = `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#1e293b;">${editorHtml}${quotedBlock}</div>`

      const res = await fetch("/api/gmail", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "send",
          mailbox,
          to: to.trim(),
          cc: cc.trim() || undefined,
          bcc: bcc.trim() || undefined,
          subject: subject.trim() || "(bez naslova)",
          htmlBody: finalHtml,
          inReplyTo: initial?.inReplyTo,
          references: initial?.references,
          threadId: initial?.threadId,
          attachments,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Greška pri slanju poruke.")
      onSent()
      onClose()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSending(false)
    }
  }

  const activeMembersWithEmail = members.filter((m) => m.email && m.email.includes("@"))

  return (
    <div
      className={`fixed inset-0 z-50 flex ${
        maximized
          ? "items-center justify-center p-2 sm:p-6 bg-black/40"
          : "items-end sm:items-end justify-center sm:justify-end p-0 sm:px-6 sm:pb-0 pointer-events-none"
      }`}
    >
      <div
        className={`pointer-events-auto border border-border bg-card shadow-2xl flex flex-col overflow-hidden transition-all ${
          maximized
            ? "w-full max-w-5xl h-[90vh] rounded-2xl"
            : "w-full sm:w-[640px] max-h-[88vh] rounded-t-2xl"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#1B2B36] text-white">
          <div className="flex items-center gap-2 min-w-0">
            <PenSquare className="h-4 w-4 text-[#CEA369] shrink-0" />
            <span className="font-semibold text-sm truncate">
              {subject ? subject : "Nova poruka"}{" "}
              <span className="text-[#CEA369] font-normal text-xs">({mailbox})</span>
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMaximized((v) => !v)}
              className="hover:opacity-75 transition-opacity p-1"
              title={maximized ? "Smanji prozor" : "Proširi prozor"}
            >
              {maximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
            <button type="button" onClick={onClose} className="hover:opacity-75 transition-opacity p-1">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Fields */}
        <div className="flex flex-col divide-y divide-border flex-1 overflow-y-auto bg-white">
          <div className="flex items-center px-4 py-2 gap-2">
            <span className="text-xs font-semibold text-muted-foreground w-12 shrink-0">Za:</span>
            <input
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="primatelj@example.com (više adresa odvojite zarezom)"
              className="flex-1 text-sm bg-transparent outline-none"
            />
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowMemberPicker((v) => !v)}
                className="text-[11px] font-medium text-primary hover:underline flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-muted"
                title="Odaberi člana društva"
              >
                <Users className="h-3 w-3" /> Članovi
              </button>
              {!showCcBcc && (
                <button
                  type="button"
                  onClick={() => setShowCcBcc(true)}
                  className="text-[11px] font-medium text-muted-foreground hover:text-foreground px-1"
                >
                  CC / BCC
                </button>
              )}
            </div>
          </div>

          {showMemberPicker && (
            <div className="px-4 py-2.5 bg-slate-50 max-h-36 overflow-y-auto space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-muted-foreground">
                  Kliknite na člana za dodavanje u primatelje:
                </span>
                <button
                  type="button"
                  onClick={() => setShowMemberPicker(false)}
                  className="text-[11px] text-muted-foreground hover:text-foreground"
                >
                  Zatvori
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {activeMembersWithEmail.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => addRecipient(m.email)}
                    className="text-[11px] bg-white hover:bg-primary/10 border border-border rounded-full px-2.5 py-0.5 transition-colors"
                  >
                    {m.name} &lt;{m.email}&gt;
                  </button>
                ))}
              </div>
            </div>
          )}

          {showCcBcc && (
            <>
              <div className="flex items-center px-4 py-2 gap-2">
                <span className="text-xs font-semibold text-muted-foreground w-12 shrink-0">CC:</span>
                <input
                  type="text"
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  placeholder="Kopija (CC)"
                  className="flex-1 text-sm bg-transparent outline-none"
                />
              </div>
              <div className="flex items-center px-4 py-2 gap-2">
                <span className="text-xs font-semibold text-muted-foreground w-12 shrink-0">BCC:</span>
                <input
                  type="text"
                  value={bcc}
                  onChange={(e) => setBcc(e.target.value)}
                  placeholder="Skrivena kopija (BCC)"
                  className="flex-1 text-sm bg-transparent outline-none"
                />
              </div>
            </>
          )}

          <div className="flex items-center px-4 py-2 gap-2">
            <span className="text-xs font-semibold text-muted-foreground w-12 shrink-0">Naslov:</span>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Naslov poruke"
              className="flex-1 text-sm font-medium bg-transparent outline-none"
            />
          </div>

          {/* Rich Editor */}
          <GmailRichEditor
            editorRef={editorRef}
            initialHtml={initialEditorContent}
            minHeight={maximized ? "360px" : "240px"}
          />

          {/* Quoted original message toggle (Gmail "..." button) */}
          {initial?.quotedHtml && (
            <div className="px-4 py-2 bg-white border-t border-border/50">
              <button
                type="button"
                onClick={() => setShowQuoted((v) => !v)}
                className="inline-flex items-center gap-1 rounded border border-slate-300 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 text-xs text-slate-600"
                title={showQuoted ? "Sakrij citiranu poruku" : "Prikaži citiranu poruku"}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
              {showQuoted && (
                <div className="mt-2 pl-3 border-l-2 border-slate-300 text-xs text-slate-600 max-h-48 overflow-y-auto">
                  {initial.quotedHeader && <p className="mb-1 font-medium">{initial.quotedHeader}</p>}
                  <div dangerouslySetInnerHTML={{ __html: initial.quotedHtml }} />
                </div>
              )}
            </div>
          )}

          {/* Attachments list */}
          {attachments.length > 0 && (
            <div className="px-4 py-2.5 bg-slate-50 space-y-1.5">
              <p className="text-[11px] font-semibold text-muted-foreground">
                Priložene datoteke ({attachments.length}):
              </p>
              <div className="flex flex-wrap gap-2">
                {attachments.map((att, idx) => (
                  <div
                    key={`${att.filename}-${idx}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 py-1 text-xs"
                  >
                    <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="truncate max-w-[200px] font-medium">{att.filename}</span>
                    <span className="text-[10px] text-muted-foreground">({formatBytes(att.size)})</span>
                    <button
                      type="button"
                      onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-muted-foreground hover:text-destructive ml-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="px-4 py-2 text-xs text-destructive bg-destructive/10 flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-slate-50">
          <div className="flex items-center gap-2">
            <Button
              onClick={handleSend}
              disabled={sending}
              size="sm"
              className="gap-2 rounded-full px-5 bg-[#0b57d0] hover:bg-[#0842a0] text-white font-semibold"
            >
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {sending ? "Slanje..." : "Pošalji"}
            </Button>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                handleFileChange(e.target.files)
                e.target.value = ""
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="gap-1.5 text-xs rounded-full"
            >
              <Paperclip className="h-3.5 w-3.5" /> Priloži datoteku
            </Button>
          </div>

          <Button variant="ghost" size="sm" onClick={onClose} title="Odbaci skicu">
            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * Real Gmail-style Inline Reply / Reply All / Forward box rendered directly under the message
 */
function InlineReplyBox({
  msg,
  mailbox,
  signatureHtml,
  initialMode,
  onClose,
  onSent,
  onPopOut,
}: {
  msg: EmailMessage
  mailbox: string
  signatureHtml: string
  initialMode: "reply" | "replyAll" | "forward"
  onClose: () => void
  onSent: () => void
  onPopOut: (data: ComposeInitialData) => void
}) {
  const { members } = useMembers()
  const editorRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const replyToAddress = extractEmailAddress(msg.replyTo || msg.from)
  const computeRecipients = (mode: "reply" | "replyAll" | "forward") => {
    if (mode === "forward") return { to: "", cc: "" }
    if (mode === "reply") return { to: replyToAddress, cc: "" }
    const allTo = [replyToAddress, msg.to]
      .filter(Boolean)
      .join(", ")
      .split(",")
      .map((s) => extractEmailAddress(s))
      .filter((addr) => addr && addr.toLowerCase() !== mailbox.toLowerCase())
    return {
      to: Array.from(new Set(allTo)).join(", ") || replyToAddress,
      cc: msg.cc || "",
    }
  }

  const initialRecips = computeRecipients(initialMode)
  const [mode, setMode] = useState<"reply" | "replyAll" | "forward">(initialMode)
  const [to, setTo] = useState(initialRecips.to)
  const [cc, setCc] = useState(initialRecips.cc)
  const [bcc, setBcc] = useState("")
  const [showCcBcc, setShowCcBcc] = useState(Boolean(initialRecips.cc))
  const [showMemberPicker, setShowMemberPicker] = useState(false)
  const [showQuoted, setShowQuoted] = useState(initialMode === "forward")
  const [attachments, setAttachments] = useState<OutgoingAttachment[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")

  const subject =
    mode === "forward"
      ? msg.subject?.toLowerCase().startsWith("fwd:")
        ? msg.subject
        : `Fwd: ${msg.subject}`
      : msg.subject?.toLowerCase().startsWith("re:")
      ? msg.subject
      : `Re: ${msg.subject}`

  const quotedHeader =
    mode === "forward"
      ? `---------- Proslijeđena poruka ----------<br/>Od: ${msg.from}<br/>Datum: ${msg.date}<br/>Naslov: ${msg.subject}<br/>Za: ${msg.to}`
      : `Dana ${formatFullDateTime(msg.date)} korisnik ${msg.from} napisao je:`

  const quotedHtml =
    msg.body?.html ||
    `<pre style="white-space:pre-wrap;font-family:sans-serif;">${(msg.body?.text || msg.snippet || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")}</pre>`

  const initialEditorHtml = buildInitialEditorHtml(signatureHtml, "")

  const handleModeChange = (newMode: "reply" | "replyAll" | "forward") => {
    setMode(newMode)
    const r = computeRecipients(newMode)
    setTo(r.to)
    setCc(r.cc)
    if (r.cc) setShowCcBcc(true)
    if (newMode === "forward") setShowQuoted(true)
  }

  const handleFileChange = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const newAttachments: OutgoingAttachment[] = []
    for (const file of Array.from(files)) {
      if (file.size > 18 * 1024 * 1024) {
        setError(`Datoteka "${file.name}" je prevelika (maksimalno 18 MB).`)
        continue
      }
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = (reader.result as string) || ""
          resolve(result.includes(",") ? result.split(",")[1] : result)
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      newAttachments.push({
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        contentBase64: base64,
      })
    }
    setAttachments((prev) => [...prev, ...newAttachments])
  }

  const handleSend = async () => {
    if (!to.trim()) {
      setError("Unesite primatelja (Za).")
      return
    }
    setSending(true)
    setError("")
    try {
      const editorHtml = editorRef.current?.innerHTML || ""
      const fullHtml = `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#1e293b;">${editorHtml}<br/><div class="gmail_quote"><div dir="ltr" style="color:#64748b;font-size:12px;margin-bottom:6px;">${quotedHeader}</div><blockquote style="margin:0 0 0 .8ex;border-left:1px #ccc solid;padding-left:1ex;">${quotedHtml}</blockquote></div></div>`

      const res = await fetch("/api/gmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          mailbox,
          to: to.trim(),
          cc: cc.trim() || undefined,
          bcc: bcc.trim() || undefined,
          subject,
          htmlBody: fullHtml,
          inReplyTo: mode !== "forward" ? msg.messageId || undefined : undefined,
          references:
            mode !== "forward"
              ? [msg.references, msg.messageId].filter(Boolean).join(" ") || undefined
              : undefined,
          threadId: msg.threadId,
          attachments,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Greška pri slanju odgovora.")
      onSent()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSending(false)
    }
  }

  const activeMembersWithEmail = members.filter((m) => m.email && m.email.includes("@"))

  return (
    <div className="rounded-2xl border border-slate-300 bg-white shadow-md overflow-hidden mt-4">
      {/* Top recipient bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-50 border-b border-border">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <select
            value={mode}
            onChange={(e) => handleModeChange(e.target.value as any)}
            className="text-xs font-semibold bg-white border border-border rounded-lg px-2.5 py-1.5 text-slate-700 outline-none"
          >
            <option value="reply">Odgovori</option>
            <option value="replyAll">Odgovori svima</option>
            <option value="forward">Proslijedi</option>
          </select>

          <span className="text-xs font-semibold text-muted-foreground">Za:</span>
          <input
            type="text"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="Unesite primatelja..."
            className="flex-1 text-sm bg-transparent outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowMemberPicker((v) => !v)}
            className="text-[11px] font-medium text-primary hover:underline flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-200/60"
          >
            <Users className="h-3 w-3" /> Članovi
          </button>
          {!showCcBcc && (
            <button
              type="button"
              onClick={() => setShowCcBcc(true)}
              className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
            >
              CC / BCC
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              onPopOut({
                mode,
                to,
                cc,
                bcc,
                subject,
                bodyHtml: editorRef.current?.innerHTML || initialEditorHtml,
                quotedHtml,
                quotedHeader,
                inReplyTo: msg.messageId,
                references: [msg.references, msg.messageId].filter(Boolean).join(" "),
                threadId: msg.threadId,
              })
            }
            className="p-1 text-muted-foreground hover:text-foreground"
            title="Otvori u većem prozoru"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {showMemberPicker && (
        <div className="px-4 py-2 bg-slate-50 border-b border-border max-h-32 overflow-y-auto flex flex-wrap gap-1.5">
          {activeMembersWithEmail.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                const cur = to
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
                if (!cur.includes(m.email)) setTo([...cur, m.email].join(", "))
              }}
              className="text-[11px] bg-white hover:bg-primary/10 border border-border rounded-full px-2.5 py-0.5"
            >
              {m.name} &lt;{m.email}&gt;
            </button>
          ))}
        </div>
      )}

      {showCcBcc && (
        <div className="divide-y divide-border border-b border-border bg-white">
          <div className="flex items-center px-4 py-1.5 gap-2">
            <span className="text-xs font-semibold text-muted-foreground w-10">CC:</span>
            <input
              type="text"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="Kopija (CC)"
              className="flex-1 text-sm bg-transparent outline-none"
            />
          </div>
          <div className="flex items-center px-4 py-1.5 gap-2">
            <span className="text-xs font-semibold text-muted-foreground w-10">BCC:</span>
            <input
              type="text"
              value={bcc}
              onChange={(e) => setBcc(e.target.value)}
              placeholder="Skrivena kopija (BCC)"
              className="flex-1 text-sm bg-transparent outline-none"
            />
          </div>
        </div>
      )}

      {/* Rich HTML Editor with Gmail signature */}
      <GmailRichEditor editorRef={editorRef} initialHtml={initialEditorHtml} minHeight="170px" />

      {/* Collapsible quoted original message ("...") */}
      <div className="px-4 py-2 bg-white border-t border-border/50">
        <button
          type="button"
          onClick={() => setShowQuoted((v) => !v)}
          className="inline-flex items-center gap-1 rounded border border-slate-300 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 text-xs text-slate-600"
          title={showQuoted ? "Sakrij citirani sadržaj" : "Prikaži citirani sadržaj"}
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>

        {showQuoted && (
          <div className="mt-2 pl-3 border-l-2 border-slate-300 text-xs text-slate-600 max-h-60 overflow-y-auto">
            <div className="mb-1.5 text-slate-500" dangerouslySetInnerHTML={{ __html: quotedHeader }} />
            <div dangerouslySetInnerHTML={{ __html: quotedHtml }} />
          </div>
        )}
      </div>

      {/* Attachments */}
      {attachments.length > 0 && (
        <div className="px-4 py-2 bg-slate-50 border-t border-border flex flex-wrap gap-2">
          {attachments.map((att, idx) => (
            <div
              key={`${att.filename}-${idx}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 py-1 text-xs"
            >
              <Paperclip className="h-3 w-3 text-muted-foreground" />
              <span className="truncate max-w-[180px] font-medium">{att.filename}</span>
              <span className="text-[10px] text-muted-foreground">({formatBytes(att.size)})</span>
              <button
                type="button"
                onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                className="text-muted-foreground hover:text-destructive ml-1"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="px-4 py-2 text-xs text-destructive bg-destructive/10 flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-t border-border">
        <div className="flex items-center gap-2">
          <Button
            onClick={handleSend}
            disabled={sending}
            size="sm"
            className="gap-2 rounded-full px-5 bg-[#0b57d0] hover:bg-[#0842a0] text-white font-semibold"
          >
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {sending ? "Slanje..." : "Pošalji"}
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFileChange(e.target.files)
              e.target.value = ""
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="gap-1.5 text-xs rounded-full"
          >
            <Paperclip className="h-3.5 w-3.5" /> Priloži datoteku
          </Button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-muted-foreground hover:text-destructive"
          title="Odbaci odgovor"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function MessageDetail({
  messageId,
  mailbox,
  currentFolder,
  canSend,
  signatureHtml,
  onBack,
  onPopOutCompose,
  onActionDone,
}: {
  messageId: string
  mailbox: string
  currentFolder: string
  canSend: boolean
  signatureHtml: string
  onBack: () => void
  onPopOutCompose: (data: ComposeInitialData) => void
  onActionDone: () => void
}) {
  const [msg, setMsg] = useState<EmailMessage | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [replyMode, setReplyMode] = useState<"reply" | "replyAll" | "forward" | null>(null)
  const replyContainerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setLoading(true)
    setReplyMode(null)
    fetch(
      `/api/gmail?action=message&mailbox=${encodeURIComponent(mailbox)}&messageId=${encodeURIComponent(
        messageId
      )}${!canSend ? "&readonly=1" : ""}&_t=${Date.now()}`,
      { cache: "no-store" }
    )
      .then(async (r) => {
        const data = await r.json()
        if (!r.ok || data.error) {
          // Message no longer exists on Gmail (deleted externally)
          onActionDone()
          onBack()
          return
        }
        setMsg(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [messageId, mailbox, canSend])

  const openInlineReply = (mode: "reply" | "replyAll" | "forward") => {
    setReplyMode(mode)
    setTimeout(() => {
      replyContainerRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
    }, 100)
  }

  const performMessageAction = async (action: string, closeAfter = true) => {
    if (!canSend) return
    setActionLoading(true)
    try {
      await fetch("/api/gmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, mailbox, messageId }),
      })
      if (action === "star" && msg) {
        setMsg({ ...msg, starred: true })
      } else if (action === "unstar" && msg) {
        setMsg({ ...msg, starred: false })
      }
      if (closeAfter) {
        onActionDone()
        onBack()
      }
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!msg) return null

  const attachments = msg.attachments ?? []
  // Image attachments that should also be shown as visual previews if not already embedded via cid:
  const imageAttachments = attachments.filter((a) =>
    a.mimeType?.toLowerCase().startsWith("image/")
  )

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      {/* Top Action Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 px-4 md:px-6 py-2.5 border-b border-border bg-card">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 font-medium">
          <ChevronLeft className="h-4 w-4" /> Natrag na popis
        </Button>

        <div className="flex-1" />

        {!canSend && (
          <Badge variant="outline" className="gap-1 text-amber-700 border-amber-300 bg-amber-50">
            <Eye className="h-3 w-3" /> Samo čitanje
          </Badge>
        )}

        {canSend && (
          <>
            <Button
              variant="ghost"
              size="sm"
              disabled={actionLoading}
              onClick={() => performMessageAction(msg.starred ? "unstar" : "star", false)}
              className="gap-1.5"
              title={msg.starred ? "Ukloni zvjezdicu" : "Označi zvjezdicom"}
            >
              <Star
                className={`h-4 w-4 ${
                  msg.starred ? "fill-amber-400 text-amber-400" : "text-muted-foreground"
                }`}
              />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => openInlineReply("reply")}
              className="gap-1.5"
            >
              <Reply className="h-4 w-4" /> Odgovori
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => openInlineReply("replyAll")}
              className="gap-1.5"
            >
              <ReplyAll className="h-4 w-4" /> Odgovori svima
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => openInlineReply("forward")}
              className="gap-1.5"
            >
              <Forward className="h-4 w-4" /> Proslijedi
            </Button>

            <Button
              variant="ghost"
              size="sm"
              disabled={actionLoading}
              onClick={() => performMessageAction("markUnread", true)}
              className="gap-1.5"
            >
              <MailOpen className="h-4 w-4" /> Nepročitano
            </Button>

            {currentFolder === "TRASH" ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={actionLoading}
                onClick={() => performMessageAction("untrash", true)}
                className="gap-1.5 text-emerald-700 hover:text-emerald-800"
              >
                <RotateCcw className="h-4 w-4" /> Vrati iz smeća
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                disabled={actionLoading}
                onClick={() => performMessageAction("trash", true)}
                className="gap-1.5 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" /> U smeće
              </Button>
            )}
          </>
        )}
      </div>

      {/* Expanded Gmail-like Message View */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-5 space-y-5 w-full">
        {/* Subject Header */}
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-xl md:text-2xl font-normal text-slate-900 leading-snug">
            {msg.subject || "(bez naslova)"}
          </h1>
          <Badge variant="secondary" className="shrink-0 text-[11px] font-normal">
            {currentFolder}
          </Badge>
        </div>

        {/* Sender Avatar + Metadata Row (Gmail style) */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-border/70">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-10 w-10 rounded-full bg-[#1B2B36] text-[#CEA369] flex items-center justify-center font-bold text-sm shrink-0">
              {getInitials(msg.from)}
            </div>
            <div className="min-w-0 space-y-0.5">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-bold text-sm text-slate-900">{formatSender(msg.from)}</span>
                <span className="text-xs text-muted-foreground truncate">
                  &lt;{extractEmailAddress(msg.from)}&gt;
                </span>
              </div>
              <div className="text-xs text-muted-foreground space-x-3">
                <span>
                  <strong className="font-medium text-slate-700">Za:</strong> {msg.to}
                </span>
                {msg.cc && (
                  <span>
                    <strong className="font-medium text-slate-700">CC:</strong> {msg.cc}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 text-xs text-slate-600">
            <span>{formatFullDateTime(msg.date)}</span>
            {canSend && (
              <button
                type="button"
                onClick={() => openInlineReply("reply")}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-600"
                title="Odgovori"
              >
                <Reply className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Main Email Body (Wide view + full HTML/Image support) */}
        <div className="w-full min-h-[140px]">
          {msg.body?.html ? (
            <EmailHtmlFrame html={msg.body.html} />
          ) : (
            <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed text-slate-800">
              {msg.body?.text || msg.snippet}
            </pre>
          )}
        </div>

        {/* Visual Image Previews for Attached Images */}
        {imageAttachments.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-border/60">
            <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <ImageIcon className="h-4 w-4 text-primary" />
              Slike u poruci ({imageAttachments.length})
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {imageAttachments.map((imgAtt) => {
                const inlineUrl =
                  imgAtt.inlineDataUrl ||
                  `/api/gmail?action=attachment&mailbox=${encodeURIComponent(
                    mailbox
                  )}&messageId=${encodeURIComponent(msg.id)}&attachmentId=${encodeURIComponent(
                    imgAtt.attachmentId
                  )}&filename=${encodeURIComponent(imgAtt.filename)}&mimeType=${encodeURIComponent(
                    imgAtt.mimeType
                  )}&inline=1`

                const downloadUrl =
                  imgAtt.inlineDataUrl ||
                  `/api/gmail?action=attachment&mailbox=${encodeURIComponent(
                    mailbox
                  )}&messageId=${encodeURIComponent(msg.id)}&attachmentId=${encodeURIComponent(
                    imgAtt.attachmentId
                  )}&filename=${encodeURIComponent(imgAtt.filename)}&mimeType=${encodeURIComponent(
                    imgAtt.mimeType
                  )}`

                return (
                  <div
                    key={imgAtt.attachmentId}
                    className="rounded-xl border border-border overflow-hidden bg-slate-50 flex flex-col shadow-2xs"
                  >
                    <a
                      href={inlineUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block bg-white p-2 flex items-center justify-center max-h-64 overflow-hidden"
                    >
                      <img
                        src={inlineUrl}
                        alt={imgAtt.filename}
                        className="max-h-60 w-auto object-contain rounded"
                      />
                    </a>
                    <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-t border-border text-xs">
                      <div className="min-w-0 pr-2">
                        <p className="font-medium text-slate-800 truncate">{imgAtt.filename}</p>
                        <p className="text-[10px] text-muted-foreground">{formatBytes(imgAtt.size)}</p>
                      </div>
                      <a
                        href={downloadUrl}
                        download={imgAtt.filename}
                        className="p-1.5 rounded-lg hover:bg-slate-200/70 text-slate-700 shrink-0"
                        title="Preuzmi sliku"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* All Attachments Download Strip */}
        {attachments.length > 0 && (
          <div className="rounded-xl border border-border bg-slate-50/70 p-3.5 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Paperclip className="h-3.5 w-3.5 text-primary" />
              <span>Svi privitci ({attachments.length})</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {attachments.map((att) => {
                const downloadUrl =
                  att.inlineDataUrl ||
                  `/api/gmail?action=attachment&mailbox=${encodeURIComponent(
                    mailbox
                  )}&messageId=${encodeURIComponent(msg.id)}&attachmentId=${encodeURIComponent(
                    att.attachmentId
                  )}&filename=${encodeURIComponent(att.filename)}&mimeType=${encodeURIComponent(
                    att.mimeType
                  )}`

                return (
                  <a
                    key={att.attachmentId}
                    href={downloadUrl}
                    download={att.filename}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border border-border bg-white hover:bg-slate-100 px-3 py-2 text-xs transition-colors shadow-2xs"
                  >
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate max-w-[220px]">{att.filename}</p>
                      <p className="text-[10px] text-muted-foreground">{formatBytes(att.size)}</p>
                    </div>
                    <Download className="h-3.5 w-3.5 text-muted-foreground ml-1 shrink-0" />
                  </a>
                )
              })}
            </div>
          </div>
        )}

        {/* Bottom Gmail Reply / Reply All / Forward pill buttons OR Inline Reply Editor */}
        {canSend && (
          <div ref={replyContainerRef} className="pt-4 pb-8">
            {!replyMode ? (
              <div className="flex flex-wrap gap-2.5">
                <Button
                  variant="outline"
                  onClick={() => openInlineReply("reply")}
                  className="gap-2 rounded-full px-5 border-slate-300 text-slate-700 hover:bg-slate-100"
                >
                  <Reply className="h-4 w-4" /> Odgovori
                </Button>
                <Button
                  variant="outline"
                  onClick={() => openInlineReply("replyAll")}
                  className="gap-2 rounded-full px-5 border-slate-300 text-slate-700 hover:bg-slate-100"
                >
                  <ReplyAll className="h-4 w-4" /> Odgovori svima
                </Button>
                <Button
                  variant="outline"
                  onClick={() => openInlineReply("forward")}
                  className="gap-2 rounded-full px-5 border-slate-300 text-slate-700 hover:bg-slate-100"
                >
                  <Forward className="h-4 w-4" /> Proslijedi
                </Button>
              </div>
            ) : (
              <InlineReplyBox
                msg={msg}
                mailbox={mailbox}
                signatureHtml={signatureHtml}
                initialMode={replyMode}
                onClose={() => setReplyMode(null)}
                onSent={() => {
                  setReplyMode(null)
                  onActionDone()
                }}
                onPopOut={(data) => {
                  setReplyMode(null)
                  onPopOutCompose(data)
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function GmailContent() {
  const { user } = useAuth()
  const { settings } = useSettings()

  // Role check:
  // - Admin or user with accessRights.gmail.edit === true can send, reply, forward, and modify emails
  // - User with accessRights.gmail.view === true (and edit === false) has read-only access
  const canSend = user?.role === "admin" || user?.accessRights?.gmail?.edit === true

  const [mailbox, setMailbox] = useState(settings.gmailMailbox || "")
  const [signatureHtml, setSignatureHtml] = useState("")
  const [statusInfo, setStatusInfo] = useState<{
    connected: boolean
    emailAddress?: string
    unreadInboxCount?: number
  }>({ connected: false })

  const [folder, setFolder] = useState("INBOX")
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [messages, setMessages] = useState<EmailMessage[]>([])
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [composeOpen, setComposeOpen] = useState(false)
  const [composeInitial, setComposeInitial] = useState<ComposeInitialData | undefined>()

  useEffect(() => {
    if (settings.gmailMailbox) {
      setMailbox(settings.gmailMailbox)
    }
  }, [settings.gmailMailbox])

  const sortMessagesUnreadFirst = (list: EmailMessage[]): EmailMessage[] => {
    return [...list].sort((a, b) => {
      if (a.unread !== b.unread) {
        return a.unread ? -1 : 1
      }
      return (b.internalDate || 0) - (a.internalDate || 0)
    })
  }

  const fetchMessages = useCallback(
    async (pageTokenToLoad?: string, silent = false) => {
      if (pageTokenToLoad) {
        setLoadingMore(true)
      } else if (!silent) {
        setLoading(true)
        setError("")
        setSelectedId(null)
      }

      try {
        const params = new URLSearchParams({
          action: "list",
          folder,
          _t: String(Date.now()),
        })
        if (mailbox) params.set("mailbox", mailbox)
        if (search) params.set("q", search)
        if (pageTokenToLoad) params.set("pageToken", pageTokenToLoad)

        const res = await fetch(`/api/gmail?${params.toString()}`, {
          cache: "no-store",
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Greška pri dohvaćanju poruka.")

        if (data.mailbox && !mailbox) {
          setMailbox(data.mailbox)
        }
        if (typeof data.signature === "string" && data.signature) {
          setSignatureHtml(data.signature)
        }

        setStatusInfo({
          connected: true,
          emailAddress: data.mailbox || mailbox,
          unreadInboxCount: data.unreadInboxCount ?? 0,
        })

        setNextPageToken(data.nextPageToken)
        if (pageTokenToLoad) {
          setMessages((prev) => sortMessagesUnreadFirst([...prev, ...(data.messages ?? [])]))
        } else {
          setMessages(sortMessagesUnreadFirst(data.messages ?? []))
        }
      } catch (e: any) {
        if (!silent) {
          setError(e.message)
          setStatusInfo((prev) => ({ ...prev, connected: false }))
        }
      } finally {
        if (!silent) {
          setLoading(false)
        }
        setLoadingMore(false)
      }
    },
    [mailbox, folder, search]
  )

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  // Auto-sync with Gmail when user returns to browser tab or every 25 seconds
  useEffect(() => {
    const handleFocusOrVisible = () => {
      if (document.visibilityState === "visible" && !selectedId) {
        fetchMessages(undefined, true)
      }
    }

    window.addEventListener("focus", handleFocusOrVisible)
    document.addEventListener("visibilitychange", handleFocusOrVisible)

    const interval = setInterval(() => {
      if (document.visibilityState === "visible" && !selectedId) {
        fetchMessages(undefined, true)
      }
    }, 25000)

    return () => {
      window.removeEventListener("focus", handleFocusOrVisible)
      document.removeEventListener("visibilitychange", handleFocusOrVisible)
      clearInterval(interval)
    }
  }, [fetchMessages, selectedId])

  const toggleStar = async (e: React.MouseEvent, msg: EmailMessage) => {
    e.stopPropagation()
    if (!canSend) return
    const nextStarred = !msg.starred
    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, starred: nextStarred } : m)))

    try {
      await fetch("/api/gmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: nextStarred ? "star" : "unstar",
          mailbox,
          messageId: msg.id,
        }),
      })
    } catch {}
  }

  const unreadMessages = messages.filter((m) => m.unread)
  const readMessages = messages.filter((m) => !m.unread)
  const unreadCount = statusInfo.unreadInboxCount ?? unreadMessages.length

  const renderMessageRow = (msg: EmailMessage) => (
    <div
      key={msg.id}
      onClick={() => {
        if (canSend) {
          setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, unread: false } : m)))
        }
        setSelectedId(msg.id)
      }}
      className={`w-full flex items-center gap-3 px-4 md:px-6 py-2.5 text-left hover:shadow-xs hover:bg-slate-100/80 transition-all cursor-pointer ${
        msg.unread ? "bg-[#f2f6fc] font-semibold" : "bg-white"
      }`}
    >
      {/* Star button */}
      <button
        type="button"
        onClick={(e) => toggleStar(e, msg)}
        disabled={!canSend}
        className={`text-muted-foreground transition-colors shrink-0 p-0.5 ${
          canSend ? "hover:text-amber-400" : "cursor-default opacity-60"
        }`}
        title={msg.starred ? "Ukloni zvjezdicu" : "Označi zvjezdicom"}
      >
        <Star className={`h-4 w-4 ${msg.starred ? "fill-amber-400 text-amber-400" : ""}`} />
      </button>

      {/* Unread dot */}
      <div className="w-2 shrink-0">
        {msg.unread && <div className="h-2 w-2 rounded-full bg-[#0b57d0]" />}
      </div>

      {/* Sender / Recipient */}
      <span
        className={`w-44 md:w-56 shrink-0 text-sm truncate ${
          msg.unread ? "font-bold text-slate-900" : "text-slate-700"
        }`}
      >
        {folder === "SENT" ? `Za: ${formatSender(msg.to)}` : formatSender(msg.from)}
      </span>

      {/* Subject + snippet (expanded full width) */}
      <div className="flex-1 min-w-0 flex items-baseline gap-2">
        <span
          className={`text-sm truncate shrink-0 max-w-md lg:max-w-xl ${
            msg.unread ? "font-bold text-slate-900" : "text-slate-800"
          }`}
        >
          {msg.subject || "(bez naslova)"}
        </span>
        <span className="text-xs text-slate-500 truncate hidden sm:inline font-normal">
          — {msg.snippet}
        </span>
      </div>

      {/* Attachment indicator */}
      {msg.hasAttachments && <Paperclip className="h-3.5 w-3.5 text-slate-400 shrink-0" />}

      {/* Date */}
      <span
        className={`text-xs shrink-0 ml-2 ${
          msg.unread ? "font-bold text-slate-900" : "text-slate-500"
        }`}
      >
        {formatDate(msg.date)}
      </span>
    </div>
  )

  return (
    <div className="flex h-[calc(100vh-3.5rem)] md:h-screen w-full overflow-hidden bg-white">
      {/* Compact Left Sidebar */}
      <div className="w-52 shrink-0 border-r border-border flex flex-col bg-slate-50/70 p-2.5 gap-2">
        {/* Compose Button (Only if user has send/edit permission) */}
        {canSend ? (
          <Button
            onClick={() => {
              setComposeInitial(undefined)
              setComposeOpen(true)
            }}
            disabled={!statusInfo.connected && !mailbox}
            className="w-full gap-2.5 justify-start rounded-2xl py-5 px-4 shadow-xs font-semibold bg-[#c2e7ff] hover:bg-[#b3dffc] text-[#001d35] border-0"
          >
            <PenSquare className="h-4 w-4 text-[#001d35]" /> Nova poruka
          </Button>
        ) : (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-900 flex items-center gap-2">
            <Lock className="h-4 w-4 text-amber-600 shrink-0" />
            <div>
              <p className="font-bold leading-tight">Samo čitanje</p>
              <p className="text-[10px] text-amber-700">Nemate ovlasti za slanje</p>
            </div>
          </div>
        )}

        {/* Folders */}
        <nav className="flex flex-col gap-0.5 mt-1">
          {FOLDERS.map((f) => {
            const Icon = f.icon
            const active = folder === f.id
            return (
              <button
                key={f.id}
                onClick={() => {
                  setFolder(f.id)
                  setSelectedId(null)
                }}
                className={`flex items-center gap-3 px-3 py-2 rounded-full text-sm transition-colors ${
                  active
                    ? "bg-[#d3e3fd] text-[#041e49] font-bold"
                    : "text-slate-700 hover:bg-slate-200/60"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left truncate">{f.label}</span>
                {f.id === "INBOX" && unreadCount > 0 && (
                  <span className="text-xs font-bold text-[#041e49]">{unreadCount}</span>
                )}
              </button>
            )
          })}
        </nav>

        <div className="flex-1" />

        {/* Connection status & mailbox info */}
        <div className="border-t border-border pt-2.5 space-y-2">
          {statusInfo.connected ? (
            <div className="rounded-xl bg-emerald-50/90 border border-emerald-200 px-2.5 py-2 space-y-0.5">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-800">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>Povezano</span>
              </div>
              <p
                className="text-[11px] font-mono text-emerald-700 truncate"
                title={statusInfo.emailAddress || mailbox}
              >
                {statusInfo.emailAddress || mailbox}
              </p>
            </div>
          ) : (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-2.5 py-2 text-[11px] text-amber-800">
              Sandučić nije povezan
            </div>
          )}

          {user?.role === "admin" && (
            <Link
              href="/settings?tab=email-notifications"
              className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <Settings className="h-3.5 w-3.5" /> Postavke sandučića
            </Link>
          )}
        </div>
      </div>

      {/* Main Content Area (Expanded Full Width) */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top Search Bar */}
        <div className="flex items-center gap-3 px-4 md:px-6 py-2.5 border-b border-border bg-slate-50/50">
          <div className="relative flex-1 max-w-2xl">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setSearch(searchInput)
              }}
              placeholder="Pretraži poštu u sandučiću..."
              className="pl-10 pr-8 h-10 text-sm rounded-full bg-[#eaf1fb] border-0 focus-visible:ring-1 focus-visible:bg-white"
            />
            {searchInput && (
              <button
                onClick={() => {
                  setSearchInput("")
                  setSearch("")
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchMessages()}
            disabled={loading}
            className="gap-1.5 rounded-full"
            title="Osvježi sandučić"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline text-xs">Osvježi</span>
          </Button>
        </div>

        {/* Body */}
        {selectedId ? (
          <MessageDetail
            messageId={selectedId}
            mailbox={mailbox}
            currentFolder={folder}
            canSend={canSend}
            signatureHtml={signatureHtml}
            onBack={() => setSelectedId(null)}
            onPopOutCompose={(data) => {
              setComposeInitial(data)
              setComposeOpen(true)
            }}
            onActionDone={() => fetchMessages()}
          />
        ) : loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center max-w-md mx-auto">
            <AlertCircle className="h-10 w-10 text-destructive opacity-80" />
            <div className="space-y-1.5">
              <p className="font-bold text-base">Povezivanje s Gmail sandučićem nije uspjelo</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{error}</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              {user?.role === "admin" && (
                <Link href="/settings?tab=email-notifications">
                  <Button variant="default" size="sm" className="gap-2">
                    <Settings className="h-4 w-4" /> Otvori Postavke (E-mail / Gmail)
                  </Button>
                </Link>
              )}
              <Button variant="outline" size="sm" onClick={() => fetchMessages()} className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" /> Pokušaj ponovno
              </Button>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Inbox className="h-10 w-10 opacity-30" />
            <p className="text-sm">Nema poruka u ovoj mapi</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto divide-y divide-border/70">
            {/* Unread section at the top */}
            {unreadMessages.length > 0 && (
              <>
                <div className="px-4 md:px-6 py-1.5 bg-slate-100/90 text-[11px] font-bold uppercase tracking-wider text-[#0b57d0] flex items-center justify-between">
                  <span>Nepročitane poruke ({unreadMessages.length})</span>
                </div>
                {unreadMessages.map(renderMessageRow)}
              </>
            )}

            {/* Read messages section below */}
            {readMessages.length > 0 && (
              <>
                {unreadMessages.length > 0 && (
                  <div className="px-4 md:px-6 py-1.5 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Pročitane poruke ({readMessages.length})
                  </div>
                )}
                {readMessages.map(renderMessageRow)}
              </>
            )}

            {nextPageToken && (
              <div className="p-4 flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchMessages(nextPageToken)}
                  disabled={loadingMore}
                  className="gap-2 rounded-full"
                >
                  {loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Učitaj više poruka
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Compose Dialog (Only if user has send/edit permission) */}
      {canSend && (
        <ComposeDialog
          open={composeOpen}
          onClose={() => setComposeOpen(false)}
          mailbox={statusInfo.emailAddress || mailbox}
          signatureHtml={signatureHtml}
          initial={composeInitial}
          onSent={() => fetchMessages()}
        />
      )}
    </div>
  )
}
