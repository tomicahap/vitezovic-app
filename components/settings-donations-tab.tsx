"use client"

import * as React from "react"
import {
  Bot,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Info,
  Mail,
  QrCode,
  RefreshCw,
  Save,
  Send,
  Trash2,
  Upload,
  AlertTriangle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { CampaignSettings } from "@/lib/mailcrawl/types"

interface SettingsDonationsTabProps {
  onNotify: (msg: string) => void
  onError: (msg: string) => void
}

export function SettingsDonationsTab({ onNotify, onError }: SettingsDonationsTabProps) {
  const [settings, setSettings] = React.useState<CampaignSettings | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [hub3PreviewUrl, setHub3PreviewUrl] = React.useState("")
  const [geminiModels, setGeminiModels] = React.useState<{ id: string; displayName: string }[]>([])
  const [modelsLoading, setModelsLoading] = React.useState(false)
  const [testGeminiLoading, setTestGeminiLoading] = React.useState(false)
  const [testSmtpLoading, setTestSmtpLoading] = React.useState(false)
  const [copyingSmtp, setCopyingSmtp] = React.useState(false)
  const [smtpSendingTest, setSmtpSendingTest] = React.useState(false)
  const [smtpTestEmail, setSmtpTestEmail] = React.useState("")
  const [showSmtpPass, setShowSmtpPass] = React.useState(false)
  const [geminiStatus, setGeminiStatus] = React.useState<{ state: "idle" | "ok" | "error"; message?: string }>({ state: "idle" })
  const [smtpStatus, setSmtpStatus] = React.useState<{ state: "idle" | "ok" | "error"; message?: string }>({ state: "idle" })
  const logoInputRef = React.useRef<HTMLInputElement>(null)

  const loadData = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/mailcrawl/settings", { cache: "no-store" })
      if (res.ok) {
        const data = await res.json()
        setSettings(data)
      }
      const hubRes = await fetch("/api/admin/mailcrawl/hub3-preview", { cache: "no-store" })
      if (hubRes.ok) {
        const hubData = await hubRes.json()
        if (hubData.dataUrl) setHub3PreviewUrl(hubData.dataUrl)
      }
    } catch {
      onError("Greška pri učitavanju postavki donacijskih kampanja.")
    } finally {
      setLoading(false)
    }
  }, [onError])

  React.useEffect(() => {
    loadData()
  }, [loadData])

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    onError("")
    try {
      const res = await fetch("/api/admin/mailcrawl/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        if (data.settings) setSettings(data.settings)
        try {
          const hubRes = await fetch("/api/admin/mailcrawl/hub3-preview", { cache: "no-store" })
          if (hubRes.ok) {
            const hubData = await hubRes.json().catch(() => ({}))
            if (hubData.dataUrl) setHub3PreviewUrl(hubData.dataUrl)
          }
        } catch {}
        onNotify("✓ Postavke donacijskih kampanja, HUB-3A uplatnice i AI servisa su spremljene.")
      } else {
        onError(data.error || "Greška pri spremanju postavki kampanje.")
      }
    } catch {
      onError("Greška pri komunikaciji s poslužiteljem.")
    } finally {
      setSaving(false)
    }
  }

  const handleTestGemini = async () => {
    if (!settings) return
    setTestGeminiLoading(true)
    setGeminiStatus({ state: "idle" })
    try {
      const res = await fetch("/api/admin/mailcrawl/settings/test-gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gemini_api_key: settings.gemini_api_key,
          gemini_model: settings.gemini_model,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setGeminiStatus({ state: "ok", message: data.message || "Veza s Gemini AI je uspješna!" })
        onNotify("✓ Veza s Google Gemini AI je uspješna!")
      } else {
        setGeminiStatus({ state: "error", message: data.error || "Greška pri testiranju Geminija." })
        onError(data.error || "Greška pri testiranju Google Gemini AI.")
      }
    } catch {
      setGeminiStatus({ state: "error", message: "Greška mreže." })
    } finally {
      setTestGeminiLoading(false)
    }
  }

  const handleListGeminiModels = async () => {
    if (!settings) return
    setModelsLoading(true)
    try {
      const res = await fetch("/api/admin/mailcrawl/settings/list-gemini-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gemini_api_key: settings.gemini_api_key }),
      })
      const data = await res.json()
      if (data.ok && Array.isArray(data.models)) {
        setGeminiModels(data.models)
        onNotify(`Dohvaćeno ${data.models.length} aktivnih Gemini modela.`)
      } else {
        onError(data.error || "Nije moguće dohvatiti modele.")
      }
    } catch {
      onError("Greška pri dohvatu Gemini modela.")
    } finally {
      setModelsLoading(false)
    }
  }

  const handleCopySystemSmtp = async () => {
    if (!settings) return
    setCopyingSmtp(true)
    try {
      const res = await fetch("/api/admin/mailcrawl/settings/copy-system-smtp")
      const data = await res.json()
      if (data.ok && data.smtp) {
        setSettings({
          ...settings,
          smtp_host: data.smtp.smtp_host || "",
          smtp_port: String(data.smtp.smtp_port || "587"),
          smtp_user: data.smtp.smtp_user || "",
          smtp_pass: data.smtp.smtp_pass || "",
          smtp_secure: data.smtp.smtp_secure ? "true" : "false",
          sender_email: data.smtp.sender_email || settings.sender_email,
        })
        onNotify("✓ SMTP postavke preuzete su iz glavnih sustavskih postavki. Kliknite 'Spremi sve postavke'.")
      } else {
        onError(data.error || "Glavne SMTP postavke nisu pronađene.")
      }
    } catch {
      onError("Greška pri kopiranju SMTP postavki.")
    } finally {
      setCopyingSmtp(false)
    }
  }

  const handleTestSmtp = async () => {
    if (!settings) return
    setTestSmtpLoading(true)
    setSmtpStatus({ state: "idle" })
    try {
      const res = await fetch("/api/admin/mailcrawl/settings/test-smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })
      const data = await res.json()
      if (data.ok) {
        setSmtpStatus({ state: "ok", message: data.message || "SMTP veza je uspješna!" })
        onNotify("✓ SMTP veza za donacije je ispravna.")
      } else {
        setSmtpStatus({ state: "error", message: data.error || "Greška pri spajanju na SMTP." })
        onError(data.error || "Greška pri provjeri SMTP poslužitelja.")
      }
    } catch {
      setSmtpStatus({ state: "error", message: "Greška mreže." })
    } finally {
      setTestSmtpLoading(false)
    }
  }

  const handleSendSmtpDirectTest = async () => {
    if (!settings || !smtpTestEmail.trim()) {
      onError("Unesite e-mail adresu za slanje testne poruke.")
      return
    }
    setSmtpSendingTest(true)
    try {
      const res = await fetch("/api/admin/mailcrawl/settings/send-test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: smtpTestEmail.trim(), settings }),
      })
      const data = await res.json()
      if (data.ok) {
        onNotify(`✓ Testni e-mail donacijske kampanje poslan je na ${smtpTestEmail.trim()}.`)
      } else {
        onError(data.error || "Slanje testnog e-maila nije uspjelo.")
      }
    } catch {
      onError("Greška pri slanju testnog e-maila.")
    } finally {
      setSmtpSendingTest(false)
    }
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !settings) return
    if (file.size > 1024 * 1024) {
      onError("Logotip je prevelik (maksimalno 1 MB).")
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      setSettings({ ...settings, custom_logo: dataUrl })
      onNotify("Logotip je učitan — kliknite 'Spremi sve postavke kampanje' za spremanje.")
    }
    reader.readAsDataURL(file)
  }

  if (loading || !settings) {
    return (
      <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
        <RefreshCw className="h-4 w-4 animate-spin" />
        Učitavanje postavki donacija, HUB-3A i AI sustava...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-card rounded-xl border shadow-xs">
        <div>
          <h3 className="text-base font-semibold">Postavke donacijskih kampanja, HUB-3A uplatnice i AI servisa</h3>
          <p className="text-xs text-muted-foreground">
            Sve opcije iz modula Donacije & Kampanje na jednom mjestu: IBAN i HUB-3A barkod, Google Gemini AI ključ, namjenski SMTP i logotip potpisa.
          </p>
        </div>
        <Button type="button" onClick={handleSave} disabled={saving} size="sm" className="shrink-0 gap-1.5">
          {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {saving ? "Spremanje..." : "Spremi sve postavke"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* HUB-3A i podaci društva */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <QrCode className="h-4 w-4 text-primary" /> Podaci društva & HUB-3A 2D uplatnica
            </CardTitle>
            <CardDescription>
              Podaci za generiranje 2D barkoda na uplatnicama i donacijskim pozivima.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs font-medium">Naziv primatelja:</label>
              <Input value={settings.org_name} onChange={(e) => setSettings({ ...settings, org_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Ulica i broj:</label>
                <Input value={settings.org_street} onChange={(e) => setSettings({ ...settings, org_street: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium">Grad i poštanski br.:</label>
                <Input value={settings.org_city} onChange={(e) => setSettings({ ...settings, org_city: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">IBAN račun društva:</label>
                <Input
                  value={settings.org_iban}
                  onChange={(e) => setSettings({ ...settings, org_iban: e.target.value })}
                  className="font-mono font-medium"
                />
              </div>
              <div>
                <label className="text-xs font-medium">Predloženi iznos donacije (EUR):</label>
                <Input
                  value={settings.suggested_amount_eur}
                  onChange={(e) => setSettings({ ...settings, suggested_amount_eur: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Model plaćanja:</label>
                <Input value={settings.payment_model} onChange={(e) => setSettings({ ...settings, payment_model: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium">Poziv na broj:</label>
                <Input
                  value={settings.payment_reference}
                  onChange={(e) => setSettings({ ...settings, payment_reference: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">Opis plaćanja:</label>
              <Input
                value={settings.payment_description}
                onChange={(e) => setSettings({ ...settings, payment_description: e.target.value })}
              />
            </div>

            {hub3PreviewUrl && (
              <div className="pt-2 border-t mt-3 flex flex-col items-center justify-center p-3 rounded-lg bg-muted/40">
                <div className="text-[11px] font-medium text-muted-foreground mb-2">
                  Službeni HUB-3A 2D barkod (pregled):
                </div>
                <img src={hub3PreviewUrl} alt="HUB-3A barkod" className="max-h-24 bg-white p-2 rounded border" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gemini AI & Donacijski SMTP */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Bot className="h-4 w-4 text-amber-500" /> Google Gemini AI postavke
                </CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTestGemini}
                  disabled={testGeminiLoading}
                  className="text-xs h-7"
                >
                  {testGeminiLoading ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : null}
                  Testiraj Gemini
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {geminiStatus.state === "ok" && (
                <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-1.5 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {geminiStatus.message}
                </div>
              )}
              {geminiStatus.state === "error" && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-1.5 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" /> {geminiStatus.message}
                </div>
              )}
              <div>
                <label className="text-xs font-medium">Gemini API ključ:</label>
                <Input
                  type="password"
                  placeholder="AIzaSy..."
                  value={settings.gemini_api_key}
                  onChange={(e) => setSettings({ ...settings, gemini_api_key: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium">Model:</label>
                  <button
                    type="button"
                    onClick={handleListGeminiModels}
                    className="text-[11px] text-primary hover:underline flex items-center gap-1"
                  >
                    {modelsLoading ? <RefreshCw className="h-2.5 w-2.5 animate-spin" /> : null}
                    Dohvati aktivne modele
                  </button>
                </div>
                {geminiModels.length > 0 ? (
                  <Select value={settings.gemini_model} onValueChange={(val) => setSettings({ ...settings, gemini_model: val })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {geminiModels.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.displayName} ({m.id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={settings.gemini_model}
                    onChange={(e) => setSettings({ ...settings, gemini_model: e.target.value })}
                  />
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Mail className="h-4 w-4 text-primary" /> SMTP poslužitelj za kampanje
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleCopySystemSmtp}
                    disabled={copyingSmtp}
                    className="text-xs h-7 text-muted-foreground hover:text-foreground"
                  >
                    {copyingSmtp ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                    Preuzmi iz sustava
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleTestSmtp}
                    disabled={testSmtpLoading}
                    className="text-xs h-7"
                  >
                    {testSmtpLoading ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : null}
                    Testiraj SMTP
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {smtpStatus.state === "ok" && (
                <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-1.5 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {smtpStatus.message}
                </div>
              )}
              {smtpStatus.state === "error" && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-1.5">
                  {smtpStatus.message}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium">SMTP Host:</label>
                  <Input
                    value={settings.smtp_host}
                    onChange={(e) => setSettings({ ...settings, smtp_host: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Port:</label>
                  <Input
                    value={settings.smtp_port}
                    onChange={(e) => setSettings({ ...settings, smtp_port: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium">Korisničko ime:</label>
                  <Input
                    value={settings.smtp_user}
                    onChange={(e) => setSettings({ ...settings, smtp_user: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">SMTP lozinka:</label>
                  <div className="relative">
                    <Input
                      type={showSmtpPass ? "text" : "password"}
                      value={settings.smtp_pass}
                      onChange={(e) => setSettings({ ...settings, smtp_pass: e.target.value })}
                      className="pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSmtpPass((p) => !p)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showSmtpPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium">Ime pošiljatelja:</label>
                  <Input
                    value={settings.sender_name}
                    onChange={(e) => setSettings({ ...settings, sender_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">From e-mail:</label>
                  <Input
                    value={settings.sender_email}
                    onChange={(e) => setSettings({ ...settings, sender_email: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div>
                  <label className="text-xs font-medium">Sigurna veza (SSL / TLS)</label>
                  <p className="text-[11px] text-muted-foreground">Uključeno za port 465 (SSL).</p>
                </div>
                <Switch
                  checked={String(settings.smtp_secure) === "true"}
                  onCheckedChange={(checked) => setSettings({ ...settings, smtp_secure: checked ? "true" : "false" })}
                />
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2.5 rounded-lg border bg-muted/40">
                <Input
                  type="email"
                  placeholder="Testna e-mail adresa..."
                  value={smtpTestEmail}
                  onChange={(e) => setSmtpTestEmail(e.target.value)}
                  className="text-xs h-8 flex-1"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="text-xs h-8 shrink-0 gap-1.5"
                  onClick={handleSendSmtpDirectTest}
                  disabled={smtpSendingTest}
                >
                  <Send className="h-3.5 w-3.5" />
                  {smtpSendingTest ? "Šaljem..." : "Pošalji test"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Logotip i potpis donacijskih e-mailova */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ImageIcon className="h-4 w-4 text-primary" /> Logotip potpisa kampanje
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center p-4 border border-dashed rounded-lg bg-muted/20 min-h-[110px] gap-2">
              {settings.custom_logo ? (
                <>
                  <img
                    src={settings.custom_logo}
                    alt="Logotip kampanje"
                    className="max-h-20 max-w-[200px] object-contain rounded border p-1 bg-white"
                  />
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" className="text-xs h-7" onClick={() => logoInputRef.current?.click()}>
                      <Upload className="h-3 w-3 mr-1" /> Promijeni
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7 text-rose-500"
                      onClick={() => setSettings({ ...settings, custom_logo: "" })}
                    >
                      <Trash2 className="h-3 w-3 mr-1" /> Ukloni
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-1.5 text-center">
                  <ImageIcon className="h-8 w-8 text-muted-foreground/60" />
                  <span className="text-xs text-muted-foreground">Nema učitanog logotipa</span>
                  <Button type="button" variant="outline" size="sm" className="text-xs h-7 mt-1" onClick={() => logoInputRef.current?.click()}>
                    <Upload className="h-3 w-3 mr-1" /> Učitaj logotip
                  </Button>
                </div>
              )}
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={handleLogoUpload}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="h-4 w-4 text-primary" /> Potpis donacijskih e-mailova
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              rows={4}
              value={settings.email_signature}
              onChange={(e) => setSettings({ ...settings, email_signature: e.target.value })}
              placeholder="Hrvatsko rodoslovno društvo..."
            />
            <div className="flex justify-end">
              <Button type="button" onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? "Spremam..." : "Spremi sve postavke kampanje"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
