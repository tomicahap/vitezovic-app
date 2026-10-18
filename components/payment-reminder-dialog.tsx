"use client"

import * as React from "react"
import { Member, useMembers } from "@/contexts/members-context"
import { useSettings } from "@/contexts/settings-context"
import { useAuth } from "@/contexts/auth-context"
import { useActivityLog } from "@/contexts/activity-log-context"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import { 
  DollarSign, 
  Mail, 
  CheckCircle, 
  AlertCircle, 
  Send, 
  Clock, 
  Users, 
  FileText, 
  Eye, 
  Edit3, 
  QrCode, 
  RefreshCw,
  AlertTriangle
} from "lucide-react"
import { formatInvitationDateTime } from "./invitation-preview-dialog"

interface PaymentReminderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "single" | "bulk"
  member?: Member | null
  debtorsList?: Member[]
  onSuccess?: () => void
}

export function PaymentReminderDialog({
  open,
  onOpenChange,
  mode,
  member,
  debtorsList,
  onSuccess,
}: PaymentReminderDialogProps) {
  const { members, updateMember } = useMembers()
  const { settings } = useSettings()
  const { user } = useAuth()
  const { addLog } = useActivityLog()

  const [subject, setSubject] = React.useState("")
  const [customBody, setCustomBody] = React.useState("")
  const [viewMode, setViewMode] = React.useState<"preview" | "edit">("preview")
  const [includeSlip, setIncludeSlip] = React.useState(true)
  const [includeQr, setIncludeQr] = React.useState(true)

  // Za bulk mod: označeni ID-jevi članova
  const [selectedBulkIds, setSelectedBulkIds] = React.useState<number[]>([])

  const [isSending, setIsSending] = React.useState(false)
  const [sendResult, setSendResult] = React.useState<{
    status: "idle" | "success" | "error"
    message: string
    count?: number
    errors?: number
    sentAt?: string
    details?: string[]
  }>({ status: "idle", message: "" })

  // Izračunaj listu dužnika ako je bulk
  const allDebtors = React.useMemo(() => {
    if (mode === "single") return []
    if (debtorsList && debtorsList.length > 0) return debtorsList
    return members.filter((m) => m.status_clana === "DUG" || m.paymentStatus === "overdue")
  }, [mode, debtorsList, members])

  const prevOpenRef = React.useRef(false)

  // Inicijalizacija pri otvaranju
  React.useEffect(() => {
    if (open && !prevOpenRef.current) {
      prevOpenRef.current = true
      const defaultSubj = settings?.paymentEmailSubject || "Obavijest o nepodmirenoj članarini - HRD"
      const defaultText =
        settings?.paymentEmailBody ||
        'Poštovani/a {{name}},\n\nPrema evidenciji Hrvatskog rodoslovnog društva "Pavao Ritter Vitezović", molimo Vas za podmirenje godišnje članarine za tekuće razdoblje.\n\nUkoliko ste već izvršili uplatu u zadnjih nekoliko dana, molimo Vas da zanemarite ovu obavijest.'
      const signature = settings?.paymentEmailSignature || 'Srdačan pozdrav,\nBlagajništvo Društva\nHRD "Pavao Ritter Vitezović"'

      setSubject(defaultSubj)
      setCustomBody(`${defaultText}\n\n${signature}`)
      setViewMode("preview")
      setSendResult({ status: "idle", message: "" })
      setIncludeSlip(Boolean(settings?.paymentSlipUrl))
      setIncludeQr(Boolean(settings?.paymentQrUrl))

      if (mode === "bulk") {
        // Označi sve dužnike koji imaju email
        const withEmail = (allDebtors || []).filter((d) => Boolean(d && d.email && d.email.includes("@"))).map((d) => d.id)
        setSelectedBulkIds(withEmail)
      }
    } else if (!open) {
      prevOpenRef.current = false
    }
  }, [open, mode, member, allDebtors, settings])

  const targetMemberName = member?.name || "Ivan Horvat"
  const targetMemberEmail = member?.email || "clan@email.hr"

  const previewBody = customBody
    .replace(/{{name}}/gi, targetMemberName)
    .replace(/{{ime}}/gi, targetMemberName)
    .replace(/{{email}}/gi, targetMemberEmail)
    .replace(/{{registryNumber}}/gi, member?.registryNumber || "—")
    .replace(/{{membershipNumber}}/gi, member?.membershipNumber || "—")

  const handleToggleSelectAll = (checked: boolean) => {
    if (checked) {
      const valid = allDebtors.filter((d) => d.email && d.email.includes("@")).map((d) => d.id)
      setSelectedBulkIds(valid)
    } else {
      setSelectedBulkIds([])
    }
  }

  const handleToggleMember = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedBulkIds((prev) => [...prev, id])
    } else {
      setSelectedBulkIds((prev) => prev.filter((item) => item !== id))
    }
  }

  const handleSend = async () => {
    if (mode === "single") {
      if (!member?.email) {
        setSendResult({
          status: "error",
          message: "Član nema unesenu email adresu. Slanje nije moguće.",
        })
        return
      }
    } else {
      if (selectedBulkIds.length === 0) {
        setSendResult({
          status: "error",
          message: "Niti jedan primatelj nije odabran.",
        })
        return
      }
    }

    setIsSending(true)
    setSendResult({ status: "idle", message: "" })

    try {
      const payload: any = {
        customSubject: subject,
        customBody,
        includeSlip,
        includeQr,
      }

      if (mode === "single" && member) {
        payload.memberId = member.id
      } else {
        payload.memberIds = selectedBulkIds
      }

      if (user) {
        payload.sender = {
          userId: user.id.toString(),
          userName: user.name,
          userRole: user.role
        }
      }

      const response = await fetch("/api/admin/notifications/payment-reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        const sentAt = data.sentAt || new Date().toISOString()

        // Ažuriraj stanje članova u contextu
        if (mode === "single" && member) {
          updateMember(member.id, { lastPaymentReminderAt: sentAt })
          if (user) {
            addLog({
              userId: user.id.toString(),
              userName: user.name,
              userRole: user.role,
              action: "Slanje podsjetnika za članarinu",
              details: `Poslan podsjetnik članu: ${member.name} (${member.email})`,
            })
          }
        } else if (mode === "bulk") {
          selectedBulkIds.forEach((id) => {
            updateMember(id, { lastPaymentReminderAt: sentAt })
          })
          if (user) {
            addLog({
              userId: user.id.toString(),
              userName: user.name,
              userRole: user.role,
              action: "Skupno slanje podsjetnika za članarinu",
              details: `Poslan skupni podsjetnik za ${data.count || selectedBulkIds.length} članova sa statusom DUG.`,
            })
          }
        }

        setSendResult({
          status: "success",
          message: data.message || `Obavijest je uspješno poslana!`,
          count: data.count,
          errors: data.errors,
          sentAt,
          details: data.details,
        })

        if (onSuccess) {
          onSuccess()
        }
      } else {
        const errorMsg = data.error || data.message || "Neuspjelo slanje obavijesti."
        setSendResult({
          status: "error",
          message: errorMsg,
          details: data.details,
        })
      }
    } catch (err: any) {
      console.error("Greška pri slanju obavijesti o plaćanju:", err)
      setSendResult({
        status: "error",
        message: err.message || "Došlo je do mrežne greške pri kontaktiranju servera.",
      })
    } finally {
      setIsSending(false)
    }
  }

  const debtorsWithoutEmail = allDebtors.filter((d) => !d.email || !d.email.includes("@"))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 rounded-2xl border border-border shadow-2xl">
        {/* Zaglavlje modala */}
        <div className="bg-gradient-to-r from-red-700 via-rose-800 to-amber-900 text-white p-6 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center shrink-0 border border-white/20">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-white tracking-tight">
                {mode === "single"
                  ? "Provjera i slanje obavijesti o plaćanju"
                  : "Skupno slanje obavijesti o dugovanjima"}
              </DialogTitle>
              <DialogDescription className="text-xs text-rose-100">
                {mode === "single"
                  ? `Pregledajte podatke za uplatu i sadržaj emaila prije slanja članu`
                  : `Provjera primatelja, predloška i privitaka prije masovnog slanja svim dužnicima`}
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Status Alert - Uspjeh */}
          {sendResult.status === "success" && (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-900 shadow-sm animate-in fade-in duration-200">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-6 w-6 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-emerald-900">Obavijest je uspješno poslana!</h4>
                  <p className="text-xs text-emerald-800">{sendResult.message}</p>
                  {sendResult.sentAt && (
                    <p className="text-xs font-semibold text-emerald-950 flex items-center gap-1.5 pt-1">
                      <Clock className="h-3.5 w-3.5" /> Evidentirano vrijeme slanja: {formatInvitationDateTime(sendResult.sentAt)}
                    </p>
                  )}
                  <p className="text-[11px] text-emerald-700 pt-0.5">
                    Evidencija slanja je automatski zabilježena kod člana u sustavu.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Status Alert - Greška */}
          {sendResult.status === "error" && (
            <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-900 shadow-sm animate-in fade-in duration-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-6 w-6 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-red-900">Greška: Mail NIJE poslan!</h4>
                  <p className="text-xs text-red-800">{sendResult.message}</p>
                  {sendResult.details && sendResult.details.length > 0 && (
                    <div className="text-[11px] text-red-700 mt-1 max-h-24 overflow-y-auto space-y-0.5 bg-red-100/50 p-2 rounded">
                      {sendResult.details.map((d, i) => (
                        <div key={i}>{d}</div>
                      ))}
                    </div>
                  )}
                  <p className="text-[11px] text-red-700 pt-1">
                    Provjerite SMTP postavke poslužitelja u Postavkama ili valjanost email adresa.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* POJEDINAČNI MOD: Provjera primatelja */}
          {mode === "single" && member && (
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span>Provjera podataka primatelja</span>
                <Badge
                  className={`text-[10px] font-bold ${
                    member.status_clana === "DUG"
                      ? "bg-red-100 text-red-800 border-red-200"
                      : "bg-emerald-100 text-emerald-800 border-emerald-200"
                  }`}
                >
                  Status: {member.status_clana || "DUG"}
                </Badge>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 text-xs">
                <div className="space-y-1">
                  <span className="text-muted-foreground block font-medium">Primatelj (Član):</span>
                  <p className="font-semibold text-sm text-foreground">{member.name}</p>
                </div>

                <div className="space-y-1">
                  <span className="text-muted-foreground block font-medium">Email adresa:</span>
                  {member.email ? (
                    <p className="font-mono text-xs font-semibold text-foreground bg-background px-2 py-1 rounded border border-border inline-block">
                      {member.email}
                    </p>
                  ) : (
                    <p className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded border border-red-200 inline-block">
                      ⚠ Nema email adresu!
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <span className="text-muted-foreground block font-medium">Zadnja evidentirana uplata:</span>
                  <p className="font-medium text-foreground">
                    {member.datum_zadnje_uplate
                      ? new Date(member.datum_zadnje_uplate).toLocaleDateString("hr-HR")
                      : "Nema evidentiranih uplata"}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-muted-foreground block font-medium">Evidencija prethodne opomene:</span>
                  <p className="font-medium text-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    {member.lastPaymentReminderAt
                      ? formatInvitationDateTime(member.lastPaymentReminderAt)
                      : "Nikada nije poslana"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* SKUPNI MOD: Popis dužnika za slanje */}
          {mode === "bulk" && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-red-600" />
                  <h4 className="font-bold text-xs uppercase tracking-wider">
                    Dužnici za slanje obavijesti ({selectedBulkIds.length}/{allDebtors.length})
                  </h4>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="selectAllDebtors"
                    checked={
                      selectedBulkIds.length > 0 &&
                      selectedBulkIds.length ===
                        allDebtors.filter((d) => d.email && d.email.includes("@")).length
                    }
                    onCheckedChange={(checked) => handleToggleSelectAll(Boolean(checked))}
                  />
                  <Label htmlFor="selectAllDebtors" className="text-xs cursor-pointer">
                    Označi sve s emailom
                  </Label>
                </div>
              </div>

              {debtorsWithoutEmail.length > 0 && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-900 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>{debtorsWithoutEmail.length} dužnik(a)</strong> nema unesenu email adresu i neće primiti
                    obavijest.
                  </span>
                </div>
              )}

              {/* Lista dužnika */}
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 text-xs">
                {allDebtors.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4 italic">
                    Trenutno nema članova sa statusom DUG.
                  </p>
                ) : (
                  allDebtors.map((debtor) => {
                    const hasEmail = Boolean(debtor.email && debtor.email.includes("@"))
                    const isSelected = selectedBulkIds.includes(debtor.id)

                    return (
                      <div
                        key={debtor.id}
                        className={`flex items-center justify-between p-2 rounded-lg border transition-colors ${
                          isSelected
                            ? "bg-red-50/60 border-red-200"
                            : hasEmail
                            ? "bg-muted/30 border-border hover:bg-muted/50"
                            : "bg-gray-50 border-gray-200 opacity-60"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Checkbox
                            id={`debtor-${debtor.id}`}
                            checked={isSelected}
                            disabled={!hasEmail || sendResult.status === "success" || isSending}
                            onCheckedChange={(checked) => handleToggleMember(debtor.id, Boolean(checked))}
                          />
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground truncate">{debtor.name}</p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {debtor.email || "Nema emaila"} · Matica: {debtor.registryNumber || "—"}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0 text-[11px]">
                          <span className="font-semibold text-red-700 block">Status: DUG</span>
                          {debtor.lastPaymentReminderAt && (
                            <span className="text-muted-foreground text-[10px] block" title={`Podsjetnik poslan: ${formatInvitationDateTime(debtor.lastPaymentReminderAt)}`}>
                              Opomena: {formatInvitationDateTime(debtor.lastPaymentReminderAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}

          {/* Predmet e-pošte */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Predmet e-pošte (Subject):</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="text-xs"
              disabled={sendResult.status === "success" || isSending}
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

              {/* Uključivanje uplatnice / QR koda */}
              <div className="flex items-center gap-3 text-xs">
                {settings?.paymentSlipUrl && (
                  <label className="flex items-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground">
                    <Checkbox
                      checked={includeSlip}
                      onCheckedChange={(c) => setIncludeSlip(Boolean(c))}
                      disabled={sendResult.status === "success" || isSending}
                    />
                    <FileText className="h-3 w-3 text-primary" /> Uplatnica
                  </label>
                )}
                {settings?.paymentQrUrl && (
                  <label className="flex items-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground">
                    <Checkbox
                      checked={includeQr}
                      onCheckedChange={(c) => setIncludeQr(Boolean(c))}
                      disabled={sendResult.status === "success" || isSending}
                    />
                    <QrCode className="h-3 w-3 text-primary" /> 2D/3D Barcode
                  </label>
                )}
              </div>
            </div>

            {viewMode === "preview" ? (
              /* Kartica simulacije Email klijenta */
              <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden text-xs">
                {/* Email headers */}
                <div className="bg-muted/40 border-b border-border p-3 space-y-1.5 font-mono text-[11px]">
                  <div className="flex">
                    <span className="w-16 text-muted-foreground shrink-0">Od:</span>
                    <span className="text-foreground font-medium">
                      Hrvatsko rodoslovno društvo &lt;{settings?.smtpFrom || "blagajna@rodoslovlje.hr"}&gt;
                    </span>
                  </div>
                  <div className="flex">
                    <span className="w-16 text-muted-foreground shrink-0">Za:</span>
                    <span className="text-foreground font-medium">
                      {mode === "single"
                        ? `${targetMemberName} <${targetMemberEmail}>`
                        : `Odabrani dužnici (${selectedBulkIds.length} primatelja)`}
                    </span>
                  </div>
                  <div className="flex">
                    <span className="w-16 text-muted-foreground shrink-0">Predmet:</span>
                    <span className="text-foreground font-bold">{subject}</span>
                  </div>
                </div>

                {/* Email body preview */}
                <div className="p-5 space-y-4 font-sans bg-white text-slate-800">
                  <div className="border-b border-rose-200 pb-3">
                    <h3 className="font-bold text-base text-rose-900">
                      Hrvatsko rodoslovno društvo &ldquo;Pavao Ritter Vitezović&rdquo;
                    </h3>
                    <p className="text-[11px] text-slate-500">Obavijest o nepodmirenoj članarini</p>
                  </div>

                  <p className="text-sm">
                    Poštovani/a <strong>{targetMemberName}</strong>,
                  </p>

                  <div className="text-xs leading-relaxed text-slate-700 whitespace-pre-wrap">
                    {previewBody}
                  </div>

                  {(includeSlip || includeQr) && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 space-y-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-rose-800">
                        Prilozi za jednostavno plaćanje
                      </div>
                      <div className="flex items-center gap-3 text-xs text-rose-900">
                        {includeSlip && (
                          <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-rose-200 shadow-xs">
                            <FileText className="h-4 w-4 text-rose-700" /> Uplatnica HUB3 (priložena)
                          </div>
                        )}
                        {includeQr && (
                          <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-rose-200 shadow-xs">
                            <QrCode className="h-4 w-4 text-rose-700" /> Barkod za m-banking (priložen)
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 text-[11px] text-slate-600 border-t border-slate-100">
                    Hrvatsko rodoslovno društvo &ldquo;Pavao Ritter Vitezović&rdquo;
                  </div>
                </div>
              </div>
            ) : (
              /* Uređivanje teksta i predloška */
              <div className="space-y-3 rounded-xl border border-border bg-card p-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Tekst poruke (s dinamičkim oznakama):</Label>
                  <Textarea
                    value={customBody}
                    onChange={(e) => setCustomBody(e.target.value)}
                    rows={8}
                    className="text-xs font-mono"
                    disabled={sendResult.status === "success" || isSending}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Dostupne oznake: <code className="bg-muted px-1 rounded">{"{{name}}"}</code> (ime i prezime),{" "}
                    <code className="bg-muted px-1 rounded">{"{{email}}"}</code>,{" "}
                    <code className="bg-muted px-1 rounded">{"{{registryNumber}}"}</code> (broj matice).
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
                disabled={isSending}
              >
                <RefreshCw className="h-3.5 w-3.5" /> Pokušaj ponovno
              </Button>
            )}

            {sendResult.status !== "success" ? (
              <Button
                type="button"
                size="sm"
                className="gap-1.5 bg-red-600 hover:bg-red-700 text-white font-medium"
                onClick={handleSend}
                disabled={
                  isSending ||
                  (mode === "single" && !member?.email) ||
                  (mode === "bulk" && selectedBulkIds.length === 0)
                }
              >
                {isSending ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Slanje obavijesti...
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    {mode === "single"
                      ? "Odobri i pošalji obavijest"
                      : `Odobri i pošalji svima (${selectedBulkIds.length})`}
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
