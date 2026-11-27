"use client"

import * as React from "react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CloseActionButton } from "@/components/ui/action-bar"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Mail, Send, CheckCircle2, AlertCircle, Clock, Cake, Eye, Loader2, Ban } from "lucide-react"
import { Member, useMembers } from "@/contexts/members-context"
import { useSettings } from "@/contexts/settings-context"
import { useAuth } from "@/contexts/auth-context"
import { formatDateDMY, formatDateTimeDMY, buildClientSenderIdentity } from "@/lib/utils"
import { buildHrdMasterEmail, escapeHtml } from "@/lib/hrd-email-system"

interface BirthdayEmailDialogProps {
  member: Member | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (sentAt: string) => void
}

export function BirthdayEmailDialog({
  member,
  open,
  onOpenChange,
  onSuccess,
}: BirthdayEmailDialogProps) {
  const { settings } = useSettings()
  const { members, updateMember } = useMembers()
  const { user } = useAuth()

  const [subject, setSubject] = React.useState("")
  const [bodyText, setBodyText] = React.useState("")
  const [testEmailAddress, setTestEmailAddress] = React.useState("")
  const [isSending, setIsSending] = React.useState(false)
  const [isSendingTest, setIsSendingTest] = React.useState(false)
  const [sendResult, setSendResult] = React.useState<{
    status: "idle" | "success" | "error"
    message?: string
    sentAt?: string
  }>({ status: "idle" })

  React.useEffect(() => {
    if (open && member) {
      const defaultSubject =
        settings.birthdayEmailSubject ||
        'Sretan rođendan želi Vam HRD "Pavao Ritter Vitezović"!'
      const defaultBody =
        settings.birthdayEmailBody ||
        'Poštovani/a {{name}},\n\nU ime Hrvatskog rodoslovnog društva "Pavao Ritter Vitezović" od srca Vam želimo sretan rođendan, puno zdravlja, radosti i uspjeha u daljnjem radu i istraživanju!\n\nSrdačan pozdrav,\nHRD "Pavao Ritter Vitezović"'

      setSubject(
        defaultSubject
          .replace(/{{name}}/gi, member.name)
          .replace(/{{ime}}/gi, member.name)
      )
      setBodyText(
        defaultBody
          .replace(/{{name}}/gi, member.name)
          .replace(/{{ime}}/gi, member.name)
          .replace(/{{email}}/gi, member.email || "")
      )
      setTestEmailAddress(user?.email || settings.smtpFrom || "")
      setSendResult({ status: "idle" })
    }
  }, [open, member, settings.birthdayEmailSubject, settings.birthdayEmailBody, user?.email, settings.smtpFrom])

  if (!member) return null

  const previewBuilt = buildHrdMasterEmail({
    templateType: "obavijest_clanovima",
    title: subject || `Sretan rođendan, ${member.name}!`,
    bodyTextOrHtml: bodyText,
    infoBoxTitle: `Sretan rođendan, ${member.name}!`,
    infoBoxHtml: `<div>Hrvatsko rodoslovno društvo „Pavao Ritter Vitezović” želi Vam sve najbolje povodom Vašeg rođendana${
      member.birthDate ? ` (${escapeHtml(formatDateDMY(member.birthDate, member.birthDate))})` : ""
    }!</div>`,
    settings,
    sender: buildClientSenderIdentity(user, members, settings),
    forBrowserPreview: true,
  })

  const handleSendTest = async () => {
    setIsSendingTest(true)
    setSendResult({ status: "idle" })
    try {
      const response = await fetch("/api/admin/notifications/birthday", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: member.id,
          customSubject: subject,
          customBody: bodyText,
          testOnly: true,
          testEmail: testEmailAddress.trim() || user?.email || settings.smtpFrom,
          sender: buildClientSenderIdentity(user, members, settings),
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

  const handleApproveAndSend = async () => {
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
        message: "Član nema unesenu email adresu. Molimo prvo unesite email adresu u podacima člana.",
      })
      return
    }

    setIsSending(true)
    setSendResult({ status: "idle" })

    try {
      const response = await fetch("/api/admin/notifications/birthday", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: member.id,
          customSubject: subject,
          customBody: bodyText,
          sender: buildClientSenderIdentity(user, members, settings),
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        const sentAt = data.sentAt || new Date().toISOString()
        updateMember(member.id, { lastBirthdayEmailAt: sentAt })
        onSuccess?.(sentAt)
        toast.success(
          data.message || `Rođendanska čestitka je uspješno poslana na ${member.email}!`
        )
        onOpenChange(false)
      } else {
        setSendResult({
          status: "error",
          message: data.error || "Slanje e-pošte nije uspjelo.",
        })
      }
    } catch (error: any) {
      setSendResult({
        status: "error",
        message: error.message || "Greška u komunikaciji s poslužiteljem.",
      })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[94vw] sm:max-w-4xl max-h-[92vh] overflow-y-auto p-0 rounded-2xl border border-border shadow-2xl">
        {/* Header */}
        <DialogHeader className="bg-[#1E3A5F] text-white px-6 py-5 border-b-2 border-[#D97706] rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#D97706]/20 border border-[#D97706]/50 flex items-center justify-center shrink-0">
              <Cake className="h-5 w-5 text-[#FEFCE8]" />
            </div>
            <div>
              <DialogTitle className="font-serif text-lg font-bold text-white tracking-tight">
                Pregled i odobrenje rođendanske čestitke
              </DialogTitle>
              <DialogDescription className="text-xs text-[#F8FAFC]">
                Standardizirani HRD predložak (#1E3A5F / #7C2D12 / #D97706) sa službenim potpisom u podnožju.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-5">
          {/* Status rezultata slanja */}
          {sendResult.status === "success" && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-1 text-sm">
                <p className="font-bold text-emerald-900">{sendResult.message}</p>
                {sendResult.sentAt && (
                  <p className="text-xs text-emerald-700 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Evidentirano u kartonu člana: {formatDateTimeDMY(sendResult.sentAt)}
                  </p>
                )}
              </div>
            </div>
          )}

          {sendResult.status === "error" && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-1 text-sm">
                <p className="font-bold text-red-900">{sendResult.message}</p>
                <p className="text-xs text-red-700">
                  Provjerite SMTP postavke poslužitelja u Postavkama sustava ili ispravnost email adrese.
                </p>
              </div>
            </div>
          )}

          {member.doNotContact && (
            <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4 flex items-start gap-3">
              <Ban className="h-5 w-5 text-red-700 shrink-0 mt-0.5" />
              <div className="space-y-1 text-sm">
                <p className="font-bold text-red-900">
                  Zabrana kontakta — Na izričitu napomenu član je zatražio da ga se ne kontaktira.
                </p>
                <p className="text-xs text-red-800">
                  Slanje rođendanskih čestitki niti bilo kakvih drugih poruka ovom članu nije dopušteno.
                </p>
              </div>
            </div>
          )}

          {/* Evidencija prethodnog slanja */}
          {member.lastBirthdayEmailAt && sendResult.status !== "success" && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 flex items-center justify-between gap-3 text-xs text-amber-900">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-700 shrink-0" />
                <span>
                  Zadnja rođendanska čestitka evidentirana je:{" "}
                  <strong>{formatDateTimeDMY(member.lastBirthdayEmailAt)}</strong>
                </span>
              </div>
              <Badge variant="outline" className="border-amber-300 text-amber-800 bg-white">
                Evidentirano
              </Badge>
            </div>
          )}

          {/* Podaci primatelja */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-border bg-muted/30 p-4">
            <div>
              <span className="text-[11px] font-medium text-muted-foreground block">Primatelj</span>
              <span className="text-sm font-semibold text-foreground">{member.name}</span>
            </div>
            <div>
              <span className="text-[11px] font-medium text-muted-foreground block">Email adresa</span>
              {member.email ? (
                <span className="text-sm font-mono font-semibold text-foreground">{member.email}</span>
              ) : (
                <span className="text-sm font-semibold text-red-600">Nema unesenu email adresu!</span>
              )}
            </div>
          </div>

          {/* Uređivanje predloška */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="birthday-subject" className="text-xs font-semibold">
                Predmet (Subject)
              </Label>
              <Input
                id="birthday-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Sretan rođendan želi Vam HRD..."
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="birthday-body" className="text-xs font-semibold">
                Tekst čestitke
              </Label>
              <Textarea
                id="birthday-body"
                rows={6}
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                className="text-sm leading-relaxed"
              />
            </div>
          </div>

          {/* Pregled kako će email izgledati */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <Eye className="h-3.5 w-3.5" />
              Pregled standardiziranog HRD predloška prije odobrenja i slanja
            </div>
            <div className="rounded-xl border border-[#E2E8F0] overflow-hidden bg-[#F8FAFC] p-2">
              <div dangerouslySetInnerHTML={{ __html: previewBuilt.html }} />
            </div>
          </div>

          {/* Gumbi */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2 border-t border-border">
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
            <div className="flex flex-col-reverse sm:flex-row gap-2.5">
              <CloseActionButton
                label="Zatvori"
                onClick={() => onOpenChange(false)}
                disabled={isSending || isSendingTest}
              />
              <Button
                onClick={handleApproveAndSend}
                disabled={isSending || isSendingTest || !member.email || Boolean(member.doNotContact) || !subject.trim() || !bodyText.trim()}
                className="rounded-full h-10 px-6 gap-2 bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 border border-[#D97706] text-white font-bold shadow-md"
              >
                {isSending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Slanje u tijeku...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Odobri i pošalji čestitku
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
