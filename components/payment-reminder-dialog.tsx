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
  AlertTriangle,
  Search
} from "lucide-react"
import { formatInvitationDateTime } from "./invitation-preview-dialog"
import { buildHrdMasterEmail, escapeHtml } from "@/lib/hrd-email-system"
import { formatDateDMY } from "@/lib/utils"
import { EmailSendProgressBanner } from "@/components/email-send-progress-banner"
import {
  consumeEmailSendStream,
  INITIAL_BULK_EMAIL_PROGRESS,
  type BulkEmailProgressState,
} from "@/lib/bulk-email-stream"

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
  const [debtorSearch, setDebtorSearch] = React.useState("")
  const [testEmailAddress, setTestEmailAddress] = React.useState("")

  // Za bulk mod: označeni ID-jevi članova
  const [selectedBulkIds, setSelectedBulkIds] = React.useState<number[]>([])

  const [isSending, setIsSending] = React.useState(false)
  const [isSendingTest, setIsSendingTest] = React.useState(false)
  const [sendProgress, setSendProgress] = React.useState<BulkEmailProgressState>(INITIAL_BULK_EMAIL_PROGRESS)
  const sendAbortRef = React.useRef<AbortController | null>(null)
  const [sendResult, setSendResult] = React.useState<{
    status: "idle" | "success" | "error"
    message: string
    count?: number
    errors?: number
    sentAt?: string
    details?: string[]
  }>({ status: "idle", message: "" })

  // Izračunaj listu dužnika ako je bulk (uvijek isključi Ne kontaktirati i preminule)
  const allDebtors = React.useMemo(() => {
    if (mode === "single") return []
    const base =
      debtorsList && debtorsList.length > 0
        ? debtorsList
        : members.filter((m) => m.status_clana === "DUG" || m.paymentStatus === "overdue")
    return base.filter((m) => !m.doNotContact && !m.deceased)
  }, [mode, debtorsList, members])

  const filteredDebtors = React.useMemo(() => {
    if (!debtorSearch.trim()) return allDebtors
    const q = debtorSearch.toLowerCase().trim()
    return allDebtors.filter(
      (d) =>
        d.name?.toLowerCase().includes(q) ||
        d.email?.toLowerCase().includes(q) ||
        d.registryNumber?.toLowerCase().includes(q)
    )
  }, [allDebtors, debtorSearch])

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
      setSendProgress(INITIAL_BULK_EMAIL_PROGRESS)
      setIncludeSlip(Boolean(settings?.paymentSlipUrl))
      setIncludeQr(Boolean(settings?.paymentQrUrl))
      setDebtorSearch("")
      setTestEmailAddress(user?.email || settings?.smtpFrom || "")

      if (mode === "bulk") {
        // Označi sve dužnike koji imaju email
        const withEmail = (allDebtors || []).filter((d) => Boolean(d && d.email && d.email.includes("@"))).map((d) => d.id)
        setSelectedBulkIds(withEmail)
      }
    } else if (!open) {
      prevOpenRef.current = false
    }
  }, [open, mode, member, allDebtors, settings])

  const firstSelectedDebtor = React.useMemo(() => {
    if (mode === "single") return member
    if (selectedBulkIds.length > 0) {
      return allDebtors.find((d) => d.id === selectedBulkIds[0]) || allDebtors[0]
    }
    return allDebtors[0] || null
  }, [mode, member, selectedBulkIds, allDebtors])

  const targetMemberName = firstSelectedDebtor?.name || member?.name || "Ivan Horvat"
  const targetMemberEmail = firstSelectedDebtor?.email || member?.email || "clan@email.hr"

  const previewBody = React.useMemo(() => {
    return customBody
      .replace(/{{name}}/gi, targetMemberName)
      .replace(/{{ime}}/gi, targetMemberName)
      .replace(/{{email}}/gi, targetMemberEmail)
      .replace(/{{registryNumber}}/gi, firstSelectedDebtor?.registryNumber || member?.registryNumber || "123/2024")
      .replace(/{{membershipNumber}}/gi, firstSelectedDebtor?.membershipNumber || member?.membershipNumber || "HRD-123")
  }, [customBody, targetMemberName, targetMemberEmail, firstSelectedDebtor, member])

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

  const previewHtmlResult = React.useMemo(() => {
    let extra = ""
    if (includeQr && settings?.paymentQrUrl) {
      extra += `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F8FAFC; border: 1px solid #E2E8F0; margin-bottom: 16px;">
        <tr>
          <td align="center" style="padding: 16px;">
            <div style="font-family: Georgia, 'Times New Roman', serif; font-size: 14px; font-weight: bold; color: #7C2D12; margin-bottom: 6px;">2D barkod za brzo plaćanje (m-banking)</div>
            <div style="font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #1F2937; margin-bottom: 12px;">Skenirajte ovaj barkod kamerom unutar aplikacije Vaše banke („Skeniraj i plati”) za trenutačno popunjavanje naloga.</div>
            <div style="display: inline-block; background-color: #FFFFFF; padding: 10px; border: 1px solid #E2E8F0;">
              <img src="${settings.paymentQrUrl}" alt="2D Barkod za uplatu" width="220" style="display: block; max-width: 220px; width: 100%; height: auto;" />
            </div>
          </td>
        </tr>
      </table>`
    }
    if (includeSlip && settings?.paymentSlipUrl) {
      extra += `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F8FAFC; border: 1px solid #E2E8F0;">
        <tr>
          <td align="center" style="padding: 16px;">
            <div style="font-family: Georgia, 'Times New Roman', serif; font-size: 14px; font-weight: bold; color: #7C2D12; margin-bottom: 6px;">Uplatnica HUB-3 za uplatu članarine</div>
            <div style="font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #1F2937; margin-bottom: 12px;">Uplatu možete izvršiti putem internetskog bankarstva ili prema prikazanoj uplatnici.</div>
            <div style="background-color: #FFFFFF; padding: 8px; border: 1px solid #E2E8F0;">
              <img src="${settings.paymentSlipUrl}" alt="Uplatnica HUB-3" width="500" style="display: block; max-width: 100%; width: 100%; height: auto;" />
            </div>
          </td>
        </tr>
      </table>`
    }

    const regNo = firstSelectedDebtor?.registryNumber || member?.registryNumber || ""
    return buildHrdMasterEmail({
      templateType: "obavijest_clanovima",
      title: subject || "Obavijest o članarini",
      bodyTextOrHtml: previewBody,
      infoBoxTitle: "Evidencija primatelja",
      infoBoxHtml: `<div>Član: <strong>${escapeHtml(targetMemberName)}</strong>${
        regNo ? ` • Broj matice: <strong>${escapeHtml(regNo)}</strong>` : ""
      }<br/>Status članarine: <strong style="color: #7C2D12;">Podmirenje članarine za tekuće razdoblje</strong></div>`,
      extraContentHtml: extra || undefined,
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
  }, [includeQr, includeSlip, settings, firstSelectedDebtor, member, subject, previewBody, targetMemberName, user])

  const handleSendTest = async () => {
    setIsSendingTest(true)
    setSendResult({ status: "idle", message: "" })
    try {
      const payload: any = {
        customSubject: subject,
        customBody,
        includeSlip,
        includeQr,
        testOnly: true,
        testEmail: testEmailAddress.trim() || user?.email || settings?.smtpFrom,
      }
      if (mode === "single" && member) payload.memberId = member.id
      else payload.memberIds = selectedBulkIds
      if (user) {
        payload.sender = {
          userId: user.id.toString(),
          userName: user.name,
          userRole: user.role,
        }
      }
      const response = await fetch("/api/admin/notifications/payment-reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
    const abortController = new AbortController()
    sendAbortRef.current = abortController
    const totalExpected = mode === "single" ? 1 : selectedBulkIds.length
    setSendProgress({
      ...INITIAL_BULK_EMAIL_PROGRESS,
      active: true,
      status: "running",
      total: totalExpected,
      label: "Slanje podsjetnika za članarinu",
    })

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

      const data = await consumeEmailSendStream(
        "/api/admin/notifications/payment-reminders",
        payload,
        (prog) => setSendProgress({ ...prog, label: "Slanje podsjetnika za članarinu" }),
        abortController.signal
      )

      if (data?.success) {
        const sentAt = data.sentAt || new Date().toISOString()
        const sentIds: number[] = Array.isArray(data.sentMemberIds) ? data.sentMemberIds : selectedBulkIds

        // Ažuriraj stanje članova u contextu
        if (mode === "single" && member) {
          if (sentIds.length === 0 || sentIds.includes(member.id)) {
            updateMember(member.id, { lastPaymentReminderAt: sentAt })
          }
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
          sentIds.forEach((id) => {
            updateMember(id, { lastPaymentReminderAt: sentAt })
          })
          if (user) {
            addLog({
              userId: user.id.toString(),
              userName: user.name,
              userRole: user.role,
              action: "Skupno slanje podsjetnika za članarinu",
              details: `Poslan skupni podsjetnik za ${data.count || sentIds.length} članova sa statusom DUG.`,
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
        const errorMsg = data?.error || data?.message || "Neuspjelo slanje obavijesti."
        setSendResult({
          status: "error",
          message: errorMsg,
          details: data?.details,
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
          message: "Slanje je zaustavljeno. Već poslane poruke ostaju evidentirane.",
        })
      } else {
        console.error("Greška pri slanju obavijesti o plaćanju:", err)
        setSendResult({
          status: "error",
          message: err.message || "Došlo je do mrežne greške pri kontaktiranju servera.",
        })
      }
    } finally {
      sendAbortRef.current = null
      setIsSending(false)
    }
  }

  const debtorsWithoutEmail = allDebtors.filter((d) => !d.email || !d.email.includes("@"))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[98vw] sm:max-w-[98vw] md:max-w-[98vw] lg:max-w-[98vw] xl:max-w-[1750px] h-[96vh] max-h-[96vh] flex flex-col p-0 rounded-2xl border border-border shadow-2xl overflow-hidden bg-background">
        {/* Zaglavlje modala */}
        <div className="bg-[#1E3A5F] border-b-2 border-[#D97706] text-white p-5 px-6 rounded-t-2xl shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center shrink-0 border border-[#D97706]/40">
                {mode === "single" ? (
                  <DollarSign className="h-5 w-5 text-[#FEFCE8]" />
                ) : (
                  <Users className="h-5 w-5 text-[#FEFCE8]" />
                )}
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-white tracking-tight">
                  {mode === "single"
                    ? "Provjera i slanje obavijesti o članarini"
                    : "Dužnici za slanje obavijesti o članarini"}
                </DialogTitle>
                <DialogDescription className="text-xs text-[#F8FAFC]">
                  Standardizirani HRD predložak (#1E3A5F / #7C2D12 / #D97706) s ugrađenim uplatnim podacima i službenim potpisom
                </DialogDescription>
              </div>
            </div>

            {mode === "bulk" && (
              <Badge className="bg-[#D97706]/25 text-[#FEFCE8] border border-[#D97706]/50 text-xs px-3 py-1 font-semibold">
                Odabrano: {selectedBulkIds.length} / {allDebtors.length} dužnika
              </Badge>
            )}
          </div>
        </div>

        {/* Glavni sadržaj u 2 stupca (lijevo dužnici/opcije, desno cijeli mail) */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {(sendProgress.active || sendProgress.status !== "idle") && (
            <EmailSendProgressBanner
              progress={sendProgress}
              onCancel={() => sendAbortRef.current?.abort()}
              title="Brojač slanja podsjetnika za članarinu"
            />
          )}

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
                    Evidencija slanja je automatski zabilježena kod članova u sustavu.
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

          {/* DVA STUPCA: 4 stupca kontrole / 8 stupaca široki prikaz maila */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LIJEVI STUPAC: Dužnici / Primatelj + Postavke */}
            <div className="lg:col-span-5 xl:col-span-4 2xl:col-span-3 space-y-4">
              {/* POJEDINAČNI MOD: Provjera primatelja */}
              {mode === "single" && member && member.doNotContact && (
                <div className="rounded-xl border-2 border-red-300 bg-red-50 p-3.5 text-xs text-red-950 space-y-1">
                  <p className="font-bold text-red-900">
                    Zabrana kontakta — Na izričitu napomenu član je zatražio da ga se ne kontaktira.
                  </p>
                  <p className="text-[11px] text-red-800">
                    Slanje podsjetnika za članarinu ili bilo kakvih obavijesti ovom članu je onemogućeno.
                  </p>
                </div>
              )}
              {mode === "single" && member && (() => {
                const isExpelledOrExpired = Boolean(
                  member.expelled || member.status === "expired" || member.status_clana === "ISPISAN"
                )
                const hasDebt = member.paymentStatus === "overdue" || member.status_clana === "DUG"
                const singleStatusLabel = isExpelledOrExpired
                  ? "ISPISAN"
                  : hasDebt
                  ? "DUG"
                  : member.status_clana || "AKTIVAN"

                return (
                <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-xs">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                    <span>Podaci o primatelju</span>
                    <Badge
                      className={`text-[10px] font-bold ${
                        isExpelledOrExpired
                          ? "bg-rose-100 text-rose-800 border-rose-200"
                          : hasDebt
                          ? "bg-red-100 text-red-800 border-red-200"
                          : "bg-emerald-100 text-emerald-800 border-emerald-200"
                      }`}
                    >
                      Status: {singleStatusLabel}
                    </Badge>
                  </div>

                  <div className="grid gap-2.5 text-xs">
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Primatelj (Član):</span>
                      <p className="font-semibold text-foreground text-sm">{member.name}</p>
                    </div>

                    <div>
                      <span className="text-muted-foreground block text-[11px]">Email adresa:</span>
                      {member.email ? (
                        <p className="font-mono text-xs font-semibold text-foreground bg-muted/50 px-2 py-1 rounded border border-border inline-block">
                          {member.email}
                        </p>
                      ) : (
                        <p className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded border border-red-200 inline-block">
                          ⚠ Nema email adresu!
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border">
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Zadnja uplata:</span>
                        <p className="font-medium text-foreground text-[11px]">
                          {formatDateDMY(member.datum_zadnje_uplate, "Nema uplata")}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Zadnja opomena:</span>
                        <p className="font-medium text-foreground text-[11px] flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="truncate">
                            {member.lastPaymentReminderAt
                              ? formatInvitationDateTime(member.lastPaymentReminderAt)
                              : "Nikada"}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                )
              })()}

              {/* SKUPNI MOD: Popis dužnika za slanje */}
              {mode === "bulk" && (
                <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-red-600" />
                      <h4 className="font-bold text-xs uppercase tracking-wider">
                        Dužnici za slanje ({selectedBulkIds.length}/{allDebtors.length})
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
                      <Label htmlFor="selectAllDebtors" className="text-xs cursor-pointer font-medium">
                        Označi sve
                      </Label>
                    </div>
                  </div>

                  {/* Pretraživanje dužnika */}
                  {allDebtors.length > 3 && (
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        value={debtorSearch}
                        onChange={(e) => setDebtorSearch(e.target.value)}
                        placeholder="Pretraži dužnike..."
                        className="pl-8 text-xs h-8"
                      />
                    </div>
                  )}

                  {debtorsWithoutEmail.length > 0 && (
                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-2 text-xs text-amber-900 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                      <span>
                        <strong>{debtorsWithoutEmail.length} dužnik(a)</strong> nema email.
                      </span>
                    </div>
                  )}

                  {/* Lista dužnika */}
                  <div className="max-h-64 sm:max-h-72 overflow-y-auto space-y-1.5 pr-1 text-xs">
                    {filteredDebtors.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4 italic">
                        {debtorSearch ? "Nema dužnika koji odgovaraju pretrazi." : "Trenutno nema članova sa statusom DUG."}
                      </p>
                    ) : (
                      filteredDebtors.map((debtor) => {
                        const hasEmail = Boolean(debtor.email && debtor.email.includes("@"))
                        const isSelected = selectedBulkIds.includes(debtor.id)

                        return (
                          <div
                            key={debtor.id}
                            className={`flex items-center justify-between p-2 rounded-lg border transition-colors ${
                              isSelected
                                ? "bg-red-50/70 border-red-200"
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
                              <span className="font-semibold text-red-700 block text-[10px]">DUG</span>
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
              <div className="space-y-1.5 bg-card p-4 rounded-xl border border-border shadow-xs">
                <Label className="text-xs font-semibold">Predmet e-pošte (Subject):</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="text-xs"
                  disabled={sendResult.status === "success" || isSending}
                />
              </div>

              {/* Uključivanje uplatnice / QR koda */}
              <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-xs">
                <Label className="text-xs font-semibold block text-foreground">
                  Ugrađivanje slika za plaćanje:
                </Label>
                <div className="space-y-2 text-xs">
                  <label className="flex items-center justify-between p-2 rounded-lg border border-border hover:bg-muted/30 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={includeQr}
                        onCheckedChange={(c) => setIncludeQr(Boolean(c))}
                        disabled={sendResult.status === "success" || isSending || !settings?.paymentQrUrl}
                      />
                      <QrCode className="h-4 w-4 text-[#CEA369]" />
                      <span className="font-medium">2D barkod za m-banking</span>
                    </div>
                    {settings?.paymentQrUrl ? (
                      <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                        Učitano
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                        Nije konfigurirano
                      </Badge>
                    )}
                  </label>

                  <label className="flex items-center justify-between p-2 rounded-lg border border-border hover:bg-muted/30 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={includeSlip}
                        onCheckedChange={(c) => setIncludeSlip(Boolean(c))}
                        disabled={sendResult.status === "success" || isSending || !settings?.paymentSlipUrl}
                      />
                      <FileText className="h-4 w-4 text-[#CEA369]" />
                      <span className="font-medium">Uplatnica HUB-3</span>
                    </div>
                    {settings?.paymentSlipUrl ? (
                      <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                        Učitano
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                        Nije konfigurirano
                      </Badge>
                    )}
                  </label>
                </div>
              </div>

              {/* Uređivanje teksta poruke */}
              <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Prilagodba teksta poruke:</Label>
                  <Button
                    type="button"
                    variant={viewMode === "edit" ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs gap-1 px-2.5"
                    onClick={() => setViewMode(viewMode === "edit" ? "preview" : "edit")}
                  >
                    <Edit3 className="h-3 w-3" />
                    {viewMode === "edit" ? "Završi uređivanje" : "Uredi predložak"}
                  </Button>
                </div>

                {viewMode === "edit" ? (
                  <div className="space-y-2">
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
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Tekst se automatski personalizira za svakog odabranog člana. Kliknite na &bdquo;Uredi predložak&rdquo; za izmjenu teksta.
                  </p>
                )}
              </div>
            </div>

            {/* DESNI STUPAC: Široki prikaz cijelog maila s ugrađenom uplatnicom i barkodom */}
            <div className="lg:col-span-7 xl:col-span-8 2xl:col-span-9 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-[#CEA369]" />
                  <h4 className="font-bold text-xs uppercase tracking-wider text-foreground">
                    Prikaz cijelog maila (kako ga primatelj vidi):
                  </h4>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  Primjer za: <strong className="text-foreground">{targetMemberName}</strong>
                </span>
              </div>

              {/* Kartica simulacije Email klijenta */}
              <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden text-xs">
                {/* Email headers */}
                <div className="bg-muted/40 border-b border-border p-3.5 space-y-1.5 font-mono text-[11px]">
                  <div className="flex items-center">
                    <span className="w-16 text-muted-foreground shrink-0 font-sans text-xs">Od:</span>
                    <span className="text-foreground font-medium">
                      Hrvatsko rodoslovno društvo &lt;{settings?.smtpFrom || "rodoslovlje@rodoslovlje.hr"}&gt;
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-16 text-muted-foreground shrink-0 font-sans text-xs">Za:</span>
                    <span className="text-foreground font-medium">
                      {mode === "single"
                        ? `${targetMemberName} <${targetMemberEmail}>`
                        : `${targetMemberName} <${targetMemberEmail}> (${selectedBulkIds.length} primatelja)`}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-16 text-muted-foreground shrink-0 font-sans text-xs">Predmet:</span>
                    <span className="text-foreground font-bold">{subject}</span>
                  </div>
                </div>

                {/* Email body preview s ugrađenim slikama u punoj veličini */}
                <div className="p-2 sm:p-4 bg-[#F8FAFC] max-h-[calc(96vh-240px)] overflow-y-auto">
                  <div dangerouslySetInnerHTML={{ __html: previewHtmlResult.html }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Podnožje s gumbima */}
        <div className="border-t border-border bg-muted/40 p-4 px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-b-2xl shrink-0">
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

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSending}
            >
              {sendResult.status === "success" ? "Zatvori" : "Odustani"}
            </Button>

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
                className="gap-1.5 bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 border border-[#D97706] text-white font-medium px-5 h-9"
                onClick={handleSend}
                disabled={
                  isSending ||
                  isSendingTest ||
                  (mode === "single" && (!member?.email || Boolean(member?.doNotContact))) ||
                  (mode === "bulk" && selectedBulkIds.length === 0)
                }
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
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 font-medium px-5 h-9"
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
