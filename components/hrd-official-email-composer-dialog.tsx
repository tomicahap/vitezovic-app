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
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  Link as LinkIcon,
  Loader2,
  Mail,
  Send,
  Sparkles,
} from "lucide-react"
import { useSettings } from "@/contexts/settings-context"
import { useAuth } from "@/contexts/auth-context"
import {
  buildHrdMasterEmail,
  DEFAULT_HRD_EMAIL_PALETTE,
  escapeHtml,
  HRD_EMAIL_TEMPLATE_TYPES,
  HrdEmailTemplateTypeId,
} from "@/lib/hrd-email-system"

interface HrdOfficialEmailComposerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialRecipient?: string
  initialTemplateType?: HrdEmailTemplateTypeId
}

export function HrdOfficialEmailComposerDialog({
  open,
  onOpenChange,
  initialRecipient = "",
  initialTemplateType = "sluzbena_obavijest",
}: HrdOfficialEmailComposerDialogProps) {
  const { settings } = useSettings()
  const { user } = useAuth()

  const [to, setTo] = React.useState(initialRecipient)
  const [cc, setCc] = React.useState("")
  const [bcc, setBcc] = React.useState("")
  const [templateType, setTemplateType] = React.useState<HrdEmailTemplateTypeId>(initialTemplateType)
  const [subject, setSubject] = React.useState("")
  const [title, setTitle] = React.useState("")
  const [greeting, setGreeting] = React.useState("Poštovani,")
  const [bodyText, setBodyText] = React.useState("")
  const [includeInfoBox, setIncludeInfoBox] = React.useState(false)
  const [infoBoxTitle, setInfoBoxTitle] = React.useState("")
  const [infoBoxContent, setInfoBoxContent] = React.useState("")
  const [ctaText, setCtaText] = React.useState("")
  const [ctaUrl, setCtaUrl] = React.useState("")
  const [closingText, setClosingText] = React.useState("S poštovanjem,")
  const [testEmailAddress, setTestEmailAddress] = React.useState("")
  const [isSending, setIsSending] = React.useState(false)
  const [isSendingTest, setIsSendingTest] = React.useState(false)
  const [statusMsg, setStatusMsg] = React.useState<{
    type: "idle" | "success" | "error"
    text?: string
  }>({ type: "idle" })

  React.useEffect(() => {
    if (open) {
      setTo(initialRecipient || "")
      const meta =
        HRD_EMAIL_TEMPLATE_TYPES.find((t) => t.id === initialTemplateType) ||
        HRD_EMAIL_TEMPLATE_TYPES[0]
      setTemplateType(meta.id)
      setTitle(meta.defaultTitle)
      setSubject(`${meta.defaultTitle} — HRD „Pavao Ritter Vitezović”`)
      setInfoBoxTitle(meta.defaultInfoBoxTitle || "Važne informacije")
      setClosingText(meta.defaultClosingText || "S poštovanjem,")
      setTestEmailAddress(settings.smtpFrom || user?.email || "")
      setStatusMsg({ type: "idle" })
    }
  }, [open, initialRecipient, initialTemplateType, settings.smtpFrom, user?.email])

  const handleTypeChange = (nextType: HrdEmailTemplateTypeId) => {
    setTemplateType(nextType)
    const meta = HRD_EMAIL_TEMPLATE_TYPES.find((t) => t.id === nextType)
    if (meta) {
      setTitle(meta.defaultTitle)
      if (!subject || subject.includes("HRD „Pavao Ritter Vitezović”")) {
        setSubject(`${meta.defaultTitle} — HRD „Pavao Ritter Vitezović”`)
      }
      setInfoBoxTitle(meta.defaultInfoBoxTitle || "")
      setClosingText(meta.defaultClosingText || "S poštovanjem,")
    }
  }

  const previewResult = React.useMemo(() => {
    return buildHrdMasterEmail({
      templateType,
      title: title || subject || "Službena obavijest",
      greeting: greeting.trim() || undefined,
      bodyTextOrHtml: bodyText || "Ovdje će se prikazati glavni sadržaj Vaše službene poruke...",
      infoBoxTitle: includeInfoBox ? infoBoxTitle : undefined,
      infoBoxHtml:
        includeInfoBox && infoBoxContent.trim()
          ? `<div>${escapeHtml(infoBoxContent).replace(/\n/g, "<br/>")}</div>`
          : undefined,
      ctaText: ctaText.trim() || undefined,
      ctaUrl: ctaUrl.trim() || undefined,
      closingText: closingText.trim() || undefined,
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
  }, [
    templateType,
    title,
    subject,
    greeting,
    bodyText,
    includeInfoBox,
    infoBoxTitle,
    infoBoxContent,
    ctaText,
    ctaUrl,
    closingText,
    settings,
    user,
  ])

  const sendMessage = async (testOnly: boolean) => {
    if (!testOnly && !to.trim()) {
      setStatusMsg({ type: "error", text: "Unesite barem jednog primatelja (To)." })
      return
    }
    if (testOnly) setIsSendingTest(true)
    else setIsSending(true)
    setStatusMsg({ type: "idle" })

    try {
      const res = await fetch("/api/admin/notifications/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          to,
          cc,
          bcc,
          subject,
          templateType,
          title,
          greeting,
          bodyText,
          infoBoxTitle: includeInfoBox ? infoBoxTitle : "",
          infoBoxContent: includeInfoBox ? infoBoxContent : "",
          ctaText,
          ctaUrl,
          closingText,
          testOnly,
          testEmail: testEmailAddress,
          sender: user
            ? {
                userId: user.id,
                userName: user.name,
                userEmail: user.email,
                userRole: user.role,
              }
            : undefined,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setStatusMsg({ type: "success", text: data.message })
      } else {
        setStatusMsg({ type: "error", text: data.error || "Slanje nije uspjelo." })
      }
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Greška u komunikaciji s poslužiteljem." })
    } finally {
      setIsSending(false)
      setIsSendingTest(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] sm:max-w-[1360px] max-h-[92vh] overflow-y-auto p-0 rounded-2xl border border-[#E2E8F0] shadow-2xl">
        <DialogHeader
          style={{
            backgroundColor: DEFAULT_HRD_EMAIL_PALETTE.navyBlue,
            borderBottom: `3px solid ${DEFAULT_HRD_EMAIL_PALETTE.goldOrange}`,
          }}
          className="text-white px-6 py-5 rounded-t-2xl"
        >
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div
                style={{
                  backgroundColor: "rgba(217, 119, 6, 0.2)",
                  borderColor: DEFAULT_HRD_EMAIL_PALETTE.goldOrange,
                }}
                className="h-10 w-10 rounded-xl border flex items-center justify-center shrink-0"
              >
                <Mail className="h-5 w-5 text-[#FEFCE8]" />
              </div>
              <div>
                <DialogTitle className="font-serif text-lg font-bold text-white tracking-tight">
                  Službeni HRD uređivač e-pošte (Standardizirani vizualni identitet)
                </DialogTitle>
                <DialogDescription style={{ color: DEFAULT_HRD_EMAIL_PALETTE.lightGrayBg }} className="text-xs">
                  Centralizirani HTML predložak (max 600 px) sa standardiziranim zaglavljem (#1E3A5F) i postojećim službenim potpisom u podnožju.
                </DialogDescription>
              </div>
            </div>
            <Badge
              style={{
                backgroundColor: DEFAULT_HRD_EMAIL_PALETTE.goldOrange,
                color: DEFAULT_HRD_EMAIL_PALETTE.white,
              }}
              className="text-xs"
            >
              Paleta: #1E3A5F • #7C2D12 • #D97706
            </Badge>
          </div>
        </DialogHeader>

        <div className="p-5 md:p-6 space-y-4">
          {/* Upozorenja ako nedostaje službeni logo ili standardizirani potpis */}
          {previewResult.warnings.length > 0 && (
            <div className="space-y-2">
              {previewResult.warnings.map((w, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-950 flex items-start gap-2.5"
                >
                  <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {statusMsg.type !== "idle" && (
            <div
              className={`rounded-xl border px-4 py-3 text-xs font-semibold flex items-center gap-2 ${
                statusMsg.type === "success"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                  : "border-red-300 bg-red-50 text-red-900"
              }`}
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{statusMsg.text}</span>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-[1fr_1.08fr]">
            {/* LIJEVO: Kontrole uređivača */}
            <div className="space-y-3.5">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Vrsta službenog predloška (1–8)</Label>
                <select
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-medium"
                  value={templateType}
                  onChange={(e) => handleTypeChange(e.target.value as HrdEmailTemplateTypeId)}
                >
                  {HRD_EMAIL_TEMPLATE_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1 sm:col-span-3">
                  <Label className="text-xs font-semibold">Primatelj (To) *</Label>
                  <Input
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    placeholder="ime.prezime@domena.hr (ili više adresa odvojenih zarezom)"
                  />
                </div>
                <div className="space-y-1 sm:col-span-1">
                  <Label className="text-xs">Kopija (CC)</Label>
                  <Input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="Opcionalno" />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Skrivena kopija (BCC)</Label>
                  <Input value={bcc} onChange={(e) => setBcc(e.target.value)} placeholder="Opcionalno" />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Predmet e-pošte (Subject) *</Label>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Naslov unutar dokumenta (Georgia)</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Oslovljavanje / Uvodni pozdrav</Label>
                <Input value={greeting} onChange={(e) => setGreeting(e.target.value)} placeholder="Poštovani," />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Glavni sadržaj poruke *</Label>
                <Textarea
                  rows={6}
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  placeholder="Upišite sadržaj službene poruke..."
                />
              </div>

              {/* Opcionalni informativni blok #FEFCE8 */}
              <div className="rounded-xl border border-[#E2E8F0] bg-[#FEFCE8] p-3.5 space-y-2.5">
                <label className="flex items-center gap-2 text-xs font-bold text-[#7C2D12] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeInfoBox}
                    onChange={(e) => setIncludeInfoBox(e.target.checked)}
                    className="h-4 w-4"
                  />
                  Uključi informativni blok u svijetloj krem boji (#FEFCE8, obrub #D97706)
                </label>
                {includeInfoBox && (
                  <div className="space-y-2 pt-1">
                    <Input
                      value={infoBoxTitle}
                      onChange={(e) => setInfoBoxTitle(e.target.value)}
                      placeholder="Naslov informativnog bloka"
                      className="bg-white h-8 text-xs"
                    />
                    <Textarea
                      rows={3}
                      value={infoBoxContent}
                      onChange={(e) => setInfoBoxContent(e.target.value)}
                      placeholder="Sadržaj informativnog bloka (npr. datum, vrijeme, mjesto, napomena)..."
                      className="bg-white text-xs"
                    />
                  </div>
                )}
              </div>

              {/* Umetanje poveznice / gumba i završne poruke */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1">
                    <LinkIcon className="h-3 w-3" /> Tekst gumba / poveznice (opcionalno)
                  </Label>
                  <Input
                    value={ctaText}
                    onChange={(e) => setCtaText(e.target.value)}
                    placeholder="Npr. Otvori dokument"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">URL poveznice (https://...)</Label>
                  <Input
                    value={ctaUrl}
                    onChange={(e) => setCtaUrl(e.target.value)}
                    placeholder="https://rodoslovlje.hr/..."
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Završna poruka prije potpisa</Label>
                <Input value={closingText} onChange={(e) => setClosingText(e.target.value)} />
              </div>
            </div>

            {/* DESNO: Pregled konačnog HTML izgleda (600px) */}
            <div className="space-y-2 flex flex-col">
              <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5" />
                  Konačni izgled HTML e-maila (sa standardiziranim zaglavljem i potpisom)
                </span>
                <span className="font-mono text-[11px]">Širina: max 600 px</span>
              </div>
              <div className="flex-1 rounded-xl border border-[#E2E8F0] overflow-hidden bg-[#F8FAFC] p-2 max-h-[600px] overflow-y-auto">
                <div dangerouslySetInnerHTML={{ __html: previewResult.html }} />
              </div>
            </div>
          </div>

          {/* Donja traka: Testni e-mail i konačno slanje */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-border">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <Input
                value={testEmailAddress}
                onChange={(e) => setTestEmailAddress(e.target.value)}
                placeholder="Adresa za testni mail (admin ili drugi mail)..."
                className="h-9 text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => sendMessage(true)}
                disabled={isSending || isSendingTest}
                className="shrink-0 gap-1.5 border-[#D97706] text-[#1E3A5F] hover:bg-[#FEFCE8]"
              >
                {isSendingTest ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-[#D97706]" />}
                Pošalji testni e-mail
              </Button>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Zatvori
              </Button>
              <Button
                type="button"
                onClick={() => sendMessage(false)}
                disabled={isSending || isSendingTest || !to.trim() || !subject.trim() || !bodyText.trim()}
                style={{ backgroundColor: DEFAULT_HRD_EMAIL_PALETTE.navyBlue }}
                className="gap-2 text-white hover:opacity-95"
              >
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Pošalji službenu poruku
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
