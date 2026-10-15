"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { 
  BarChart3, 
  Users, 
  Mail, 
  Send, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  Eye, 
  Edit3
} from "lucide-react"

interface PollNotificationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pollTitle: string
  targetType: "all" | "selected"
  selectedMemberIds?: number[] | null
  totalMembersCount?: number
  onSuccess?: () => void
}

export function PollNotificationDialog({
  open,
  onOpenChange,
  pollTitle,
  targetType,
  selectedMemberIds,
  totalMembersCount = 0,
  onSuccess,
}: PollNotificationDialogProps) {
  const [subject, setSubject] = React.useState("")
  const [customBody, setCustomBody] = React.useState("")
  const [viewMode, setViewMode] = React.useState<"preview" | "edit">("preview")

  const [isSending, setIsSending] = React.useState(false)
  const [sendResult, setSendResult] = React.useState<{
    status: "idle" | "success" | "error"
    message: string
  }>({ status: "idle", message: "" })

  const originUrl = typeof window !== "undefined" ? window.location.origin : "https://rodoslovlje.hr"

  React.useEffect(() => {
    if (open) {
      setSubject(`Obavezno glasovanje: ${pollTitle}`)
      setCustomBody(
        `Poštovani/a {{name}},\n\nObavještavamo Vas da je u sustavu HRD otvoreno novo glasovanje za članove društva:\n\n"${pollTitle}"\n\nMolimo Vas da se prijavite u sustav kako biste dali svoj glas. Prema pravilniku Društva, Vaše sudjelovanje je obavezno za donošenje pravovaljanih odluka.\n\nPoveznica za prijavu: ${originUrl}/login\n\nSrdačan pozdrav,\nTajništvo Društva\nHRD "Pavao Ritter Vitezović"`
      )
      setViewMode("preview")
      setSendResult({ status: "idle", message: "" })
    }
  }, [open, pollTitle, originUrl])

  const recipientsCount = targetType === "all" ? totalMembersCount : selectedMemberIds?.length || 0

  const handleSend = async () => {
    setIsSending(true)
    setSendResult({ status: "idle", message: "" })

    try {
      const response = await fetch("/api/polls/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pollTitle,
          targetType,
          selectedMemberIds: targetType === "all" ? null : selectedMemberIds,
          customSubject: subject,
          customBody,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setSendResult({
          status: "success",
          message: data.message || `Obavijesti su uspješno poslane!`,
        })

        if (onSuccess) {
          onSuccess()
        }
      } else {
        setSendResult({
          status: "error",
          message: data.error || "Došlo je do pogreške pri slanju obavijesti.",
        })
      }
    } catch (err: any) {
      console.error("Greška pri slanju obavijesti o anketi:", err)
      setSendResult({
        status: "error",
        message: err.message || "Došlo je do mrežne greške.",
      })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 rounded-2xl border border-border shadow-2xl">
        <div className="bg-gradient-to-r from-teal-700 via-emerald-800 to-slate-900 text-white p-6 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center shrink-0 border border-white/20">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-white tracking-tight">
                Provjera i slanje obavijesti o glasovanju
              </DialogTitle>
              <DialogDescription className="text-xs text-teal-100">
                Pregledajte tekst i primatelje prije slanja e-mail obavijesti
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Uspjeh alert */}
          {sendResult.status === "success" && (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-900 shadow-sm animate-in fade-in duration-200">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-6 w-6 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-emerald-900">E-mail obavijesti su uspješno poslane!</h4>
                  <p className="text-xs text-emerald-800">{sendResult.message}</p>
                </div>
              </div>
            </div>
          )}

          {/* Greška alert */}
          {sendResult.status === "error" && (
            <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-900 shadow-sm animate-in fade-in duration-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-6 w-6 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-red-900">Greška: E-mailovi NISU poslani!</h4>
                  <p className="text-xs text-red-800">{sendResult.message}</p>
                </div>
              </div>
            </div>
          )}

          {/* Sažetak ankete */}
          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Glasovanje / Anketa</span>
              <Badge variant="outline" className="text-[10px] font-medium bg-background">
                {targetType === "all" ? "Svi članovi" : "Odabrani članovi"}
              </Badge>
            </div>

            <div>
              <h3 className="font-bold text-base text-foreground">{pollTitle}</h3>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-primary" /> Primatelji:{" "}
                <strong>
                  {targetType === "all"
                    ? `Svi aktivni članovi društva (${recipientsCount})`
                    : `${recipientsCount} odabranih članova`}
                </strong>
              </p>
            </div>
          </div>

          {/* Predmet e-pošte */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Predmet e-pošte (Subject):</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="text-xs"
              disabled={sendResult.status === "success" || isSending}
            />
          </div>

          {/* Izbor prikaza */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg border border-border">
                <Button
                  type="button"
                  variant={viewMode === "preview" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 text-xs gap-1.5 px-3 rounded-md"
                  onClick={() => setViewMode("preview")}
                >
                  <Eye className="h-3.5 w-3.5" /> Vizualni izgled e-pošte
                </Button>
                <Button
                  type="button"
                  variant={viewMode === "edit" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 text-xs gap-1.5 px-3 rounded-md"
                  onClick={() => setViewMode("edit")}
                >
                  <Edit3 className="h-3.5 w-3.5" /> Prilagodi tekst poruke
                </Button>
              </div>
            </div>

            {viewMode === "preview" ? (
              <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden text-xs">
                <div className="bg-muted/40 border-b border-border p-3 space-y-1 font-mono text-[11px]">
                  <div className="flex">
                    <span className="w-16 text-muted-foreground shrink-0">Od:</span>
                    <span className="text-foreground font-medium">
                      Hrvatsko rodoslovno društvo &lt;tajnistvo@rodoslovlje.hr&gt;
                    </span>
                  </div>
                  <div className="flex">
                    <span className="w-16 text-muted-foreground shrink-0">Za:</span>
                    <span className="text-foreground font-medium">
                      {targetType === "all" ? "Svi članovi društva" : `Odabrani članovi (${recipientsCount})`}
                    </span>
                  </div>
                  <div className="flex">
                    <span className="w-16 text-muted-foreground shrink-0">Predmet:</span>
                    <span className="text-foreground font-bold">{subject}</span>
                  </div>
                </div>

                <div className="p-5 space-y-4 font-sans bg-white text-slate-800">
                  <div className="border-b border-teal-200 pb-3">
                    <h3 className="font-bold text-base text-teal-900">
                      Hrvatsko rodoslovno društvo &ldquo;Pavao Ritter Vitezović&rdquo;
                    </h3>
                    <p className="text-[11px] text-slate-500">Službeno glasovanje za članove</p>
                  </div>

                  <div className="text-xs leading-relaxed text-slate-700 whitespace-pre-wrap">
                    {customBody.replace(/{{name}}/gi, "Ivan Horvat")}
                  </div>

                  <div className="text-center py-2">
                    <span className="inline-flex items-center gap-2 bg-teal-700 text-white font-semibold px-5 py-2.5 rounded-lg shadow-sm text-xs">
                      Prijavite se i glasujte
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 rounded-xl border border-border bg-card p-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Uredi tekst poruke:</Label>
                  <Textarea
                    value={customBody}
                    onChange={(e) => setCustomBody(e.target.value)}
                    rows={8}
                    className="text-xs font-mono"
                    disabled={sendResult.status === "success" || isSending}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Oznaka <code className="bg-muted px-1 rounded">{"{{name}}"}</code> automatski se zamjenjuje imenom
                    svakog pojedinog člana.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border bg-muted/40 p-4 flex items-center justify-between gap-3 rounded-b-2xl">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSending}
          >
            {sendResult.status === "success" ? "Zatvori" : "Odustani"}
          </Button>

          <div className="flex items-center gap-2">
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
                className="gap-1.5 bg-teal-700 hover:bg-teal-800 text-white font-medium"
                onClick={handleSend}
                disabled={isSending}
              >
                {isSending ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Slanje obavijesti...
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    Odobri i pošalji obavijest
                  </>
                )}
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 font-medium"
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
