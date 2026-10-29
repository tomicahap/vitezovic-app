"use client"

import * as React from "react"
import { useAuth } from "@/contexts/auth-context"
import { useActivityLog } from "@/contexts/activity-log-context"
import { formatInvitationDateTime } from "@/components/invitation-preview-dialog"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
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
  User
} from "lucide-react"

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
  const { refreshLogs } = useActivityLog()

  const [subject, setSubject] = React.useState("")
  const [customBody, setCustomBody] = React.useState("")
  const [viewMode, setViewMode] = React.useState<"preview" | "edit">("preview")

  const [isSending, setIsSending] = React.useState(false)
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
      setSendResult({ status: "idle", message: "" })
    } else if (!open) {
      prevOpenRef.current = false
    }
  }, [open, type, item.id, item.type, item.status, item.title, item.date, item.time, item.location, item.host, isMeeting, isGathering, originUrl])

  const validRecipients = (recipients || []).filter((r) => Boolean(r && r.email && typeof r.email === 'string' && r.email.includes("@")))

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

      const response = await fetch("/api/send-board-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        const sentAt = data.sentAt || new Date().toISOString()
        const sentCount = data.sentCount || validRecipients.length

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
          message: data.error || "Došlo je do greške pri slanju obavijesti.",
        })
      }
    } catch (err: any) {
      console.error("Greška pri slanju obavijesti:", err)
      setSendResult({
        status: "error",
        message: err.message || "Došlo je do mrežne pogreške pri slanju.",
      })
    } finally {
      setIsSending(false)
    }
  }

  const cleanPreviewBody = customBody
    .replace(/Poveznica za prijavu u sustav:\s*https?:\/\/[^\s<]+/gi, '')
    .replace(/Poveznica za prijavu u sustav:\s*\[LINK\]/gi, '')
    .trim()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[94vw] sm:max-w-4xl max-h-[92vh] overflow-y-auto p-0 rounded-2xl border border-border shadow-2xl">
        {/* Zaglavlje modala */}
        <div className="bg-[#1B2B36] border-b-2 border-[#CEA369] text-white p-6 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center shrink-0 border border-[#CEA369]/40">
              <Mail className="h-5 w-5 text-[#CEA369]" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-white tracking-tight">
                Provjera i slanje obavijesti o {isMeeting ? "sjednici" : (isGathering ? "rodoslovnom druženju" : "predavanju")}
              </DialogTitle>
              <DialogDescription className="text-xs text-[#CEA369]">
                Pregledajte primatelje i izgled e-pošte prije slanja
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
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

                <div className="p-4 bg-[#F2EFE9]">
                  <div className="rounded-xl border border-[#E8E4DE] bg-white overflow-hidden shadow-xs">
                    <div className="bg-[#1B2B36] border-b-2 border-[#CEA369] px-5 py-4 text-white">
                      <h3 className="font-bold text-sm text-white">
                        Hrvatsko rodoslovno društvo
                      </h3>
                      <p className="text-[11px] text-[#CEA369]">&ldquo;Pavao Ritter Vitezović&rdquo; — Službena obavijest</p>
                    </div>
                    <div className="p-5 space-y-4 font-sans text-[#1B2B36]">
                      <div className="text-xs leading-relaxed whitespace-pre-wrap">
                        {cleanPreviewBody}
                      </div>
                      <div className="text-center py-2">
                        <span className="inline-block bg-[#1B2B36] text-white border-2 border-[#CEA369] px-6 py-2.5 rounded-full text-xs font-bold shadow-xs">
                          Prijavite se u sustav &rarr;
                        </span>
                      </div>
                    </div>
                  </div>
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
        <div className="border-t border-border bg-muted/40 p-4 flex items-center justify-between gap-3 rounded-b-2xl">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSending}
          >
            {sendResult.status === "success" ? "Zatvori" : "Odustani"}
          </Button>

          <div className="flex items-center gap-2">
            {sendResult.status === "error" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={handleSend}
                disabled={isSending}
              >
                <RefreshCw className="h-3.5 w-3.5" /> Pokušaj ponovno
              </Button>
            )}

            {sendResult.status !== "success" ? (
              <Button
                type="button"
                size="sm"
                className="gap-1.5 bg-[#1B2B36] hover:bg-[#1B2B36]/90 border border-[#CEA369] text-white font-medium"
                onClick={handleSend}
                disabled={isSending || validRecipients.length === 0}
              >
                {isSending ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Slanje obavijesti...
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5 text-[#CEA369]" />
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
  )
}
