"use client"

import React, { useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  Archive,
  Ban,
  CheckCircle2,
  Eye,
  FlaskConical,
  Lock,
  Mail,
  RefreshCw,
  Send,
  ShieldAlert,
  User,
  UserCheck,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  CloseActionButton,
  FinishActionButton,
  ModalActionFooter,
} from "@/components/ui/action-bar"
import { SectionTabsBar } from "@/components/ui/section-tabs"
import { buildInquiryClosedEmail, INQUIRY_ARCHIVE_EMAIL } from "@/lib/inquiry-close-email"
import { buildClientSenderIdentity } from "@/lib/utils"
import type { ResearchInquiry } from "@/components/research-inquiries-tab"

export interface InquiryCloseDispatchResult {
  requester: {
    status: "sent" | "skipped_no_email" | "skipped_do_not_contact" | "error"
    to?: string | null
    channel?: string
    error?: string
  }
  researcher: {
    status: "sent" | "skipped_no_assignee" | "skipped_no_email" | "skipped_do_not_contact" | "error"
    name?: string | null
    to?: string | null
    channel?: string
    error?: string
  }
  archive?: {
    status: "sent" | "error"
    to: string
    channel?: string
    error?: string
  }
}

interface SimulationStep {
  title: string
  status: "ok" | "warn" | "error"
  detail: string
}

interface InquiryCloseCaseModalProps {
  open: boolean
  initialTab?: "confirm" | "preview" | "test"
  inquiry: ResearchInquiry
  members: any[]
  user: any
  settings: any
  getAuthHeaders: (user: any) => Record<string, string>
  getActorPayload: (user: any) => any
  onClose: () => void
  onClosedSuccess: (updatedInquiry: ResearchInquiry, dispatch?: InquiryCloseDispatchResult) => void
}

