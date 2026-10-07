"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  Mail, Inbox, Send, Search, RefreshCw, Compose, X, Loader2,
  ChevronLeft, ChevronRight, Reply, Trash2, MailOpen, MailPlus,
  AlertTriangle, Settings, ArrowUp, Check, Star
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/contexts/auth-context"
import { useSettings } from "@/contexts/settings-context"
import { useActivityLog } from "@/contexts/activity-log-context"

// ─── Types ────────────────────────────────────────────────────────────────────

interface GmailMessage {
  id: string
  threadId: string
  snippet: string
  from: string
  to: string
  subject: string
  date: string
  labelIds: string[]
  unread: boolean
  body?: { text: string; html: string }
}

const FOLDERS = [
  { id: "INBOX", label: "Inbox", icon: Inbox },
  { id: "SENT", label: "Poslano",  icon: Send },
  { id: "ALL",  label: "Sve pošte", icon: Mail },
]

function formatDate(dateStr: string) {
  try {
    const d = new Date(dateStr)
    const now = new Date()
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString("hr-HR", { hour: "2-digit", minute: "2-digit", hour12: false })
    }
    return d.toLocaleDateString("hr-HR", { day: "2-digit", month: "short" })
  } catch { return dateStr }
}

function extractName(fromHeader: string) {
  const match = fromHeader.match(/^"?([^"<]+)"?\s*</)
  return match ? match[1].trim() : fromHeader
}

// ─── Compose Dialog ───────────────────────────────────────────────────────────

