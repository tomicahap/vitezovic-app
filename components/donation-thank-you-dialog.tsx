"use client"

import * as React from "react"
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  HeartHandshake,
  Loader2,
  Mail,
  RotateCcw,
  Send,
  Sparkles,
} from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { CloseActionButton } from "@/components/ui/action-bar"
import { formatDateDMY, formatDateTimeDMY } from "@/lib/utils"

export interface DonationThankYouTarget {
  leadId?: number
  sentId?: number
}

interface DonorSummaryInfo {
  leadId?: number
  sentId?: number
  name: string
  entityType?: string
  contactPerson?: string
  email?: string
  donatedAmount: string
  donatedAt: string
  donationNote?: string
  thankYouSentAt?: string
  thankYouSentTo?: string
  thankYouCount?: number
}

interface DonationThankYouDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: DonationThankYouTarget | null
  defaultTestEmail?: string
  onSent?: () => void
}

export function DonationThankYouDialog({
  open,
  onOpenChange,
  target,
  defaultTestEmail = "",
  onSent,
}: DonationThankYouDialogProps) {
  const [loadingDraft, setLoadingDraft] = React.useState(false)
  const [donor, setDonor] = React.useState<DonorSummaryInfo | null>(null)
  const [hasGeminiKey, setHasGeminiKey] = React.useState(false)

  const [recipientEmail, setRecipientEmail] = React.useState("")
  const [contactPerson, setContactPerson] = React.useState("")
  const [subject, setSubject] = React.useState("")
  const [bodyText, setBodyText] = React.useState("")
  const [personalizationNote, setPersonalizationNote] = React.useState("")
  const [customAiInstruction, setCustomAiInstruction] = React.useState("")

  const [previewHtml, setPreviewHtml] = React.useState("")
  const [refreshingPreview, setRefreshingPreview] = React.useState(false)
  const [generatingAi, setGeneratingAi] = React.useState(false)

  const [testEmail, setTestEmail] = React.useState(defaultTestEmail)
  const [sendingTest, setSendingTest] = React.useState(false)
  const [testResultMsg, setTestResultMsg] = React.useState<{
    ok: boolean
    text: string
  } | null>(null)

  const [sendingReal, setSendingReal] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState("")

  const bodyTextareaRef = React.useRef<HTMLTextAreaElement | null>(null)
  const previewAbortRef = React.useRef<AbortController | null>(null)
  const previewTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const draftLoadedRef = React.useRef(false)

  React.useEffect(() => {
    if (defaultTestEmail && !testEmail) {
      setTestEmail(defaultTestEmail)
    }
  }, [defaultTestEmail, testEmail])

  const focusBodyAtStart = React.useCallback(() => {
    requestAnimationFrame(() => {
      const el = bodyTextareaRef.current
      if (!el) return
      try {
        el.focus()
        el.setSelectionRange(0, 0)
        el.scrollTop = 0
      } catch {}
    })
  }, [])

  const loadDraft = React.useCallback(async () => {
    if (!target?.leadId && !target?.sentId) return
    setLoadingDraft(true)
    setErrorMsg("")
    setTestResultMsg(null)
    draftLoadedRef.current = false

    try {
      const res = await fetch("/api/admin/mailcrawl/thank-you", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "draft",
          leadId: target.leadId,
          sentId: target.sentId,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Greška pri pripremi predloška zahvale.")
      }

      setDonor(data.donor || null)
      setHasGeminiKey(Boolean(data.hasGeminiKey))
      setRecipientEmail(data.donor?.email || "")
      setContactPerson(data.donor?.contactPerson || "")
      setSubject(data.subject || "")
      setBodyText(data.body || "")
      setPersonalizationNote(data.personalizationNote || "")
      setPreviewHtml(data.previewHtml || "")
      setCustomAiInstruction("")
      draftLoadedRef.current = true
      focusBodyAtStart()
    } catch (err: any) {
      setErrorMsg(err?.message || "Nije moguće učitati podatke donatora.")
    } finally {
      setLoadingDraft(false)
    }
  }, [target?.leadId, target?.sentId, focusBodyAtStart])

  React.useEffect(() => {
    if (open && (target?.leadId || target?.sentId)) {
      loadDraft()
    } else if (!open) {
      draftLoadedRef.current = false
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current)
      if (previewAbortRef.current) previewAbortRef.current.abort()
    }
  }, [open, target?.leadId, target?.sentId, loadDraft])

  // Debounced live HTML preview update when subject/body/contact changes
  React.useEffect(() => {
    if (!open || !draftLoadedRef.current || (!target?.leadId && !target?.sentId)) return
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current)

    previewTimerRef.current = setTimeout(async () => {
      if (previewAbortRef.current) previewAbortRef.current.abort()
      const controller = new AbortController()
      previewAbortRef.current = controller
      setRefreshingPreview(true)
      try {
        const res = await fetch("/api/admin/mailcrawl/thank-you", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            action: "preview",
            leadId: target?.leadId,
            sentId: target?.sentId,
            contactPerson,
            subject,
            body: bodyText,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok && data.ok && data.previewHtml) {
          setPreviewHtml(data.previewHtml)
        }
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          // ignore silent preview refresh failure
        }
      } finally {
        setRefreshingPreview(false)
      }
    }, 350)

    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current)
    }
  }, [open, target?.leadId, target?.sentId, contactPerson, subject, bodyText])

  const handleGenerateAi = async () => {
    if (!target?.leadId && !target?.sentId) return
    setGeneratingAi(true)
    setErrorMsg("")
    try {
      const res = await fetch("/api/admin/mailcrawl/thank-you", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_ai",
          leadId: target.leadId,
          sentId: target.sentId,
          contactPerson,
          customInstruction: customAiInstruction.trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "AI personalizacija zahvale nije uspjela.")
      }
      setSubject(data.subject || "")
      setBodyText(data.body || "")
      setPersonalizationNote(data.personalizationNote || "")
      if (data.previewHtml) setPreviewHtml(data.previewHtml)
      toast.success("Personalizirana zahvala je pripremljena.")
      focusBodyAtStart()
    } catch (err: any) {
      setErrorMsg(err?.message || "Greška pri generiranju zahvale.")
      toast.error(err?.message || "Greška pri AI generiranju.")
    } finally {
      setGeneratingAi(false)
    }
  }

  const handleSendTest = async () => {
    const cleanTest = testEmail.trim()
    if (!cleanTest || !cleanTest.includes("@")) {
      setTestResultMsg({ ok: false, text: "Unesite valjanu testnu e-mail adresu." })
      return
    }
    setSendingTest(true)
    setTestResultMsg(null)
    try {
      const res = await fetch("/api/admin/mailcrawl/thank-you", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_test",
          leadId: target?.leadId,
          sentId: target?.sentId,
          testEmail: cleanTest,
          contactPerson,
          subject,
          body: bodyText,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Slanje testnog maila nije uspjelo.")
      }
      setTestResultMsg({ ok: true, text: data.message || `Testni e-mail poslan na ${cleanTest}.` })
      toast.success(data.message || `Testni e-mail poslan na ${cleanTest}.`)
    } catch (err: any) {
      const msg = err?.message || "Greška pri slanju testnog maila."
      setTestResultMsg({ ok: false, text: msg })
      toast.error(msg)
    } finally {
      setSendingTest(false)
    }
  }

  const handleSendReal = async () => {
    const cleanEmail = recipientEmail.trim()
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg("Unesite valjanu e-mail adresu donatora prije slanja.")
      return
    }
    if (!subject.trim() || !bodyText.trim()) {
      setErrorMsg("Predmet i tekst zahvale ne smiju biti prazni.")
      return
    }

    setSendingReal(true)
    setErrorMsg("")
    try {
      const res = await fetch("/api/admin/mailcrawl/thank-you", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          leadId: target?.leadId,
          sentId: target?.sentId,
          recipientEmail: cleanEmail,
          contactPerson,
          subject: subject.trim(),
          body: bodyText.trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Slanje zahvale nije uspjelo.")
      }

      toast.success(data.message || `Personalizirana zahvala poslana na ${cleanEmail}!`)
      onOpenChange(false)
      onSent?.()
    } catch (err: any) {
      const msg = err?.message || "Greška pri slanju zahvale."
      setErrorMsg(msg)
      toast.error(msg)
    } finally {
      setSendingReal(false)
    }
  }

  const amountBadgeLabel = donor?.donatedAmount
    ? `${parseFloat(String(donor.donatedAmount).replace(",", ".")).toFixed(2).replace(".", ",")} EUR`
    : "Donacija"
  const dateBadgeLabel = donor?.donatedAt ? formatDateDMY(donor.donatedAt, donor.donatedAt) : ""

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1250px] w-[97vw] h-[92vh] max-h-[92vh] p-0 gap-0 flex flex-col overflow-hidden">
        {/* Službeno HRD zaglavlje modala */}
        <DialogHeader className="bg-[#1E3A5F] border-b-2 border-[#D97706] px-6 pr-14 py-4 text-white shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-start gap-3 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-white/10 border border-[#D97706]/60 flex items-center justify-center shrink-0">
                <HeartHandshake className="h-5 w-5 text-[#FEFCE8]" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="font-serif text-lg font-bold text-white leading-tight truncate">
                  Personalizirana zahvala za donaciju
                </DialogTitle>
                <DialogDescription className="text-xs text-[#F8FAFC]/85 mt-0.5 truncate">
                  {donor
                    ? `${donor.name} · ${amountBadgeLabel}${dateBadgeLabel ? ` · Datum uplate: ${dateBadgeLabel}` : ""}`
                    : "Priprema službenog e-maila zahvale donatoru"}
                </DialogDescription>
              </div>
            </div>

            {donor?.thankYouSentAt && (
              <Badge className="bg-emerald-700/90 text-white border border-emerald-300/40 text-[11px] shrink-0 self-start sm:self-center">
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                Zahvala poslana {Number(donor.thankYouCount || 1)}x ({formatDateDMY(donor.thankYouSentAt)})
              </Badge>
            )}
          </div>
        </DialogHeader>

        {/* Tijelo modala */}
        {loadingDraft ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-10 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-[#1E3A5F]" />
            <p className="text-sm font-medium">Priprema personaliziranog teksta zahvale…</p>
          </div>
        ) : (
          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-hidden bg-[#F2EFE9]/40">
            {/* Lijevi stupac: Uređivanje i test */}
            <div className="lg:col-span-6 p-5 overflow-y-auto space-y-4 border-b lg:border-b-0 lg:border-r border-[#E8E4DE] bg-white">
              {donor?.thankYouSentAt && (
                <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-950 flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <strong>Prethodno poslana zahvala:</strong> {formatDateTimeDMY(donor.thankYouSentAt)} na{" "}
                    <span className="font-mono">{donor.thankYouSentTo || donor.email}</span> (ukupno{" "}
                    {donor.thankYouCount || 1}x). Možete urediti poruku i poslati novu zahvalu.
                  </div>
                </div>
              )}

              {errorMsg && (
                <div className="rounded-xl border border-red-300 bg-red-50 px-3.5 py-2.5 text-xs text-red-900 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-[#1B2B36]">
                    Primatelj (E-mail adresa donatora) *
                  </label>
                  <Input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="npr. kontakt@tvrtka.hr ili ime@gmail.com"
                    className="font-mono text-base sm:text-xs"
                  />
                  {!recipientEmail && (
                    <p className="text-[11px] text-amber-800">
                      Ovaj donator još nema upisanu e-mail adresu — unesite je ovdje i automatski će se spremiti.
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-[#1B2B36]">
                    Kontakt osoba / oslovljavanje (opcionalno)
                  </label>
                  <Input
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="npr. Ana Kovačić ili ostavite prazno"
                    className="text-base sm:text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1 text-xs">
                <label className="font-semibold text-[#1B2B36]">Predmet poruke *</label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Predmet e-maila zahvale"
                  className="text-base sm:text-xs font-medium"
                />
              </div>

              {/* AI i brze kontrole */}
              <div className="rounded-xl border border-[#E8E4DE] bg-[#FBF9F6] p-3 space-y-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-[#7C2D12] flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-[#D97706]" />
                    Personalizacija zahvale
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={loadDraft}
                      disabled={generatingAi || loadingDraft}
                      className="h-7 px-2.5 text-[11px] bg-white"
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Zadani predložak
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleGenerateAi}
                      disabled={generatingAi}
                      className="h-7 px-2.5 text-[11px] border-[#D97706] text-[#7C2D12] bg-[#FEFCE8] hover:bg-amber-100"
                      title={
                        hasGeminiKey
                          ? "Generiraj novu personaliziranu zahvalu putem Gemini AI-ja"
                          : "Generiraj personalizirani predložak"
                      }
                    >
                      {generatingAi ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Pripremam…
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3 w-3 mr-1 text-[#D97706]" />
                          {hasGeminiKey ? "AI personalizacija" : "Prilagodi tekst"}
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {hasGeminiKey && (
                  <Input
                    value={customAiInstruction}
                    onChange={(e) => setCustomAiInstruction(e.target.value)}
                    placeholder="Opcionalna uputa za AI (npr. spomeni projekt digitalizacije župnih matica u Zagorju)..."
                    className="h-8 bg-white text-base sm:text-xs"
                  />
                )}

                {personalizationNote && (
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    {personalizationNote}
                  </p>
                )}
              </div>

              <div className="space-y-1 text-xs">
                <label className="font-semibold text-[#1B2B36]">
                  Tekst zahvale (službeni potpis s imenom, funkcijom i logotipom dodaje se automatski) *
                </label>
                <Textarea
                  ref={bodyTextareaRef}
                  rows={10}
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  className="text-base sm:text-xs leading-relaxed font-sans resize-y min-h-[210px]"
                  placeholder="Ovdje uredite personaliziranu zahvalu..."
                />
              </div>

              {/* Sigurni [TEST] odjeljak */}
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 space-y-2 text-xs">
                <div className="font-semibold text-[#1E3A5F]">
                  Testno slanje ([TEST] — bez upisa slanja u evidenciju donatora)
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="vasa.adresa@rodoslovlje.hr"
                    className="h-9 bg-white font-mono text-base sm:text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSendTest}
                    disabled={sendingTest || sendingReal}
                    className="h-9 px-4 rounded-full border-[#D97706] text-[#1E3A5F] hover:bg-[#FEFCE8] font-semibold shrink-0 gap-1.5"
                  >
                    {sendingTest ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Šaljem test…
                      </>
                    ) : (
                      <>
                        <Mail className="h-3.5 w-3.5 text-[#D97706]" />
                        Pošalji [TEST]
                      </>
                    )}
                  </Button>
                </div>
                {testResultMsg && (
                  <p
                    className={`text-[11px] font-medium ${
                      testResultMsg.ok ? "text-emerald-700" : "text-red-700"
                    }`}
                  >
                    {testResultMsg.text}
                  </p>
                )}
              </div>
            </div>

            {/* Desni stupac: Vizualni pregled uživo */}
            <div className="lg:col-span-6 flex flex-col min-h-[340px] bg-[#F8FAFC] overflow-hidden">
              <div className="px-4 py-2.5 border-b border-[#E2E8F0] bg-[#FBF9F6] flex items-center justify-between text-xs shrink-0">
                <span className="font-semibold text-[#1E3A5F] flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5 text-[#D97706]" />
                  Vizualni pregled službenog e-maila zahvale
                </span>
                {refreshingPreview && (
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Osvježavanje…
                  </span>
                )}
              </div>
              <div className="flex-1 min-h-0 p-2 sm:p-3 overflow-hidden">
                {previewHtml ? (
                  <iframe
                    title="Pregled e-mail zahvale za donaciju"
                    srcDoc={previewHtml}
                    className="w-full h-full rounded-xl border border-[#E2E8F0] bg-white shadow-xs"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                    Pregled poruke nije dostupan.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Podnožje modala */}
        <DialogFooter className="bg-[#FBF9F6] border-t-2 border-border px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <span className="text-[11px] text-muted-foreground">
            Službeni HRD predložak zahvale (potvrda iznosa i datuma, bez nove uplatnice)
          </span>
          <div className="flex items-center justify-end gap-2.5">
            <CloseActionButton
              label="Odustani"
              onClick={() => onOpenChange(false)}
              disabled={sendingReal}
            />
            <Button
              type="button"
              onClick={handleSendReal}
              disabled={loadingDraft || sendingReal || !recipientEmail.trim()}
              className="rounded-full min-h-10 px-6 bg-[#1E3A5F] hover:bg-[#162D4A] border border-[#D97706] text-white font-bold shadow-md gap-2"
            >
              {sendingReal ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Slanje zahvale…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 text-[#D97706]" />
                  {donor?.thankYouSentAt ? "Pošalji novu zahvalu" : "Pošalji zahvalu donatoru"}
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
