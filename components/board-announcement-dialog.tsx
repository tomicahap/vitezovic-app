"use client"

import * as React from "react"
import { useAuth } from "@/contexts/auth-context"
import { useMembers, isAdminAccountEntry, type Member } from "@/contexts/members-context"
import { useSettings } from "@/contexts/settings-context"
import { useActivityLog } from "@/contexts/activity-log-context"
import {
  buildHrdMasterEmail,
  escapeHtml,
} from "@/lib/hrd-email-system"
import {
  isBoardMember,
  getMemberActiveFunctions,
  formatDateTimeDMY,
} from "@/lib/utils"
import { getUserAccessRights } from "@/lib/inquiry-permissions"

export function canUserSendBoardAnnouncement(user: any, members: Member[]): boolean {
  if (!user) return false
  if (user.role === "admin" || user.role === "moderator") return true
  const ar = getUserAccessRights(user)
  if (ar?.notifications?.edit === true) return true
  const me = (members || []).find(
    (m) =>
      Number(m.id) === Number(user.id) ||
      (user.email && m.email && m.email.toLowerCase() === user.email.toLowerCase())
  )
  return Boolean(me && !me.deceased && !me.expelled && isBoardMember(me))
}
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Mail,
  Send,
  Users,
  Eye,
  Edit3,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  UserCheck,
  AlertTriangle,
  Megaphone,
  ChevronDown,
  ChevronUp,
} from "lucide-react"

interface BoardAnnouncementDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialMessage?: string
  onSent?: () => void
}

interface BoardRecipient {
  member: Member
  id: number
  name: string
  email: string
  functions: string[]
}

