"use client"

import * as React from "react"
import { useAuth } from "@/contexts/auth-context"
import { useMembers } from "@/contexts/members-context"
import { useSettings } from "@/contexts/settings-context"
import { useActivityLog } from "@/contexts/activity-log-context"
import { formatInvitationDateTime } from "@/components/invitation-preview-dialog"
import { buildHrdMasterEmail, escapeHtml, formatHrdEmailDate, formatHrdEmailTime, HrdEmailTemplateTypeId } from "@/lib/hrd-email-system"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CloseActionButton } from "@/components/ui/action-bar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  Mail, 
  Send, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  Eye, 
  Edit3,
  User,
  FileText
} from "lucide-react"
import { EventPdfPreviewDialog } from "@/components/event-pdf-preview-dialog"
import { EmailSendProgressBanner } from "@/components/email-send-progress-banner"
import {
  consumeEmailSendStream,
  INITIAL_BULK_EMAIL_PROGRESS,
  type BulkEmailProgressState,
} from "@/lib/bulk-email-stream"

interface BoardNotificationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: "meeting" | "lecture"
  item: {
    id?: number | string
    title: string
    type?: string
    date: string
    time?: string
    location?: string
    host?: string
    status?: string
  }
  recipients: { id?: number; name: string; email: string }[]
  onSuccess?: (data?: { sentAt: string; recipients: any[] }) => void
}

