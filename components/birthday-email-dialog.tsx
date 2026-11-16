"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Mail, Send, CheckCircle2, AlertCircle, Clock, Cake, Eye, Loader2 } from "lucide-react"
import { Member, useMembers } from "@/contexts/members-context"
import { useSettings } from "@/contexts/settings-context"
import { useAuth } from "@/contexts/auth-context"
import { formatDateTimeDMY } from "@/lib/utils"

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
  const { updateMember } = useMembers()
  const { user } = useAuth()

  const [subject, setSubject] = React.useState("")
  const [bodyText, setBodyText] = React.useState("")
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
      setSendResult({ status: "idle" })
    }
  }, [open, member, settings.birthdayEmailSubject, settings.birthdayEmailBody])

  if (!member) return null

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
          testEmail: settings.smtpFrom || user?.email,
          sender: user
            ? {
                userId: user.id.toString(),
                userName: user.name,
                userRole: user.role,
              }
            : undefined,
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
          sender: user
            ? {
                userId: user.id.toString(),
                userName: user.name,
                userRole: user.role,
              }
            : undefined,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        const sentAt = data.sentAt || new Date().toISOString()
        updateMember(member.id, { lastBirthdayEmailAt: sentAt })
        setSendResult({
          status: "success",
          sentAt,
          message: data.message || `Rođendanska čestitka je uspješno poslana na ${member.email}!`,
        })
        onSuccess?.(sentAt)
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
        <DialogHeader className="bg-[#343C32] text-white px-6 py-5 border-b-2 border-[#A17B50] rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#A17B50]/20 border border-[#A17B50]/50 flex items-center justify-center shrink-0">
              <Cake className="h-5 w-5 text-[#EAE1D1]" />
            </div>
            <div>
              <DialogTitle className="font-serif text-lg font-bold text-white tracking-tight">
                Pregled i odobrenje rođendanske čestitke
              </DialogTitle>
              <DialogDescription className="text-xs text-[#EAE1D1]">
                Standardizirani HRD predložak (#343C32 / #A17B50 / #EAE1D1) s postojećim službenim logotipom i potpisom.
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
              Pregled poruke prije odobrenja i slanja
            </div>
            <div className="rounded-xl border border-border overflow-hidden bg-[#F2EFE9] p-4">
              <div className="mx-auto max-w-xl rounded-xl bg-white border border-[#E8E4DE] overflow-hidden shadow-sm">
                <div className="bg-[#1B2B36] px-5 py-4 border-b-2 border-[#CEA369]">
                  <div className="text-sm font-bold text-white">Hrvatsko rodoslovno društvo</div>
                  <div className="text-[11px] text-[#CEA369]">
                    „Pavao Ritter Vitezović” — Rođendanska čestitka
                  </div>
                </div>
                <div className="bg-[#FDF8F0] border-b border-[#E8E4DE] px-5 py-2.5 text-xs font-bold text-[#9A6B2F]">
                  🎂 Sretan rođendan, {member.name}!
                </div>
                <div className="p-5 space-y-4">
                  <div className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {bodyText}
                  </div>
                  <div className="border-t border-[#E8E4DE] pt-3 text-[11px] text-slate-500">
                    Hrvatsko rodoslovno društvo „Pavao Ritter Vitezović”
                    <br />
                    <span className="text-[10px] text-slate-400">Službena čestitka Društva</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Gumbi */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2 pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={handleSendTest}
              disabled={isSending || isSendingTest || !subject.trim() || !bodyText.trim()}
              className="gap-2 border-[#A17B50] text-[#343C32] hover:bg-[#EAE1D1]/50"
            >
              {isSendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4 text-[#A17B50]" />}
              Pošalji testni e-mail
            </Button>
            <div className="flex flex-col-reverse sm:flex-row gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending || isSendingTest}>
                Zatvori
              </Button>
              <Button
                onClick={handleApproveAndSend}
                disabled={isSending || isSendingTest || !member.email || !subject.trim() || !bodyText.trim()}
                className="gap-2 bg-[#343C32] hover:bg-[#343C32]/90 text-white"
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
