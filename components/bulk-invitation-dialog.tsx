"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CloseActionButton } from "@/components/ui/action-bar"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Mail,
  Send,
  Search,
  Users,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  KeyRound,
} from "lucide-react"
import { toast } from "sonner"
import { useMembers, type Member } from "@/contexts/members-context"
import { useSettings } from "@/contexts/settings-context"
import { useAuth } from "@/contexts/auth-context"
import { formatDateTimeDMY } from "@/lib/utils"
import { buildHrdMasterEmail, escapeHtml } from "@/lib/hrd-email-system"
import { EmailSendProgressBanner } from "@/components/email-send-progress-banner"
import {
  consumeEmailSendStream,
  INITIAL_BULK_EMAIL_PROGRESS,
  type BulkEmailProgressState,
} from "@/lib/bulk-email-stream"

const DEFAULT_BULK_INVITATION_BODY =
  "Pozivamo Vas da aktivirate svoj pristup u službeni informacijski sustav Hrvatskog rodoslovnog društva „Pavao Ritter Vitezović” (Rodoslovac).\n\nKlikom na poveznicu ispod automatski ćete biti prijavljeni u sustav, gdje ćete odmah postaviti svoju novu osobnu lozinku (bez potrebe za unosom stare lozinke). Nakon postavljanja lozinke, ubuduće se prijavljujete svojim korisničkim imenom i novom lozinkom."

export type BulkInvitationStageFilter =
  | "not_invited_active"
  | "invited_pending"
  | "all_active"
  | "all"

export function getMemberAccessState(member: Member): "activated" | "invited_pending" | "not_invited" {
  const isActivated = Boolean(
    member.lastLoginAt || (member.hasPassword && !member.isTempPassword)
  )
  if (isActivated) return "activated"
  if (member.invitationSent) return "invited_pending"
  return "not_invited"
}

interface BulkInvitationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialMemberIds?: number[]
}

