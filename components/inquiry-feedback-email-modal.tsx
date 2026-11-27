"use client"

import React, { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Eye,
  FlaskConical,
  Loader2,
  Mail,
  Send,
  Star,
  User,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { CloseActionButton, ModalActionFooter } from "@/components/ui/action-bar"
import { buildInquiryFeedbackEmail } from "@/lib/inquiry-feedback"
import { formatDateTimeDMY, buildClientSenderIdentity } from "@/lib/utils"
import type { ResearchInquiry } from "@/components/research-inquiries-tab"

interface InquiryFeedbackEmailModalProps {
  open: boolean
  inquiry: ResearchInquiry
  members: any[]
  user: any
  settings: any
  getAuthHeaders: (user: any) => Record<string, string>
  getActorPayload: (user: any) => any
  onClose: () => void
  onSentSuccess: (updatedFeedback?: any) => void
}

function extractEmail(raw?: string | null): string {
  if (!raw) return ""
  const m = String(raw).match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
  return m ? m[0].trim().toLowerCase() : ""
}

export function InquiryFeedbackEmailModal({
  open,
  inquiry,
  members,
  user,
  settings,
  getAuthHeaders,
  getActorPayload,
  onClose,
  onSentSuccess,
}: InquiryFeedbackEmailModalProps) {
  const [testEmail, setTestEmail] = useState("")
  const [sendingTest, setSendingTest] = useState(false)
  const [sending, setSending] = useState(false)
  const [testSuccessMsg, setTestSuccessMsg] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    if (open) {
      setTestEmail(user?.email || settings?.smtpFrom || "")
      setSendingTest(false)
      setSending(false)
      setTestSuccessMsg("")
      setError("")
    }
  }, [open, inquiry.id, user?.email, settings?.smtpFrom])

  const requesterEmail = useMemo(() => {
    if (inquiry.requester_email && String(inquiry.requester_email).trim()) {
      return String(inquiry.requester_email).trim()
    }
    return extractEmail(inquiry.requester_contact)
  }, [inquiry.requester_email, inquiry.requester_contact])

  const requesterBlocked = useMemo(() => {
    if (!requesterEmail) return false
    return (members || []).some(
      (m) =>
        m?.doNotContact &&
        m?.email &&
        String(m.email).trim().toLowerCase() === requesterEmail.toLowerCase()
    )
  }, [members, requesterEmail])

  const existingFeedback = (inquiry as any)?.feedback || null
  const alreadySubmitted = Boolean(existingFeedback?.submitted_at)
  const alreadySent = Boolean(existingFeedback?.sent_at)

  const previewEmail = useMemo(() => {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "https://rodoslovlje.hr"
    return buildInquiryFeedbackEmail({
      inquiry: {
        id: inquiry.id,
        subject: inquiry.subject,
        requesterName: inquiry.requester_name,
        researcherName: inquiry.assigned_to_name || null,
        inquiryDate: inquiry.inquiry_date || null,
      },
      surveyUrl: `${origin}/ocjena-istrazivanja/test-pregled`,
      settings,
      sender: buildClientSenderIdentity(user, members, settings),
      forBrowserPreview: true,
    })
  }, [inquiry.id, inquiry.subject, inquiry.requester_name, inquiry.assigned_to_name, inquiry.inquiry_date, settings, user])

  if (!open) return null

  const handleSendTest = async () => {
    if (!testEmail.trim() || !testEmail.includes("@")) {
      setError("Unesite valjanu testnu e-mail adresu.")
      return
    }
    setSendingTest(true)
    setError("")
    setTestSuccessMsg("")
    try {
      const res = await fetch("/api/projects/inquiries/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(user) },
        body: JSON.stringify({
          inquiryId: inquiry.id,
          isTest: true,
          testEmail: testEmail.trim(),
          actor: getActorPayload(user),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) {
        throw new Error(data.error || "Slanje testne ankete nije uspjelo.")
      }
      setTestSuccessMsg(data.message || `Testni e-mail poslan na ${testEmail.trim()}.`)
    } catch (e: any) {
      setError(e?.message || "Greška pri slanju testnog e-maila.")
    } finally {
      setSendingTest(false)
    }
  }

  const handleSendOfficial = async () => {
    if (!requesterEmail || requesterBlocked || alreadySubmitted || sending) return
    setSending(true)
    setError("")
    try {
      const res = await fetch("/api/projects/inquiries/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(user) },
        body: JSON.stringify({
          inquiryId: inquiry.id,
          isTest: false,
          actor: getActorPayload(user),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) {
        throw new Error(data.error || "Slanje ankete zadovoljstva nije uspjelo.")
      }
      toast.success(data.message || `Anketa zadovoljstva poslana je na ${requesterEmail}.`)
      onSentSuccess(data.feedback)
      onClose()
    } catch (e: any) {
      setError(e?.message || "Greška pri slanju ankete zadovoljstva.")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-background border border-border rounded-none sm:rounded-3xl shadow-2xl max-w-4xl w-full h-[100dvh] sm:h-auto sm:max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[#1E3A5F] border-b-2 border-[#D97706] text-white px-4 py-4 sm:px-6 flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-white/10 border border-[#D97706]/50 flex items-center justify-center shrink-0 mt-0.5">
              <Star className="h-5 w-5 text-[#FEFCE8]" />
            </div>
            <div className="min-w-0">
              <h3 className="font-serif text-lg sm:text-xl font-bold leading-tight">
                Provjera zadovoljstva naručitelja — Predmet #{inquiry.id}
              </h3>
              <p className="text-xs text-[#F8FAFC]/90 mt-1 truncate">
                {inquiry.subject}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => !sending && onClose()}
            aria-label="Zatvori prozor"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white hover:bg-white/20 shrink-0 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Status primatelja */}
          <div className="rounded-2xl border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-xl bg-[#EFF5FB] border border-[#1E3A5F]/20 flex items-center justify-center shrink-0 text-[#1E3A5F]">
                <User className="h-4 w-4" />
              </div>
              <div className="text-xs space-y-0.5">
                <div className="font-bold text-[#1E3A5F]">
                  Primatelj (naručitelj istraživanja): {inquiry.requester_name}
                </div>
                <div className="font-mono text-[11px] text-muted-foreground">
                  {requesterEmail || "Naručitelj nema upisanu e-mail adresu"}
                </div>
                {alreadySent && !alreadySubmitted && existingFeedback?.sent_at && (
                  <div className="text-[11px] text-amber-800 font-medium pt-0.5">
                    Napomena: Anketa je već bila poslana {formatDateTimeDMY(existingFeedback.sent_at)} (još nije ispunjena). Ponovnim slanjem izdat će se nova jednokratna poveznica.
                  </div>
                )}
              </div>
            </div>

            {alreadySubmitted ? (
              <Badge className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs shrink-0">
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Već ispunjeno
              </Badge>
            ) : requesterBlocked ? (
              <Badge className="bg-red-600 text-white text-xs shrink-0">
                <Ban className="h-3.5 w-3.5 mr-1" /> Ne kontaktirati
              </Badge>
            ) : requesterEmail ? (
              <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs shrink-0">
                Spremno za slanje
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-amber-800 border-amber-300 bg-amber-50 shrink-0">
                Nedostaje e-mail
              </Badge>
            )}
          </div>

          {alreadySubmitted && (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3.5 text-xs text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
              <span>
                Naručitelj je već predao ocjenu zadovoljstva ({Number(existingFeedback?.average_rating || 0).toFixed(2)}/5 ★) dana{" "}
                {formatDateTimeDMY(existingFeedback?.submitted_at)}. Ponovno slanje nije potrebno.
              </span>
            </div>
          )}

          {/* Pregled HTML poruke */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-[#1E3A5F]">
              <span className="inline-flex items-center gap-1.5">
                <Eye className="h-4 w-4 text-[#D97706]" />
                Pregled službenog e-maila zahvale i poziva na ocjenjivanje
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                Predmet: {previewEmail.subject}
              </span>
            </div>
            <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 max-h-[420px] overflow-y-auto">
              <div dangerouslySetInnerHTML={{ __html: previewEmail.html }} />
            </div>
          </div>

          {/* Testno slanje */}
          <div className="rounded-2xl border border-[#1E3A5F]/20 bg-[#EFF5FB]/60 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <FlaskConical className="h-4 w-4 text-[#D97706] shrink-0" />
              <Input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="Testna e-mail adresa..."
                className="h-9 text-xs bg-white"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={sendingTest || sending}
              onClick={handleSendTest}
              className="rounded-full h-9 px-4 text-xs font-bold border-2 border-[#D97706] bg-white text-[#1E3A5F] hover:bg-[#FEFCE8] gap-1.5 shrink-0"
            >
              {sendingTest ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5 text-[#D97706]" />}
              {sendingTest ? "Šaljem test…" : "Pošalji testni e-mail"}
            </Button>
          </div>

          {testSuccessMsg && (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
              <span>{testSuccessMsg}</span>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-800 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <ModalActionFooter
          left={
            <span className="text-[11px] text-muted-foreground">
              Šalje se isključivo naručitelju s jednokratnom poveznicom (1–5 ★).
            </span>
          }
          right={
            <>
              <CloseActionButton
                label="Odustani"
                onClick={() => !sending && onClose()}
                disabled={sending}
              />
              <Button
                type="button"
                disabled={!requesterEmail || requesterBlocked || alreadySubmitted || sending || sendingTest}
                onClick={handleSendOfficial}
                className="rounded-full min-h-10 px-6 bg-[#1E3A5F] hover:bg-[#162D4A] text-white border border-[#D97706] font-bold shadow-md gap-2"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Slanje ankete…
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 text-[#D97706]" />
                    {alreadySent ? "Pošalji anketu ponovno" : "Pošalji provjeru zadovoljstva"}
                  </>
                )}
              </Button>
            </>
          }
        />
      </div>
    </div>
  )
}
