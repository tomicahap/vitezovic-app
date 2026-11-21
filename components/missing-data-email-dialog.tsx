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
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  FileDown,
  FileText,
  Loader2,
  Mail,
  Search,
  Send,
  Users,
} from "lucide-react"
import { Member, useMembers } from "@/contexts/members-context"
import { useSettings } from "@/contexts/settings-context"
import { useAuth } from "@/contexts/auth-context"
import { formatDateTimeDMY } from "@/lib/utils"
import {
  DEFAULT_MISSING_DATA_EMAIL_BODY,
  DEFAULT_MISSING_FIELD_KEYS,
  MEMBER_CHECKABLE_FIELDS,
  SINGLE_USE_LINK_EMAIL_NOTICE_HTML,
  ensureSingleUseNoticeInBody,
  formatMissingFieldsBullets,
  getMissingMemberFields,
} from "@/lib/member-missing-fields"
import { buildHrdMasterEmail, escapeHtml } from "@/lib/hrd-email-system"
import { EmailSendProgressBanner } from "@/components/email-send-progress-banner"
import {
  consumeEmailSendStream,
  INITIAL_BULK_EMAIL_PROGRESS,
  type BulkEmailProgressState,
} from "@/lib/bulk-email-stream"

interface MissingDataEmailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialMemberIds?: number[]
}

