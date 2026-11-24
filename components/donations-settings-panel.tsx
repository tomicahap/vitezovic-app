"use client"

import * as React from "react"
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Globe,
  Image as ImageIcon,
  Info,
  Mail,
  QrCode,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { SaveActionButton } from "@/components/ui/action-bar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import type { CampaignSettings } from "@/lib/mailcrawl/types"

function ConnectionStatusBadge({
  loading,
  status,
}: {
  loading: boolean
  status: { state: "idle" | "ok" | "error"; message?: string }
}) {
  if (loading) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium text-muted-foreground bg-muted animate-pulse select-none">
        <RefreshCw className="h-3 w-3 animate-spin" />
        Testiram...
      </span>
    )
  }

  if (status.state === "ok") {
    return (
      <span
        title={status.message || "Veza uspješno uspostavljena (OK)"}
        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40 shadow-xs select-none cursor-default"
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        OK
      </span>
    )
  }

  if (status.state === "error") {
    return (
      <div className="relative group inline-flex items-center">
        <span
          title={status.message}
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/40 shadow-xs cursor-pointer select-none"
        >
          <span>ERROR</span>
          <AlertTriangle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
        </span>
        <div className="pointer-events-none absolute right-0 top-full mt-2 hidden group-hover:flex flex-col z-50 w-80 p-3 bg-slate-900 text-slate-100 text-xs rounded-lg shadow-2xl border border-slate-700 whitespace-normal leading-relaxed">
          <div className="font-semibold text-rose-400 mb-1 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-400" />
            Detalji pogreške:
          </div>
          <div className="text-slate-200 break-words text-[11px] font-mono select-text">{status.message}</div>
        </div>
      </div>
    )
  }

  return null
}

interface DonationsSettingsPanelProps {
  externalSettings?: CampaignSettings | null
  externalHub3PreviewUrl?: string
  onSettingsSaved?: (updated: CampaignSettings, newHub3Url?: string) => void
  onNotify?: (msg: string) => void
  onError?: (msg: string) => void
}

