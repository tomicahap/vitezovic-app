"use client"

import * as React from "react"
import { ShieldAlert, Clock, Send, Save, RefreshCw, Users, CheckCircle2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { useSettings } from "@/contexts/settings-context"
import { formatDateTimeDMY } from "@/lib/utils"
import { SaveActionButton } from "@/components/ui/action-bar"

interface BoardRecipientInfo {
  id: number
  name: string
  email: string
  roleLabel: string
}

interface SettingsAdminInactivityCardProps {
  onNotify: (msg: string) => void
  onError: (msg: string) => void
}

export function SettingsAdminInactivityCard({ onNotify, onError }: SettingsAdminInactivityCardProps) {
  const { settings, setAdminInactivitySettings, refreshSettings } = useSettings()

  const [enabled, setEnabled] = React.useState(Boolean(settings.adminInactivityEnabled))
  const [days, setDays] = React.useState<number>(settings.adminInactivityDays || 30)
  const [saving, setSaving] = React.useState(false)
  const [sendingTest, setSendingTest] = React.useState(false)
  const [testEmail, setTestEmail] = React.useState(settings.smtpFrom || "")
  const [statusLoading, setStatusLoading] = React.useState(true)
  const [statusData, setStatusData] = React.useState<{
    lastAdminLoginAt: string | null
    adminInactivityAlertSentAt: string | null
    elapsedDays: number
    boardRecipients: BoardRecipientInfo[]
  }>({
    lastAdminLoginAt: settings.lastAdminLoginAt || null,
    adminInactivityAlertSentAt: settings.adminInactivityAlertSentAt || null,
    elapsedDays: 0,
    boardRecipients: [],
  })

  React.useEffect(() => {
    setEnabled(Boolean(settings.adminInactivityEnabled))
    setDays(settings.adminInactivityDays || 30)
    if (!testEmail && settings.smtpFrom) setTestEmail(settings.smtpFrom)
  }, [settings.adminInactivityEnabled, settings.adminInactivityDays, settings.smtpFrom])

  const loadStatus = React.useCallback(async () => {
    setStatusLoading(true)
    try {
      const res = await fetch("/api/admin/inactivity-check", { cache: "no-store" })
      if (res.ok) {
        const data = await res.json()
        setStatusData({
          lastAdminLoginAt: data.lastAdminLoginAt || null,
          adminInactivityAlertSentAt: data.adminInactivityAlertSentAt || null,
          elapsedDays: Number(data.elapsedDays) || 0,
          boardRecipients: Array.isArray(data.boardRecipients) ? data.boardRecipients : [],
        })
      }
    } catch {
      // ignore
    } finally {
      setStatusLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadStatus()
  }, [loadStatus])

  const handleSave = async () => {
    if (!days || days < 1) {
      onError("Broj dana neaktivnosti mora biti najmanje 1 dan.")
      return
    }
    setSaving(true)
    onError("")
    try {
      await setAdminInactivitySettings({
        adminInactivityEnabled: enabled,
        adminInactivityDays: days,
      })
      await refreshSettings()
      await loadStatus()
      onNotify(
        enabled
          ? `✓ Kontrola neaktivnosti Administratora je uključena (prag: ${days} dana).`
          : "✓ Kontrola neaktivnosti Administratora je isključena."
      )
    } finally {
      setSaving(false)
    }
  }

  const handleSendTest = async () => {
    setSendingTest(true)
    onError("")
    try {
      const res = await fetch("/api/admin/inactivity-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send-test",
          testEmail: testEmail.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        onNotify(`✓ Testni e-mail sigurnosne predaje pristupa poslan je na: ${(data.sentTo || []).join(", ")}`)
      } else {
        onError(data.error || "Slanje testnog e-maila nije uspjelo.")
      }
    } catch {
      onError("Greška pri komunikaciji s poslužiteljem.")
    } finally {
      setSendingTest(false)
    }
  }

  return (
    <Card className={enabled ? "border-2 border-red-300 bg-red-50/30 shadow-sm" : "border-border"}>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldAlert className={enabled ? "h-5 w-5 text-red-600" : "h-5 w-5 text-muted-foreground"} />
              Kontrola neaktivnosti Administratora (Sigurnosna predaja pristupa)
            </CardTitle>
            <CardDescription>
              Automatsko osiguranje kontinuiteta rada društva: ako se Administrator ne prijavi u sustav zadani broj dana, sustav automatski šalje e-mail s administratorskim pristupnim podacima (korisničko ime i lozinka) svim aktivnim članovima tijela društva.
            </CardDescription>
          </div>
          <Badge
            variant={enabled ? "default" : "outline"}
            className={
              enabled
                ? "bg-red-600 text-white hover:bg-red-600 shrink-0 px-3 py-1"
                : "text-muted-foreground shrink-0 px-3 py-1"
            }
          >
            {enabled ? `AKTIVNO (${days} dana)` : "ISKLJUČENO"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex items-start gap-3 rounded-xl border border-border bg-background p-4">
            <Switch
              id="admin-inactivity-switch"
              checked={enabled}
              onCheckedChange={setEnabled}
              className="mt-0.5"
            />
            <div className="space-y-1">
              <Label htmlFor="admin-inactivity-switch" className="text-sm font-semibold cursor-pointer">
                Omogući automatsko slanje admin pristupa kod neaktivnosti
              </Label>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Svaka prijava ili aktivnost Administratora resetira brojač dana na 0.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-background p-4 space-y-2">
            <Label htmlFor="adminInactivityDays" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Broj dana bez prijave Administratora
            </Label>
            <div className="flex items-center gap-3">
              <Input
                id="adminInactivityDays"
                type="number"
                min={1}
                max={3650}
                value={days}
                onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))}
                className="w-28 font-bold"
              />
              <span className="text-xs text-muted-foreground">
                dana neaktivnosti prije slanja pristupnih podataka (npr. 30, 60 ili 90 dana)
              </span>
            </div>
          </div>
        </div>

        {/* Status praćenja prijave */}
        <div className="rounded-xl border border-border bg-muted/40 p-4 grid gap-3 sm:grid-cols-3 text-xs">
          <div className="space-y-0.5">
            <span className="text-muted-foreground font-medium flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> Zadnja aktivnost Administratora:
            </span>
            <p className="font-bold text-foreground text-sm">
              {statusLoading
                ? "Učitavanje..."
                : statusData.lastAdminLoginAt
                ? formatDateTimeDMY(statusData.lastAdminLoginAt)
                : "Bilježi se od ove sesije"}
            </p>
          </div>
          <div className="space-y-0.5">
            <span className="text-muted-foreground font-medium">Proteklo od zadnje prijave:</span>
            <p className="font-bold text-foreground text-sm">
              {statusLoading ? "—" : `${statusData.elapsedDays} dana`} (prag: {days} dana)
            </p>
          </div>
          <div className="space-y-0.5">
            <span className="text-muted-foreground font-medium">Status sigurnosne obavijesti:</span>
            <p className="font-bold text-sm">
              {statusData.adminInactivityAlertSentAt ? (
                <span className="text-red-700">
                  Poslano {formatDateTimeDMY(statusData.adminInactivityAlertSentAt)}
                </span>
              ) : (
                <span className="text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Administrator je aktivan
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Popis primatelja iz tijela društva */}
        <div className="rounded-xl border border-border bg-background p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Primatelji u tijelima društva ({statusData.boardRecipients.length})
            </span>
            <span className="text-[11px] text-muted-foreground">
              Svi aktivni članovi s dodijeljenom funkcijom u društvu ili ulogom Moderatora
            </span>
          </div>
          {statusData.boardRecipients.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {statusData.boardRecipients.map((r) => (
                <div
                  key={r.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1 text-xs"
                >
                  <span className="font-semibold text-foreground">{r.name}</span>
                  <span className="text-muted-foreground">({r.roleLabel})</span>
                  <span className="font-mono text-[11px] text-primary">• {r.email}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Trenutno nema aktivnih članova s dodijeljenom funkcijom u tijelima društva i valjanom e-mail adresom. Dodijelite funkciju članovima (npr. Predsjednik, Tajnik) u kartonu člana.
            </p>
          )}
        </div>

        {/* Akcijski gumbi */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-border">
          <div className="flex items-center gap-2">
            <Input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="E-mail za test (npr. admin@...)..."
              className="h-9 text-xs w-56"
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleSendTest}
              disabled={sendingTest}
              className="gap-1.5 h-9 text-xs shrink-0 rounded-full border-2 border-slate-300"
            >
              {sendingTest ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Pošalji testni e-mail
            </Button>
          </div>

          <SaveActionButton
            label="Spremi pravilo neaktivnosti"
            loading={saving}
            loadingLabel="Spremanje..."
            onClick={handleSave}
          />
        </div>
      </CardContent>
    </Card>
  )
}