export function InquiryCloseCaseModal({
  open,
  initialTab = "confirm",
  inquiry,
  members,
  user,
  settings,
  getAuthHeaders,
  getActorPayload,
  onClose,
  onClosedSuccess,
}: InquiryCloseCaseModalProps) {
  const [activeTab, setActiveTab] = useState<"confirm" | "preview" | "test">(initialTab)
  const [previewRole, setPreviewRole] = useState<"requester" | "researcher" | "archive">("requester")
  const [closingNote, setClosingNote] = useState("")
  const [confirmedLock, setConfirmedLock] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [closeError, setCloseError] = useState("")

  // Test & simulation state
  const [testEmail, setTestEmail] = useState("")
  const [testTarget, setTestTarget] = useState<"all" | "requester" | "researcher" | "archive">("all")
  const [isTesting, setIsTesting] = useState(false)
  const [testError, setTestError] = useState("")
  const [simulationReport, setSimulationReport] = useState<{
    testEmail: string
    steps: SimulationStep[]
  } | null>(null)

  useEffect(() => {
    if (open) {
      setActiveTab(initialTab)
      setPreviewRole("requester")
      setClosingNote("")
      setConfirmedLock(false)
      setIsClosing(false)
      setCloseError("")
      setTestEmail(user?.email || settings?.smtpFrom || "")
      setTestTarget("all")
      setIsTesting(false)
      setTestError("")
      setSimulationReport(null)
    }
  }, [open, initialTab, inquiry.id, user?.email, settings?.smtpFrom])

  const assignedMember = useMemo(() => {
    return (
      (members || []).find(
        (m) =>
          (inquiry.assigned_to_id && Number(m.id) === Number(inquiry.assigned_to_id)) ||
          (inquiry.assigned_to_name &&
            String(m.name || "").trim().toLowerCase() ===
              String(inquiry.assigned_to_name).trim().toLowerCase())
      ) || null
    )
  }, [members, inquiry.assigned_to_id, inquiry.assigned_to_name])

  const requesterEmail = useMemo(() => {
    if (inquiry.requester_email && String(inquiry.requester_email).trim()) {
      return String(inquiry.requester_email).trim()
    }
    const m = String(inquiry.requester_contact || "").match(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
    )
    return m ? m[0].trim().toLowerCase() : ""
  }, [inquiry.requester_email, inquiry.requester_contact])

  const researcherName = assignedMember?.name || inquiry.assigned_to_name || ""
  const researcherEmail = assignedMember?.email ? String(assignedMember.email).trim() : ""
  const researcherDoNotContact = Boolean(assignedMember?.doNotContact)

  const requesterBlockedByMember = useMemo(() => {
    if (!requesterEmail) return false
    return (members || []).some(
      (m) =>
        m?.doNotContact &&
        m?.email &&
        String(m.email).trim().toLowerCase() === requesterEmail.toLowerCase()
    )
  }, [members, requesterEmail])

  const previewEmail = useMemo(() => {
    return buildInquiryClosedEmail({
      role: previewRole,
      inquiry: {
        id: inquiry.id,
        subject: inquiry.subject,
        requesterName: inquiry.requester_name,
        requesterContact: inquiry.requester_contact || null,
        requesterEmail: requesterEmail || null,
        researcherName: researcherName || "Dodijeljeni istraživač",
        researcherEmail: researcherEmail || null,
        inquiryDate: inquiry.inquiry_date,
        closedDate: new Date(),
        closedByName: user?.name || "Administrator",
        closingNote: closingNote.trim() || null,
        actionsTaken: inquiry.actions_taken || null,
        collectedDocuments: inquiry.collected_documents || null,
        researchResult: inquiry.research_result || null,
        attachmentsCount: Array.isArray(inquiry.attachments) ? inquiry.attachments.length : 0,
      },
      settings,
      sender: buildClientSenderIdentity(user, members, settings),
      forBrowserPreview: true,
    })
  }, [
    previewRole,
    inquiry.id,
    inquiry.subject,
    inquiry.requester_name,
    inquiry.inquiry_date,
    requesterEmail,
    researcherName,
    researcherEmail,
    user,
    closingNote,
    settings,
    inquiry.requester_contact,
    inquiry.actions_taken,
    inquiry.collected_documents,
    inquiry.research_result,
    inquiry.attachments,
  ])

  if (!open) return null

  const handleConfirmClose = async () => {
    if (!confirmedLock || isClosing) return
    setIsClosing(true)
    setCloseError("")
    try {
      const res = await fetch("/api/projects/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(user) },
        body: JSON.stringify({
          action: "close-case",
          id: inquiry.id,
          confirmedPermanentLock: true,
          closingNote: closingNote.trim(),
          formUpdates: inquiry,
          actor: getActorPayload(user),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) {
        throw new Error(data.error || "Greška pri zatvaranju predmeta.")
      }
      onClosedSuccess(data.inquiry || { ...inquiry, status: "completed" }, data.emailDispatch)
    } catch (e: any) {
      setCloseError(e?.message || "Greška pri zatvaranju predmeta.")
    } finally {
      setIsClosing(false)
    }
  }

  const handleRunTest = async () => {
    if (!testEmail.trim() || !testEmail.includes("@")) {
      setTestError("Unesite valjanu e-mail adresu na koju želite primiti testne obavijesti.")
      return
    }
    setIsTesting(true)
    setTestError("")
    setSimulationReport(null)
    try {
      const res = await fetch("/api/projects/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(user) },
        body: JSON.stringify({
          action: "close-case",
          id: inquiry.id,
          isTest: true,
          testEmail: testEmail.trim(),
          testTarget,
          closingNote: closingNote.trim(),
          formUpdates: inquiry,
          actor: getActorPayload(user),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) {
        throw new Error(data.error || "Testno slanje nije uspjelo.")
      }
      setSimulationReport({
        testEmail: data.testEmail || testEmail.trim(),
        steps: data.steps || [],
      })
    } catch (e: any) {
      setTestError(e?.message || "Greška pri testiranju zatvaranja predmeta.")
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-background border border-border rounded-none sm:rounded-3xl shadow-2xl max-w-4xl w-full h-[100dvh] sm:h-auto sm:max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header u službenoj HRD paleti */}
        <div className="bg-[#1E3A5F] border-b-2 border-[#D97706] text-white px-4 py-4 sm:px-6 flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-white/10 border border-[#D97706]/50 flex items-center justify-center shrink-0 mt-0.5">
              <Lock className="h-5 w-5 text-[#FEFCE8]" />
            </div>
            <div className="min-w-0">
              <h3 className="font-serif text-lg sm:text-xl font-bold leading-tight">
                Zatvaranje i zaključavanje predmeta #{inquiry.id}
              </h3>
              <p className="text-xs text-[#F8FAFC]/90 mt-1 truncate">
                {inquiry.subject}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => !isClosing && onClose()}
            aria-label="Zatvori prozor"
            title="Zatvori prozor"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white hover:bg-white/20 shrink-0 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Sekcije modala */}
        <SectionTabsBar
          variant="detail"
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "confirm" | "preview" | "test")}
          ariaLabel="Koraci zatvaranja istraživačkog predmeta"
          tabs={[
            {
              id: "confirm",
              label: "Potvrda i primatelji",
              shortLabel: "Potvrda",
              icon: ShieldAlert,
            },
            {
              id: "preview",
              label: "Pregled e-mailova",
              shortLabel: "E-mailovi",
              icon: Eye,
              count: 3,
            },
            {
              id: "test",
              label: "Test i simulacija",
              shortLabel: "Test",
              icon: FlaskConical,
              hasDot: Boolean(simulationReport),
            },
          ]}
        />

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {activeTab === "confirm" && (
            <>
              {/* Upozorenje o trajnom zaključavanju */}
              <div className="rounded-2xl border-2 border-red-300 bg-red-50/90 p-4 flex items-start gap-3 text-red-950 shadow-2xs">
                <ShieldAlert className="h-6 w-6 text-red-700 shrink-0 mt-0.5" />
                <div className="space-y-1.5 text-xs leading-relaxed">
                  <p className="font-bold text-sm text-red-900">
                    Važno upozorenje: Nakon zatvaranja više nije moguće nastaviti raditi na ovom predmetu!
                  </p>
                  <p>
                    Zatvoreni predmet postaje <strong>trajno zaključan samo za uvid</strong> — naknadno uređivanje bilješki, dodavanje datoteka ili slanje novih poruka unutar ovog predmeta neće biti moguće.
                  </p>
                  <p>
                    Odmah po zatvaranju sustav automatski šalje službeni e-mail <strong>istraživaču</strong>, <strong>osobi na koju se istraživanje odnosilo</strong> (s uputom da u slučaju potrebe pošalje novi upit) te <strong>arhivski zapis na {INQUIRY_ARCHIVE_EMAIL}</strong>.
                  </p>
                </div>
              </div>

              {/* Primatelji automatskih e-mailova */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Podnositelj */}
                <div className="rounded-2xl border border-border bg-card p-4 space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1E3A5F]">
                      <User className="h-4 w-4 text-sky-700" />
                      1. Osoba koja je poslala upit
                    </span>
                    {requesterBlockedByMember ? (
                      <Badge className="bg-red-600 text-white text-[10px]">
                        <Ban className="h-3 w-3 mr-1" /> Ne kontaktirati
                      </Badge>
                    ) : requesterEmail ? (
                      <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px]">
                        Šalje se automatski
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-amber-800 border-amber-300 bg-amber-50">
                        Nema e-mail adrese
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs space-y-0.5">
                    <div className="font-semibold text-foreground">{inquiry.requester_name}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">
                      {requesterEmail || "E-mail adresa nije upisana"}
                    </div>
                  </div>
                </div>

                {/* Istraživač */}
                <div className="rounded-2xl border border-border bg-card p-4 space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1E3A5F]">
                      <UserCheck className="h-4 w-4 text-amber-700" />
                      2. Dodijeljeni istraživač
                    </span>
                    {!researcherName ? (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        Nije dodijeljen
                      </Badge>
                    ) : researcherDoNotContact ? (
                      <Badge className="bg-red-600 text-white text-[10px]">
                        <Ban className="h-3 w-3 mr-1" /> Ne kontaktirati
                      </Badge>
                    ) : researcherEmail ? (
                      <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px]">
                        Šalje se automatski
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-amber-800 border-amber-300 bg-amber-50">
                        Nema e-mail adrese
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs space-y-0.5">
                    <div className="font-semibold text-foreground">
                      {researcherName || "Nitko nije dodijeljen ovom predmetu"}
                    </div>
                    <div className="font-mono text-[11px] text-muted-foreground">
                      {researcherName
                        ? researcherEmail || "Član nema upisanu e-mail adresu"
                        : "Obavijest istraživaču se neće slati."}
                    </div>
                  </div>
                </div>

                {/* Arhiva Društva */}
                <div className="rounded-2xl border border-border bg-card p-4 space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1E3A5F]">
                      <Archive className="h-4 w-4 text-emerald-700" />
                      3. Arhiva Društva
                    </span>
                    <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px]">
                      Šalje se automatski
                    </Badge>
                  </div>
                  <div className="text-xs space-y-0.5">
                    <div className="font-semibold text-foreground">HRD Arhiva predmeta</div>
                    <div className="font-mono text-[11px] text-muted-foreground">
                      {INQUIRY_ARCHIVE_EMAIL}
                    </div>
                  </div>
                </div>
              </div>

              {/* Opcionalna završna napomena za e-mail */}
              <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
                <Label htmlFor="closing-note-input" className="text-xs font-bold text-foreground">
                  Dodatna završna napomena u oba e-maila (opcionalno)
                </Label>
                <Textarea
                  id="closing-note-input"
                  rows={3}
                  placeholder="npr. Svi pronađeni dokumenti predani su stranci i arhivirani u predmetu..."
                  value={closingNote}
                  onChange={(e) => setClosingNote(e.target.value)}
                  className="text-xs bg-background"
                />
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <p className="text-[11px] text-muted-foreground">
                    Prije konačnog zatvaranja možete pregledati izgled e-mailova ili pokrenuti siguran test.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveTab("preview")}
                      className="rounded-full h-8 text-xs gap-1.5 border-[#1E3A5F]/30 text-[#1E3A5F]"
                    >
                      <Eye className="h-3.5 w-3.5" /> Pregledaj e-mailove
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveTab("test")}
                      className="rounded-full h-8 text-xs gap-1.5 border-[#D97706] text-[#1E3A5F] hover:bg-[#FEFCE8]"
                    >
                      <FlaskConical className="h-3.5 w-3.5 text-[#D97706]" /> Testiraj zatvaranje
                    </Button>
                  </div>
                </div>
              </div>

              {/* Druga potvrda - obavezni checkbox */}
              <div
                className={`rounded-2xl border-2 p-4 transition-colors ${
                  confirmedLock
                    ? "border-emerald-500 bg-emerald-50/70"
                    : "border-amber-400 bg-amber-50/60"
                }`}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="confirm-permanent-lock"
                    checked={confirmedLock}
                    onCheckedChange={(v) => setConfirmedLock(v === true)}
                    className="mt-0.5 h-5 w-5 border-2 border-[#1E3A5F] data-[state=checked]:bg-emerald-700 data-[state=checked]:border-emerald-700"
                  />
                  <label
                    htmlFor="confirm-permanent-lock"
                    className="text-xs sm:text-sm font-semibold text-slate-900 cursor-pointer leading-relaxed select-none"
                  >
                    Potvrđujem zatvaranje predmeta #{inquiry.id} i razumijem da nakon zatvaranja više neće biti moguće nastaviti raditi na ovom predmetu te da će sustav automatski poslati obavijest istraživaču, podnositelju upita i arhivi Društva ({INQUIRY_ARCHIVE_EMAIL}).
                  </label>
                </div>
              </div>

              {closeError && (
                <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-xs font-semibold text-red-800 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{closeError}</span>
                </div>
              )}
            </>
          )}

          {activeTab === "preview" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <SectionTabsBar
                  variant="compact"
                  value={previewRole}
                  onValueChange={(v) => setPreviewRole(v as "requester" | "researcher" | "archive")}
                  ariaLabel="Odabir primatelja za pregled e-maila"
                  tabs={[
                    {
                      id: "requester",
                      label: "Mail za podnositelja",
                      shortLabel: "Podnositelj",
                      icon: User,
                    },
                    {
                      id: "researcher",
                      label: "Mail za istraživača",
                      shortLabel: "Istraživač",
                      icon: UserCheck,
                    },
                    {
                      id: "archive",
                      label: "Mail za arhivu",
                      shortLabel: "Arhiva",
                      icon: Archive,
                    },
                  ]}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab("test")}
                  className="rounded-full h-9 text-xs gap-1.5 border-[#D97706] text-[#1E3A5F] hover:bg-[#FEFCE8]"
                >
                  <FlaskConical className="h-3.5 w-3.5 text-[#D97706]" />
                  Pošalji testni primjerak
                </Button>
              </div>

              <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden text-xs">
                <div className="bg-muted/40 border-b border-border p-3 space-y-1 font-mono text-[11px]">
                  <div className="flex gap-2">
                    <span className="w-20 text-muted-foreground shrink-0">Primatelj:</span>
                    <span className="font-medium text-foreground">
                      {previewRole === "requester"
                        ? `${inquiry.requester_name} <${requesterEmail || "nema e-mail adrese"}>`
                        : previewRole === "researcher"
                        ? `${researcherName || "Nije dodijeljen"} <${researcherEmail || "nema e-mail adrese"}>`
                        : `HRD Arhiva <${INQUIRY_ARCHIVE_EMAIL}>`}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="w-20 text-muted-foreground shrink-0">Predmet:</span>
                    <span className="font-bold text-foreground">{previewEmail.subject}</span>
                  </div>
                </div>
                <div className="p-3 bg-[#F8FAFC] overflow-x-auto">
                  <div dangerouslySetInnerHTML={{ __html: previewEmail.html }} />
                </div>
              </div>
            </div>
          )}

          {activeTab === "test" && (
            <div className="space-y-4">
              <div className="rounded-2xl border-2 border-[#1E3A5F]/20 bg-[#EFF5FB]/70 p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold text-[#1E3A5F]">
                  <FlaskConical className="h-4 w-4 text-[#D97706]" />
                  <span>Sigurno testiranje zatvaranja (Simulacija bez zatvaranja predmeta)</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Ovdje možete provjeriti kako zatvaranje funkcionira u praksi: sustav će poslati stvarne <strong>[TEST]</strong> e-mailove isključivo na Vašu testnu adresu i prikazati korak-po-korak izvještaj što bi se dogodilo pri stvarnom zatvaranju. <strong>Predmet #{inquiry.id} ostat će otvoren i nepromijenjen</strong>, a stvarni primatelji neće dobiti poruku.
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="close-test-email" className="text-xs font-bold">
                      Vaša e-mail adresa za test:
                    </Label>
                    <Input
                      id="close-test-email"
                      type="email"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      placeholder="ime@domena.hr"
                      className="text-xs bg-background"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Što želite testirati:</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { id: "all", label: "Sva 3 e-maila (3)" },
                        { id: "requester", label: "Samo podnositelj" },
                        { id: "researcher", label: "Samo istraživač" },
                        { id: "archive", label: "Samo arhiva" },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setTestTarget(opt.id as any)}
                          className={`rounded-xl px-3 py-2 text-xs font-semibold border transition-all ${
                            testTarget === opt.id
                              ? "bg-[#1E3A5F] text-white border-[#CEA369]"
                              : "bg-white text-[#1E3A5F] border-border hover:bg-[#EFF5FB]"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {testError && (
                  <div className="rounded-xl border border-red-300 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-800 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{testError}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border">
                  <span className="text-[11px] text-muted-foreground">
                    Poruke stižu s prefiksom <code className="font-mono font-bold">[TEST]</code> na gore upisanu adresu.
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isTesting}
                    onClick={handleRunTest}
                    className="rounded-full h-10 px-5 font-bold border-2 border-[#D97706] text-[#1E3A5F] bg-white hover:bg-[#FEFCE8] gap-2"
                  >
                    {isTesting ? (
                      <RefreshCw className="h-4 w-4 animate-spin text-[#D97706]" />
                    ) : (
                      <Send className="h-4 w-4 text-[#D97706]" />
                    )}
                    {isTesting
                      ? "Šaljem testne obavijesti…"
                      : "Pokreni test zatvaranja i pošalji [TEST] e-mailove"}
                  </Button>
                </div>
              </div>

              {simulationReport && (
                <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50/60 p-4 space-y-3 animate-in fade-in">
                  <div className="flex items-center gap-2 text-sm font-bold text-emerald-950">
                    <CheckCircle2 className="h-5 w-5 text-emerald-700" />
                    <span>
                      Simulacija uspješno izvršena — testne poruke poslane su na {simulationReport.testEmail}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {simulationReport.steps.map((step, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-border bg-white px-3.5 py-2.5 text-xs flex items-start gap-2.5 shadow-2xs"
                      >
                        <span
                          className={`mt-0.5 h-2.5 w-2.5 rounded-full shrink-0 ${
                            step.status === "ok"
                              ? "bg-emerald-600"
                              : step.status === "warn"
                              ? "bg-amber-500"
                              : "bg-red-600"
                          }`}
                        />
                        <div className="space-y-0.5">
                          <div className="font-bold text-slate-900">{step.title}</div>
                          <div className="text-slate-700 leading-relaxed">{step.detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Podnožje */}
        <ModalActionFooter
          left={
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <Mail className="h-3.5 w-3.5 text-[#1E3A5F]" />
              {confirmedLock
                ? "Druga potvrda je aktivna — spremno za trajno zatvaranje."
                : "Za zatvaranje označite potvrdni okvir na kartici „Potvrda i primatelji”."}
            </span>
          }
          right={
            <>
              <CloseActionButton
                label="Odustani"
                onClick={() => !isClosing && onClose()}
                disabled={isClosing}
              />
              <FinishActionButton
                label="Potvrdi i trajno zatvori predmet"
                loading={isClosing}
                loadingLabel="Zatvaranje i slanje obavijesti…"
                disabled={!confirmedLock || isClosing}
                onClick={handleConfirmClose}
              />
            </>
          }
        />
      </div>
    </div>
  )
}
