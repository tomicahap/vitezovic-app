"use client"

import * as React from "react"
import { Member, useMembers } from "@/contexts/members-context"
import { useSettings } from "@/contexts/settings-context"
import { useAuth } from "@/contexts/auth-context"
import { buildHrdMasterEmail, escapeHtml } from "@/lib/hrd-email-system"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CloseActionButton } from "@/components/ui/action-bar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { 
  Mail, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  Send, 
  Clock, 
  ExternalLink, 
  Key, 
  User, 
  ShieldCheck,
  Eye,
  Edit3,
  Ban
} from "lucide-react"

export function formatInvitationDateTime(isoOrDateStr: string | null | undefined): string {
  if (!isoOrDateStr) return "—"
  try {
    const d = new Date(isoOrDateStr)
    if (isNaN(d.getTime())) return isoOrDateStr
    const day = String(d.getDate()).padStart(2, "0")
    const month = String(d.getMonth() + 1).padStart(2, "0")
    const year = d.getFullYear()
    const hours = String(d.getHours()).padStart(2, "0")
    const minutes = String(d.getMinutes()).padStart(2, "0")
    return `${day}/${month}/${year} u ${hours}:${minutes}`
  } catch {
    return isoOrDateStr
  }
}

interface InvitationPreviewDialogProps {
  member: Member | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (info: { sentAt: string; email: string; tempPassword: string }) => void
}