function ComposeDialog({ mailbox, replyTo, onClose, onSent }: { mailbox: string; replyTo?: GmailMessage | null; onClose: () => void; onSent: () => void }) {
  const { user } = useAuth()
  const { addLog } = useActivityLog()
  const [form, setForm] = useState({
    to: replyTo ? extractName(replyTo.from) + ` <${replyTo.from.replace(/.*<(.+)>/, '$1')}>` : "",
    subject: replyTo ? `Re: ${replyTo.subject}`.replace(/^Re: Re: /, 'Re: ') : "",
    body: replyTo ? `\n\n---\nZa: ${replyTo.from}\nOd: ${new Date(replyTo.date).toLocaleString("hr-HR", { hour12: false })}\n${replyTo.body?.text?.slice(0, 500) ?? ""}` : "",
  })
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")

  async function send() {
    if (!form.to.trim() || !form.subject.trim()) { setError("Unesite primatelja i predmet."); return }
    setSending(true); setError("")
    try {
      const authToken = btoa(JSON.stringify({ email: user?.email, role: user?.role, name: user?.name }))
      const res = await fetch('/api/gmail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ action: 'send', mailbox, to: form.to, subject: form.subject, htmlBody: form.body.replace(/\n/g, '<br>'), textBody: form.body }),
      })
      if (res.ok) { 
        if (user) addLog({ userId: user.id.toString(), userName: user.name, userRole: user.role, action: 'Gmail - Slanje', details: `Poslana poruka na: ${form.to} | Naslov: ${form.subject}` })
        onSent(); onClose() 
      }
      else { const d = await res.json(); setError(d.error ?? 'Greška pri slanju.') }
    } catch (e: any) { setError(e.message) }
    finally { setSending(false) }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-0 right-0 z-50 w-full max-w-lg rounded-t-2xl border border-border bg-background shadow-2xl md:bottom-6 md:right-6 md:rounded-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="font-semibold">{replyTo ? "Odgovori" : "Nova poruka"}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-2 p-4">
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div className="flex items-center gap-2">
            <span className="w-14 text-xs font-medium text-muted-foreground">Za:</span>
            <input value={form.to} onChange={e => setForm(p => ({ ...p, to: e.target.value }))}
              className="flex-1 rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-14 text-xs font-medium text-muted-foreground">Predmet:</span>
            <input value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
              className="flex-1 rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
          </div>
          <textarea value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
            rows={12} className="w-full resize-none rounded border border-border bg-background p-2 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-accent" />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={onClose}>Odustani</Button>
            <Button size="sm" className="gap-2 bg-primary text-primary-foreground" onClick={send} disabled={sending}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
              {sending ? "Slanje…" : "Pošalji"}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Message Detail ───────────────────────────────────────────────────────────

function MessageDetail({ message, mailbox, onClose, onReply, onDelete }: {
  message: GmailMessage; mailbox: string; onClose: () => void; onReply: (m: GmailMessage) => void; onDelete: (id: string) => void
}) {
  return (
    <div className="flex flex-col h-full border-l border-border">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onReply(message)}>
            <Reply className="h-3.5 w-3.5" /> Odgovori
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-red-600 hover:bg-red-50" onClick={() => onDelete(message.id)}>
            <Trash2 className="h-3.5 w-3.5" /> Obriši
          </Button>
        </div>
        <button onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"><X className="h-4 w-4" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <h2 className="mb-4 font-serif text-2xl font-bold">{message.subject || "(Bez predmeta)"}</h2>
        <div className="mb-6 space-y-1 text-sm text-muted-foreground">
          <div className="flex gap-2"><span className="font-medium text-foreground">Od:</span> {message.from}</div>
          <div className="flex gap-2"><span className="font-medium text-foreground">Za:</span> {message.to || mailbox}</div>
          <div className="flex gap-2"><span className="font-medium text-foreground">Datum:</span> {new Date(message.date).toLocaleString("hr-HR", { hour12: false })}</div>
        </div>
        <div className="border-t border-border pt-4">
          {message.body?.html ? (
            <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: message.body.html }} />
          ) : (
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{message.body?.text || message.snippet}</pre>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Gmail Content ───────────────────────────────────────────────────────

export function GmailContent() {
  const { user } = useAuth()
  const { settings, setGmailMailbox } = useSettings()
  const { addLog } = useActivityLog()
  const isAdmin = user?.role === "admin"

  const [messages, setMessages] = useState<GmailMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [folder, setFolder] = useState("INBOX")
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<GmailMessage | null>(null)
  const [loadingMsg, setLoadingMsg] = useState(false)
  const [showCompose, setShowCompose] = useState(false)
  const [replyTo, setReplyTo] = useState<GmailMessage | null>(null)
  const [nextPage, setNextPage] = useState<string | undefined>()
  const [pageHistory, setPageHistory] = useState<(string | undefined)[]>([undefined])
  const [pageIdx, setPageIdx] = useState(0)
  const [configuring, setConfiguring] = useState(false)
  const [mailboxInput, setMailboxInput] = useState(settings.gmailMailbox ?? "")

  const mailbox = settings.gmailMailbox

  // Build auth token
  const authToken = user ? btoa(JSON.stringify({ email: user.email, role: user.role, name: user.name })) : ""

  const fetchMessages = useCallback(async (pageToken?: string, newSearch?: string) => {
    if (!mailbox) return
    setLoading(true); setError("")
    try {
      const params = new URLSearchParams({ mailbox, folder, q: newSearch ?? search })
      if (pageToken) params.set('pageToken', pageToken)
      const res = await fetch(`/api/gmail?${params}`, { headers: { 'Authorization': `Bearer ${authToken}` } })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Greška') }
      const data = await res.json()
      setMessages(data.messages ?? [])
      setNextPage(data.nextPageToken)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }, [mailbox, folder, search, authToken])

  useEffect(() => { if (mailbox) fetchMessages() }, [mailbox, folder])

  async function openMessage(msg: GmailMessage) {
    setSelected({ ...msg, body: undefined })
    setLoadingMsg(true)
    try {
      const res = await fetch(`/api/gmail?action=message&mailbox=${mailbox}&messageId=${msg.id}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      })
      if (res.ok) {
        const full = await res.json()
        setSelected(full)
        if (user) addLog({ userId: user.id.toString(), userName: user.name, userRole: user.role, action: 'Gmail - Pregled', details: `Otvorena poruka: ${msg.subject || msg.id}` })
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, unread: false } : m))
      }
    } catch (e) { console.error(e) }
    finally { setLoadingMsg(false) }
  }

  async function deleteMessage(id: string) {
    if (!confirm("Premjesti poruku u smeće?")) return
    try {
      await fetch('/api/gmail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ action: 'trash', mailbox, messageId: id }),
      })
      const msg = messages.find(m => m.id === id)
      if (user) addLog({ userId: user.id.toString(), userName: user.name, userRole: user.role, action: 'Gmail - Brisanje', details: `Poruka premještena u smeće: ${msg?.subject || id}` })
      setMessages(prev => prev.filter(m => m.id !== id))
      if (selected?.id === id) setSelected(null)
    } catch {}
  }

  function handleReply(msg: GmailMessage) { setReplyTo(msg); setShowCompose(true) }

  if (!mailbox) {
    return (
      <main className="flex-1 overflow-auto">
        <div className="flex flex-col items-center justify-center py-32">
          <Mail className="mb-6 h-16 w-16 text-muted-foreground/30" />
          <h2 className="mb-2 font-serif text-2xl font-bold">Gmail nije konfiguriran</h2>
          <p className="mb-6 max-w-md text-center text-muted-foreground text-sm">
            Unesite email adresu dijeljenog mailboxa (npr. tajnistvo@dndrustvo.hr) koji je konfiguriran na istom Google Workspace domenu kao i Service Account.
          </p>
          {isAdmin && (
            <div className="flex gap-3 w-full max-w-sm">
              <input value={mailboxInput} onChange={e => setMailboxInput(e.target.value)}
                placeholder="email@drustvo.hr"
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
              <Button onClick={() => { if (mailboxInput.includes('@')) setGmailMailbox(mailboxInput.trim()) }}>
                Spremi
              </Button>
            </div>
          )}
          <div className="mt-8 max-w-md rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
            <p className="mb-2 font-medium text-amber-800">⚠️ Konfiguracija potrebna</p>
            <ol className="list-decimal space-y-1 pl-4 text-amber-700">
              <li>U Google Workspace Admin konzoli aktivirajte <b>Domain-Wide Delegation</b> za Service Account</li>
              <li>Dodajte Gmail OAuth2 opsege: <code className="text-xs">https://www.googleapis.com/auth/gmail.modify</code></li>
              <li>Aktivirajte Gmail API u Google Cloud projektu</li>
              <li>Ovdje unesite email dijeljenog mailboxa</li>
            </ol>
          </div>
        </div>
      </main>
    )
  }

  const unreadCount = messages.filter(m => m.unread).length

  return (
    <main className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <div className="flex w-56 flex-shrink-0 flex-col border-r border-border bg-card p-3">
        <Button className="mb-4 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 w-full" onClick={() => { setReplyTo(null); setShowCompose(true) }}>
          <MailPlus className="h-4 w-4" /> Sastavi
        </Button>
        <nav className="space-y-1">
          {FOLDERS.map(f => {
            const Icon = f.icon
            return (
              <button key={f.id} onClick={() => { setFolder(f.id); setSelected(null) }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors ${folder === f.id ? "bg-secondary font-medium text-foreground" : "text-muted-foreground hover:bg-secondary/50"}`}>
                <Icon className="h-4 w-4" />
                {f.label}
                {f.id === "INBOX" && unreadCount > 0 && (
                  <span className="ml-auto rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">{unreadCount}</span>
                )}
              </button>
            )
          })}
        </nav>
        <div className="mt-auto pt-4 border-t border-border">
          <p className="text-[10px] text-muted-foreground truncate px-2">{mailbox}</p>
          {isAdmin && (
            <button onClick={() => setConfiguring(!configuring)} className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2">
              <Settings className="h-3 w-3" /> Promijeni mailbox
            </button>
          )}
          {configuring && isAdmin && (
            <div className="mt-2 space-y-1 px-2">
              <input value={mailboxInput} onChange={e => setMailboxInput(e.target.value)} placeholder="email@drustvo.hr"
                className="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-accent" />
              <Button size="sm" className="w-full text-xs" onClick={() => { setGmailMailbox(mailboxInput.trim()); setConfiguring(false) }}>Spremi</Button>
            </div>
          )}
        </div>
      </div>

      {/* Message list */}
      <div className={`flex flex-col border-r border-border ${selected ? "w-80 flex-shrink-0" : "flex-1"}`}>
        <div className="flex items-center gap-2 border-b border-border p-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === "Enter" && fetchMessages(undefined, search)}
              placeholder="Pretraži poštu..."
              className="w-full rounded-lg border border-border bg-background py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
          </div>
          <button onClick={() => fetchMessages()} className="rounded-lg border border-border p-2 hover:bg-secondary">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {error && (
          <div className="m-3 rounded-lg border border-red-200 bg-red-50 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-red-600" />
              <div>
                <p className="text-sm font-medium text-red-800">Greška Gmail API-ja</p>
                <p className="mt-0.5 text-xs text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="mb-3 h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Učitavanje poruka…</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Inbox className="mb-3 h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Nema poruka</p>
            </div>
          ) : messages.map(msg => (
            <button key={msg.id} onClick={() => openMessage(msg)}
              className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/30 ${selected?.id === msg.id ? "bg-secondary" : ""} ${msg.unread ? "bg-accent/5" : ""}`}>
              <div className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${msg.unread ? "bg-accent" : "bg-transparent"}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className={`truncate text-sm ${msg.unread ? "font-semibold" : "font-medium"}`}>{extractName(msg.from)}</p>
                  <span className="flex-shrink-0 text-[10px] text-muted-foreground">{formatDate(msg.date)}</span>
                </div>
                <p className={`truncate text-xs ${msg.unread ? "font-medium text-foreground" : "text-muted-foreground"}`}>{msg.subject || "(Bez predmeta)"}</p>
                <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground/60">{msg.snippet}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Message detail */}
      {selected && (
        <div className="flex-1 overflow-hidden">
          {loadingMsg ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <MessageDetail
              message={selected} mailbox={mailbox}
              onClose={() => setSelected(null)}
              onReply={handleReply}
              onDelete={deleteMessage}
            />
          )}
        </div>
      )}

      {showCompose && (
        <ComposeDialog
          mailbox={mailbox} replyTo={replyTo}
          onClose={() => { setShowCompose(false); setReplyTo(null) }}
          onSent={() => { fetchMessages(); setShowCompose(false); setReplyTo(null) }}
        />
      )}
    </main>
  )
}