export function MissingDataEmailDialog({
  open,
  onOpenChange,
  initialMemberIds,
}: MissingDataEmailDialogProps) {
  const { members, updateMember } = useMembers()
  const { settings } = useSettings()
  const { user } = useAuth()

  const [selectedFieldKeys, setSelectedFieldKeys] = React.useState<string[]>(
    DEFAULT_MISSING_FIELD_KEYS
  )
  const [selectedMemberIds, setSelectedMemberIds] = React.useState<number[]>([])
  const [previewMemberId, setPreviewMemberId] = React.useState<number | null>(null)
  const [searchTerm, setSearchTerm] = React.useState("")
  const [onlyMissingFilter, setOnlyMissingFilter] = React.useState(true)
  const [stageFilter, setStageFilter] = React.useState<"all" | "not_sent" | "sent_not_viewed" | "viewed_not_submitted" | "submitted">("all")
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
    return members.filter((m) => !m.deceased && !m.doNotContact && m.email && m.email.includes("@"))
  }, [members])

  const membersWithMissing = React.useMemo(() => {
    return eligibleMembers.map((m) => ({
      member: m,
      missing: getMissingMemberFields(m, selectedFieldKeys),
    }))
  }, [eligibleMembers, selectedFieldKeys])

  const filteredList = React.useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    return membersWithMissing.filter(({ member, missing }) => {
      if (onlyMissingFilter && missing.length === 0) return false
      if (stageFilter === "not_sent" && member.lastMissingDataEmailAt) return false
      if (stageFilter === "sent_not_viewed" && (!member.lastMissingDataEmailAt || member.dataFormViewedAt || member.dataFormSubmittedAt)) return false
      if (stageFilter === "viewed_not_submitted" && (!member.dataFormViewedAt || member.dataFormSubmittedAt)) return false
      if (stageFilter === "submitted" && !member.dataFormSubmittedAt) return false
      if (!q) return true
      return (
        member.name.toLowerCase().includes(q) ||
        member.email.toLowerCase().includes(q) ||
        (member.registryNumber || "").toLowerCase().includes(q)
      )
    })
  }, [membersWithMissing, onlyMissingFilter, stageFilter, searchTerm])

  const prevOpenRef = React.useRef(false)

  React.useEffect(() => {
    if (open && !prevOpenRef.current) {
      prevOpenRef.current = true
      setSubject(
        settings.missingDataEmailSubject ||
          'Zamolba za dopunu članskih podataka - HRD "Pavao Ritter Vitezović"'
      )
      setBodyText(
        settings.missingDataEmailBody || DEFAULT_MISSING_DATA_EMAIL_BODY
      )
      setSendResult({ status: "idle" })
      setSendProgress(INITIAL_BULK_EMAIL_PROGRESS)
      setTestEmailAddress(user?.email || settings.smtpFrom || "")
      setSearchTerm("")
      setStageFilter("all")
      if (initialMemberIds && initialMemberIds.length > 0) {
        const eligibleIdSet = new Set(eligibleMembers.map((m) => m.id))
        const filteredInitialIds = initialMemberIds.filter((id) => eligibleIdSet.has(id))
        setSelectedMemberIds(filteredInitialIds)
        setPreviewMemberId(filteredInitialIds[0] ?? eligibleMembers[0]?.id ?? null)
      } else {
        setSelectedMemberIds([])
        const firstWithMissing = membersWithMissing.find((x) => x.missing.length > 0)
        setPreviewMemberId(firstWithMissing?.member.id ?? eligibleMembers[0]?.id ?? null)
      }
    } else if (!open) {
      prevOpenRef.current = false
    }
  }, [open, initialMemberIds])

  const toggleFieldKey = (key: string) => {
    setSelectedFieldKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  const toggleMember = (id: number) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const selectAllVisible = () => {
    setSelectedMemberIds(filteredList.map((x) => x.member.id))
  }

  const clearSelection = () => {
    setSelectedMemberIds([])
  }

  const previewEntry = React.useMemo(() => {
    return (
      membersWithMissing.find((x) => x.member.id === previewMemberId) ||
      filteredList[0] ||
      membersWithMissing[0] ||
      null
    )
  }, [membersWithMissing, previewMemberId, filteredList])

  const previewSubject = React.useMemo(() => {
    if (!previewEntry) return subject
    return subject
      .replace(/{{name}}/gi, previewEntry.member.name)
      .replace(/{{ime}}/gi, previewEntry.member.name)
  }, [subject, previewEntry])

  const previewBody = React.useMemo(() => {
    if (!previewEntry) return bodyText
    const bullets = formatMissingFieldsBullets(previewEntry.missing)
    const origin = typeof window !== "undefined" ? window.location.origin : ""
    // Pregled nikad ne koristi stvarni token člana kako administrator slučajno ne bi potrošio jednokratni pristup
    const sampleToken = "jednokratna-poveznica-clana"
    const sampleLink = `${origin}/dopuna-podataka/${sampleToken}`
    const rawWithLink =
      bodyText.includes("{{formLink}}") || bodyText.includes("{{link}}")
        ? bodyText
        : `${bodyText}\n\nPoveznica za brzu online dopunu podataka:\n{{formLink}}`
    return ensureSingleUseNoticeInBody(
      rawWithLink
        .replace(/{{name}}/gi, previewEntry.member.name)
        .replace(/{{ime}}/gi, previewEntry.member.name)
        .replace(/{{missingFields}}/gi, bullets)
        .replace(/{{nedostaje}}/gi, bullets)
        .replace(/{{formLink}}/gi, sampleLink)
        .replace(/{{link}}/gi, sampleLink)
    )
  }, [bodyText, previewEntry])

  const previewHtmlResult = React.useMemo(() => {
    const missing = previewEntry?.missing || []
    const origin = typeof window !== "undefined" ? window.location.origin : "https://rodoslovlje.hr"
    const sampleToken = "jednokratna-poveznica-clana"
    const formLink = `${origin}/dopuna-podataka/${sampleToken}`
    const missingHtmlList =
      missing.length > 0
        ? `<ul style="margin: 6px 0 0; padding-left: 18px; color: #7C2D12;">${missing
            .map((f) => `<li style="margin: 3px 0;"><strong>${escapeHtml(f.label)}</strong></li>`)
            .join("")}</ul>`
        : `<div>Svi traženi podaci su već evidentirani — molimo provjerite priloženi PDF za eventualne ispravke.</div>`

    return buildHrdMasterEmail({
      templateType: "obavijest_clanovima",
      title: previewSubject || "Zamolba za dopunu članskih podataka",
      bodyTextOrHtml: previewBody,
      infoBoxTitle: `Sažetak podataka za dopunu (${missing.length})`,
      infoBoxHtml: `${missingHtmlList}${SINGLE_USE_LINK_EMAIL_NOTICE_HTML}<div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #E2E8F0;"><strong>Privitak:</strong> U privitku se nalazi Vaš trenutni evidencijski list u PDF formatu.</div>`,
      ctaText: "Otvori osobni obrazac i dopuni podatke (1 pristup)",
      ctaUrl: formLink,
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
  }, [previewEntry, previewSubject, previewBody, settings, user])

  const handleSendTest = async () => {
    setIsSendingTest(true)
    setSendResult({ status: "idle" })
    try {
      const res = await fetch("/api/admin/notifications/missing-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberIds: selectedMemberIds,
          previewMemberId: previewEntry?.member.id,
          selectedFieldKeys,
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
        setSendResult({ status: "error", message: data.error || "Slanje testnog maila nije uspjelo." })
      }
    } catch (err: any) {
      setSendResult({ status: "error", message: err.message || "Greška pri slanju testnog maila." })
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
      label: "Slanje zamolbi za dopunu podataka",
    })

    try {
      const data = await consumeEmailSendStream(
        "/api/admin/notifications/missing-data",
        {
          memberIds: selectedMemberIds,
          selectedFieldKeys,
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
        (prog) => setSendProgress({ ...prog, label: "Slanje zamolbi za dopunu podataka" }),
        abortController.signal
      )

      if (data?.success) {
        const sentAt = data.sentAt || new Date().toISOString()
        const sentIds: number[] = data.sentMemberIds || []
        const infoMap = new Map<number, string>(
          Array.isArray(data.sentMembersInfo)
            ? data.sentMembersInfo.map((x: any) => [Number(x.id), String(x.token)])
            : []
        )
        for (const id of sentIds) {
          const tok = infoMap.get(id)
          updateMember(id, {
            lastMissingDataEmailAt: sentAt,
            dataFormViewedAt: null,
            dataFormSubmittedAt: null,
            dataFormSingleUse: true,
            ...(tok ? { dataFormToken: tok } : {}),
          })
        }
        setSendResult({
          status: "success",
          message: data.message || `Poslano ${sentIds.length} personaliziranih e-mailova.`,
        })
      } else {
        setSendResult({
          status: "error",
          message: data?.error || "Slanje nije uspjelo.",
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
          message: "Slanje je zaustavljeno. Već poslani e-mailovi i tokeni su sačuvani.",
        })
      } else {
        setSendResult({
          status: "error",
          message: error.message || "Greška u komunikaciji s poslužiteljem.",
        })
      }
    } finally {
      sendAbortRef.current = null
      setIsSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] sm:max-w-[1320px] max-h-[92vh] overflow-y-auto p-0 rounded-2xl border border-border shadow-2xl">
        <DialogHeader className="bg-[#1E3A5F] text-white px-6 py-5 border-b-2 border-[#D97706] rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#D97706]/20 border border-[#D97706]/40 flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5 text-[#FEFCE8]" />
            </div>
            <div>
              <DialogTitle className="font-serif text-lg font-bold text-white tracking-tight">
                Zamolba članovima za dopunu podataka (s PDF evidencijskim listom u privitku)
              </DialogTitle>
              <DialogDescription className="text-xs text-[#F8FAFC]">
                Standardizirani HRD predložak (#1E3A5F / #7C2D12 / #D97706) sa službenim potpisom, osobnim linkom i PDF privitkom.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 md:p-6 space-y-5">
          {(sendProgress.active || sendProgress.status !== "idle") && (
            <EmailSendProgressBanner
              progress={sendProgress}
              onCancel={() => sendAbortRef.current?.abort()}
              title="Brojač slanja zamolbi za dopunu podataka"
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

          {/* 1. Odabir polja koja se provjeravaju */}
          <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
              1. Koja polja provjeravamo kod članova (ako su prazna, ulaze u popis za dopunu):
            </Label>
            <div className="flex flex-wrap gap-2">
              {MEMBER_CHECKABLE_FIELDS.map((field) => {
                const checked = selectedFieldKeys.includes(field.key)
                return (
                  <label
                    key={field.key}
                    className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs cursor-pointer transition-colors ${
                      checked
                        ? "border-primary bg-primary/10 text-foreground font-medium"
                        : "border-border bg-background text-muted-foreground"
                    }`}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleFieldKey(field.key)}
                    />
                    <span>{field.label}</span>
                  </label>
                )
              })}
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.05fr_1fr]">
            {/* LIJEVO: Popis članova za odabir */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-3 flex flex-col">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    2. Odaberite članove ({selectedMemberIds.length} odabrano)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={selectAllVisible}>
                    Označi sve prikazane ({filteredList.length})
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={clearSelection}>
                    Očisti
                  </Button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Pretraži člana po imenu, emailu ili matici..."
                    className="pl-8 h-9 text-xs"
                  />
                </div>
                <label className="inline-flex items-center gap-2 rounded-lg border border-border px-3 h-9 text-xs cursor-pointer bg-background shrink-0">
                  <Checkbox
                    checked={onlyMissingFilter}
                    onCheckedChange={(v) => setOnlyMissingFilter(v === true)}
                  />
                  <span>Samo kojima nedostaju podaci</span>
                </label>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: "all", label: "Svi" },
                  { id: "not_sent", label: "Nije poslano" },
                  { id: "sent_not_viewed", label: "Poslano · nije pogledao" },
                  { id: "viewed_not_submitted", label: "Pogledao · nije predao" },
                  { id: "submitted", label: "Predao podatke" },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setStageFilter(f.id as any)}
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

              <div className="border border-border rounded-xl overflow-y-auto max-h-[380px] divide-y divide-border">
                {filteredList.length > 0 ? (
                  filteredList.map(({ member, missing }) => {
                    const isChecked = selectedMemberIds.includes(member.id)
                    const isPreview = previewEntry?.member.id === member.id
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
                            <Badge
                              variant="outline"
                              className={
                                missing.length > 0
                                  ? "border-red-200 bg-red-50 text-red-700 text-[10px] shrink-0"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] shrink-0"
                              }
                            >
                              {missing.length > 0 ? `Nedostaje: ${missing.length}` : "Potpuno"}
                            </Badge>
                          </div>
                          <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="truncate">{member.email}</span>
                            {member.dataFormSubmittedAt ? (
                              <span className="text-emerald-700 font-semibold">
                                ✓ Predao: {formatDateTimeDMY(member.dataFormSubmittedAt)}
                              </span>
                            ) : member.dataFormViewedAt ? (
                              <span className="text-blue-700 font-semibold">
                                👁 Pogledao: {formatDateTimeDMY(member.dataFormViewedAt)}
                              </span>
                            ) : member.lastMissingDataEmailAt ? (
                              <span className="text-amber-700 font-medium">
                                ✉ Poslano: {formatDateTimeDMY(member.lastMissingDataEmailAt)}
                              </span>
                            ) : (
                              <span className="text-slate-400">Nije još poslano</span>
                            )}
                          </div>
                          {missing.length > 0 && (
                            <p className="text-[11px] text-red-700/90 mt-1 line-clamp-2">
                              {missing.map((f) => f.label).join(", ")}
                            </p>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-[11px] shrink-0"
                          onClick={() => setPreviewMemberId(member.id)}
                          title="Prikaži kako izgleda personalizirani mail za ovog člana"
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

            {/* DESNO: Predložak i pregled uživo za odabranog člana */}
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                  3. Predložak poruke (varijable: {"{{name}}"}, {"{{missingFields}}"}, {"{{formLink}}"})
                </Label>
                <div className="space-y-1.5">
                  <Label htmlFor="missing-subject" className="text-xs">Predmet (Subject)</Label>
                  <Input
                    id="missing-subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="missing-body" className="text-xs">Tekst poruke</Label>
                  <Textarea
                    id="missing-body"
                    rows={6}
                    value={bodyText}
                    onChange={(e) => setBodyText(e.target.value)}
                    className="text-xs leading-relaxed"
                  />
                </div>
              </div>

              {previewEntry && (
                <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap px-1">
                    <div className="text-xs font-bold text-[#1E3A5F] flex items-center gap-1.5">
                      <Eye className="h-3.5 w-3.5 text-[#D97706]" />
                      Pregled standardiziranog HRD predloška za: {previewEntry.member.name}
                    </div>
                    <a
                      href={`/api/members/${previewEntry.member.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-[#E2E8F0] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#1E3A5F] hover:bg-[#FEFCE8]"
                    >
                      <FileDown className="h-3 w-3 text-[#7C2D12]" />
                      Preuzmi PDF privitak
                    </a>
                  </div>
                  <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] max-h-[420px] overflow-y-auto">
                    <div dangerouslySetInnerHTML={{ __html: previewHtmlResult.html }} />
                  </div>
                </div>
              )}
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
                {isSendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4 text-[#D97706]" />}
                Pošalji testni e-mail
              </Button>
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending || isSendingTest}>
                Zatvori
              </Button>
              <Button
                onClick={handleSend}
                disabled={isSending || isSendingTest || selectedMemberIds.length === 0 || !subject.trim() || !bodyText.trim()}
                className="gap-2 bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white"
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
                    Odobri i pošalji odabranim članovima ({selectedMemberIds.length})
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
