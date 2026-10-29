"use client"

import * as React from "react"
import { Member, useMembers } from "@/contexts/members-context"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
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
  Edit3
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
    return `${day}.${month}.${year}. u ${hours}:${minutes}`
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

  const [tempPassword, setTempPassword] = React.useState("")
  const [subject, setSubject] = React.useState("Pozivnica za pristup sustavu HRD")
  const [customNote, setCustomNote] = React.useState("")
  const [viewMode, setViewMode] = React.useState<"preview" | "edit">("preview")

  const [isSending, setIsSending] = React.useState(false)
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
      setSendResult({ status: "idle", message: "" })
    }
  }, [open, member, generateNewPassword])

  if (!member) return null

  const originUrl = typeof window !== "undefined" ? window.location.origin : "https://rodoslovlje.hr"

  const defaultTextBody = `Poštovani/a ${member.name},

Hrvatsko rodoslovno društvo "Pavao Ritter Vitezović" Vas poziva da se prijavite u naš novi sustav za evidenciju članstva.

Vaši podaci za prijavu:
Korisničko ime (Username): ${member.email}
Privremena lozinka: ${tempPassword}

Link za prijavu: ${originUrl}/
${customNote ? `\nDodatna napomena:\n${customNote}\n` : ""}
Sigurnosna napomena:
Ovo je privremena lozinka. Molimo Vas da je promijenite odmah nakon prve prijave klikom na "Postavke" u gornjem desnom kutu vašeg profila.

Srdačan pozdrav,
Hrvatsko rodoslovno društvo "Pavao Ritter Vitezović"`

  const handleSend = async () => {
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
          customBody: customNote ? defaultTextBody : undefined,
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
        <div className="bg-[#1B2B36] border-b-2 border-[#CEA369] text-white p-6 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center shrink-0 border border-[#CEA369]/40">
              <Mail className="h-5 w-5 text-[#CEA369]" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-white tracking-tight">
                Provjera i slanje pozivnice
              </DialogTitle>
              <DialogDescription className="text-xs text-[#CEA369]">
                Pregledajte podatke i izgled e-pošte prije slanja članu
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
                  <Key className="h-3.5 w-3.5 text-primary" /> Privremena lozinka:
                </span>
                <div className="flex items-center gap-2">
                  <Input
                    className="h-8 font-mono font-bold text-xs max-w-[140px] tracking-wider text-blue-700 bg-background"
                    value={tempPassword}
                    onChange={(e) => setTempPassword(e.target.value.toUpperCase())}
                    disabled={sendResult.status === "success" || isSending}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                    title="Generiraj drugu lozinku"
                    onClick={generateNewPassword}
                    disabled={sendResult.status === "success" || isSending}
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-1" /> Nova
                  </Button>
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
                <div className="p-4 bg-[#F2EFE9]">
                  <div className="rounded-xl border border-[#E8E4DE] bg-white overflow-hidden shadow-xs">
                    <div className="bg-[#1B2B36] border-b-2 border-[#CEA369] px-5 py-4 text-white">
                      <h3 className="font-bold text-sm text-white">
                        Hrvatsko rodoslovno društvo
                      </h3>
                      <p className="text-[11px] text-[#CEA369]">&ldquo;Pavao Ritter Vitezović&rdquo; — Sustav za evidenciju članstva</p>
                    </div>

                    <div className="p-5 space-y-4 font-sans text-[#1B2B36]">
                      <p className="text-sm">
                        Poštovani/a <strong>{member.name}</strong>,
                      </p>

                      <p className="text-xs leading-relaxed text-slate-700">
                        Pozivamo Vas da se prijavite u naš novi sustav za evidenciju članstva. Sustav Vam omogućuje uvid u
                        status Vašeg članstva, knjižnicu, predavanja, sastanke i ostale materijale društva.
                      </p>

                      {customNote && (
                        <div className="p-3 bg-[#FBF9F6] border-l-4 border-[#CEA369] rounded text-xs text-[#1B2B36] whitespace-pre-wrap">
                          <strong>Napomena administratora:</strong>
                          <p className="mt-1">{customNote}</p>
                        </div>
                      )}

                      {/* Credentials card */}
                      <div className="rounded-xl border border-[#E8E4DE] bg-[#FBF9F6] p-4 space-y-2 border-l-4 border-l-[#CEA369]">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-[#CEA369]">
                          Vaši pristupni podaci
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-[#E8E4DE]">
                          <span className="text-slate-600">Korisničko ime (Email):</span>
                          <code className="bg-slate-200 px-2 py-0.5 rounded font-bold text-[#1B2B36]">
                            {member.email || "—"}
                          </code>
                        </div>
                        <div className="flex justify-between items-center py-1">
                          <span className="text-slate-600">Privremena lozinka:</span>
                          <code className="bg-[#1B2B36] text-[#CEA369] px-2.5 py-0.5 rounded font-bold text-sm tracking-wider">
                            {tempPassword}
                          </code>
                        </div>
                      </div>

                      {/* Action button preview */}
                      <div className="text-center py-2">
                        <span className="inline-flex items-center gap-2 bg-[#1B2B36] text-white border-2 border-[#CEA369] font-bold px-6 py-2.5 rounded-full shadow-xs text-xs">
                          Prijavite se u sustav <ExternalLink className="h-3.5 w-3.5 text-[#CEA369]" />
                        </span>
                        <p className="text-[10px] text-slate-400 mt-1.5 font-mono">
                          Poveznica: {originUrl}/
                        </p>
                      </div>

                      {/* Security notice */}
                      <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-[11px] text-amber-900">
                        <strong>Sigurnosna napomena:</strong> Ovo je privremena lozinka. Molimo Vas da je promijenite
                        odmah nakon prve prijave u postavkama profila.
                      </div>

                      {/* Signoff */}
                      <div className="pt-2 text-[11px] text-slate-600 border-t border-[#E8E4DE] space-y-0.5">
                        <p>Srdačan pozdrav,</p>
                        <p className="font-semibold text-[#1B2B36]">Tajništvo Društva</p>
                        <p className="text-[10px] text-slate-400">
                          Hrvatsko rodoslovno društvo &ldquo;Pavao Ritter Vitezović&rdquo;
                        </p>
                      </div>
                    </div>
                  </div>
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
                disabled={isSending || !member.email}
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
                disabled={isSending || !member.email}
              >
                {isSending ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Slanje pozivnice...
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5 text-[#CEA369]" />
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