export function BoardAnnouncementDialog({
  open,
  onOpenChange,
  initialMessage,
  onSent,
}: BoardAnnouncementDialogProps) {
  const { user } = useAuth()
  const { members } = useMembers()
  const { settings, refreshSettings } = useSettings()
  const { refreshLogs } = useActivityLog()

  const [subject, setSubject] = React.useState("")
  const [message, setMessage] = React.useState("")
  const [selectedIds, setSelectedIds] = React.useState<number[]>([])
  const [viewMode, setViewMode] = React.useState<"edit" | "preview">("edit")
  const [showRecipientsList, setShowRecipientsList] = React.useState(true)
  const [syncBoardNotice, setSyncBoardNotice] = React.useState(false)
  const [testEmailAddress, setTestEmailAddress] = React.useState("")

  const [isSending, setIsSending] = React.useState(false)
  const [isSendingTest, setIsSendingTest] = React.useState(false)
  const [isBroadcastSent, setIsBroadcastSent] = React.useState(false)
  const [statusBanner, setStatusBanner] = React.useState<{
    type: "idle" | "success" | "error"
    title?: string
    message: string
    sentAt?: string
  }>({ type: "idle", message: "" })

  const originUrl =
    typeof window !== "undefined" ? window.location.origin : "https://cms.rodoslovlje.hr"

  // Trenutni sastav tijela društva (aktivne funkcije s važećim mandatom, bez admina, preminulih i ispisanih)
  const { eligibleRecipients, missingEmailBoardMembers } = React.useMemo(() => {
    const activeBoard = (members || [])
      .filter((m) => m && !isAdminAccountEntry(m) && !m.deceased && !m.expelled && isBoardMember(m))
      .sort((a, b) => a.name.localeCompare(b.name, "hr"))

    const eligible: BoardRecipient[] = []
    const missingEmail: Array<{ id: number; name: string; functions: string[] }> = []
    const seenEmails = new Set<string>()

    for (const m of activeBoard) {
      const activeFns = getMemberActiveFunctions(m)
      const email = String(m.email || "").trim()
      if (!email || !email.includes("@")) {
        missingEmail.push({ id: m.id, name: m.name, functions: activeFns })
        continue
      }
      const key = email.toLowerCase()
      if (seenEmails.has(key)) continue
      seenEmails.add(key)

      eligible.push({
        member: m,
        id: m.id,
        name: m.name,
        email,
        functions: activeFns,
      })
    }

    return {
      eligibleRecipients: eligible,
      missingEmailBoardMembers: missingEmail,
    }
  }, [members])

  // Odredi identitet prijavljenog pošiljatelja za zaglavlje/okvir obavijesti
  const { senderDisplayName, senderRoleLabel } = React.useMemo(() => {
    if (!user) {
      return { senderDisplayName: "Administrator", senderRoleLabel: "Administrator" }
    }
    if (user.role === "admin") {
      return {
        senderDisplayName: settings?.adminName?.trim() || user.name || "Administrator",
        senderRoleLabel: "Administrator",
      }
    }
    const me = (members || []).find(
      (m) =>
        Number(m.id) === Number(user.id) ||
        (user.email && m.email && m.email.toLowerCase() === user.email.toLowerCase())
    )
    const activeFns = me ? getMemberActiveFunctions(me) : []
    return {
      senderDisplayName: me?.name || user.name,
      senderRoleLabel:
        activeFns.length > 0
          ? activeFns.join(", ")
          : user.role === "moderator"
          ? "Moderator (tijelo društva)"
          : "Član tijela društva",
    }
  }, [user, members, settings?.adminName])

  const canSyncBoardNotice = user?.role === "admin" || user?.role === "moderator"

  const prevOpenRef = React.useRef(false)
  React.useEffect(() => {
    if (open && !prevOpenRef.current) {
      prevOpenRef.current = true
      setSubject("Važna obavijest za članove tijela Društva")
      setMessage(initialMessage || "")
      setSelectedIds(eligibleRecipients.map((r) => r.id))
      setViewMode("edit")
      setShowRecipientsList(true)
      setSyncBoardNotice(false)
      setIsBroadcastSent(false)
      setStatusBanner({ type: "idle", message: "" })
      const userEmail = user?.email && user.email.includes("@") ? user.email : ""
      setTestEmailAddress(userEmail || settings?.smtpFrom || "")
    } else if (!open) {
      prevOpenRef.current = false
    }
  }, [open, initialMessage, eligibleRecipients, user?.email, settings?.smtpFrom])

  const selectedRecipients = React.useMemo(
    () => eligibleRecipients.filter((r) => selectedIds.includes(r.id)),
    [eligibleRecipients, selectedIds]
  )

  const toggleAllRecipients = (checked: boolean) => {
    setSelectedIds(checked ? eligibleRecipients.map((r) => r.id) : [])
  }

  const toggleSingleRecipient = (id: number, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((item) => item !== id)
    )
  }

  // Live pregled u standardiziranom HRD predlošku (#1E3A5F / #D97706 / #7C2D12 + potpis)
  const previewBuilt = React.useMemo(() => {
    const now = new Date()
    const formattedDateTime = formatDateTimeDMY(now)
    const infoBoxHtml = `
      <div><strong>Obavijest podijelio/la:</strong> ${escapeHtml(senderDisplayName)} <span style="color:#6B7280;">(${escapeHtml(senderRoleLabel)})</span></div>
      <div><strong>Primatelji:</strong> Trenutni sastav tijela Društva (${selectedRecipients.length} ${selectedRecipients.length === 1 ? "član" : "članova"})</div>
      <div><strong>Datum i vrijeme:</strong> ${escapeHtml(formattedDateTime)}</div>
    `
    return buildHrdMasterEmail({
      templateType: "sluzbena_obavijest",
      title: subject.trim() || "Obavijest za članove tijela Društva",
      sentDate: now,
      greeting: "Poštovane članice i članovi tijela Društva,",
      bodyTextOrHtml:
        message.trim() ||
        "Ovdje će se prikazati tekst Vaše važne obavijesti za članove trenutnog sastava tijela društva...",
      infoBoxTitle: "Podaci o obavijesti",
      infoBoxHtml,
      ctaText: "Otvori sustav Rodoslovac",
      ctaUrl: originUrl,
      settings,
      sender: user
        ? {
            userId: user.id,
            userName: senderDisplayName,
            userEmail: user.email,
            userRole: user.role,
          }
        : undefined,
      forBrowserPreview: true,
    })
  }, [
    subject,
    message,
    senderDisplayName,
    senderRoleLabel,
    selectedRecipients.length,
    originUrl,
    settings,
    user,
  ])

  const sendPayload = async (isTest: boolean) => {
    if (!subject.trim()) {
      setStatusBanner({
        type: "error",
        title: "Nedostaje predmet",
        message: "Unesite predmet e-mail obavijesti.",
      })
      return
    }
    if (!message.trim()) {
      setStatusBanner({
        type: "error",
        title: "Nedostaje sadržaj",
        message: "Upišite tekst obavijesti za članove tijela.",
      })
      return
    }
    if (!isTest && selectedRecipients.length === 0) {
      setStatusBanner({
        type: "error",
        title: "Nema odabranih primatelja",
        message: "Odaberite barem jednog člana iz trenutnog sastava tijela društva.",
      })
      return
    }
    if (isTest && (!testEmailAddress.trim() || !testEmailAddress.includes("@"))) {
      setStatusBanner({
        type: "error",
        title: "Neispravna testna adresa",
        message: "Unesite valjanu e-mail adresu za slanje testnog maila.",
      })
      return
    }

    if (isTest) setIsSendingTest(true)
    else setIsSending(true)
    setStatusBanner({ type: "idle", message: "" })

    try {
      const response = await fetch("/api/board/announcement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          message: message.trim(),
          recipientIds: selectedRecipients.map((r) => r.id),
          testOnly: isTest,
          testEmail: testEmailAddress.trim(),
          syncBoardNotice: !isTest && canSyncBoardNotice && syncBoardNotice,
          sender: user
            ? {
                userId: user.id.toString(),
                userName: senderDisplayName,
                userRole: user.role,
                userEmail: user.email,
              }
            : undefined,
        }),
      })

      const data = await response.json()
      if (!response.ok || !data.success) {
        setStatusBanner({
          type: "error",
          title: isTest ? "Slanje testnog maila nije uspjelo" : "Slanje obavijesti nije uspjelo",
          message: data.error || "Greška pri slanju e-maila.",
        })
        return
      }

      if (isTest) {
        setStatusBanner({
          type: "success",
          title: "Testni mail poslan!",
          message: data.message || `Testni e-mail uspješno je poslan na ${testEmailAddress.trim()}.`,
          sentAt: data.sentAt,
        })
      } else {
        setIsBroadcastSent(true)
        setStatusBanner({
          type: "success",
          title: "Obavijest je poslana svim odabranim članovima tijela!",
          message:
            data.message ||
            `Uspješno poslano na ${selectedRecipients.length} adresa trenutnog sastava tijela društva.`,
          sentAt: data.sentAt,
        })
        await refreshLogs()
        if (syncBoardNotice && canSyncBoardNotice) {
          await refreshSettings()
        }
        onSent?.()
      }
    } catch (err: any) {
      setStatusBanner({
        type: "error",
        title: "Greška poslužitelja",
        message: err?.message || "Nije moguće povezati se s poslužiteljem.",
      })
    } finally {
      if (isTest) setIsSendingTest(false)
      else setIsSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[92vh] overflow-y-auto p-0 rounded-2xl border border-border shadow-2xl">
        {/* Standardizirano HRD zaglavlje dijaloga (#1E3A5F + #D97706) */}
        <div className="bg-[#1E3A5F] border-b-2 border-[#D97706] text-white p-6 rounded-t-2xl">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center shrink-0 border border-[#D97706]/40">
                <Megaphone className="h-5 w-5 text-[#FEFCE8]" />
              </div>
              <div>
                <DialogTitle className="text-lg font-serif font-bold text-white tracking-tight">
                  Obavijest članovima tijela društva (E-mail)
                </DialogTitle>
                <DialogDescription className="text-xs text-[#F8FAFC]/90 mt-0.5">
                  Unificirano HRD zaglavlje i službeni potpis • Prima isključivo trenutni aktivni sastav tijela društva
                </DialogDescription>
              </div>
            </div>
            <Badge className="bg-[#D97706] text-white border-0 text-[11px] font-semibold shrink-0">
              {eligibleRecipients.length} u tijelu
            </Badge>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Statusna obavijest */}
          {statusBanner.type === "success" && (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-900 shadow-xs animate-in fade-in duration-200">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-emerald-950">{statusBanner.title}</h4>
                  <p className="text-xs text-emerald-800">{statusBanner.message}</p>
                  {statusBanner.sentAt && (
                    <p className="text-[11px] font-semibold text-emerald-900">
                      Vrijeme slanja: {formatDateTimeDMY(statusBanner.sentAt)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {statusBanner.type === "error" && (
            <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-900 shadow-xs animate-in fade-in duration-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-red-950">{statusBanner.title}</h4>
                  <p className="text-xs text-red-800">{statusBanner.message}</p>
                </div>
              </div>
            </div>
          )}

          {/* Info traka: Tko dijeli obavijest */}
          <div className="rounded-xl border border-[#E2E8F0] bg-[#FEFCE8] px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <UserCheck className="h-4 w-4 text-[#7C2D12] shrink-0" />
              <div className="text-xs text-[#1F2937]">
                <span className="font-semibold text-[#7C2D12]">Obavijest podijelio/la (u zaglavlju maila): </span>
                <strong className="text-[#1E3A5F]">{senderDisplayName}</strong>{" "}
                <span className="text-muted-foreground">({senderRoleLabel})</span>
              </div>
            </div>
            <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-border self-start sm:self-auto">
              <Button
                type="button"
                variant={viewMode === "edit" ? "default" : "ghost"}
                size="sm"
                className="h-7 text-xs gap-1.5 px-3 rounded-md"
                onClick={() => setViewMode("edit")}
              >
                <Edit3 className="h-3.5 w-3.5" /> Uredi obavijest
              </Button>
              <Button
                type="button"
                variant={viewMode === "preview" ? "default" : "ghost"}
                size="sm"
                className="h-7 text-xs gap-1.5 px-3 rounded-md"
                onClick={() => setViewMode("preview")}
              >
                <Eye className="h-3.5 w-3.5" /> Pregled e-maila
              </Button>
            </div>
          </div>

          {viewMode === "edit" ? (
            <div className="space-y-4">
              {/* Predmet */}
              <div className="space-y-1.5">
                <Label htmlFor="board-announcement-subject" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Predmet obavijesti (Naslov)
                </Label>
                <Input
                  id="board-announcement-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Npr. Važna informacija za članove Upravnog odbora..."
                  className="bg-card"
                  disabled={isBroadcastSent || isSending}
                />
              </div>

              {/* Prostor za pisanje obavijesti */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="board-announcement-body" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Tekst obavijesti
                  </Label>
                  {settings?.boardNotice && !isBroadcastSent && (
                    <button
                      type="button"
                      onClick={() => setMessage(settings.boardNotice || "")}
                      className="text-[11px] font-semibold text-[#1F77C5] hover:underline"
                    >
                      Preuzmi s Oglasne ploče odbora
                    </button>
                  )}
                </div>
                <Textarea
                  id="board-announcement-body"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={7}
                  placeholder="Upišite važnu informaciju ili obavijest koju želite poslati članovima trenutnog sastava tijela društva..."
                  className="bg-card text-sm leading-relaxed"
                  disabled={isBroadcastSent || isSending}
                />
              </div>

              {canSyncBoardNotice && !isBroadcastSent && (
                <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer select-none">
                  <Checkbox
                    checked={syncBoardNotice}
                    onCheckedChange={(checked) => setSyncBoardNotice(checked === true)}
                    disabled={isSending}
                  />
                  <span>Istovremeno objavi ovaj tekst i na Oglasnoj ploči odbora (Nadzorna ploča)</span>
                </label>
              )}

              {/* Primatelji: isključivo trenutni sastav tijela */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/30 px-4 py-2.5 border-b border-border">
                  <button
                    type="button"
                    onClick={() => setShowRecipientsList((v) => !v)}
                    className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-foreground"
                  >
                    <Users className="h-3.5 w-3.5 text-primary" />
                    <span>
                      Primatelji — trenutni sastav tijela ({selectedRecipients.length}/{eligibleRecipients.length})
                    </span>
                    {showRecipientsList ? (
                      <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </button>
                  {!isBroadcastSent && eligibleRecipients.length > 0 && (
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => toggleAllRecipients(true)}
                        className="font-semibold text-primary hover:underline"
                      >
                        Označi sve
                      </button>
                      <span className="text-muted-foreground">·</span>
                      <button
                        type="button"
                        onClick={() => toggleAllRecipients(false)}
                        className="font-semibold text-muted-foreground hover:text-foreground hover:underline"
                      >
                        Poništi
                      </button>
                    </div>
                  )}
                </div>

                {showRecipientsList && (
                  <div className="p-3 space-y-2">
                    {eligibleRecipients.length === 0 ? (
                      <div className="py-4 text-center text-xs text-muted-foreground">
                        U registru trenutno nema članova tijela s aktivnim mandatom i upisanom e-mail adresom.
                      </div>
                    ) : (
                      <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                        {eligibleRecipients.map((r) => {
                          const isChecked = selectedIds.includes(r.id)
                          return (
                            <label
                              key={r.id}
                              className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs cursor-pointer transition-colors ${
                                isChecked
                                  ? "border-[#CEA369]/60 bg-[#FEFCE8]/40"
                                  : "border-border bg-background hover:bg-muted/30"
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <Checkbox
                                  checked={isChecked}
                                  onCheckedChange={(checked) => toggleSingleRecipient(r.id, checked === true)}
                                  disabled={isBroadcastSent || isSending}
                                />
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="font-bold text-foreground truncate">{r.name}</span>
                                    {r.functions.map((fn) => (
                                      <Badge
                                        key={fn}
                                        variant="secondary"
                                        className="text-[10px] py-0 px-1.5 bg-amber-100/80 text-amber-900 border border-amber-200"
                                      >
                                        {fn}
                                      </Badge>
                                    ))}
                                  </div>
                                  <p className="font-mono text-[11px] text-muted-foreground truncate">
                                    {r.email}
                                  </p>
                                </div>
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    )}

                    {missingEmailBoardMembers.length > 0 && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-[11px] text-amber-900 flex items-start gap-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <span>
                          Sljedeći članovi tijela nemaju upisanu e-mail adresu pa su preskočeni:{" "}
                          <strong>{missingEmailBoardMembers.map((m) => m.name).join(", ")}</strong>.
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Pregled kompletnog HRD HTML e-maila uživo */
            <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
              <div className="bg-muted/40 border-b border-border px-4 py-2.5 space-y-1 font-mono text-[11px]">
                <div className="flex gap-2">
                  <span className="w-16 text-muted-foreground shrink-0">Za:</span>
                  <span className="text-foreground font-medium">
                    Trenutni sastav tijela Društva ({selectedRecipients.length} primatelja)
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="w-16 text-muted-foreground shrink-0">Predmet:</span>
                  <span className="text-foreground font-bold">{subject || "(Bez predmeta)"}</span>
                </div>
                <div className="flex gap-2">
                  <span className="w-16 text-muted-foreground shrink-0">Autor:</span>
                  <span className="text-foreground">
                    {senderDisplayName} ({senderRoleLabel})
                  </span>
                </div>
              </div>
              <div className="bg-[#F8FAFC] p-2">
                <iframe
                  title="Pregled obavijesti tijelima društva"
                  srcDoc={previewBuilt.html}
                  className="w-full h-[460px] border-0 rounded-lg bg-white"
                  sandbox="allow-same-origin"
                />
              </div>
            </div>
          )}
        </div>

        {/* Podnožje s opcijom za testni mail i slanjem svima */}
        <div className="border-t border-border bg-muted/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-b-2xl">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <Input
              value={testEmailAddress}
              onChange={(e) => setTestEmailAddress(e.target.value)}
              placeholder="E-mail adresa za testni mail..."
              className="h-8 text-xs bg-background"
              disabled={isSending || isSendingTest}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => sendPayload(true)}
              disabled={isSending || isSendingTest}
              className="shrink-0 gap-1.5 border-[#D97706] text-[#1E3A5F] hover:bg-[#FEFCE8]"
            >
              {isSendingTest ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Mail className="h-3.5 w-3.5 text-[#D97706]" />
              )}
              Pošalji testni mail
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
              {isBroadcastSent ? "Zatvori" : "Odustani"}
            </Button>

            {!isBroadcastSent && (
              <Button
                type="button"
                size="sm"
                className="gap-1.5 bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 border border-[#D97706] text-white font-medium"
                onClick={() => sendPayload(false)}
                disabled={isSending || isSendingTest || selectedRecipients.length === 0}
              >
                {isSending ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Slanje...
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    Pošalji svima iz tijela ({selectedRecipients.length})
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