export function BulkInvitationDialog({
  open,
  onOpenChange,
  initialMemberIds,
}: BulkInvitationDialogProps) {
  const { members, updateMember } = useMembers()
  const { settings } = useSettings()
  const { user } = useAuth()

  const [selectedMemberIds, setSelectedMemberIds] = React.useState<number[]>([])
  const [previewMemberId, setPreviewMemberId] = React.useState<number | null>(null)
  const [searchTerm, setSearchTerm] = React.useState("")
  const [stageFilter, setStageFilter] = React.useState<BulkInvitationStageFilter>("not_invited_active")
  const [subject, setSubject] = React.useState("")
  const [bodyText, setBodyText] = React.useState("")
  const [testEmailAddress, setTestEmailAddress] = React.useState("")
  const [isSending, setIsSending] = React.useState(false)
  const [isSendingTest, setIsSendingTest] = React.useState(false)
  const [sendProgress, setSendProgress] = React.useState<BulkEmailProgressState>(INITIAL_BULK_EMAIL_PROGRESS)
  const sendAbortRef = React.useRef<AbortController | null>(null)
  const [sendResult, setSendResult] = React.useState<{
    status: "idle" | "success" | "error"
    message?: string
  }>({ status: "idle" })

  const eligibleMembers = React.useMemo(() => {
    return members.filter(
      (m) => !m.deceased && !m.doNotContact && Boolean(m.email && m.email.includes("@"))
    )
  }, [members])

  const counts = React.useMemo(() => {
    let notInvitedActive = 0
    let invitedPending = 0
    let allActive = 0
    for (const m of eligibleMembers) {
      const state = getMemberAccessState(m)
      if (m.status === "active") {
        allActive++
        if (state === "not_invited") notInvitedActive++
      }
      if (state === "invited_pending") invitedPending++
    }
    return {
      notInvitedActive,
      invitedPending,
      allActive,
      all: eligibleMembers.length,
    }
  }, [eligibleMembers])

  const filteredList = React.useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    return eligibleMembers.filter((member) => {
      const state = getMemberAccessState(member)
      if (stageFilter === "not_invited_active") {
        if (member.status !== "active" || state !== "not_invited") return false
      } else if (stageFilter === "invited_pending") {
        if (state !== "invited_pending") return false
      } else if (stageFilter === "all_active") {
        if (member.status !== "active") return false
      }

      if (!q) return true
      return (
        member.name.toLowerCase().includes(q) ||
        (member.email || "").toLowerCase().includes(q) ||
        (member.registryNumber || "").toLowerCase().includes(q)
      )
    })
  }, [eligibleMembers, stageFilter, searchTerm])

  const prevOpenRef = React.useRef(false)

  React.useEffect(() => {
    if (open && !prevOpenRef.current) {
      prevOpenRef.current = true
      setSubject(settings.invitationEmailSubject || "Pozivnica za pristup sustavu HRD")
      setBodyText(DEFAULT_BULK_INVITATION_BODY)
      setSendResult({ status: "idle" })
      setSendProgress(INITIAL_BULK_EMAIL_PROGRESS)
      setTestEmailAddress(user?.email || settings.smtpFrom || "")
      setSearchTerm("")

      const eligibleIdSet = new Set(eligibleMembers.map((m) => m.id))
      const filteredInitial = (initialMemberIds || []).filter((id) => eligibleIdSet.has(id))

      if (filteredInitial.length > 0) {
        setStageFilter("all")
        setSelectedMemberIds(filteredInitial)
        setPreviewMemberId(filteredInitial[0] ?? eligibleMembers[0]?.id ?? null)
      } else {
        setStageFilter("not_invited_active")
        setSelectedMemberIds([])
        const firstUninvited = eligibleMembers.find(
          (m) => m.status === "active" && getMemberAccessState(m) === "not_invited"
        )
        setPreviewMemberId(firstUninvited?.id ?? eligibleMembers[0]?.id ?? null)
      }
    } else if (!open) {
      prevOpenRef.current = false
    }
  }, [open, settings.invitationEmailSubject, settings.smtpFrom, user?.email, eligibleMembers, initialMemberIds])

  const previewMember = React.useMemo(() => {
    return (
      filteredList.find((m) => m.id === previewMemberId) ||
      eligibleMembers.find((m) => m.id === previewMemberId) ||
      filteredList[0] ||
      eligibleMembers[0] ||
      null
    )
  }, [filteredList, eligibleMembers, previewMemberId])

  const previewHtmlResult = React.useMemo(() => {
    const sampleName = previewMember?.name || "Ivan Horvat"
    const sampleEmail = previewMember?.email || settings.smtpFrom || "clan@primjer.hr"
    const origin = typeof window !== "undefined" ? window.location.origin : "https://rodoslovlje.hr"
    const inviteUrl = `${origin}/pozivnica/test-pregled`

    const resolvedSubject = (subject || "Pozivnica za pristup sustavu HRD")
      .replace(/{{name}}/gi, sampleName)
      .replace(/{{ime}}/gi, sampleName)
      .replace(/{{email}}/gi, sampleEmail)
      .replace(/{{korisnicko_ime}}/gi, sampleEmail)
      .replace(/{{link}}/gi, inviteUrl)
      .replace(/{{inviteLink}}/gi, inviteUrl)

    const resolvedBody = (bodyText || DEFAULT_BULK_INVITATION_BODY)
      .replace(/{{name}}/gi, sampleName)
      .replace(/{{ime}}/gi, sampleName)
      .replace(/{{email}}/gi, sampleEmail)
      .replace(/{{korisnicko_ime}}/gi, sampleEmail)
      .replace(/{{link}}/gi, inviteUrl)
      .replace(/{{inviteLink}}/gi, inviteUrl)

    const infoBoxHtml = `
      <div style="margin-bottom: 8px;"><strong>Korisničko ime (Username / E-pošta):</strong><br/><code style="background: #FFFFFF; padding: 3px 8px; border: 1px solid #E2E8F0; color: #1E3A5F; font-weight: bold; display: inline-block; margin-top: 2px;">${escapeHtml(sampleEmail)}</code></div>
      <div style="margin-bottom: 8px;"><strong>Izravna poveznica za aktivaciju i postavljanje lozinke:</strong><br/><a href="${escapeHtml(inviteUrl)}" style="color: #1F77C5; font-weight: bold; word-break: break-all;">${escapeHtml(inviteUrl)}</a></div>
      <div style="font-size: 12px; color: #475569; margin-top: 6px;">Nakon postavljanja lozinke, za svaku buduću prijavu koristite adresu <a href="${escapeHtml(origin)}/" style="color: #1F77C5;">${escapeHtml(origin)}/</a> te gore navedeno korisničko ime i svoju novu lozinku.</div>
    `

    return buildHrdMasterEmail({
      templateType: "informacije_clanstvo",
      title: resolvedSubject,
      greeting: `Poštovani/a ${sampleName},`,
      bodyTextOrHtml: resolvedBody,
      infoBoxTitle: "Vaši pristupni podaci za sustav Rodoslovac",
      infoBoxHtml,
      ctaText: "Aktiviraj pristup i postavi lozinku",
      ctaUrl: inviteUrl,
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
  }, [previewMember, subject, bodyText, settings, user])

  const toggleMember = (id: number) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const selectAllVisible = () => {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev)
      for (const m of filteredList) next.add(m.id)
      return Array.from(next)
    })
  }

  const clearSelection = () => setSelectedMemberIds([])

  const handleSendTest = async () => {
    setIsSendingTest(true)
    setSendResult({ status: "idle" })
    try {
      const res = await fetch("/api/admin/notifications/bulk-invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberIds: selectedMemberIds,
          previewMemberId: previewMember?.id,
          customSubject: subject,
          customBody: bodyText,
          testOnly: true,
          testEmail: testEmailAddress.trim() || user?.email || settings.smtpFrom,
          sender: user
            ? {
                userId: user.id.toString(),
                userName: user.name,
                userRole: user.role,
              }
            : undefined,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setSendResult({ status: "success", message: data.message })
      } else {
        setSendResult({
          status: "error",
          message: data.error || "Slanje testne pozivnice nije uspjelo.",
        })
      }
    } catch (err: any) {
      setSendResult({
        status: "error",
        message: err?.message || "Greška pri slanju testne pozivnice.",
      })
    } finally {
      setIsSendingTest(false)
    }
  }

  const handleSend = async () => {
    if (selectedMemberIds.length === 0) {
      setSendResult({
        status: "error",
        message: "Označite barem jednog člana na popisu primatelja.",
      })
      return
    }

    setIsSending(true)
    setSendResult({ status: "idle" })
    const abortController = new AbortController()
    sendAbortRef.current = abortController
    setSendProgress({
      ...INITIAL_BULK_EMAIL_PROGRESS,
      active: true,
      status: "running",
      total: selectedMemberIds.length,
      label: "Skupno slanje pozivnica",
    })

    try {
      const data = await consumeEmailSendStream(
        "/api/admin/notifications/bulk-invitations",
        {
          memberIds: selectedMemberIds,
          customSubject: subject,
          customBody: bodyText,
          sender: user
            ? {
                userId: user.id.toString(),
                userName: user.name,
                userRole: user.role,
              }
            : undefined,
        },
        (prog) => setSendProgress({ ...prog, label: "Skupno slanje pozivnica" }),
        abortController.signal
      )

      if (data?.success) {
        const sentAt = data.sentAt || new Date().toISOString()
        const sentIds: number[] = Array.isArray(data.sentMemberIds) ? data.sentMemberIds : []
        for (const id of sentIds) {
          updateMember(id, {
            invitationSent: true,
            invitationSentAt: sentAt,
            hasPassword: true,
            isTempPassword: true,
          })
        }

        if (data.cancelled) {
          setSendResult({
            status: "success",
            message: data.message || `Djelomično poslano ${sentIds.length} pozivnica.`,
          })
          toast.warning(data.message || "Slanje pozivnica je zaustavljeno.")
        } else {
          toast.success(data.message || `Uspješno poslano ${sentIds.length} pozivnica.`)
          onOpenChange(false)
        }
      } else {
        setSendResult({
          status: "error",
          message: data?.error || "Slanje pozivnica nije uspjelo.",
        })
      }
    } catch (error: any) {
      if (error?.name === "AbortError") {
        setSendProgress((prev) => ({
          ...prev,
          active: false,
          status: "cancelled",
          pausedReason: "Slanje zaustavljeno od strane korisnika.",
        }))
        setSendResult({
          status: "error",
          message: "Slanje je zaustavljeno. Već poslane pozivnice su evidentirane u bazi.",
        })
      } else {
        setSendResult({
          status: "error",
          message: error?.message || "Greška u komunikaciji s poslužiteljem.",
        })
      }
    } finally {
      sendAbortRef.current = null
      setIsSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] sm:max-w-[1280px] max-h-[92vh] overflow-y-auto p-0 rounded-2xl border border-border shadow-2xl">
        <DialogHeader className="bg-[#1E3A5F] text-white px-6 py-5 border-b-2 border-[#D97706] rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#D97706]/20 border border-[#D97706]/40 flex items-center justify-center shrink-0">
              <KeyRound className="h-5 w-5 text-[#FEFCE8]" />
            </div>
            <div>
              <DialogTitle className="font-serif text-lg font-bold text-white tracking-tight">
                Skupno slanje pozivnica za pristup sustavu Rodoslovac
              </DialogTitle>
              <DialogDescription className="text-xs text-[#F8FAFC]">
                Svaki član prima personaliziranu aktivacijsku poveznicu za automatsku prijavu i postavljanje vlastite lozinke.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 md:p-6 space-y-5">
          {(sendProgress.active || sendProgress.status !== "idle") && (
            <EmailSendProgressBanner
              progress={sendProgress}
              onCancel={() => sendAbortRef.current?.abort()}
              title="Brojač slanja pozivnica članovima"
            />
          )}

          {sendResult.status === "success" && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-sm font-semibold text-emerald-900">{sendResult.message}</div>
            </div>
          )}

          {sendResult.status === "error" && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div className="text-sm font-semibold text-red-900">{sendResult.message}</div>
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-[1.05fr_1fr]">
            {/* LIJEVO: Popis članova */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-3 flex flex-col">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    1. Odaberite članove ({selectedMemberIds.length} odabrano)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={selectAllVisible}
                  >
                    Označi sve prikazane ({filteredList.length})
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={clearSelection}
                  >
                    Očisti
                  </Button>
                </div>
              </div>

              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Pretraži člana po imenu, emailu ili matici..."
                  className="pl-8 h-9 text-xs"
                />
              </div>

              <div className="flex flex-wrap gap-1.5">
                {[
                  {
                    id: "not_invited_active",
                    label: `Nepozvani aktivni (${counts.notInvitedActive})`,
                  },
                  {
                    id: "invited_pending",
                    label: `Pozvani — bez prijave (${counts.invitedPending})`,
                  },
                  {
                    id: "all_active",
                    label: `Svi aktivni s e-mailom (${counts.allActive})`,
                  },
                  {
                    id: "all",
                    label: `Svi s e-mailom (${counts.all})`,
                  },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setStageFilter(f.id as BulkInvitationStageFilter)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                      stageFilter === f.id
                        ? "bg-[#1B2B36] text-white"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="border border-border rounded-xl overflow-y-auto max-h-[420px] divide-y divide-border">
                {filteredList.length > 0 ? (
                  filteredList.map((member) => {
                    const isChecked = selectedMemberIds.includes(member.id)
                    const isPreview = previewMember?.id === member.id
                    const accessState = getMemberAccessState(member)
                    return (
                      <div
                        key={member.id}
                        className={`flex items-start gap-3 p-3 text-xs transition-colors ${
                          isPreview ? "bg-blue-50/70" : "hover:bg-muted/30"
                        }`}
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleMember(member.id)}
                          className="mt-0.5"
                        />
                        <div
                          className="min-w-0 flex-1 cursor-pointer"
                          onClick={() => setPreviewMemberId(member.id)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-sm text-foreground truncate">
                              {member.name}
                            </span>
                            {accessState === "activated" ? (
                              <Badge
                                variant="outline"
                                className="border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] shrink-0"
                              >
                                Aktiviran
                              </Badge>
                            ) : accessState === "invited_pending" ? (
                              <Badge
                                variant="outline"
                                className="border-amber-200 bg-amber-50 text-amber-800 text-[10px] shrink-0"
                              >
                                Pozvan · bez prijave
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="border-slate-200 bg-slate-50 text-slate-600 text-[10px] shrink-0"
                              >
                                Nije pozvan
                              </Badge>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                            <span className="truncate">{member.email}</span>
                            {member.lastLoginAt && (
                              <span className="text-emerald-700 font-medium">
                                • Zadnja prijava: {formatDateTimeDMY(member.lastLoginAt)}
                              </span>
                            )}
                            {!member.lastLoginAt && member.invitationSentAt && (
                              <span className="text-amber-700 font-medium">
                                • Poslano: {formatDateTimeDMY(member.invitationSentAt)}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-[11px] shrink-0"
                          onClick={() => setPreviewMemberId(member.id)}
                          title="Prikaži izgled pozivnice za ovog člana"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )
                  })
                ) : (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    Nema članova koji odgovaraju odabranom filtru.
                  </div>
                )}
              </div>
            </div>

            {/* DESNO: Predložak i vizualni pregled uživo */}
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                  2. Predložak pozivnice (varijable: {"{{ime}}"}, {"{{email}}"}, {"{{link}}"})
                </Label>
                <div className="space-y-1.5">
                  <Label htmlFor="bulk-invite-subject" className="text-xs">Predmet (Subject)</Label>
                  <Input
                    id="bulk-invite-subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bulk-invite-body" className="text-xs">Tekst poruke</Label>
                  <Textarea
                    id="bulk-invite-body"
                    rows={5}
                    value={bodyText}
                    onChange={(e) => setBodyText(e.target.value)}
                    className="text-xs leading-relaxed"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap px-1">
                  <div className="text-xs font-bold text-[#1E3A5F] flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5 text-[#D97706]" />
                    Pregled uživo za: {previewMember?.name || "Primjer člana"}
                  </div>
                </div>
                <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] max-h-[380px] overflow-y-auto">
                  <div dangerouslySetInnerHTML={{ __html: previewHtmlResult.html }} />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-3 border-t border-border">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <Input
                value={testEmailAddress}
                onChange={(e) => setTestEmailAddress(e.target.value)}
                placeholder="E-mail za test (admin ili drugi mail)..."
                className="h-9 text-xs"
                disabled={isSending || isSendingTest}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleSendTest}
                disabled={isSending || isSendingTest || !subject.trim() || !bodyText.trim()}
                className="shrink-0 gap-2 border-[#D97706] text-[#1E3A5F] hover:bg-[#FEFCE8]"
              >
                {isSendingTest ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4 text-[#D97706]" />
                )}
                Pošalji testni e-mail
              </Button>
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-2.5">
              <CloseActionButton
                label="Zatvori"
                onClick={() => onOpenChange(false)}
                disabled={isSending || isSendingTest}
              />
              <Button
                onClick={handleSend}
                disabled={
                  isSending ||
                  isSendingTest ||
                  selectedMemberIds.length === 0 ||
                  !subject.trim() ||
                  !bodyText.trim()
                }
                className="rounded-full h-10 px-6 gap-2 bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 border border-[#D97706] text-white font-bold shadow-md"
              >
                {isSending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {sendProgress.total > 0
                      ? `Šaljem ${sendProgress.sent}/${sendProgress.total}...`
                      : `Slanje u tijeku (${selectedMemberIds.length})...`}
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Odobri i pošalji pozivnice ({selectedMemberIds.length})
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
