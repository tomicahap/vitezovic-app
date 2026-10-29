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
} from "lucide-react"
import Link from "next/link"

interface ParsedAttachment {
  attachmentId: string
  filename: string
  mimeType: string
  size: number
  contentId?: string
  isInline?: boolean
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

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface ComposeInitialData {
  to?: string
  cc?: string
  bcc?: string
  subject?: string
  body?: string
  inReplyTo?: string
  references?: string
  threadId?: string
}

function ComposeDialog({
  open,
  onClose,
  mailbox,
  initial,
  onSent,
}: {
  open: boolean
  onClose: () => void
  mailbox: string
  initial?: ComposeInitialData
  onSent: () => void
}) {
  const { members } = useMembers()

  const [to, setTo] = useState(initial?.to ?? "")
  const [cc, setCc] = useState(initial?.cc ?? "")
  const [bcc, setBcc] = useState(initial?.bcc ?? "")
  const [showCcBcc, setShowCcBcc] = useState(Boolean(initial?.cc || initial?.bcc))
  const [subject, setSubject] = useState(initial?.subject ?? "")
  const [body, setBody] = useState(initial?.body ?? "")
  const [attachments, setAttachments] = useState<OutgoingAttachment[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [showMemberPicker, setShowMemberPicker] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setTo(initial?.to ?? "")
    setCc(initial?.cc ?? "")
    setBcc(initial?.bcc ?? "")
    setShowCcBcc(Boolean(initial?.cc || initial?.bcc))
    setSubject(initial?.subject ?? "")
    setBody(initial?.body ?? "")
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
      const htmlBody = `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#1e293b;">${body
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br/>")}</div>`

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
          htmlBody,
          textBody: body,
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end p-0 sm:p-6 bg-black/30 backdrop-blur-[1px]">
      <div className="w-full sm:w-[580px] rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#1B2B36] text-white">
          <div className="flex items-center gap-2 min-w-0">
            <PenSquare className="h-4 w-4 text-[#CEA369] shrink-0" />
            <span className="font-semibold text-sm truncate">
              Nova poruka — <span className="text-[#CEA369] font-normal">{mailbox}</span>
            </span>
          </div>
          <button onClick={onClose} className="hover:opacity-75 transition-opacity p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Fields */}
        <div className="flex flex-col divide-y divide-border flex-1 overflow-y-auto">
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
            <div className="px-4 py-2.5 bg-muted/40 max-h-36 overflow-y-auto space-y-1.5">
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
                    className="text-[11px] bg-background hover:bg-primary/10 border border-border rounded-full px-2.5 py-0.5 transition-colors"
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

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Napišite poruku..."
            rows={11}
            className="flex-1 px-4 py-3 text-sm bg-transparent outline-none resize-none leading-relaxed"
          />

          {/* Attachments list */}
          {attachments.length > 0 && (
            <div className="px-4 py-2.5 bg-muted/25 space-y-1.5">
              <p className="text-[11px] font-semibold text-muted-foreground">
                Priložene datoteke ({attachments.length}):
              </p>
              <div className="flex flex-wrap gap-2">
                {attachments.map((att, idx) => (
                  <div
                    key={`${att.filename}-${idx}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-xs"
                  >
                    <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
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
        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
          <div className="flex items-center gap-2">
            <Button onClick={handleSend} disabled={sending} size="sm" className="gap-2 bg-[#1B2B36] hover:bg-[#263c4b] text-white">
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
              className="gap-1.5 text-xs"
            >
              <Paperclip className="h-3.5 w-3.5" /> Priloži datoteku
            </Button>
          </div>

          <Button variant="ghost" size="sm" onClick={onClose}>
            Odustani
          </Button>
        </div>
      </div>
    </div>
  )
}

function MessageDetail({
  messageId,
  mailbox,
  currentFolder,
  onBack,
  onReply,
  onActionDone,
}: {
  messageId: string
  mailbox: string
  currentFolder: string
  onBack: () => void
  onReply: (data: ComposeInitialData) => void
  onActionDone: () => void
}) {
  const [msg, setMsg] = useState<EmailMessage | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(
      `/api/gmail?action=message&mailbox=${encodeURIComponent(mailbox)}&messageId=${encodeURIComponent(messageId)}`
    )
      .then((r) => r.json())
      .then((data) => {
        setMsg(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [messageId, mailbox])

  const performMessageAction = async (action: string, closeAfter = true) => {
    setActionLoading(true)
    try {
      await fetch("/api/gmail", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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

  const replyToAddress = extractEmailAddress(msg.replyTo || msg.from)
  const quotedPlain = (msg.body?.text || msg.snippet || "")
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n")

  const handleReply = () => {
    onReply({
      to: replyToAddress,
      subject: msg.subject?.toLowerCase().startsWith("re:") ? msg.subject : `Re: ${msg.subject}`,
      body: `\n\n--- Izvorna poruka (${msg.date}) od ${msg.from} ---\n${quotedPlain}`,
      inReplyTo: msg.messageId || undefined,
      references: [msg.references, msg.messageId].filter(Boolean).join(" ") || undefined,
      threadId: msg.threadId,
    })
  }

  const handleReplyAll = () => {
    const allTo = [replyToAddress, msg.to]
      .filter(Boolean)
      .join(", ")
      .split(",")
      .map((s) => extractEmailAddress(s))
      .filter((addr) => addr && addr.toLowerCase() !== mailbox.toLowerCase())
    const uniqueTo = Array.from(new Set(allTo)).join(", ") || replyToAddress

    onReply({
      to: uniqueTo,
      cc: msg.cc || undefined,
      subject: msg.subject?.toLowerCase().startsWith("re:") ? msg.subject : `Re: ${msg.subject}`,
      body: `\n\n--- Izvorna poruka (${msg.date}) od ${msg.from} ---\n${quotedPlain}`,
      inReplyTo: msg.messageId || undefined,
      references: [msg.references, msg.messageId].filter(Boolean).join(" ") || undefined,
      threadId: msg.threadId,
    })
  }

  const handleForward = () => {
    onReply({
      to: "",
      subject: msg.subject?.toLowerCase().startsWith("fwd:") ? msg.subject : `Fwd: ${msg.subject}`,
      body: `\n\n---------- Proslijeđena poruka ----------\nOd: ${msg.from}\nDatum: ${msg.date}\nNaslov: ${msg.subject}\nZa: ${msg.to}\n\n${
        msg.body?.text || msg.snippet || ""
      }`,
      threadId: msg.threadId,
    })
  }

  const attachments = msg.attachments ?? []

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-4 md:px-6 py-3 border-b border-border bg-card">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ChevronLeft className="h-4 w-4" /> Natrag
        </Button>
        <div className="flex-1" />

        <Button
          variant="ghost"
          size="sm"
          disabled={actionLoading}
          onClick={() => performMessageAction(msg.starred ? "unstar" : "star", false)}
          className="gap-1.5"
          title={msg.starred ? "Ukloni zvjezdicu" : "Označi zvjezdicom"}
        >
          <Star className={`h-4 w-4 ${msg.starred ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
        </Button>

        <Button variant="ghost" size="sm" onClick={handleReply} className="gap-1.5">
          <Reply className="h-4 w-4" /> Odgovori
        </Button>

        <Button variant="ghost" size="sm" onClick={handleReplyAll} className="gap-1.5">
          <ReplyAll className="h-4 w-4" /> Odgovori svima
        </Button>

        <Button variant="ghost" size="sm" onClick={handleForward} className="gap-1.5">
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
      </div>

      {/* Message Content */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-5 space-y-5">
        <div className="space-y-3 border-b border-border pb-4">
          <h2 className="text-lg md:text-xl font-bold text-foreground leading-snug">
            {msg.subject || "(bez naslova)"}
          </h2>

          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 text-xs text-muted-foreground bg-muted/30 rounded-xl p-3.5 border border-border/60">
            <div className="space-y-1 min-w-0">
              <p className="truncate">
                <span className="font-semibold text-foreground">Od:</span> {msg.from}
              </p>
              <p className="truncate">
                <span className="font-semibold text-foreground">Za:</span> {msg.to}
              </p>
              {msg.cc && (
                <p className="truncate">
                  <span className="font-semibold text-foreground">CC:</span> {msg.cc}
                </p>
              )}
            </div>
            <span className="shrink-0 font-medium text-slate-600">{msg.date}</span>
          </div>
        </div>

        {/* Attachments bar */}
        {attachments.length > 0 && (
          <div className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Paperclip className="h-3.5 w-3.5 text-primary" />
              <span>Privitci ({attachments.length})</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {attachments.map((att) => {
                const downloadUrl = `/api/gmail?action=attachment&mailbox=${encodeURIComponent(
                  mailbox
                )}&messageId=${encodeURIComponent(msg.id)}&attachmentId=${encodeURIComponent(
                  att.attachmentId
                )}&filename=${encodeURIComponent(att.filename)}&mimeType=${encodeURIComponent(att.mimeType)}`

                return (
                  <a
                    key={att.attachmentId}
                    href={downloadUrl}
                    download={att.filename}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border border-border bg-card hover:bg-muted/60 px-3 py-2 text-xs transition-colors shadow-2xs"
                  >
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate max-w-[200px]">{att.filename}</p>
                      <p className="text-[10px] text-muted-foreground">{formatBytes(att.size)}</p>
                    </div>
                    <Download className="h-3.5 w-3.5 text-muted-foreground ml-1 shrink-0" />
                  </a>
                )
              })}
            </div>
          </div>
        )}

        {/* Body */}
        <div className="rounded-xl border border-border/60 bg-white p-4 md:p-6 shadow-2xs overflow-x-auto">
          {msg.body?.html ? (
            <div
              className="prose prose-sm max-w-none text-slate-900"
              dangerouslySetInnerHTML={{ __html: msg.body.html }}
            />
          ) : (
            <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed text-slate-800">
              {msg.body?.text || msg.snippet}
            </pre>
          )}
        </div>

        {/* Bottom quick reply bar */}
        <div className="pt-2 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleReply} className="gap-1.5">
            <Reply className="h-4 w-4" /> Odgovori
          </Button>
          <Button variant="outline" size="sm" onClick={handleReplyAll} className="gap-1.5">
            <ReplyAll className="h-4 w-4" /> Odgovori svima
          </Button>
          <Button variant="outline" size="sm" onClick={handleForward} className="gap-1.5">
            <Forward className="h-4 w-4" /> Proslijedi
          </Button>
        </div>
      </div>
    </div>
  )
}

export function GmailContent() {
  const { user } = useAuth()
  const { settings } = useSettings()

  const [mailbox, setMailbox] = useState(settings.gmailMailbox || "")
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

  const fetchMessages = useCallback(
    async (pageTokenToLoad?: string) => {
      if (pageTokenToLoad) {
        setLoadingMore(true)
      } else {
        setLoading(true)
        setError("")
        setSelectedId(null)
      }

      try {
        const params = new URLSearchParams({
          action: "list",
          folder,
        })
        if (mailbox) params.set("mailbox", mailbox)
        if (search) params.set("q", search)
        if (pageTokenToLoad) params.set("pageToken", pageTokenToLoad)

        const res = await fetch(`/api/gmail?${params.toString()}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Greška pri dohvaćanju poruka.")

        if (data.mailbox && !mailbox) {
          setMailbox(data.mailbox)
        }

        setStatusInfo({
          connected: true,
          emailAddress: data.mailbox || mailbox,
          unreadInboxCount: data.unreadInboxCount ?? 0,
        })

        setNextPageToken(data.nextPageToken)
        if (pageTokenToLoad) {
          setMessages((prev) => [...prev, ...(data.messages ?? [])])
        } else {
          setMessages(data.messages ?? [])
        }
      } catch (e: any) {
        setError(e.message)
        setStatusInfo((prev) => ({ ...prev, connected: false }))
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [mailbox, folder, search]
  )

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  const toggleStar = async (e: React.MouseEvent, msg: EmailMessage) => {
    e.stopPropagation()
    const nextStarred = !msg.starred
    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, starred: nextStarred } : m)))

    try {
      await fetch("/api/gmail", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: nextStarred ? "star" : "unstar",
          mailbox,
          messageId: msg.id,
        }),
      })
    } catch {}
  }

  const unreadCount =
    statusInfo.unreadInboxCount ?? messages.filter((m) => m.unread).length

  return (
    <div className="flex h-[calc(100vh-3.5rem)] md:h-screen overflow-hidden bg-background">
      {/* Left Sidebar */}
      <div className="w-60 shrink-0 border-r border-border flex flex-col bg-card p-3 gap-2">
        {/* Compose Button */}
        <Button
          onClick={() => {
            setComposeInitial(undefined)
            setComposeOpen(true)
          }}
          disabled={!statusInfo.connected && !mailbox}
          className="w-full gap-2 justify-start rounded-xl py-5 shadow-xs font-semibold bg-[#1B2B36] hover:bg-[#263c4b] text-white"
        >
          <PenSquare className="h-4 w-4 text-[#CEA369]" /> Nova poruka
        </Button>

        {/* Folders */}
        <nav className="flex flex-col gap-0.5 mt-2">
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
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">{f.label}</span>
                {f.id === "INBOX" && unreadCount > 0 && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0 font-bold">
                    {unreadCount}
                  </Badge>
                )}
              </button>
            )
          })}
        </nav>

        <div className="flex-1" />

        {/* Connection status & mailbox info */}
        <div className="border-t border-border pt-3 space-y-2">
          {statusInfo.connected ? (
            <div className="rounded-lg bg-emerald-50/80 border border-emerald-200 px-2.5 py-2 space-y-0.5">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-800">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>Povezano</span>
              </div>
              <p className="text-[11px] font-mono text-emerald-700 truncate" title={statusInfo.emailAddress || mailbox}>
                {statusInfo.emailAddress || mailbox}
              </p>
            </div>
          ) : (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-2 text-[11px] text-amber-800">
              Sandučić nije povezan
            </div>
          )}

          {user?.role === "admin" && (
            <Link
              href="/settings?tab=email-notifications"
              className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <Settings className="h-3.5 w-3.5" /> Postavke Gmail sandučića
            </Link>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Search Bar */}
        <div className="flex items-center gap-3 px-4 md:px-6 py-3 border-b border-border bg-card">
          <div className="relative flex-1 max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setSearch(searchInput)
              }}
              placeholder="Pretraži poštu (npr. ime, naslov, privitak)..."
              className="pl-9 pr-8 h-9 text-sm rounded-full bg-muted/50 border-0 focus-visible:ring-1"
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
            className="gap-1.5"
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
            onBack={() => setSelectedId(null)}
            onReply={(data) => {
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
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {messages.map((msg) => (
              <div
                key={msg.id}
                onClick={() => {
                  setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, unread: false } : m)))
                  setSelectedId(msg.id)
                }}
                className={`w-full flex items-center gap-3 px-4 md:px-6 py-3 text-left hover:bg-muted/50 transition-colors cursor-pointer ${
                  msg.unread ? "bg-primary/5 font-semibold" : "bg-background"
                }`}
              >
                {/* Star button */}
                <button
                  type="button"
                  onClick={(e) => toggleStar(e, msg)}
                  className="text-muted-foreground hover:text-amber-400 transition-colors shrink-0 p-0.5"
                  title={msg.starred ? "Ukloni zvjezdicu" : "Označi zvjezdicom"}
                >
                  <Star className={`h-4 w-4 ${msg.starred ? "fill-amber-400 text-amber-400" : ""}`} />
                </button>

                {/* Unread dot */}
                <div className="w-2 shrink-0">
                  {msg.unread && <div className="h-2 w-2 rounded-full bg-primary" />}
                </div>

                {/* Sender / Recipient */}
                <span
                  className={`w-40 md:w-48 shrink-0 text-sm truncate ${
                    msg.unread ? "font-semibold text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {folder === "SENT" ? `Za: ${formatSender(msg.to)}` : formatSender(msg.from)}
                </span>

                {/* Subject + snippet */}
                <div className="flex-1 min-w-0 flex items-baseline gap-2">
                  <span
                    className={`text-sm truncate shrink-0 max-w-xs md:max-w-md ${
                      msg.unread ? "font-semibold text-foreground" : "text-foreground"
                    }`}
                  >
                    {msg.subject || "(bez naslova)"}
                  </span>
                  <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                    — {msg.snippet}
                  </span>
                </div>

                {/* Attachment indicator */}
                {msg.hasAttachments && (
                  <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}

                {/* Date */}
                <span className="text-xs text-muted-foreground shrink-0 ml-2">
                  {formatDate(msg.date)}
                </span>
              </div>
            ))}

            {nextPageToken && (
              <div className="p-4 flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchMessages(nextPageToken)}
                  disabled={loadingMore}
                  className="gap-2"
                >
                  {loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Učitaj više poruka
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Compose Dialog */}
      <ComposeDialog
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        mailbox={statusInfo.emailAddress || mailbox}
        initial={composeInitial}
        onSent={() => fetchMessages()}
      />
    </div>
  )
}