export function DonationsSettingsPanel({
  externalSettings,
  externalHub3PreviewUrl,
  onSettingsSaved,
  onNotify,
  onError,
}: DonationsSettingsPanelProps) {
  const { user } = useAuth()
  const [settings, setSettings] = React.useState<CampaignSettings | null>(externalSettings || null)
  const [loading, setLoading] = React.useState(!externalSettings)
  const [saving, setSaving] = React.useState(false)
  const [hub3PreviewUrl, setHub3PreviewUrl] = React.useState(externalHub3PreviewUrl || "")
  const [geminiModels, setGeminiModels] = React.useState<{ id: string; displayName: string }[]>([])
  const [modelsLoading, setModelsLoading] = React.useState(false)
  const [testGeminiLoading, setTestGeminiLoading] = React.useState(false)
  const [testSerperLoading, setTestSerperLoading] = React.useState(false)
  const [testTavilyLoading, setTestTavilyLoading] = React.useState(false)
  const [testFirecrawlLoading, setTestFirecrawlLoading] = React.useState(false)
  const [testSmtpLoading, setTestSmtpLoading] = React.useState(false)
  const [copyingSmtp, setCopyingSmtp] = React.useState(false)
  const [smtpSendingTest, setSmtpSendingTest] = React.useState(false)
  const [smtpTestEmail, setSmtpTestEmail] = React.useState("")
  const [showSmtpPass, setShowSmtpPass] = React.useState(false)
  const [showSerperKey, setShowSerperKey] = React.useState(false)
  const [showTavilyKey, setShowTavilyKey] = React.useState(false)
  const [showFirecrawlKey, setShowFirecrawlKey] = React.useState(false)
  const [geminiStatus, setGeminiStatus] = React.useState<{ state: "idle" | "ok" | "error"; message?: string }>({ state: "idle" })
  const [serperStatus, setSerperStatus] = React.useState<{ state: "idle" | "ok" | "error"; message?: string }>({ state: "idle" })
  const [tavilyStatus, setTavilyStatus] = React.useState<{ state: "idle" | "ok" | "error"; message?: string }>({ state: "idle" })
  const [firecrawlStatus, setFirecrawlStatus] = React.useState<{ state: "idle" | "ok" | "error"; message?: string }>({ state: "idle" })
  const [smtpStatus, setSmtpStatus] = React.useState<{ state: "idle" | "ok" | "error"; message?: string }>({ state: "idle" })
  const logoInputRef = React.useRef<HTMLInputElement>(null)

  const notifySuccess = React.useCallback(
    (msg: string) => {
      if (onNotify) onNotify(msg)
      else toast.success(msg)
    },
    [onNotify]
  )

  const notifyError = React.useCallback(
    (msg: string) => {
      if (onError) onError(msg)
      else if (msg) toast.error(msg)
    },
    [onError]
  )

  React.useEffect(() => {
    if (externalSettings) {
      setSettings(externalSettings)
      setLoading(false)
    }
  }, [externalSettings])

  React.useEffect(() => {
    if (externalHub3PreviewUrl) {
      setHub3PreviewUrl(externalHub3PreviewUrl)
    }
  }, [externalHub3PreviewUrl])

  React.useEffect(() => {
    if (!smtpTestEmail) {
      const candidate =
        user?.email && user.email.includes("@")
          ? user.email
          : settings?.sender_email || ""
      if (candidate) setSmtpTestEmail(candidate)
    }
  }, [user?.email, settings?.sender_email, smtpTestEmail])

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
      notifyError("Greška pri učitavanju postavki donacijskih kampanja.")
    } finally {
      setLoading(false)
    }
  }, [notifyError])

  React.useEffect(() => {
    if (!externalSettings) {
      loadData()
    }
  }, [externalSettings, loadData])

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    if (onError) onError("")
    try {
      const res = await fetch("/api/admin/mailcrawl/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && (data.ok || data.settings)) {
        const updatedSettings = data.settings || settings
        setSettings(updatedSettings)
        let refreshedHub = hub3PreviewUrl
        try {
          const hubRes = await fetch("/api/admin/mailcrawl/hub3-preview", { cache: "no-store" })
          if (hubRes.ok) {
            const hubData = await hubRes.json().catch(() => ({}))
            if (hubData.dataUrl) {
              setHub3PreviewUrl(hubData.dataUrl)
              refreshedHub = hubData.dataUrl
            }
          }
        } catch {}
        onSettingsSaved?.(updatedSettings, refreshedHub)
        notifySuccess("Postavke donacijskih kampanja, Serper pretrage, HUB-3A i SMTP-a su spremljene!")
      } else {
        notifyError(data.error || "Greška pri spremanju postavki kampanje.")
      }
    } catch {
      notifyError("Greška pri komunikaciji s poslužiteljem.")
    } finally {
      setSaving(false)
    }
  }

  const handleTestSerper = async () => {
    if (!settings) return
    setTestSerperLoading(true)
    setSerperStatus({ state: "idle" })
    try {
      const res = await fetch("/api/admin/mailcrawl/settings/test-serper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serper_api_key: settings.serper_api_key || "" }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) {
        setSerperStatus({ state: "ok", message: data.message })
        notifySuccess(data.message)
      } else {
        const msg = data.error || "Serper.dev test nije uspio."
        setSerperStatus({ state: "error", message: msg })
        notifyError(msg)
      }
    } catch (err: any) {
      const msg = err?.message || "Greška mreže pri testiranju Serper.dev API-ja."
      setSerperStatus({ state: "error", message: msg })
      notifyError(msg)
    } finally {
      setTestSerperLoading(false)
    }
  }

  const handleTestTavily = async () => {
    if (!settings) return
    setTestTavilyLoading(true)
    setTavilyStatus({ state: "idle" })
    try {
      const res = await fetch("/api/admin/mailcrawl/settings/test-tavily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tavily_api_key: settings.tavily_api_key || "" }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) {
        setTavilyStatus({ state: "ok", message: data.message })
        notifySuccess(data.message)
      } else {
        const msg = data.error || "Tavily test nije uspio."
        setTavilyStatus({ state: "error", message: msg })
        notifyError(msg)
      }
    } catch (err: any) {
      const msg = err?.message || "Greška mreže pri testiranju Tavily API-ja."
      setTavilyStatus({ state: "error", message: msg })
      notifyError(msg)
    } finally {
      setTestTavilyLoading(false)
    }
  }

  const handleTestFirecrawl = async () => {
    if (!settings) return
    setTestFirecrawlLoading(true)
    setFirecrawlStatus({ state: "idle" })
    try {
      const res = await fetch("/api/admin/mailcrawl/settings/test-firecrawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firecrawl_api_key: settings.firecrawl_api_key || "" }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) {
        setFirecrawlStatus({ state: "ok", message: data.message })
        notifySuccess(data.message)
      } else {
        const msg = data.error || "Firecrawl test nije uspio."
        setFirecrawlStatus({ state: "error", message: msg })
        notifyError(msg)
      }
    } catch (err: any) {
      const msg = err?.message || "Greška mreže pri testiranju Firecrawl API-ja."
      setFirecrawlStatus({ state: "error", message: msg })
      notifyError(msg)
    } finally {
      setTestFirecrawlLoading(false)
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
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) {
        const msg = data.message || `Veza s Gemini AI je uspješna! (${data.used_model || settings.gemini_model})`
        setGeminiStatus({ state: "ok", message: msg })
        notifySuccess(msg)
      } else {
        const msg = data.error || "Greška pri testiranju Gemini AI."
        setGeminiStatus({ state: "error", message: msg })
        notifyError(msg)
      }
    } catch {
      setGeminiStatus({ state: "error", message: "Greška mreže." })
    } finally {
      setTestGeminiLoading(false)
    }
  }

  const handleListGeminiModels = async () => {
    if (!settings?.gemini_api_key) {
      notifyError("Prvo unesite Gemini API ključ.")
      return
    }
    setModelsLoading(true)
    try {
      const res = await fetch("/api/admin/mailcrawl/settings/list-gemini-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gemini_api_key: settings.gemini_api_key }),
      })
      const data = await res.json()
      if (res.ok && Array.isArray(data.models)) {
        setGeminiModels(data.models)
        notifySuccess(`Dohvaćeno ${data.models.length} aktivnih Gemini modela.`)
      } else {
        notifyError(data.error || "Nije moguće dohvatiti modele.")
      }
    } catch {
      notifyError("Greška pri dohvatu Gemini modela.")
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
      if (res.ok && data.smtp) {
        setSettings({
          ...settings,
          smtp_host: data.smtp.smtp_host || "",
          smtp_port: String(data.smtp.smtp_port || "587"),
          smtp_user: data.smtp.smtp_user || "",
          smtp_pass: data.smtp.smtp_pass || "",
          smtp_secure: String(data.smtp.smtp_secure) === "true" ? "true" : "false",
          sender_email: data.smtp.sender_email || settings.sender_email,
        })
        notifySuccess("SMTP postavke preuzete iz glavnih sustavskih postavki. Kliknite 'Spremi sve postavke'.")
      } else {
        notifyError(data.error || "Glavne SMTP postavke nisu pronađene.")
      }
    } catch {
      notifyError("Greška pri kopiranju SMTP postavki.")
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
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) {
        setSmtpStatus({ state: "ok", message: data.message || "SMTP veza je uspješna!" })
        notifySuccess(data.message || "SMTP veza za donacije je ispravna.")
      } else {
        setSmtpStatus({ state: "error", message: data.error || "Greška pri spajanju na SMTP." })
        notifyError(data.error || "Greška pri provjeri SMTP poslužitelja.")
      }
    } catch {
      setSmtpStatus({ state: "error", message: "Greška mreže." })
    } finally {
      setTestSmtpLoading(false)
    }
  }

  const handleSendSmtpDirectTest = async () => {
    if (!settings || !smtpTestEmail.trim() || !smtpTestEmail.includes("@")) {
      notifyError("Unesite valjanu e-mail adresu za slanje testne poruke.")
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
      if (res.ok && data.ok) {
        setSmtpStatus({ state: "ok", message: `Testni mail poslan na ${smtpTestEmail.trim()}!` })
        notifySuccess(`Testni e-mail donacijske kampanje poslan je na ${smtpTestEmail.trim()}.`)
      } else {
        setSmtpStatus({ state: "error", message: data.error || "Slanje testnog e-maila nije uspjelo." })
        notifyError(data.error || "Slanje testnog e-maila nije uspjelo.")
      }
    } catch {
      notifyError("Greška pri slanju testnog e-maila.")
    } finally {
      setSmtpSendingTest(false)
    }
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !settings) return
    if (file.size > 1024 * 1024) {
      notifyError("Logotip je prevelik (maksimalno 1 MB).")
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      setSettings({ ...settings, custom_logo: dataUrl })
      notifySuccess("Logotip učitan! Kliknite 'Spremi sve postavke' kako bi se spremio.")
    }
    reader.readAsDataURL(file)
  }

  if (loading || !settings) {
    return (
      <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
        <RefreshCw className="h-4 w-4 animate-spin" />
        Učitavanje postavki donacija, Serper pretrage, HUB-3A i AI sustava...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-card rounded-xl border shadow-xs">
        <div>
          <h2 className="text-base font-semibold">Postavke e-mail kampanje i donacija</h2>
          <p className="text-xs text-muted-foreground">
            Konfigurirajte podatke za uplatu (HUB-3A), Serper.dev brzu pretragu, Google Gemini AI, sigurnost skupnog slanja, SMTP i potpis.
          </p>
        </div>
        <SaveActionButton
          label="Spremi sve postavke"
          size="sm"
          loading={saving}
          loadingLabel="Spremam..."
          onClick={handleSave}
          className="shrink-0"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Podaci društva i uplatnica + Skupno slanje */}
        <div className="space-y-6">
          <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b pb-3">
              <QrCode className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Podaci društva & HUB-3A 2D uplatnica</h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium">Naziv primatelja:</label>
                <Input
                  value={settings.org_name}
                  onChange={(e) => setSettings({ ...settings, org_name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium">Ulica i broj:</label>
                  <Input
                    value={settings.org_street}
                    onChange={(e) => setSettings({ ...settings, org_street: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Grad i poštanski br.:</label>
                  <Input
                    value={settings.org_city}
                    onChange={(e) => setSettings({ ...settings, org_city: e.target.value })}
                  />
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
                  <Input
                    value={settings.payment_model}
                    onChange={(e) => setSettings({ ...settings, payment_model: e.target.value })}
                  />
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
                    Službeni HUB-3A 2D barkod (generira se u svakom mailu):
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={hub3PreviewUrl}
                    alt="HUB-3A barkod"
                    className="max-h-24 bg-white p-2 rounded border"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Postavke sigurnosti skupnog slanja */}
          <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b pb-3">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <h3 className="font-semibold text-sm">Skupno slanje i anti-spam zaštita</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Zadani razmak između mailova (sekunde):</label>
                <Input
                  type="number"
                  step="0.5"
                  min="1.5"
                  max="15"
                  value={settings.bulk_send_delay_sec || "3.5"}
                  onChange={(e) => setSettings({ ...settings, bulk_send_delay_sec: e.target.value })}
                  className="font-mono"
                />
                <p className="text-[11px] text-muted-foreground">Preporučeno 3,5 s (+ nasumični pomak) radi zaštite domene.</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Preporučeni dnevni limit slanja:</label>
                <Input
                  type="number"
                  min="10"
                  max="1000"
                  value={settings.bulk_send_daily_limit || "150"}
                  onChange={(e) => setSettings({ ...settings, bulk_send_daily_limit: e.target.value })}
                  className="font-mono"
                />
                <p className="text-[11px] text-muted-foreground">Upozorenje kad dnevni brojač prijeđe prag (npr. 150/dan).</p>
              </div>
            </div>
          </div>
        </div>

        {/* 2. API izvori (Serper, Tavily, Firecrawl), Gemini AI & SMTP Postavke */}
        <div className="space-y-6">
          {/* API izvori za brzo prikupljanje */}
          <div className="rounded-xl border border-emerald-500/30 bg-card p-5 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b pb-3 gap-2">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-emerald-600" />
                <h3 className="font-semibold text-sm">
                  API izvori za brzo prikupljanje (Serper.dev, Tavily, Firecrawl)
                </h3>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-500/20 text-[11px] text-emerald-900 dark:text-emerald-200 leading-relaxed">
              <strong>Pametna kaskada bez rasipanja kredita:</strong> Pretraga koristi{" "}
              <span className="font-semibold">Serper.dev → Tavily Search → besplatni web</span>, dok se
              čitanje stranica obavlja brzim paralelnim <span className="font-semibold">fetch</span> zahtjevom
              (0 kredita), a <span className="font-semibold">Firecrawl</span> se aktivira samo za JS/Wix/zaštićene
              stranice (maks. 1 kredit/stranica).
            </div>

            {/* 1. Serper.dev */}
            <div className="space-y-2 rounded-lg border p-3.5 bg-muted/20">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold">1. Serper.dev (Google Search + Places)</div>
                  <div className="text-[11px] text-muted-foreground">
                    2.500 jednokratnih besplatnih upita · Najbrži pronalazak tvrtki i obrta u RH
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ConnectionStatusBadge loading={testSerperLoading} status={serperStatus} />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleTestSerper}
                    disabled={testSerperLoading}
                    className="text-xs h-7"
                  >
                    {testSerperLoading ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : null}
                    Testiraj Serper
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between mt-1">
                <label className="text-[11px] font-medium text-muted-foreground">Serper.dev API ključ:</label>
                {user?.role === "admin" && (
                  <button
                    type="button"
                    onClick={() => setShowSerperKey((p) => !p)}
                    className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    {showSerperKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    <span>{showSerperKey ? "Sakrij" : "Prikaži"}</span>
                  </button>
                )}
              </div>
              <Input
                type={user?.role === "admin" && showSerperKey ? "text" : "password"}
                placeholder="Unesite ključ s serper.dev..."
                value={settings.serper_api_key || ""}
                onChange={(e) => setSettings({ ...settings, serper_api_key: e.target.value })}
                className="font-mono text-xs h-8"
              />
            </div>

            {/* 2. Tavily Search */}
            <div className="space-y-2 rounded-lg border p-3.5 bg-muted/20">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold">2. Tavily Search (Mjesečni besplatni paket)</div>
                  <div className="text-[11px] text-muted-foreground">
                    1.000 besplatnih kredita svaki mjesec · Automatski fallback ako je Serper prazan ili potrošen
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ConnectionStatusBadge loading={testTavilyLoading} status={tavilyStatus} />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleTestTavily}
                    disabled={testTavilyLoading}
                    className="text-xs h-7"
                  >
                    {testTavilyLoading ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : null}
                    Testiraj Tavily
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between mt-1">
                <label className="text-[11px] font-medium text-muted-foreground">Tavily API ključ:</label>
                {user?.role === "admin" && (
                  <button
                    type="button"
                    onClick={() => setShowTavilyKey((p) => !p)}
                    className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    {showTavilyKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    <span>{showTavilyKey ? "Sakrij" : "Prikaži"}</span>
                  </button>
                )}
              </div>
              <Input
                type={user?.role === "admin" && showTavilyKey ? "text" : "password"}
                placeholder="tvly-..."
                value={settings.tavily_api_key || ""}
                onChange={(e) => setSettings({ ...settings, tavily_api_key: e.target.value })}
                className="font-mono text-xs h-8"
              />
            </div>

            {/* 3. Firecrawl */}
            <div className="space-y-2 rounded-lg border p-3.5 bg-muted/20">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold">3. Firecrawl (Pametni čitač za JS / Wix / blokade)</div>
                  <div className="text-[11px] text-muted-foreground">
                    1.000 besplatnih kredita mjesečno · Aktivira se SAMO kad običan fetch ne pronađe e-mail (maks. 2 paralelno)
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ConnectionStatusBadge loading={testFirecrawlLoading} status={firecrawlStatus} />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleTestFirecrawl}
                    disabled={testFirecrawlLoading}
                    className="text-xs h-7"
                  >
                    {testFirecrawlLoading ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : null}
                    Testiraj Firecrawl
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between mt-1">
                <label className="text-[11px] font-medium text-muted-foreground">Firecrawl API ključ:</label>
                {user?.role === "admin" && (
                  <button
                    type="button"
                    onClick={() => setShowFirecrawlKey((p) => !p)}
                    className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    {showFirecrawlKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    <span>{showFirecrawlKey ? "Sakrij" : "Prikaži"}</span>
                  </button>
                )}
              </div>
              <Input
                type={user?.role === "admin" && showFirecrawlKey ? "text" : "password"}
                placeholder="fc-..."
                value={settings.firecrawl_api_key || ""}
                onChange={(e) => setSettings({ ...settings, firecrawl_api_key: e.target.value })}
                className="font-mono text-xs h-8"
              />
            </div>
          </div>

          {/* Gemini AI */}
          <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-amber-500" />
                <h3 className="font-semibold text-sm">Google Gemini AI postavke</h3>
              </div>
              <div className="flex items-center gap-2">
                <ConnectionStatusBadge loading={testGeminiLoading} status={geminiStatus} />
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
            </div>

            <div className="space-y-3">
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
                  <Select
                    value={settings.gemini_model}
                    onValueChange={(val) => setSettings({ ...settings, gemini_model: val })}
                  >
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
            </div>
          </div>

          {/* SMTP Server */}
          <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-3 gap-2">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm">SMTP poslužitelj za slanje</h3>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
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
                <ConnectionStatusBadge loading={testSmtpLoading} status={smtpStatus} />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTestSmtp}
                  disabled={testSmtpLoading}
                  className="text-xs h-7"
                >
                  {testSmtpLoading ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : null}
                  Testiraj SMTP vezu
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium">SMTP poslužitelj (Host):</label>
                  <Input
                    placeholder="npr. mail.rodoslovlje.hr ili smtp.gmail.com"
                    value={settings.smtp_host}
                    onChange={(e) => setSettings({ ...settings, smtp_host: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Port:</label>
                  <Input
                    placeholder="465 ili 587"
                    value={settings.smtp_port}
                    onChange={(e) => {
                      const val = e.target.value
                      const is465 = val === "465"
                      setSettings({
                        ...settings,
                        smtp_port: val,
                        smtp_secure: is465 ? "true" : val === "587" || val === "25" ? "false" : settings.smtp_secure,
                      })
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium">Korisničko ime / Email za prijavu:</label>
                  <Input
                    placeholder="rodoslovlje@rodoslovlje.hr"
                    value={settings.smtp_user}
                    onChange={(e) => setSettings({ ...settings, smtp_user: e.target.value })}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium">SMTP lozinka:</label>
                    {user?.role === "admin" && (
                      <button
                        type="button"
                        onClick={() => setShowSmtpPass((p) => !p)}
                        className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                      >
                        {showSmtpPass ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        <span>{showSmtpPass ? "Sakrij lozinku" : "Prikaži lozinku"}</span>
                      </button>
                    )}
                  </div>
                  <Input
                    type={user?.role === "admin" && showSmtpPass ? "text" : "password"}
                    placeholder="Lozinka sandučića ili App Password"
                    value={settings.smtp_pass}
                    onChange={(e) => setSettings({ ...settings, smtp_pass: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-xs font-medium">Ime pošiljatelja:</label>
                  <Input
                    value={settings.sender_name}
                    onChange={(e) => setSettings({ ...settings, sender_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Adresa pošiljatelja (From Email):</label>
                  <Input
                    value={settings.sender_email}
                    onChange={(e) => setSettings({ ...settings, sender_email: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div className="space-y-0.5">
                  <label className="text-xs font-medium">Sigurna veza (SSL / TLS):</label>
                  <p className="text-[11px] text-muted-foreground">
                    Uključeno za port 465 (SSL). Za port 587 (STARTTLS) ostavite isključeno.
                  </p>
                </div>
                <Switch
                  checked={String(settings.smtp_secure) === "true"}
                  onCheckedChange={(checked) => setSettings({ ...settings, smtp_secure: checked ? "true" : "false" })}
                />
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-3 rounded-lg border bg-muted/40">
                <div className="flex items-center gap-1.5 text-xs font-semibold shrink-0">
                  <Send className="h-3.5 w-3.5 text-primary" />
                  Testni mail:
                </div>
                <Input
                  type="email"
                  placeholder="Unesite e-mail za test..."
                  value={smtpTestEmail}
                  onChange={(e) => setSmtpTestEmail(e.target.value)}
                  className="text-xs h-8 flex-1"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="text-xs h-8 shrink-0"
                  onClick={handleSendSmtpDirectTest}
                  disabled={smtpSendingTest}
                >
                  {smtpSendingTest ? <RefreshCw className="h-3 w-3 animate-spin mr-1.5" /> : <Send className="h-3 w-3 mr-1.5" />}
                  {smtpSendingTest ? "Šaljem..." : "Pošalji test"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Logotip i potpis */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b pb-3">
            <ImageIcon className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Logotip u potpisu e-maila</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Učitajte logotip (PNG, JPG ili WebP do 1 MB) koji će se prikazivati u potpisu svih odlaznih e-mailova donacija.
          </p>

          <div className="flex flex-col items-center justify-center p-4 border border-dashed rounded-lg bg-muted/20 min-h-[110px] gap-2">
            {settings.custom_logo ? (
              <div className="flex flex-col items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={settings.custom_logo}
                  alt="Logotip kampanje"
                  className="max-h-20 max-w-[200px] object-contain rounded border p-1 bg-white shadow-xs"
                />
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" className="text-xs h-7" onClick={() => logoInputRef.current?.click()}>
                    <Upload className="h-3 w-3 mr-1" />
                    Promijeni
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7 text-rose-500 hover:text-rose-600"
                    onClick={() => setSettings({ ...settings, custom_logo: "" })}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Ukloni
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5 text-center">
                <ImageIcon className="h-8 w-8 text-muted-foreground/60" />
                <span className="text-xs text-muted-foreground">Nema učitanog logotipa</span>
                <Button type="button" variant="outline" size="sm" className="text-xs h-7 mt-1" onClick={() => logoInputRef.current?.click()}>
                  <Upload className="h-3 w-3 mr-1" />
                  Učitaj logotip
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
        </div>

        <div className="lg:col-span-2 rounded-xl border bg-card p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2 border-b pb-3">
            <Info className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Potpis na dnu maila</h3>
          </div>
          <Textarea
            rows={5}
            value={settings.email_signature}
            onChange={(e) => setSettings({ ...settings, email_signature: e.target.value })}
            placeholder="Hrvatsko rodoslovno društvo “Pavao Ritter Vitezović”&#10;(LOGO)&#10;OIB: 17328479414..."
          />
          <p className="text-[11px] text-muted-foreground">
            Oznaka <code className="px-1 py-0.5 rounded bg-muted">(LOGO)</code> automatski postavlja učitani logotip na to mjesto.
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-border">
        <SaveActionButton
          label="Spremi sve postavke kampanje"
          loading={saving}
          loadingLabel="Spremam postavke..."
          onClick={handleSave}
          className="min-w-[240px]"
        />
      </div>
    </div>
  )
}