export function BoardNotificationDialog({
  open,
  onOpenChange,
  type,
  item,
  recipients,
  onSuccess,
}: BoardNotificationDialogProps) {
  const { user } = useAuth()
  const { members } = useMembers()
  const { settings } = useSettings()
  const { refreshLogs } = useActivityLog()

  const [subject, setSubject] = React.useState("")
  const [customBody, setCustomBody] = React.useState("")
  const [viewMode, setViewMode] = React.useState<"preview" | "edit">("preview")
  const [showPdfPreview, setShowPdfPreview] = React.useState(false)
  const [testEmailAddress, setTestEmailAddress] = React.useState("")

  const [isSending, setIsSending] = React.useState(false)
  const [isSendingTest, setIsSendingTest] = React.useState(false)
  const [sendProgress, setSendProgress] = React.useState<BulkEmailProgressState>(INITIAL_BULK_EMAIL_PROGRESS)
  const sendAbortRef = React.useRef<AbortController | null>(null)
  const [sendResult, setSendResult] = React.useState<{
    status: "idle" | "success" | "error"
    message: string
    sentAt?: string
    sentCount?: number
  }>({ status: "idle", message: "" })

  const isMeeting = type === "meeting"
  const isGathering = !isMeeting && (item.type === "gathering" || item.type === "druzenje" || item.type === "druženje" || item.title?.toLowerCase().includes("druženje") || item.title?.toLowerCase().includes("druzenje") || item.title?.toLowerCase().includes("rodoslovno"))
  const typeLabel = isMeeting ? "Sjednica" : (isGathering ? "Rodoslovno druženje" : "Predavanje")

  const originUrl = typeof window !== "undefined" ? window.location.origin : "https://cms.rodoslovlje.hr"

  const prevOpenRef = React.useRef(false)

  // Inicijalizacija pri otvaranju
  React.useEffect(() => {
    if (open && !prevOpenRef.current) {
      prevOpenRef.current = true
      const isCompleted = item.status === "completed"
      let defaultSubj = ""
      let defaultText = ""

      if (isMeeting) {
        if (isCompleted) {
          defaultSubj = `Zapisnik i detalji sa sjednice: ${item.title}`
          defaultText = `Poštovane članice i članovi tijela Društva,\n\nOvim putem Vas obavještavamo da je sjednica uspješno završena te su u sustavu dostupni zapisnik i materijali.\n\nNaziv: ${item.title}\nDatum održavanja: ${item.date} u ${item.time || "—"}\nLokacija: ${item.location || "Online"}\n\nPoveznica za prijavu u sustav: ${originUrl}\n\nSrdačan pozdrav,\nIzvršni odbor HRD "Pavao Ritter Vitezović"`
        } else {
          defaultSubj = `Sazvana je nova sjednica: ${item.title}`
          defaultText = `Poštovane članice i članovi tijela Društva,\n\nPozivamo Vas na sjednicu koja će se održati prema sljedećim podacima:\n\nNaziv sjednice: ${item.title}\nDatum i vrijeme: ${item.date} u ${item.time || "—"}\nLokacija: ${item.location || "Online"}\n\nMolimo Vas da svoj dolazak potvrdite ili se prijavite u sustav radi uvida u dnevni red.\n\nPoveznica za prijavu u sustav: ${originUrl}\n\nSrdačan pozdrav,\nIzvršni odbor HRD "Pavao Ritter Vitezović"`
        }
      } else if (isGathering) {
        defaultSubj = "Obavijest o rodoslovnom druženju"

        if (isCompleted) {
          defaultText = `Poštovane članice i članovi tijela Društva,\n\nRodoslovno druženje je uspješno održano te su u sustavu dostupni sažetak i materijali.\n\nNaziv: ${item.title}\nDatum održavanja: ${item.date} u ${item.time || "—"}\nLokacija: ${item.location || "Online"}\n\nPoveznica za prijavu u sustav: ${originUrl}\n\nSrdačan pozdrav,\nHRD "Pavao Ritter Vitezović"`
        } else {
          defaultText = `Poštovane članice i članovi tijela Društva,\n\nZadovoljstvo nam je najaviti rodoslovno druženje:\n\nNaziv: ${item.title}\nDatum i vrijeme: ${item.date} u ${item.time || "—"}\nLokacija: ${item.location || "Online"}\n\nRadujemo se Vašem dolasku.\n\nPoveznica za prijavu u sustav: ${originUrl}\n\nSrdačan pozdrav,\nHRD "Pavao Ritter Vitezović"`
        }
      } else {
        if (isCompleted) {
          defaultSubj = `Održano predavanje: ${item.title}`
          defaultText = `Poštovane članice i članovi tijela Društva,\n\nPredavanje je uspješno održano te su u sustavu dostupni sažetak i materijali.\n\nNaziv predavanja: ${item.title}\nPredavač: ${item.host || "—"}\nDatum održavanja: ${item.date} u ${item.time || "—"}\nLokacija: ${item.location || "Online"}\n\nPoveznica za prijavu u sustav: ${originUrl}\n\nSrdačan pozdrav,\nHRD "Pavao Ritter Vitezović"`
        } else {
          defaultSubj = `Novo predavanje: ${item.title}`
          defaultText = `Poštovane članice i članovi tijela Društva,\n\nZadovoljstvo nam je najaviti predavanje:\n\nNaziv predavanja: ${item.title}\nPredavač: ${item.host || "—"}\nDatum i vrijeme: ${item.date} u ${item.time || "—"}\nLokacija: ${item.location || "Online"}\n\nRadujemo se Vašem dolasku.\n\nPoveznica za prijavu u sustav: ${originUrl}\n\nSrdačan pozdrav,\nHRD "Pavao Ritter Vitezović"`
        }
      }

      setSubject(defaultSubj)
      setCustomBody(defaultText)
      setViewMode("preview")
      setTestEmailAddress(user?.email || settings?.smtpFrom || "")
      setSendResult({ status: "idle", message: "" })
      setSendProgress(INITIAL_BULK_EMAIL_PROGRESS)
    } else if (!open) {
      prevOpenRef.current = false
    }
  }, [open, type, item.id, item.type, item.status, item.title, item.date, item.time, item.location, item.host, isMeeting, isGathering, originUrl])

  const { validRecipients, excludedDoNotContactCount } = React.useMemo(() => {
    const blockedIds = new Set(members.filter((m) => m?.doNotContact).map((m) => m.id))
    const blockedEmails = new Set(
      members
        .filter((m) => m?.doNotContact && m.email)
        .map((m) => String(m.email).trim().toLowerCase())
    )
    const withEmail = (recipients || []).filter((r) =>
      Boolean(r && r.email && typeof r.email === 'string' && r.email.includes("@"))
    )
    const allowed = withEmail.filter((r) => {
      if (r.id !== undefined && blockedIds.has(Number(r.id))) return false
      const emailLower = String(r.email).trim().toLowerCase()
      return !blockedEmails.has(emailLower)
    })
    return {
      validRecipients: allowed,
      excludedDoNotContactCount: withEmail.length - allowed.length,
    }
  }, [recipients, members])

  const handleSend = async () => {
    if (validRecipients.length === 0) {
      setSendResult({
        status: "error",
        message: "Niti jedan odabrani primatelj nema valjanu email adresu.",
      })
      return
    }

    setIsSending(true)
    setSendResult({ status: "idle", message: "" })
    const abortController = new AbortController()
    sendAbortRef.current = abortController
    setSendProgress({
      ...INITIAL_BULK_EMAIL_PROGRESS,
      active: true,
      status: "running",
      total: validRecipients.length,
      label: `Slanje obavijesti o ${isMeeting ? "sjednici" : isGathering ? "druženju" : "predavanju"}`,
    })

    try {
      const payload: any = {
        type,
        item,
        recipients: validRecipients.map((r) => ({ email: r.email, name: r.name })),
        customSubject: isGathering ? "Obavijest o rodoslovnom druženju" : subject,
        customBody,
      }

      if (user) {
        payload.sender = {
          userId: user.id.toString(),
          userName: user.name,
          userRole: user.role
        }
      }

      const data = await consumeEmailSendStream(
        "/api/send-board-notification",
        payload,
        (prog) =>
          setSendProgress({
            ...prog,
            label: `Slanje obavijesti o ${isMeeting ? "sjednici" : isGathering ? "druženju" : "predavanju"}`,
          }),
        abortController.signal
      )

      if (data?.success) {
        const sentAt = data.sentAt || new Date().toISOString()
        const sentCount = data.sentCount ?? validRecipients.length

        await refreshLogs()

        setSendResult({
          status: "success",
          message: data.message || `Obavijesti su uspješno poslane na ${validRecipients.length} adresa!`,
          sentAt,
          sentCount,
        })

        if (onSuccess) {
          onSuccess({
            sentAt,
            recipients: data.recipients || validRecipients.map(r => ({
              name: r.name,
              email: r.email,
              sentAt,
              sentBy: user?.name || "Administrator"
            }))
          })
        }
      } else {
        setSendResult({
          status: "error",
          message: data?.error || "Došlo je do greške pri slanju obavijesti.",
        })
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
        setSendProgress((prev) => ({
          ...prev,
          active: false,
          status: "cancelled",
          pausedReason: "Slanje zaustavljeno od strane korisnika.",
        }))
        setSendResult({
          status: "error",
          message: "Slanje je zaustavljeno. Već poslani e-mailovi su evidentirani.",
        })
      } else {
        console.error("Greška pri slanju obavijesti:", err)
        setSendResult({
          status: "error",
          message: err.message || "Došlo je do mrežne pogreške pri slanju.",
        })
      }
    } finally {
      sendAbortRef.current = null
      setIsSending(false)
    }
  }

  const cleanPreviewBody = customBody
    .replace(/Poveznica za prijavu u sustav:\s*https?:\/\/[^\s<]+/gi, '')
    .replace(/Poveznica za prijavu u sustav:\s*\[LINK\]/gi, '')
    .trim()

  const formattedItemDate = item.date ? formatHrdEmailDate(item.date) : "—"
  const formattedItemTime = formatHrdEmailTime(item.time) || "—"
  const templateType: HrdEmailTemplateTypeId = isMeeting
    ? (item.status === "completed" ? "zapisnik_sjednice" : "poziv_sjednica")
    : "poziv_predavanje"
  const infoBoxTitle = isMeeting
    ? (item.status === "completed" ? "Sažetak održane sjednice" : "Podaci o održavanju sjednice")
    : "Detalji događanja"

  const previewHtmlResult = buildHrdMasterEmail({
    templateType,
    title: isGathering ? "Obavijest o rodoslovnom druženju" : (subject || "Obavijest"),
    bodyTextOrHtml: cleanPreviewBody,
    infoBoxTitle,
    infoBoxHtml: `
      <div><strong>Naziv:</strong> ${escapeHtml(item.title || "—")}</div>
      <div><strong>Datum i vrijeme:</strong> ${escapeHtml(formattedItemDate)} u ${escapeHtml(formattedItemTime)}</div>
      <div><strong>Lokacija:</strong> ${escapeHtml(item.location || "Online")}</div>
      ${!isMeeting && item.host ? `<div><strong>Predavač / voditelj:</strong> ${escapeHtml(item.host)}</div>` : ""}
      <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #E2E8F0;"><strong>Službeni PDF prilog:</strong> U privitku e-pošte automatski se šalje generirani A4 PDF dokument.</div>
    `,
    ctaText: "Prijavite se u sustav",
    ctaUrl: originUrl,
    settings,
    sender: user
      ? {
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          userRole: user.role,
        }
      : undefined,
    forBrowserPreview: true,
  })

  const handleSendTest = async () => {
    setIsSendingTest(true)
    setSendResult({ status: "idle", message: "" })
    try {
      const payload: any = {
        type,
        item,
        recipients: validRecipients.map((r) => ({ email: r.email, name: r.name })),
        customSubject: isGathering ? "Obavijest o rodoslovnom druženju" : subject,
        customBody,
        testOnly: true,
        testEmail: testEmailAddress.trim() || user?.email || settings?.smtpFrom,
      }
      if (user) {
        payload.sender = {
          userId: user.id.toString(),
          userName: user.name,
          userRole: user.role,
        }
      }
      const response = await fetch("/api/send-board-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (response.ok && data.success) {
        setSendResult({
          status: "success",
          message: data.message || "Testna obavijest je uspješno poslana!",
        })
      } else {
        setSendResult({
          status: "error",
          message: data.error || "Slanje testnog e-maila nije uspjelo.",
        })
      }
    } catch (err: any) {
      setSendResult({
        status: "error",
        message: err.message || "Greška pri slanju testnog e-maila.",
      })
    } finally {
      setIsSendingTest(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[94vw] sm:max-w-4xl max-h-[92vh] overflow-y-auto p-0 rounded-2xl border border-border shadow-2xl">
        {/* Zaglavlje modala */}
        <div className="bg-[#1E3A5F] border-b-2 border-[#D97706] text-white p-6 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center shrink-0 border border-[#D97706]/40">
              <Mail className="h-5 w-5 text-[#FEFCE8]" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-white tracking-tight">
                Provjera i slanje obavijesti o {isMeeting ? "sjednici" : (isGathering ? "rodoslovnom druženju" : "predavanju")}
              </DialogTitle>
              <DialogDescription className="text-xs text-[#F8FAFC]">
                Standardizirani HRD predložak (#1E3A5F / #7C2D12 / #D97706) s A4 PDF privitkom i službenim potpisom
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {(sendProgress.active || sendProgress.status !== "idle") && (
            <EmailSendProgressBanner
              progress={sendProgress}
              onCancel={() => sendAbortRef.current?.abort()}
              title="Brojač slanja obavijesti"
            />
          )}

          {/* Uspjeh alert */}
          {sendResult.status === "success" && (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-900 shadow-sm animate-in fade-in duration-200">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-6 w-6 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-emerald-900">E-mail obavijesti su uspješno poslane!</h4>
                  <p className="text-xs text-emerald-800">{sendResult.message}</p>
                  {sendResult.sentAt && (
                    <p className="text-xs font-semibold text-emerald-950 flex items-center gap-1.5 pt-1">
                      <Clock className="h-3.5 w-3.5" /> Evidentirano vrijeme slanja: {formatInvitationDateTime(sendResult.sentAt)}
                    </p>
                  )}
                  <p className="text-[11px] text-emerald-700 pt-0.5">
                    Evidencija slanja (tko, kome i točno vrijeme) trajno je spremljena isključivo uz ovaj predmet.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Greška alert */}
          {sendResult.status === "error" && (
            <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-900 shadow-sm animate-in fade-in duration-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-6 w-6 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-red-900">Greška: E-mailovi NISU poslani!</h4>
                  <p className="text-xs text-red-800">{sendResult.message}</p>
                  <p className="text-[11px] text-red-700 pt-1">
                    Provjerite SMTP postavke poslužitelja u Postavkama.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Upozorenje ako su primatelji isključeni zbog zabrane kontakta */}
          {excludedDoNotContactCount > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-900 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
              <span>
                Isključeno primatelja s oznakom <strong>Ne kontaktirati</strong>: <strong>{excludedDoNotContactCount}</strong> (na izričitu napomenu člana slanje nije dopušteno).
              </span>
            </div>
          )}

          {/* Sažetak događaja */}
          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Podaci o događaju</span>
              <Badge variant="outline" className="text-[10px] font-medium bg-background">
                {typeLabel}
              </Badge>
            </div>

            <div className="space-y-1">
              <h3 className="font-bold text-base text-foreground">{item.title}</h3>
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-primary" /> {item.date}
                </span>
                {item.time && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-primary" /> {item.time}
                  </span>
                )}
                {item.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-primary" /> {item.location}
                  </span>
                )}
                {!isGathering && item.host && (
                  <span className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-primary" /> Predavač: {item.host}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Automatski priložen A4 PDF dokument */}
          <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3.5 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-rose-100 flex items-center justify-center shrink-0 text-rose-700 font-extrabold text-xs border border-rose-300 shadow-xs">
                PDF
              </div>
              <div>
                <div className="text-xs font-bold text-rose-950 flex items-center gap-1.5">
                  Automatski A4 PDF privitak uz e-mail
                  <Badge variant="outline" className="text-[10px] bg-white border-rose-300 text-rose-700 font-semibold py-0 px-1.5">
                    Priloženo
                  </Badge>
                </div>
                <p className="text-[11px] text-rose-800">
                  Uz svaki poslani e-mail automatski se prilaže službeni PDF izvještaj sa svim podacima i funkcijama članova.
                </p>
              </div>
            </div>
            {item.id && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs h-7.5 gap-1.5 border-rose-300 bg-white hover:bg-rose-100 text-rose-900 shrink-0 font-medium shadow-xs"
                onClick={() => setShowPdfPreview(true)}
              >
                <FileText className="h-3.5 w-3.5 text-rose-600" />
                Pregledaj PDF
              </Button>
            )}
          </div>

          {/* Popis primatelja */}
          <div className="rounded-xl border border-border bg-card p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-primary" /> Primatelji ({validRecipients.length})
              </span>
              <span className="text-[11px] text-muted-foreground">
                Svi odabrani članovi odbora
              </span>
            </div>

            <div className="max-h-32 overflow-y-auto space-y-1 pr-1 text-xs">
              {validRecipients.map((r, i) => (
                <div key={i} className="flex justify-between items-center py-1 px-2 rounded bg-muted/30">
                  <span className="font-medium text-foreground">{r.name}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">{r.email}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Predmet e-pošte */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Predmet e-pošte (Subject):</Label>
            <Input
              value={isGathering ? "Obavijest o rodoslovnom druženju" : subject}
              onChange={(e) => !isGathering && setSubject(e.target.value)}
              className="text-xs"
              disabled={isGathering || sendResult.status === "success" || isSending}
            />
          </div>

          {/* Izbor prikaza: Vizualni preview ili Prilagodba teksta */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg border border-border">
                <Button
                  type="button"
                  variant={viewMode === "preview" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 text-xs gap-1.5 px-3 rounded-md"
                  onClick={() => setViewMode("preview")}
                >
                  <Eye className="h-3.5 w-3.5" /> Vizualni izgled e-pošte
                </Button>
                <Button
                  type="button"
                  variant={viewMode === "edit" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 text-xs gap-1.5 px-3 rounded-md"
                  onClick={() => setViewMode("edit")}
                >
                  <Edit3 className="h-3.5 w-3.5" /> Prilagodi tekst poruke
                </Button>
              </div>
            </div>

            {viewMode === "preview" ? (
              <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden text-xs">
                <div className="bg-muted/40 border-b border-border p-3 space-y-1 font-mono text-[11px]">
                  <div className="flex">
                    <span className="w-16 text-muted-foreground shrink-0">Od:</span>
                    <span className="text-foreground font-medium">
                      Hrvatsko rodoslovno društvo &lt;rodoslovlje@rodoslovlje.hr&gt;
                    </span>
                  </div>
                  <div className="flex">
                    <span className="w-16 text-muted-foreground shrink-0">Za:</span>
                    <span className="text-foreground font-medium">
                      Odabrani članovi ({validRecipients.length} primatelja)
                    </span>
                  </div>
                  <div className="flex">
                    <span className="w-16 text-muted-foreground shrink-0">Predmet:</span>
                    <span className="text-foreground font-bold">{isGathering ? "Obavijest o rodoslovnom druženju" : subject}</span>
                  </div>
                </div>

                <div className="p-2 bg-[#F8FAFC] overflow-x-auto">
                  <div dangerouslySetInnerHTML={{ __html: previewHtmlResult.html }} />
                </div>
              </div>
            ) : (
              <div className="space-y-3 rounded-xl border border-border bg-card p-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Uredi tekst obavijesti:</Label>
                  <Textarea
                    value={customBody}
                    onChange={(e) => setCustomBody(e.target.value)}
                    rows={8}
                    className="text-xs"
                    disabled={sendResult.status === "success" || isSending}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Podnožje s gumbima */}
        <div className="border-t border-border bg-muted/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-b-2xl">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <Input
              value={testEmailAddress}
              onChange={(e) => setTestEmailAddress(e.target.value)}
              placeholder="E-mail za test (admin ili drugi mail)..."
              className="h-8 text-xs bg-background"
              disabled={isSending || isSendingTest}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSendTest}
              disabled={isSending || isSendingTest}
              className="shrink-0 gap-1.5 border-[#D97706] text-[#1E3A5F] hover:bg-[#FEFCE8]"
            >
              {isSendingTest ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5 text-[#D97706]" />}
              Pošalji testni e-mail
            </Button>
          </div>

          <div className="flex items-center justify-end gap-2.5">
            <CloseActionButton
              label={sendResult.status === "success" ? "Zatvori" : "Odustani"}
              onClick={() => onOpenChange(false)}
              disabled={isSending}
            />

            {sendResult.status === "error" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full h-10 px-4 gap-1.5 border-2 border-slate-300"
                onClick={handleSend}
                disabled={isSending}
              >
                <RefreshCw className="h-3.5 w-3.5" /> Pokušaj ponovno
              </Button>
            )}

            {sendResult.status !== "success" ? (
              <Button
                type="button"
                className="rounded-full h-10 px-6 gap-2 bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 border border-[#D97706] text-white font-bold shadow-md"
                onClick={handleSend}
                disabled={isSending || isSendingTest || validRecipients.length === 0}
              >
                {isSending ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    {sendProgress.total > 0
                      ? `Šaljem ${sendProgress.sent}/${sendProgress.total}...`
                      : "Slanje obavijesti..."}
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5 text-[#D97706]" />
                    Odobri i pošalji obavijest ({validRecipients.length})
                  </>
                )}
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 font-medium"
                onClick={() => onOpenChange(false)}
              >
                <CheckCircle className="h-3.5 w-3.5" /> U redu
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>

      {showPdfPreview && item.id && (
        <EventPdfPreviewDialog
          type={type}
          id={Number(item.id)}
          title={item.title}
          onClose={() => setShowPdfPreview(false)}
        />
      )}
    </>
  )
}