export function InvitationPreviewDialog({
  member,
  open,
  onOpenChange,
  onSuccess,
}: InvitationPreviewDialogProps) {
  const { updateMember } = useMembers()
  const { settings } = useSettings()
  const { user } = useAuth()

  const [tempPassword, setTempPassword] = React.useState("")
  const [subject, setSubject] = React.useState("Pozivnica za pristup sustavu HRD")
  const [customNote, setCustomNote] = React.useState("")
  const [viewMode, setViewMode] = React.useState<"preview" | "edit">("preview")
  const [testEmailAddress, setTestEmailAddress] = React.useState("")

  const [isSending, setIsSending] = React.useState(false)
  const [isSendingTest, setIsSendingTest] = React.useState(false)
  const [sendResult, setSendResult] = React.useState<{
    status: "idle" | "success" | "error"
    message: string
    sentAt?: string
  }>({ status: "idle", message: "" })

  // Generiranje nove privremene lozinke
  const generateNewPassword = React.useCallback(() => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    let pwd = ""
    for (let i = 0; i < 8; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setTempPassword(pwd)
  }, [])

  // Reset stanja kad se dijalog otvori za člana
  React.useEffect(() => {
    if (open && member) {
      generateNewPassword()
      setSubject("Pozivnica za pristup sustavu HRD")
      setCustomNote("")
      setViewMode("preview")
      setTestEmailAddress(user?.email || settings?.smtpFrom || "")
      setSendResult({ status: "idle", message: "" })
    }
  }, [open, member, generateNewPassword, user?.email, settings?.smtpFrom])

  if (!member) return null

  const originUrl = typeof window !== "undefined" ? window.location.origin : "https://rodoslovlje.hr"
  const previewInviteUrl = `${originUrl}/pozivnica/aktivacijski-link`

  const buildInvitationText = (note: string) =>
    note.trim()
      ? `Pozivamo Vas da aktivirate svoj pristup u službeni informacijski sustav Hrvatskog rodoslovnog društva „Pavao Ritter Vitezović” (Rodoslovac).\n\nDodatna napomena:\n${note.trim()}\n\nKlikom na poveznicu ispod automatski ćete biti prijavljeni u sustav, gdje ćete odmah postaviti svoju novu osobnu lozinku (bez potrebe za unosom stare lozinke). Nakon postavljanja lozinke, ubuduće se prijavljujete svojim korisničkim imenom i novom lozinkom.`
      : `Pozivamo Vas da aktivirate svoj pristup u službeni informacijski sustav Hrvatskog rodoslovnog društva „Pavao Ritter Vitezović” (Rodoslovac).\n\nKlikom na poveznicu ispod automatski ćete biti prijavljeni u sustav, gdje ćete odmah postaviti svoju novu osobnu lozinku (bez potrebe za unosom stare lozinke). Nakon postavljanja lozinke, ubuduće se prijavljujete svojim korisničkim imenom i novom lozinkom.`

  const previewBuilt = buildHrdMasterEmail({
    templateType: "informacije_clanstvo",
    title: subject || "Pozivnica za pristup sustavu HRD",
    greeting: `Poštovani/a ${member.name},`,
    bodyTextOrHtml: buildInvitationText(customNote),
    infoBoxTitle: "Vaši pristupni podaci za sustav Rodoslovac",
    infoBoxHtml: `
      <div style="margin-bottom: 8px;"><strong>Korisničko ime (Username / E-pošta):</strong><br/><code style="background: #FFFFFF; padding: 3px 8px; border: 1px solid #E2E8F0; color: #1E3A5F; font-weight: bold; display: inline-block; margin-top: 2px;">${escapeHtml(member.email || "—")}</code></div>
      <div style="margin-bottom: 8px;"><strong>Izravna poveznica za aktivaciju i postavljanje lozinke:</strong><br/><a href="${escapeHtml(previewInviteUrl)}" style="color: #1F77C5; font-weight: bold; word-break: break-all;">${escapeHtml(previewInviteUrl)}</a></div>
      <div style="font-size: 12px; color: #475569; margin-top: 6px;">Nakon postavljanja lozinke, za svaku buduću prijavu koristite adresu <a href="${escapeHtml(originUrl)}/" style="color: #1F77C5;">${escapeHtml(originUrl)}/</a> te gore navedeno korisničko ime i svoju novu lozinku.</div>
    `,
    ctaText: "Aktiviraj pristup i postavi lozinku",
    ctaUrl: previewInviteUrl,
    closingText: "Dobro došli u sustav Hrvatskog rodoslovnog društva „Pavao Ritter Vitezović”!",
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
      const response = await fetch("/api/send-invitation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: member.id,
          email: member.email || "test@rodoslovlje.hr",
          name: member.name,
          tempPassword,
          subject,
          customBody: customNote.trim() ? buildInvitationText(customNote) : undefined,
          testOnly: true,
          testEmail: testEmailAddress.trim() || user?.email || settings?.smtpFrom,
          sender: user
            ? {
                userId: user.id.toString(),
                userName: user.name,
                userRole: user.role,
              }
            : undefined,
        }),
      })
      const data = await response.json()
      if (response.ok && data.success) {
        setSendResult({ status: "success", message: data.message })
      } else {
        setSendResult({ status: "error", message: data.error || "Slanje testnog maila nije uspjelo." })
      }
    } catch (err: any) {
      setSendResult({ status: "error", message: err.message || "Greška pri slanju testnog maila." })
    } finally {
      setIsSendingTest(false)
    }
  }

  const handleSend = async () => {
    if (member.doNotContact) {
      setSendResult({
        status: "error",
        message: "Na izričitu napomenu član je zatražio da ga se ne kontaktira. Slanje nije dopušteno.",
      })
      return
    }
    if (!member.email) {
      setSendResult({
        status: "error",
        message: "Član nema unesenu email adresu. Molimo prvo unesite email adresu.",
      })
      return
    }

    setIsSending(true)
    setSendResult({ status: "idle", message: "" })

    try {
      const response = await fetch("/api/send-invitation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: member.id,
          email: member.email,
          name: member.name,
          tempPassword,
          subject,
          customBody: customNote.trim() ? buildInvitationText(customNote) : undefined,
          sender: user
            ? {
                userId: user.id.toString(),
                userName: user.name,
                userRole: user.role,
              }
            : undefined,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        const sentAt = data.sentAt || new Date().toISOString()

        // Ažuriraj stanje člana u contextu
        updateMember(member.id, {
          invitationSent: true,
          invitationSentAt: sentAt,
          password: tempPassword,
          isTempPassword: true,
        })

        setSendResult({
          status: "success",
          message: `Pozivnica je uspješno poslana na ${member.email}!`,
          sentAt,
        })

        if (onSuccess) {
          onSuccess({ sentAt, email: member.email, tempPassword })
        }
      } else {
        const errMsg = data.error || data.details || "Neuspjelo slanje pozivnice."
        setSendResult({
          status: "error",
          message: errMsg,
        })
      }
    } catch (err: any) {
      console.error("Greška pri slanju pozivnice:", err)
      setSendResult({
        status: "error",
        message: err.message || "Došlo je do mrežne greške pri kontaktiranju poslužitelja.",
      })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[94vw] sm:max-w-4xl max-h-[92vh] overflow-y-auto p-0 rounded-2xl border border-border shadow-2xl">
        {/* Zaglavlje modala */}
        <div className="bg-[#1E3A5F] border-b-2 border-[#D97706] text-white p-6 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center shrink-0 border border-[#D97706]/40">
              <Mail className="h-5 w-5 text-[#FEFCE8]" />
            </div>
            <div>
              <DialogTitle className="font-serif text-lg font-bold text-white tracking-tight">
                Provjera i slanje pozivnice
              </DialogTitle>
              <DialogDescription className="text-xs text-[#F8FAFC]">
                Standardizirani HRD predložak (#1E3A5F / #7C2D12 / #D97706) sa službenim potpisom u podnožju
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Status alert ako je slanje uspjelo ili neuspjelo */}
          {sendResult.status === "success" && (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-900 shadow-sm animate-in fade-in duration-200">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-6 w-6 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-emerald-900">Email je uspješno poslan!</h4>
                  <p className="text-xs text-emerald-800">{sendResult.message}</p>
                  {sendResult.sentAt && (
                    <p className="text-xs font-semibold text-emerald-950 flex items-center gap-1.5 pt-1">
                      <Clock className="h-3.5 w-3.5" /> Evidentirano vrijeme slanja: {formatInvitationDateTime(sendResult.sentAt)}
                    </p>
                  )}
                  <p className="text-[11px] text-emerald-700 pt-0.5">
                    Podaci su automatski spremljeni u profil člana i evidentirani za evidenciju.
                  </p>
                </div>
              </div>
            </div>
          )}

          {sendResult.status === "error" && (
            <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-900 shadow-sm animate-in fade-in duration-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-6 w-6 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-red-900">Greška: Mail NIJE poslan!</h4>
                  <p className="text-xs text-red-800">{sendResult.message}</p>
                  <p className="text-[11px] text-red-700 pt-1">
                    Provjerite SMTP postavke poslužitelja u Postavkama sustava ili ispravnost email adrese.
                  </p>
                </div>
              </div>
            </div>
          )}

          {member.doNotContact && (
            <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4 text-red-950 shadow-sm flex items-start gap-3">
              <Ban className="h-5 w-5 text-red-700 shrink-0 mt-0.5" />
              <div className="space-y-1 text-sm">
                <h4 className="font-bold text-red-900">
                  Zabrana kontakta — Na izričitu napomenu član je zatražio da ga se ne kontaktira.
                </h4>
                <p className="text-xs text-red-800">
                  Slanje pozivnica niti bilo kakvih drugih poruka ovom članu nije dopušteno.
                </p>
              </div>
            </div>
          )}

          {/* Ranija evidencija pozivnice */}
          {member.invitationSent && sendResult.status !== "success" && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
              <Clock className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Prethodno poslana pozivnica: </span>
                Ovom članu je pozivnica već bila poslana{" "}
                <span className="font-bold">
                  {member.invitationSentAt ? formatInvitationDateTime(member.invitationSentAt) : "ranije"}
                </span>
                . Ako potvrdite novo slanje, generira se nova privremena lozinka i evidentira novi datum.
              </div>
            </div>
          )}

          {/* Tablica / Sažetak primatelja za administratora */}
          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Provjera podataka primatelja</span>
              <Badge variant="outline" className="text-[10px] font-mono bg-background">
                ID #{member.id}
              </Badge>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 text-xs">
              <div className="space-y-1">
                <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                  <User className="h-3.5 w-3.5 text-primary" /> Kome se šalje:
                </span>
                <p className="font-semibold text-sm text-foreground">{member.name}</p>
              </div>

              <div className="space-y-1">
                <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                  <Mail className="h-3.5 w-3.5 text-primary" /> Email adresa primatelja:
                </span>
                {member.email ? (
                  <p className="font-mono text-xs font-semibold text-foreground bg-background px-2 py-1 rounded border border-border inline-block">
                    {member.email}
                  </p>
                ) : (
                  <p className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded border border-red-200 inline-block">
                    ⚠ Nema unesenu email adresu!
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Korisničko ime (Username):
                </span>
                <p className="font-mono text-xs text-foreground bg-background px-2 py-1 rounded border border-border inline-block">
                  {member.email || "—"}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                  <Key className="h-3.5 w-3.5 text-primary" /> Način aktivacije i lozinka:
                </span>
                <div className="rounded-lg border border-[#CEA369]/60 bg-[#FEFCE8] px-2.5 py-1.5 text-[11px] text-[#1E3A5F] leading-snug">
                  <strong>Izravna poveznica:</strong> član se klikom automatski prijavljuje i sam postavlja novu lozinku (bez upisivanja stare).
                </div>
              </div>
            </div>

            <Separator className="my-2" />

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Predmet e-pošte (Subject):</Label>
              <Input
                className="h-8 text-xs bg-background"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={sendResult.status === "success" || isSending}
              />
            </div>
          </div>

          {/* Izbor prikaza: Vizualni preview ili Dodatna napomena */}
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
                  <Edit3 className="h-3.5 w-3.5" /> Dodatna napomena / tekst
                </Button>
              </div>
              <span className="text-[11px] text-muted-foreground">
                Prikaz točnog sadržaja poruke
              </span>
            </div>

            {viewMode === "preview" ? (
              /* Kartica simulacije Email klijenta */
              <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden text-xs">
                {/* Email headers */}
                <div className="bg-muted/40 border-b border-border p-3 space-y-1.5 font-mono text-[11px]">
                  <div className="flex">
                    <span className="w-16 text-muted-foreground shrink-0">Od:</span>
                    <span className="text-foreground font-medium">
                      Hrvatsko rodoslovno društvo &lt;rodoslovlje@rodoslovlje.hr&gt;
                    </span>
                  </div>
                  <div className="flex">
                    <span className="w-16 text-muted-foreground shrink-0">Za:</span>
                    <span className="text-foreground font-medium">
                      {member.name} &lt;{member.email || "nema-emaila"}&gt;
                    </span>
                  </div>
                  <div className="flex">
                    <span className="w-16 text-muted-foreground shrink-0">Predmet:</span>
                    <span className="text-foreground font-bold">{subject}</span>
                  </div>
                </div>

                {/* Email body preview */}
                <div className="p-2 bg-[#F8FAFC] overflow-x-auto">
                  <div dangerouslySetInnerHTML={{ __html: previewBuilt.html }} />
                </div>
              </div>
            ) : (
              /* Polje za dodatnu napomenu / prilagodbu teksta */
              <div className="space-y-3 rounded-xl border border-border bg-card p-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Dodatna prilagođena poruka ili napomena članu (opcionalno):
                  </Label>
                  <Textarea
                    placeholder="Upišite ovdje bilo kakvu dodatnu poruku koja će biti uključena u email pozivnice..."
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                    rows={4}
                    className="text-xs resize-none"
                    disabled={sendResult.status === "success" || isSending}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Ovaj tekst bit će istaknut unutar tijela pozivnice zajedno s podacima za prijavu.
                  </p>
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
                disabled={isSending || !member.email || Boolean(member.doNotContact)}
              >
                <RefreshCw className="h-3.5 w-3.5" /> Pokušaj ponovno
              </Button>
            )}

            {sendResult.status !== "success" ? (
              <Button
                type="button"
                className="rounded-full h-10 px-6 gap-2 bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 border border-[#D97706] text-white font-bold shadow-md"
                onClick={handleSend}
                disabled={isSending || isSendingTest || !member.email || Boolean(member.doNotContact)}
              >
                {isSending ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Slanje pozivnice...
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5 text-[#D97706]" />
                    Odobri i pošalji pozivnicu
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
