"use client"

import * as React from "react"
import { 
  Sparkles, 
  Search, 
  Send, 
  Globe, 
  Mail, 
  Building2, 
  User, 
  CheckCircle2, 
  AlertCircle,
  AlertTriangle, 
  RefreshCw, 
  Clock, 
  Settings, 
  Eye, 
  Trash2, 
  SlidersHorizontal,
  Bot,
  QrCode,
  ShieldCheck,
  Check,
  X,
  ExternalLink,
  Plus,
  Play,
  Save,
  Upload,
  Copy,
  Info,
  Heart,
  HeartHandshake,
  RotateCcw,
  Image as ImageIcon
} from "lucide-react"
import { cn } from "@/lib/utils"
import { buildGreeting } from "@/lib/mailcrawl/ai"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import type { Lead, CampaignSettings, SentRegistryItem } from "@/lib/mailcrawl/types"
import type { CrawlJobState } from "@/lib/mailcrawl/crawler-state"

function StatusBadge({
  loading,
  status
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

export function DonationsContent() {
  const [activeTab, setActiveTab] = React.useState("search")
  
  // Stats
  const [stats, setStats] = React.useState<{
    total: number
    newCount: number
    draftCount: number
    sentCount: number
    donorCount?: number
    totalDonatedEur?: number
    rejectedCount: number
    registrySentTotal: number
    byType: { tvrtka: number; obrt: number; udruga: number }
  }>({
    total: 0,
    newCount: 0,
    draftCount: 0,
    sentCount: 0,
    donorCount: 0,
    totalDonatedEur: 0,
    rejectedCount: 0,
    registrySentTotal: 0,
    byType: { tvrtka: 0, obrt: 0, udruga: 0 }
  })

  // Crawler state
  const [crawlStatus, setCrawlStatus] = React.useState<CrawlJobState>({
    running: false,
    logs: [],
    foundCount: 0,
    insertedCount: 0,
    duplicateCount: 0,
    startedAt: null,
    finishedAt: null
  })

  // Search form state
  const [searchQuery, setSearchQuery] = React.useState("")
  const [searchCity, setSearchCity] = React.useState("")
  const [searchEntityType, setSearchEntityType] = React.useState("all")
  const [searchSource, setSearchSource] = React.useState("all")
  const [searchMax, setSearchMax] = React.useState("10")
  const [autoGenerateAi, setAutoGenerateAi] = React.useState(true)

  // Direct URL crawl
  const [singleUrl, setSingleUrl] = React.useState("")
  const [singleLoading, setSingleLoading] = React.useState(false)

  // Manual Add Dialog
  const [manualDialogOpen, setManualDialogOpen] = React.useState(false)
  const [manualForm, setManualForm] = React.useState({
    name: "",
    email: "",
    website: "",
    oib: "",
    city: "",
    contact_person: "",
    contact_role: "",
    entity_type: "tvrtka",
    activity_category: "",
    autoGenerateAi: true
  })

  // Leads list state
  const [leads, setLeads] = React.useState<Lead[]>([])
  const [leadFilterStatus, setLeadFilterStatus] = React.useState("all")
  const [leadFilterType, setLeadFilterType] = React.useState("all")
  const [leadSearchQuery, setLeadSearchQuery] = React.useState("")
  const [leadsLoading, setLeadsLoading] = React.useState(false)

  // Sent Registry list state
  const [sentRegistry, setSentRegistry] = React.useState<SentRegistryItem[]>([])
  const [sentFilter, setSentFilter] = React.useState("")

  // Campaign Settings state
  const [settings, setSettings] = React.useState<CampaignSettings | null>(null)
  const [settingsLoading, setSettingsLoading] = React.useState(false)
  const [hub3PreviewUrl, setHub3PreviewUrl] = React.useState<string>("")
  const [geminiModels, setGeminiModels] = React.useState<{ id: string; displayName: string }[]>([])
  const [modelsLoading, setModelsLoading] = React.useState(false)
  const [testGeminiLoading, setTestGeminiLoading] = React.useState(false)
  const [testSmtpLoading, setTestSmtpLoading] = React.useState(false)
  const [copyingSmtp, setCopyingSmtp] = React.useState(false)
  const [savingSettings, setSavingSettings] = React.useState(false)
  const [geminiStatus, setGeminiStatus] = React.useState<{ state: "idle" | "ok" | "error"; message?: string }>({ state: "idle" })
  const [smtpStatus, setSmtpStatus] = React.useState<{ state: "idle" | "ok" | "error"; message?: string }>({ state: "idle" })
  const logoInputRef = React.useRef<HTMLInputElement>(null)

  // Lead preview / edit dialog
  const [selectedLead, setSelectedLead] = React.useState<Lead | null>(null)
  const [previewDialogOpen, setPreviewDialogOpen] = React.useState(false)
  const [previewData, setPreviewData] = React.useState<{
    html: string
    plainText: string
    barcodeDataUrl: string
    from?: string
  } | null>(null)
  const [previewTab, setPreviewTab] = React.useState<"visual" | "edit">("visual")
  const [editSubject, setEditSubject] = React.useState("")
  const [editBody, setEditBody] = React.useState("")
  const [editEmail, setEditEmail] = React.useState("")
  const [editContact, setEditContact] = React.useState("")
  const [customAiPrompt, setCustomAiPrompt] = React.useState("")
  const [generatingAiSingle, setGeneratingAiSingle] = React.useState(false)
  const [sendingEmail, setSendingEmail] = React.useState(false)
  const [testEmailAddress, setTestEmailAddress] = React.useState("")
  const [reprocessingLeadId, setReprocessingLeadId] = React.useState<number | null>(null)
  const [savingLeadEdits, setSavingLeadEdits] = React.useState(false)
  const [smtpTestEmail, setSmtpTestEmail] = React.useState("tomica.hap@gmail.com")
  const [smtpSendingTest, setSmtpSendingTest] = React.useState(false)
  // Donor modal state
  const [donorDialogOpen, setDonorDialogOpen] = React.useState(false)
  const [donorLead, setDonorLead] = React.useState<Lead | null>(null)
  const [donorAmount, setDonorAmount] = React.useState("50.00")
  const [donorDate, setDonorDate] = React.useState(new Date().toISOString().split("T")[0])
  const [donorNote, setDonorNote] = React.useState("Uplaćeno prema pozivu za donaciju")
  const [savingDonor, setSavingDonor] = React.useState(false)

  const logsEndRef = React.useRef<HTMLDivElement>(null)

  // Load stats
  const fetchStats = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/mailcrawl/stats")
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch {}
  }, [])

  // Load leads
  const fetchLeads = React.useCallback(async () => {
    setLeadsLoading(true)
    try {
      const params = new URLSearchParams()
      if (leadFilterStatus !== "all") params.append("status", leadFilterStatus)
      if (leadFilterType !== "all") params.append("entity_type", leadFilterType)
      if (leadSearchQuery) params.append("q", leadSearchQuery)
      const res = await fetch(`/api/admin/mailcrawl/leads?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setLeads(data)
      }
    } catch {
      toast.error("Greška pri dohvatu liste kontakata.")
    } finally {
      setLeadsLoading(false)
    }
  }, [leadFilterStatus, leadFilterType, leadSearchQuery])

  // Load sent registry
  const fetchSentRegistry = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/mailcrawl/sent-registry")
      if (res.ok) {
        const data = await res.json()
        setSentRegistry(data)
      }
    } catch {}
  }, [])

  // Load settings
  const fetchSettings = React.useCallback(async () => {
    setSettingsLoading(true)
    try {
      const res = await fetch("/api/admin/mailcrawl/settings")
      if (res.ok) {
        const data = await res.json()
        setSettings(data)
      }
      const hubRes = await fetch("/api/admin/mailcrawl/hub3-preview")
      if (hubRes.ok) {
        const hubData = await hubRes.json()
        if (hubData.dataUrl) setHub3PreviewUrl(hubData.dataUrl)
      }
    } catch {
      toast.error("Greška pri dohvatu postavki.")
    } finally {
      setSettingsLoading(false)
    }
  }, [])

  // Polling crawler status when running
  React.useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    const checkCrawl = async () => {
      try {
        const res = await fetch("/api/admin/mailcrawl/crawl/status")
        if (res.ok) {
          const st: CrawlJobState = await res.json()
          setCrawlStatus(st)
          if (!st.running && interval) {
            clearInterval(interval)
            fetchStats()
            fetchLeads()
          }
        }
      } catch {}
    }

    checkCrawl()
    if (crawlStatus.running) {
      interval = setInterval(checkCrawl, 1500)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [crawlStatus.running, fetchStats, fetchLeads])

  // Scroll logs to bottom
  React.useEffect(() => {
    if (crawlStatus.running && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [crawlStatus.logs, crawlStatus.running])

  // Initial load
  React.useEffect(() => {
    fetchStats()
    fetchLeads()
    fetchSentRegistry()
    fetchSettings()
  }, [fetchStats, fetchLeads, fetchSentRegistry, fetchSettings])

  // Start search crawler
  const handleStartSearch = async () => {
    try {
      const res = await fetch("/api/admin/mailcrawl/crawl/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: searchQuery,
          city: searchCity,
          entityType: searchEntityType,
          registrySource: searchSource,
          maxResults: parseInt(searchMax, 10),
          autoGenerateAi
        })
      })
      const data = await res.json()
      if (res.ok) {
        toast.success("Pretraživanje pokrenuto!")
        setCrawlStatus(prev => ({ ...prev, running: true }))
      } else {
        toast.error(data.error || "Nije uspjelo pokretanje.")
      }
    } catch {
      toast.error("Došlo je do greške pri pokretanju.")
    }
  }

  // Single website crawl
  const handleSingleUrlCrawl = async () => {
    if (!singleUrl.trim()) {
      toast.error("Unesite URL web stranice.")
      return
    }
    setSingleLoading(true)
    try {
      const res = await fetch("/api/admin/mailcrawl/crawl/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: singleUrl,
          autoGenerateAi: true
        })
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Uspješno analizirano i dodano: ${data.lead.name}!`)
        setSingleUrl("")
        fetchStats()
        fetchLeads()
      } else {
        toast.error(data.error || "Greška pri analizi weba.")
      }
    } catch {
      toast.error("Greška pri spajanju s poslužiteljem.")
    } finally {
      setSingleLoading(false)
    }
  }

  // Manual lead add
  const handleManualAdd = async () => {
    if (!manualForm.name.trim() || !manualForm.email.trim()) {
      toast.error("Naziv i e-mail su obavezni.")
      return
    }
    try {
      const res = await fetch("/api/admin/mailcrawl/leads/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(manualForm)
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Dodan subjekt: ${data.lead.name}`)
        setManualDialogOpen(false)
        setManualForm({
          name: "",
          email: "",
          website: "",
          oib: "",
          city: "",
          contact_person: "",
          contact_role: "",
          entity_type: "tvrtka",
          activity_category: "",
          autoGenerateAi: true
        })
        fetchStats()
        fetchLeads()
      } else {
        toast.error(data.error || "Greška pri dodavanju.")
      }
    } catch {
      toast.error("Greška pri komunikaciji s poslužiteljem.")
    }
  }

  // Update contact person and automatically adapt greeting
  const handleContactChange = (newContact: string) => {
    setEditContact(newContact)
    if (!selectedLead) return

    const newGreeting = buildGreeting({
      name: selectedLead.name,
      contact_person: newContact,
      entity_type: selectedLead.entity_type
    })

    let updatedBody = editBody
    if (updatedBody && updatedBody.trim()) {
      const lines = updatedBody.split("\n")
      if (lines.length > 0 && lines[0].trim().startsWith("Poštovan")) {
        lines[0] = newGreeting
        updatedBody = lines.join("\n")
      } else {
        updatedBody = newGreeting + "\n\n" + updatedBody
      }
    } else {
      updatedBody = newGreeting + "\n\n"
    }

    setEditBody(updatedBody)
    refreshPreview({ contact: newContact, body: updatedBody })
  }

  // Save manual lead edits from preview modal
  const handleSaveLeadEdits = async () => {
    if (!selectedLead?.id) return
    setSavingLeadEdits(true)
    try {
      const res = await fetch(`/api/admin/mailcrawl/leads/${selectedLead.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_person: editContact,
          email: editEmail,
          email_subject: editSubject,
          email_body: editBody
        })
      })
      const data = await res.json()
      if (res.ok && data.lead) {
        setSelectedLead(data.lead)
        setLeads(prev => prev.map(l => l.id === selectedLead.id ? data.lead : l))
        toast.success("Podaci subjekta i tekst maila uspješno spremljeni!")
        refreshPreview()
      } else {
        toast.error(data.error || "Greška pri spremanju.")
      }
    } catch {
      toast.error("Greška pri spremanju izmjena.")
    } finally {
      setSavingLeadEdits(false)
    }
  }

  // Regenerate single lead with AI
  const handleRegenerateSingleLead = async (lead: Lead) => {
    if (!lead.id) return
    setReprocessingLeadId(lead.id)
    try {
      const res = await fetch(`/api/admin/mailcrawl/leads/${lead.id}/generate-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      })
      const data = await res.json()
      if (res.ok && data.lead) {
        setLeads(prev => prev.map(l => l.id === lead.id ? data.lead : l))
        toast.success(`Subjekt "${lead.name}" uspješno ponovno obrađen s AI!`)
        if (selectedLead?.id === lead.id) {
          setSelectedLead(data.lead)
          setEditSubject(data.lead.email_subject || "")
          setEditBody(data.lead.email_body || "")
          setEditContact(data.lead.contact_person || "")
          refreshPreview({
            email: data.lead.email,
            subject: data.lead.email_subject,
            body: data.lead.email_body,
            contact: data.lead.contact_person
          })
        }
      } else {
        toast.error(data.error || "Greška pri ponovnoj obradi subjekta.")
      }
    } catch {
      toast.error("Greška pri pozivu poslužitelja.")
    } finally {
      setReprocessingLeadId(null)
    }
  }

  // Open donor dialog
  const openDonorDialog = (lead: Lead) => {
    setDonorLead(lead)
    setDonorAmount(lead.donated_amount || settings?.suggested_amount_eur || "50.00")
    setDonorDate(lead.donated_at || new Date().toISOString().split("T")[0])
    setDonorNote(lead.donation_note || "Uplaćeno prema pozivu za donaciju")
    setDonorDialogOpen(true)
  }

  // Save donor payment
  const handleSaveDonor = async () => {
    if (!donorLead?.id) return
    setSavingDonor(true)
    try {
      const res = await fetch(`/api/admin/mailcrawl/leads/${donorLead.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "donor",
          donated_at: donorDate,
          donated_amount: donorAmount,
          donation_note: donorNote
        })
      })
      const data = await res.json()
      if (res.ok && data.lead) {
        setLeads(prev => prev.map(l => l.id === donorLead.id ? data.lead : l))
        toast.success(`Subjekt "${donorLead.name}" uspješno označen kao donator (${donorAmount} EUR)!`)
        setDonorDialogOpen(false)
        fetchStats()
      } else {
        toast.error(data.error || "Greška pri spremanju uplate donatora.")
      }
    } catch {
      toast.error("Greška pri komunikaciji s poslužiteljem.")
    } finally {
      setSavingDonor(false)
    }
  }

  // Reset lead for a future campaign cycle
  const handleResetForFutureCampaign = async (lead: Lead) => {
    if (!lead.id) return
    try {
      const res = await fetch(`/api/admin/mailcrawl/leads/${lead.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "draft_ready"
        })
      })
      const data = await res.json()
      if (res.ok && data.lead) {
        setLeads(prev => prev.map(l => l.id === lead.id ? data.lead : l))
        toast.success(`Subjekt "${lead.name}" spreman za novu kampanju (status vraćen na nacrt).`)
        fetchStats()
      }
    } catch {
      toast.error("Greška pri reaktivaciji subjekta.")
    }
  }

  // Send SMTP test email to personal address
  const handleSendSmtpDirectTest = async () => {
    if (!smtpTestEmail || !smtpTestEmail.includes("@")) {
      toast.error("Unesite valjanu e-mail adresu za test.")
      return
    }
    setSmtpSendingTest(true)
    try {
      const res = await fetch("/api/admin/mailcrawl/settings/send-test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: smtpTestEmail, settings })
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        toast.success(data.message || `Testni e-mail poslan na ${smtpTestEmail}!`)
        setSmtpStatus({ state: "ok", message: `Testni mail poslan na ${smtpTestEmail}!` })
      } else {
        const errorMsg = data.error || "Greška pri slanju testnog e-maila."
        toast.error(errorMsg)
        setSmtpStatus({ state: "error", message: errorMsg })
      }
    } catch (err: any) {
      const msg = err?.message || "Greška pri slanju testnog maila."
      toast.error(msg)
      setSmtpStatus({ state: "error", message: msg })
    } finally {
      setSmtpSendingTest(false)
    }
  }

  // Open preview modal for lead
  const openLeadPreview = async (lead: Lead) => {
    setSelectedLead(lead)
    setEditSubject(lead.email_subject || `${lead.name} i očuvanje hrvatskih korijena`)
    setEditBody(lead.email_body || "")
    setEditEmail(lead.email || "")
    setEditContact(lead.contact_person || "")
    setCustomAiPrompt("")
    setPreviewTab("visual")
    setTestEmailAddress(prev => prev || settings?.sender_email || "tomica.hap@gmail.com")
    setPreviewDialogOpen(true)

    try {
      const res = await fetch(`/api/admin/mailcrawl/leads/${lead.id}/preview-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: lead.email,
          email_subject: lead.email_subject,
          email_body: lead.email_body
        })
      })
      if (res.ok) {
        const data = await res.json()
        setPreviewData(data)
      }
    } catch {}
  }

  // Refresh visual preview
  const refreshPreview = async (overrides?: {
    email?: string
    subject?: string
    body?: string
    contact?: string
  }) => {
    if (!selectedLead) return
    try {
      const res = await fetch(`/api/admin/mailcrawl/leads/${selectedLead.id}/preview-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: overrides?.email ?? editEmail,
          email_subject: overrides?.subject ?? editSubject,
          email_body: overrides?.body ?? editBody,
          contact_person: overrides?.contact ?? editContact
        })
      })
      if (res.ok) {
        const data = await res.json()
        setPreviewData(data)
      }
    } catch {}
  }

  // Generate AI single
  const handleGenerateAiSingle = async () => {
    if (!selectedLead) return
    setGeneratingAiSingle(true)
    try {
      const res = await fetch(`/api/admin/mailcrawl/leads/${selectedLead.id}/generate-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customInstruction: customAiPrompt })
      })
      const data = await res.json()
      if (res.ok) {
        toast.success("AI je uspješno kreirao personalizirani mail!")
        setSelectedLead(data.lead)
        setEditSubject(data.lead.email_subject)
        setEditBody(data.lead.email_body)
        refreshPreview()
        fetchLeads()
        fetchStats()
      } else {
        toast.error(data.error || "Greška pri generiranju AI teksta.")
      }
    } catch {
      toast.error("Došlo je do greške.")
    } finally {
      setGeneratingAiSingle(false)
    }
  }

  // Send email to lead
  const handleApproveAndSend = async () => {
    if (!selectedLead) return
    setSendingEmail(true)
    try {
      const res = await fetch(`/api/admin/mailcrawl/leads/${selectedLead.id}/approve-and-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: editEmail,
          email_subject: editSubject,
          email_body: editBody,
          contact_person: editContact
        })
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Mail uspješno poslan na ${editEmail}!`)
        setPreviewDialogOpen(false)
        fetchStats()
        fetchLeads()
        fetchSentRegistry()
      } else {
        toast.error(data.error || "Greška pri slanju.")
      }
    } catch {
      toast.error("Greška pri slanju.")
    } finally {
      setSendingEmail(false)
    }
  }

  // Send test email
  const handleSendTest = async () => {
    if (!selectedLead) return
    try {
      const res = await fetch(`/api/admin/mailcrawl/leads/${selectedLead.id}/send-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testEmail: testEmailAddress,
          email_subject: editSubject,
          email_body: editBody
        })
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message || "Testni mail poslan!")
      } else {
        toast.error(data.error || "Greška pri slanju testnog maila.")
      }
    } catch {
      toast.error("Greška.")
    }
  }

  // Reject lead
  const handleRejectLead = async (id: number) => {
    try {
      const res = await fetch(`/api/admin/mailcrawl/leads/${id}/reject`, { method: "POST" })
      if (res.ok) {
        toast.info("Subjekt označen kao odbijen.")
        fetchStats()
        fetchLeads()
      }
    } catch {}
  }

  // Delete lead
  const handleDeleteLead = async (id: number) => {
    try {
      const res = await fetch(`/api/admin/mailcrawl/leads/${id}`, { method: "DELETE" })
      if (res.ok) {
        toast.success("Subjekt uklonjen iz baze.")
        fetchStats()
        fetchLeads()
      }
    } catch {}
  }

  // Bulk generate
  const handleBulkGenerate = async () => {
    try {
      toast.loading("Generiram AI nacrte za sve nove subjekte...", { id: "bulk" })
      const res = await fetch("/api/admin/mailcrawl/leads/bulk-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      })
      const data = await res.json()
      toast.dismiss("bulk")
      if (res.ok) {
        toast.success(`Generirano ${data.generated} novih nacrta mailova!`)
        fetchStats()
        fetchLeads()
      } else {
        toast.error(data.error || "Greška pri masovnom generiranju.")
      }
    } catch {
      toast.dismiss("bulk")
      toast.error("Greška.")
    }
  }

  // Logo upload handlers
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !settings) return
    if (file.size > 1024 * 1024) {
      toast.error("Slika logotipa je prevelika (maksimalno 1 MB).")
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result as string
      setSettings({ ...settings, custom_logo: base64 })
      toast.success("Logotip učitan! Kliknite 'Spremi sve postavke' kako bi se spremio.")
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveLogo = () => {
    if (!settings) return
    setSettings({ ...settings, custom_logo: "" })
    toast.info("Logotip uklonjen. Kliknite 'Spremi sve postavke' kako bi potvrdili.")
  }

  // Save Settings
  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e && e.preventDefault) e.preventDefault()
    if (!settings) return
    setSavingSettings(true)
    try {
      const res = await fetch("/api/admin/mailcrawl/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && (data.ok || data.settings)) {
        toast.success("Postavke uspješno spremljene!")
        if (data.settings) setSettings(data.settings)
        // Refresh HUB-3 preview
        try {
          const hubRes = await fetch("/api/admin/mailcrawl/hub3-preview")
          if (hubRes.ok) {
            const hubData = await hubRes.json().catch(() => ({}))
            if (hubData.dataUrl) setHub3PreviewUrl(hubData.dataUrl)
          }
        } catch {}
      } else {
        toast.error(data.error || "Greška pri spremanju postavki.")
      }
    } catch (err: any) {
      toast.error(err?.message || "Greška pri spremanju.")
    } finally {
      setSavingSettings(false)
    }
  }

  // List Gemini models
  const handleListGeminiModels = async () => {
    if (!settings?.gemini_api_key) {
      toast.error("Prvo unesite Gemini API ključ.")
      return
    }
    setModelsLoading(true)
    try {
      const res = await fetch("/api/admin/mailcrawl/settings/list-gemini-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gemini_api_key: settings.gemini_api_key })
      })
      const data = await res.json()
      if (res.ok && data.models) {
        setGeminiModels(data.models)
        toast.success(`Pronađeno ${data.models.length} aktivnih Gemini modela!`)
      } else {
        toast.error(data.error || "Nije uspio dohvat modela.")
      }
    } catch {
      toast.error("Greška pri provjeri modela.")
    } finally {
      setModelsLoading(false)
    }
  }

  // Test Gemini
  const handleTestGemini = async () => {
    setTestGeminiLoading(true)
    setGeminiStatus({ state: "idle" })
    try {
      const res = await fetch("/api/admin/mailcrawl/settings/test-gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) {
        const msg = data.message || `Gemini test uspješan! Korišten model: ${data.used_model || settings?.gemini_model || ""}`
        setGeminiStatus({ state: "ok", message: msg })
        toast.success(msg)
      } else {
        const msg = data.error || "Gemini test nije prošao."
        setGeminiStatus({ state: "error", message: msg })
        toast.error(msg)
      }
    } catch (err: any) {
      const msg = err?.message || "Greška pri povezivanju s poslužiteljem."
      setGeminiStatus({ state: "error", message: msg })
      toast.error("Greška pri testiranju Gemini-ja.")
    } finally {
      setTestGeminiLoading(false)
    }
  }

  // Copy SMTP from system settings
  const handleCopySystemSmtp = async () => {
    setCopyingSmtp(true)
    try {
      const res = await fetch("/api/admin/mailcrawl/settings/copy-system-smtp")
      const data = await res.json()
      if (res.ok && data.smtp) {
        setSettings(prev => prev ? ({ ...prev, ...data.smtp }) : prev)
        toast.success("SMTP podaci uspješno preuzeti iz glavnih postavki sustava! Kliknite 'Spremi sve postavke' za trajno spremanje.")
      } else {
        toast.error(data.error || "Nije uspjelo preuzimanje postavki sustava.")
      }
    } catch {
      toast.error("Greška pri dohvaćanju postavki sustava.")
    } finally {
      setCopyingSmtp(false)
    }
  }

  // Test SMTP
  const handleTestSmtp = async () => {
    setTestSmtpLoading(true)
    setSmtpStatus({ state: "idle" })
    try {
      const res = await fetch("/api/admin/mailcrawl/settings/test-smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) {
        const msg = data.message || "SMTP veza uspješno uspostavljena!"
        setSmtpStatus({ state: "ok", message: msg })
        toast.success(msg)
      } else {
        const msg = data.error || "SMTP veza neuspješna."
        setSmtpStatus({ state: "error", message: msg })
        toast.error(msg)
      }
    } catch (err: any) {
      const msg = err?.message || "Greška pri testiranju SMTP-a."
      setSmtpStatus({ state: "error", message: msg })
      toast.error("Greška pri testiranju SMTP-a.")
    } finally {
      setTestSmtpLoading(false)
    }
  }

  const filteredSent = sentRegistry.filter(s => {
    if (!sentFilter) return true
    const term = sentFilter.toLowerCase()
    return (
      (s.company_name || "").toLowerCase().includes(term) ||
      (s.email_norm || "").toLowerCase().includes(term) ||
      (s.oib || "").includes(term) ||
      (s.subject || "").toLowerCase().includes(term)
    )
  })

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 max-w-7xl mx-auto w-full">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-amber-500" />
              Donacije i Mail Crawler
            </h1>
            <Badge variant="outline" className="border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20">
              Admin modul
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Automatizirano pretraživanje hrvatskih subjekata, Google Gemini AI personalizacija donacijskih poziva i službeni HUB-3A 2D barkod za uplate.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { fetchStats(); fetchLeads(); fetchSentRegistry(); }}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Osvježi
          </Button>
          <Button size="sm" onClick={() => setManualDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Ručni unos subjekta
          </Button>
        </div>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="text-xs font-medium text-muted-foreground">UKUPNO KANDIDATA</div>
          <div className="text-2xl font-bold mt-1">{stats.total}</div>
          <div className="text-[11px] text-muted-foreground mt-1">
            {stats.byType.tvrtka} tvrtki · {stats.byType.obrt} obrta · {stats.byType.udruga} udruga
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm border-blue-500/20 bg-blue-50/10">
          <div className="text-xs font-medium text-blue-600 dark:text-blue-400">NOVI KONTAKTI</div>
          <div className="text-2xl font-bold mt-1 text-blue-600 dark:text-blue-400">{stats.newCount}</div>
          <div className="text-[11px] text-muted-foreground mt-1">Čekaju AI pripremu</div>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm border-amber-500/20 bg-amber-50/10">
          <div className="text-xs font-medium text-amber-600 dark:text-amber-400">NACRTI SPREMNI</div>
          <div className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">{stats.draftCount}</div>
          <div className="text-[11px] text-muted-foreground mt-1">Čekaju Vaše odobrenje</div>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm border-emerald-500/20 bg-emerald-50/10">
          <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400">POSLANO ZAMOLBI</div>
          <div className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">{stats.sentCount}</div>
          <div className="text-[11px] text-muted-foreground mt-1">Čekaju uplatu</div>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm border-rose-500/30 bg-rose-50/15 dark:bg-rose-950/20">
          <div className="text-xs font-medium text-rose-600 dark:text-rose-400 flex items-center justify-between">
            <span>UPLAĆENE DONACIJE</span>
            <Heart className="h-4 w-4 text-rose-500 fill-rose-500" />
          </div>
          <div className="text-2xl font-bold mt-1 text-rose-600 dark:text-rose-400">{stats.donorCount || 0}</div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
            {stats.totalDonatedEur ? `${stats.totalDonatedEur.toFixed(2)} EUR` : "0.00 EUR"} uplaćeno
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="text-xs font-medium text-muted-foreground">TRAJNI REGISTAR</div>
          <div className="text-2xl font-bold mt-1 flex items-center gap-1.5">
            <ShieldCheck className="h-5 w-5 text-indigo-500" />
            {stats.registrySentTotal}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">Zaštićeno od duplikata</div>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-2xl">
          <TabsTrigger value="search" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            <span>Pretraživanje</span>
          </TabsTrigger>
          <TabsTrigger value="leads" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            <span>Nacrti & Slanje</span>
            {stats.draftCount > 0 && (
              <span className="ml-1 rounded-full bg-amber-500 text-white text-[10px] px-1.5 py-0.2 font-semibold">
                {stats.draftCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="sent" className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            <span>Registar poslanih</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span>Postavke kampanje</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: PRETRAŽIVANJE I PRONALAZAK SUBJEKATA */}
        <TabsContent value="search" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form Column */}
            <div className="lg:col-span-1 space-y-6">
              <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b pb-3">
                  <Search className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">Automatsko pretraživanje registara</h3>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium">Djelatnost ili pojam (opcionalno):</label>
                  <Input
                    placeholder="npr. stolarija, IT, arhitektura, vinarija..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    disabled={crawlStatus.running}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Ostavite prazno za automatsko rotiranje svih hrvatskih djelatnosti.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium">Grad ili regija (opcionalno):</label>
                  <Input
                    placeholder="npr. Zagreb, Split, Varaždin..."
                    value={searchCity}
                    onChange={(e) => setSearchCity(e.target.value)}
                    disabled={crawlStatus.running}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2 min-w-0">
                    <label className="text-xs font-medium">Vrsta subjekta:</label>
                    <Select value={searchEntityType} onValueChange={setSearchEntityType} disabled={crawlStatus.running}>
                      <SelectTrigger className="w-full min-w-0 truncate">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Svi subjekti</SelectItem>
                        <SelectItem value="tvrtka">Tvrtke (d.o.o.)</SelectItem>
                        <SelectItem value="obrt">Obrti</SelectItem>
                        <SelectItem value="udruga">Udruge</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 min-w-0">
                    <label className="text-xs font-medium">Izvor registara:</label>
                    <Select value={searchSource} onValueChange={setSearchSource} disabled={crawlStatus.running}>
                      <SelectTrigger className="w-full min-w-0 truncate">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Svi registri i web</SelectItem>
                        <SelectItem value="fininfo">Fininfo</SelectItem>
                        <SelectItem value="companywall">CompanyWall</SelectItem>
                        <SelectItem value="imenici">Poslovni imenici</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium">Broj novih subjekata za pronalazak:</label>
                  <Select value={searchMax} onValueChange={setSearchMax} disabled={crawlStatus.running}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 subjekt</SelectItem>
                      <SelectItem value="5">5 subjekata</SelectItem>
                      <SelectItem value="10">10 subjekata</SelectItem>
                      <SelectItem value="15">15 subjekata</SelectItem>
                      <SelectItem value="20">20 subjekata</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/40">
                  <div className="space-y-0.5">
                    <div className="text-xs font-medium flex items-center gap-1.5">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                      Gemini AI automatska izrada
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Generiraj nacrt personaliziranog maila odmah pri pronalasku
                    </div>
                  </div>
                  <Switch
                    checked={autoGenerateAi}
                    onCheckedChange={setAutoGenerateAi}
                    disabled={crawlStatus.running}
                  />
                </div>

                <Button
                  className="w-full"
                  onClick={handleStartSearch}
                  disabled={crawlStatus.running}
                >
                  {crawlStatus.running ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Pretraživanje u tijeku...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Pokreni pretraživanje
                    </>
                  )}
                </Button>
              </div>

              {/* Direct URL analysis box */}
              <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
                <div className="flex items-center gap-2 border-b pb-2">
                  <Globe className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">Izravna analiza web stranice</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Unesite URL bilo koje tvrtke ili obrta kako bi sustav izvukao kontakt osobu, mail i djelatnost.
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="https://primjer-tvrtke.hr"
                    value={singleUrl}
                    onChange={(e) => setSingleUrl(e.target.value)}
                    disabled={singleLoading}
                  />
                  <Button variant="secondary" onClick={handleSingleUrlCrawl} disabled={singleLoading}>
                    {singleLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Analiziraj"}
                  </Button>
                </div>
              </div>
            </div>

            {/* Live Progress & Terminal Column */}
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4 flex flex-col h-[560px]">
                <div className="flex items-center justify-between border-b pb-3">
                  <div className="flex items-center gap-2">
                    <div className={`h-2.5 w-2.5 rounded-full ${crawlStatus.running ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                    <h3 className="font-semibold text-sm">
                      {crawlStatus.running ? "Pretraživanje i dubinska analiza u tijeku..." : "Dnevnik pretraživanja"}
                    </h3>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>Pronađeno: <strong className="text-foreground">{crawlStatus.foundCount}</strong></span>
                    <span>Spremljeno: <strong className="text-emerald-600 dark:text-emerald-400">{crawlStatus.insertedCount}</strong></span>
                    <span>Preskočeno (duplikati): <strong className="text-amber-600">{crawlStatus.duplicateCount}</strong></span>
                  </div>
                </div>

                {/* Terminal logs window */}
                <div className="flex-1 bg-slate-950 text-slate-100 rounded-lg p-4 font-mono text-xs overflow-y-auto space-y-1.5 border border-slate-800">
                  {crawlStatus.logs.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-500">
                      Spreman za pretraživanje. Pritisnite &quot;Pokreni pretraživanje&quot; za početak.
                    </div>
                  ) : (
                    crawlStatus.logs.map((l, idx) => (
                      <div key={idx} className="flex items-start gap-2 leading-relaxed">
                        <span className="text-slate-500 select-none">[{l.time}]</span>
                        <span
                          className={
                            l.type === "success"
                              ? "text-emerald-400"
                              : l.type === "warn"
                              ? "text-amber-400"
                              : l.type === "error"
                              ? "text-rose-400"
                              : l.type === "done"
                              ? "text-cyan-400 font-bold"
                              : "text-slate-200"
                          }
                        >
                          {l.message}
                        </span>
                      </div>
                    ))
                  )}
                  <div ref={logsEndRef} />
                </div>

                {crawlStatus.running && (
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                    <span className="flex items-center gap-1.5">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin text-amber-500" />
                      Analiziram kontakte na webu i pripremam personalizirane mailove...
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => fetchLeads()}>
                      Pregledaj dosad spremljeno
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: NACRTI I SLANJE MAILOVA (ADMIN ODOBRAVANJE) */}
        <TabsContent value="leads" className="space-y-4 mt-6">
          {/* Filters and bulk action bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Pretraži subjekte, mailove, OIB..."
                  className="pl-8 text-xs h-9"
                  value={leadSearchQuery}
                  onChange={(e) => setLeadSearchQuery(e.target.value)}
                />
              </div>

              <Select value={leadFilterStatus} onValueChange={setLeadFilterStatus}>
                <SelectTrigger className="w-44 h-9 text-xs font-medium">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Svi statusi</SelectItem>
                  <SelectItem value="donor">Donatori (Uplaćeno)</SelectItem>
                  <SelectItem value="sent">Poslano (Čeka uplatu)</SelectItem>
                  <SelectItem value="draft_ready">Nacrt spreman</SelectItem>
                  <SelectItem value="new">Novi (bez teksta)</SelectItem>
                  <SelectItem value="rejected">Odbijeno</SelectItem>
                </SelectContent>
              </Select>

              <Select value={leadFilterType} onValueChange={setLeadFilterType}>
                <SelectTrigger className="w-36 h-9 text-xs">
                  <SelectValue placeholder="Vrsta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Sve vrste</SelectItem>
                  <SelectItem value="tvrtka">Tvrtka</SelectItem>
                  <SelectItem value="obrt">Obrt</SelectItem>
                  <SelectItem value="udruga">Udruga</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="ghost" size="sm" onClick={() => fetchLeads()} className="h-9">
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleBulkGenerate} className="h-9 text-xs">
                <Bot className="h-3.5 w-3.5 mr-1.5 text-amber-500" />
                AI generiraj sve nacrte
              </Button>
            </div>
          </div>

          {/* Leads table */}
          <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b text-muted-foreground font-medium">
                  <tr>
                    <th className="py-3 px-4">Subjekt</th>
                    <th className="py-3 px-4">Grad / Sjedište</th>
                    <th className="py-3 px-4">Kontakt osoba</th>
                    <th className="py-3 px-4">E-mail adresa</th>
                    <th className="py-3 px-4">Status & AI priprema</th>
                    <th className="py-3 px-4 text-right">Akcija</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {leadsLoading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-muted-foreground">
                        <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                        Učitavanje liste kontakata...
                      </td>
                    </tr>
                  ) : leads.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-muted-foreground">
                        Nema kontakata za prikaz. Pokrenite pretraživanje u kartici &quot;Pretraživanje&quot; ili unesite subjekt ručno.
                      </td>
                    </tr>
                  ) : (
                    leads.map((lead) => {
                      const isDonor = lead.status === "donor"
                      const isDraftReady = lead.status === "draft_ready"
                      const isSent = lead.status === "sent"
                      const isRejected = lead.status === "rejected"

                      return (
                        <tr key={lead.id} className="hover:bg-muted/40 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-medium text-foreground">{lead.name}</div>
                            <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                              <span className="capitalize">{lead.entity_type}</span>
                              {lead.oib && <span>· OIB: {lead.oib}</span>}
                              {lead.website && (
                                <a
                                  href={lead.website}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-primary hover:underline flex items-center gap-0.5"
                                >
                                  web <ExternalLink className="h-2.5 w-2.5" />
                                </a>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-4 text-muted-foreground">
                            {lead.city || "Hrvatska"}
                          </td>

                          <td className="py-3 px-4">
                            {lead.contact_person ? (
                              <div>
                                <div className="font-medium">{lead.contact_person}</div>
                                <div className="text-[10px] text-muted-foreground">{lead.contact_role || "Kontakt"}</div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic">Nije specificirano</span>
                            )}
                          </td>

                          <td className="py-3 px-4 font-mono">
                            {lead.email}
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex flex-col gap-1 items-start">
                              {isDonor ? (
                                <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium border-0 shadow-xs">
                                  <HeartHandshake className="h-3 w-3 mr-1" />
                                  Donator: {lead.donated_amount ? `${lead.donated_amount} EUR` : "Uplaćeno"}
                                </Badge>
                              ) : isSent ? (
                                <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20">
                                  <Check className="h-3 w-3 mr-1" />
                                  Poslano {lead.sent_at}
                                </Badge>
                              ) : isDraftReady ? (
                                <Badge variant="outline" className="border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20">
                                  <Sparkles className="h-3 w-3 mr-1" />
                                  Nacrt spreman
                                </Badge>
                              ) : isRejected ? (
                                <Badge variant="outline" className="text-muted-foreground">
                                  Odbijeno
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="border-blue-500/30 text-blue-600 dark:text-blue-400">
                                  Novi kontakt
                                </Badge>
                              )}

                              {lead.ai_personalization_note && (
                                <div className="text-[10px] text-muted-foreground line-clamp-1 max-w-xs">
                                  {lead.ai_personalization_note}
                                </div>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant={isDraftReady ? "default" : "outline"}
                                className="h-7 text-xs"
                                onClick={() => openLeadPreview(lead)}
                              >
                                {isSent || isDonor ? (
                                  <>
                                    <Eye className="h-3 w-3 mr-1" />
                                    Pregledaj
                                  </>
                                ) : (
                                  <>
                                    <Send className="h-3 w-3 mr-1" />
                                    {isDraftReady ? "Pregledaj i pošalji" : "Pripremi mail"}
                                  </>
                                )}
                              </Button>

                              {/* Gumb za ponovnu AI obradu */}
                              {!isSent && !isDonor && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                                  onClick={() => handleRegenerateSingleLead(lead)}
                                  disabled={reprocessingLeadId === lead.id}
                                  title="Ponovno obradi i generiraj AI tekst za ovaj subjekt"
                                >
                                  <RefreshCw className={cn("h-3.5 w-3.5", reprocessingLeadId === lead.id && "animate-spin text-amber-500")} />
                                </Button>
                              )}

                              {/* Gumb za evidenciju uplate donacije (za poslane subjekte) */}
                              {!isDonor && isSent && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 px-2"
                                  onClick={() => openDonorDialog(lead)}
                                  title="Evidentiraj uplatu i označi kao donatora"
                                >
                                  <HeartHandshake className="h-3.5 w-3.5 mr-1" />
                                  Donator
                                </Button>
                              )}

                              {/* Gumb za pripremu za ponovno slanje u budućoj kampanji */}
                              {!isDonor && isSent && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                                  onClick={() => handleResetForFutureCampaign(lead)}
                                  title="Pripremi za ponovno slanje u budućoj kampanji (vraća status na nacrt)"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                </Button>
                              )}

                              {!isSent && !isDonor && !isRejected && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-500"
                                  onClick={() => handleRejectLead(lead.id!)}
                                  title="Odbij"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              )}

                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-500"
                                onClick={() => handleDeleteLead(lead.id!)}
                                title="Obriši"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* TAB 3: REGISTAR POSLANIH DONACIJA (ZAŠTITA OD DUPLIKATA) */}
        <TabsContent value="sent" className="space-y-4 mt-6">
          <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-3">
              <div>
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-indigo-500" />
                  Trajni registar poslanih donacija (Zaštita od duplikata)
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sustav trajno bilježi svaki poslan mail i OIB. Nikada se neće poslati dvaput istom primatelju.
                </p>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Pretraži registar..."
                  className="pl-8 text-xs h-9"
                  value={sentFilter}
                  onChange={(e) => setSentFilter(e.target.value)}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b text-muted-foreground font-medium">
                  <tr>
                    <th className="py-2.5 px-4">Datum & Vrijeme</th>
                    <th className="py-2.5 px-4">Naziv subjekta</th>
                    <th className="py-2.5 px-4">E-mail adresa</th>
                    <th className="py-2.5 px-4">OIB</th>
                    <th className="py-2.5 px-4">Predmet poslanog maila</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredSent.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground">
                        Još nema poslanih donacijskih poziva.
                      </td>
                    </tr>
                  ) : (
                    filteredSent.map((s) => (
                      <tr key={s.id} className="hover:bg-muted/30">
                        <td className="py-2.5 px-4 text-muted-foreground whitespace-nowrap">{s.sent_at}</td>
                        <td className="py-2.5 px-4 font-medium">{s.company_name}</td>
                        <td className="py-2.5 px-4 font-mono text-primary">{s.email_norm}</td>
                        <td className="py-2.5 px-4">{s.oib || "-"}</td>
                        <td className="py-2.5 px-4 text-muted-foreground">{s.subject}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* TAB 4: POSTAVKE KAMPANJE */}
        <TabsContent value="settings" className="space-y-6 mt-6">
          {settings && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-card rounded-xl border shadow-xs">
                <div>
                  <h2 className="text-base font-semibold">Postavke e-mail kampanje i donacija</h2>
                  <p className="text-xs text-muted-foreground">Konfigurirajte podatke za uplatu (HUB-3A), Gemini AI ključ, SMTP poslužitelj i logotip potpisa.</p>
                </div>
                <Button
                  type="button"
                  onClick={() => handleSaveSettings()}
                  disabled={savingSettings}
                  size="sm"
                  className="shrink-0"
                >
                  {savingSettings ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                  {savingSettings ? "Spremam..." : "Spremi sve postavke"}
                </Button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 1. Podaci društva i uplatnica */}
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

                    {/* Barcode preview */}
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

                {/* 2. Google Gemini & SMTP Postavke */}
                <div className="space-y-6">
                  {/* Gemini AI */}
                  <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b pb-3">
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4 text-amber-500" />
                        <h3 className="font-semibold text-sm">Google Gemini AI postavke</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge loading={testGeminiLoading} status={geminiStatus} />
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
                          title="Preuzmi Host, Port, Korisničko ime, Lozinku i SSL iz glavnih postavki sustava"
                        >
                          {copyingSmtp ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                          Preuzmi iz sustava
                        </Button>
                        <StatusBadge loading={testSmtpLoading} status={smtpStatus} />
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
                                smtp_secure: is465 ? "true" : (val === "587" || val === "25" ? "false" : settings.smtp_secure)
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
                          <label className="text-xs font-medium">SMTP lozinka:</label>
                          <Input
                            type="password"
                            placeholder="Lozinka sandučića ili 16-znamenkasti App Password"
                            value={settings.smtp_pass}
                            onChange={(e) => setSettings({ ...settings, smtp_pass: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div>
                          <label className="text-xs font-medium">Ime pošiljatelja (Sender Name):</label>
                          <Input
                            placeholder="Hrvatsko rodoslovno društvo"
                            value={settings.sender_name}
                            onChange={(e) => setSettings({ ...settings, sender_name: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium">Adresa pošiljatelja (From Email):</label>
                          <Input
                            placeholder="rodoslovlje@rodoslovlje.hr"
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

                      <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                        <div className="font-semibold flex items-center gap-1.5 text-[11.5px]">
                          <Info className="h-3.5 w-3.5 shrink-0" />
                          Napomena za slanje e-mailova:
                        </div>
                        <p className="text-[11px] leading-relaxed">
                          • <strong>Vlastita domena (mail.rodoslovlje.hr)</strong>: Port 465 uz SSL (ili port 587) uz lozinku Vašeg sandučića.<br/>
                          • <strong>Gmail (smtp.gmail.com)</strong>: Port 465 uz SSL, a za lozinku je <u>obavezna</u> Google &quot;Lozinka aplikacije&quot; (App Password) od 16 znakova, generirana u postavkama Google računa.
                        </p>
                      </div>

                      {/* Direct Test Email to Personal Address */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-3 rounded-lg border bg-muted/40">
                        <div className="flex items-center gap-1.5 text-xs font-semibold shrink-0">
                          <Send className="h-3.5 w-3.5 text-primary" />
                          Pošalji testni mail na osobni e-mail:
                        </div>
                        <Input
                          type="email"
                          placeholder="npr. tomica.hap@gmail.com"
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
                          {smtpSendingTest ? "Šaljem..." : "Pošalji test na mail"}
                        </Button>
                      </div>

                      {smtpStatus.state === "error" && (
                        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
                          <div className="space-y-1">
                            <div className="font-semibold">Pojavila se greška pri provjeri SMTP poslužitelja:</div>
                            <div className="font-mono text-[11px] leading-relaxed break-words">{smtpStatus.message}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Logotip i potpis maila */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Upload logotipa */}
                <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 border-b pb-3">
                    <ImageIcon className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-sm">Logotip u potpisu e-maila</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Učitajte vlastiti logotip (PNG, JPG ili WebP do 1 MB) koji će se prikazivati u potpisu svih odlaznih e-mailova donacija.
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
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-xs h-7"
                            onClick={() => logoInputRef.current?.click()}
                          >
                            <Upload className="h-3 w-3 mr-1" />
                            Promijeni
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7 text-rose-500 hover:text-rose-600"
                            onClick={handleRemoveLogo}
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
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-xs h-7 mt-1"
                          onClick={() => logoInputRef.current?.click()}
                        >
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

                {/* Potpis maila */}
                <div className="lg:col-span-2 rounded-xl border bg-card p-5 shadow-sm space-y-3">
                  <label className="text-xs font-medium">Potpis na dnu maila:</label>
                  <Textarea
                    rows={4}
                    value={settings.email_signature}
                    onChange={(e) => setSettings({ ...settings, email_signature: e.target.value })}
                    placeholder="Srdačan pozdrav,&#10;Hrvatsko rodoslovno društvo..."
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Tekst potpisa bit će prikazan u nastavku svakog poslanog e-maila, uz učitani logotip.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  onClick={() => handleSaveSettings()}
                  disabled={savingSettings}
                  size="lg"
                  className="min-w-[240px]"
                >
                  {savingSettings ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  {savingSettings ? "Spremam postavke..." : "Spremi sve postavke kampanje"}
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* MODAL 1: PREGLED & ODOBRAVANJE MAILA (PREGLEDNI SPLIT VIEW) */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-6xl w-[96vw] max-h-[94vh] flex flex-col p-6">
          <DialogHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                <DialogTitle className="text-lg font-bold">
                  Pregled i odobrenje maila za: {selectedLead?.name}
                </DialogTitle>
              </div>
              {selectedLead && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs uppercase font-medium">
                    {selectedLead.entity_type || "tvrtka"}
                  </Badge>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSaveLeadEdits}
                    disabled={savingLeadEdits}
                    className="h-7 text-xs"
                  >
                    {savingLeadEdits ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                    Spremi izmjene teksta
                  </Button>
                </div>
              )}
            </div>
            <DialogDescription className="sr-only">
              Uredite odgovornu osobu, tekst i pošaljite testni ili stvarni e-mail.
            </DialogDescription>
          </DialogHeader>

          {selectedLead && (
            <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* LIJEVI STUPAC: Uređivanje podataka, odgovorne osobe i teksta */}
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl border bg-card shadow-xs space-y-3">
                    <div className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">
                      Podaci o primatelju i zaglavlju
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold flex items-center gap-1">
                            <User className="h-3.5 w-3.5 text-primary" />
                            Odgovorna osoba:
                          </label>
                          <span className="text-[10px] text-muted-foreground">mijenja pozdrav</span>
                        </div>
                        <Input
                          placeholder="Ime i prezime (npr. Ivan Horvat)"
                          value={editContact}
                          onChange={(e) => handleContactChange(e.target.value)}
                          className="text-xs h-8"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold flex items-center gap-1">
                          <Mail className="h-3.5 w-3.5 text-primary" />
                          E-mail adresa primatelja:
                        </label>
                        <Input
                          type="email"
                          placeholder="kontakt@tvrtka.hr"
                          value={editEmail}
                          onChange={(e) => {
                            setEditEmail(e.target.value)
                            refreshPreview({ email: e.target.value })
                          }}
                          className="text-xs h-8 font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <label className="text-xs font-semibold">Predmet (Subject) poruke:</label>
                      <Input
                        value={editSubject}
                        onChange={(e) => {
                          setEditSubject(e.target.value)
                          refreshPreview({ subject: e.target.value })
                        }}
                        className="text-xs h-8 font-medium"
                      />
                    </div>
                  </div>

                  {/* Uređivanje teksta maila */}
                  <div className="p-3.5 rounded-xl border bg-card shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold">Glavni tekst personaliziranog maila:</label>
                      <button
                        type="button"
                        onClick={() => handleContactChange(editContact)}
                        className="text-[11px] text-primary hover:underline flex items-center gap-1"
                        title="Ponovno uskladi pozdrav u prvoj rečenici s imenom odgovorne osobe"
                      >
                        <RefreshCw className="h-2.5 w-2.5" />
                        Ažuriraj pozdrav
                      </button>
                    </div>
                    <Textarea
                      rows={10}
                      value={editBody}
                      onChange={(e) => {
                        setEditBody(e.target.value)
                        refreshPreview({ body: e.target.value })
                      }}
                      className="font-sans text-xs leading-relaxed"
                      placeholder="Poštovani, ..."
                    />
                  </div>

                  {/* Gemini AI prompt box */}
                  <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-50/15 dark:bg-amber-950/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                        <Bot className="h-4 w-4" />
                        Gemini AI automatska prilagodba
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={handleGenerateAiSingle}
                        disabled={generatingAiSingle}
                      >
                        {generatingAiSingle ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                        Doradi s AI
                      </Button>
                    </div>
                    <Input
                      placeholder="Dodatna uputa za AI (npr. 'skrati na 3 rečenice' ili 'naglasiti očuvanje korijena')..."
                      className="text-xs h-8"
                      value={customAiPrompt}
                      onChange={(e) => setCustomAiPrompt(e.target.value)}
                    />
                  </div>
                </div>

                {/* DESNI STUPAC: Živi vizualni pretpregled maila */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                      <Eye className="h-3.5 w-3.5 text-primary" />
                      Živi pretpregled maila (točan izgled primatelju):
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => refreshPreview()}
                      className="h-6 text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      <RefreshCw className="h-2.5 w-2.5 mr-1" />
                      Osvježi prikaz
                    </Button>
                  </div>

                  <div className="rounded-xl border overflow-hidden bg-white shadow-xs flex flex-col">
                    <div className="p-2.5 bg-slate-100 border-b text-[11px] text-slate-700 flex flex-col gap-0.5 font-mono">
                      <div className="flex justify-between">
                        <span className="truncate"><strong>Od:</strong> {previewData?.from || `${settings?.sender_name} <${settings?.sender_email}>`}</span>
                        <span className="text-muted-foreground text-[10px]">HTML mail</span>
                      </div>
                      <div className="truncate"><strong>Za:</strong> {editEmail || "(nema e-maila)"}</div>
                      <div className="truncate font-sans font-semibold text-slate-900 pt-0.5"><strong>Predmet:</strong> {editSubject}</div>
                    </div>
                    {previewData?.html ? (
                      <iframe
                        srcDoc={previewData.html}
                        title="Email Preview"
                        className="w-full h-[470px] border-0 bg-white"
                      />
                    ) : (
                      <div className="h-[470px] flex items-center justify-center text-xs text-muted-foreground bg-slate-50">
                        <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                        Učitavanje pretpregleda...
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t pt-3">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <span className="text-xs font-semibold whitespace-nowrap text-muted-foreground">Test na moj mail:</span>
              <Input
                placeholder="npr. tomica.hap@gmail.com"
                value={testEmailAddress}
                onChange={(e) => setTestEmailAddress(e.target.value)}
                className="h-8 text-xs font-mono"
              />
              <Button variant="secondary" size="sm" className="h-8 text-xs shrink-0" onClick={handleSendTest}>
                Pošalji test
              </Button>
            </div>

            <div className="flex items-center gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setPreviewDialogOpen(false)}>
                Zatvori
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleApproveAndSend}
                disabled={sendingEmail || selectedLead?.status === "sent"}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
                {sendingEmail ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                    Slanje u tijeku...
                  </>
                ) : selectedLead?.status === "sent" ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Već poslano
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Odobri i pošalji mail subjektu
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: RUČNI UNOS SUBJEKTA */}
      <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ručni unos novog subjekta</DialogTitle>
            <DialogDescription>
              Unesite podatke tvrtke, obrta ili udruge koju želite dodati u sustav donacija.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <label className="font-medium">Naziv subjekta:</label>
              <Input
                placeholder="npr. Stolarija Horvat d.o.o."
                value={manualForm.name}
                onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })}
              />
            </div>

            <div>
              <label className="font-medium">E-mail adresa:</label>
              <Input
                placeholder="info@stolarija-horvat.hr"
                value={manualForm.email}
                onChange={(e) => setManualForm({ ...manualForm, email: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-medium">Vrsta:</label>
                <Select
                  value={manualForm.entity_type}
                  onValueChange={(val) => setManualForm({ ...manualForm, entity_type: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tvrtka">Tvrtka</SelectItem>
                    <SelectItem value="obrt">Obrt</SelectItem>
                    <SelectItem value="udruga">Udruga</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="font-medium">Grad:</label>
                <Input
                  placeholder="npr. Varaždin"
                  value={manualForm.city}
                  onChange={(e) => setManualForm({ ...manualForm, city: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-medium">Kontakt osoba:</label>
                <Input
                  placeholder="Ivan Horvat"
                  value={manualForm.contact_person}
                  onChange={(e) => setManualForm({ ...manualForm, contact_person: e.target.value })}
                />
              </div>
              <div>
                <label className="font-medium">Uloga:</label>
                <Input
                  placeholder="Direktor"
                  value={manualForm.contact_role}
                  onChange={(e) => setManualForm({ ...manualForm, contact_role: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="font-medium">Web stranica:</label>
              <Input
                placeholder="https://stolarija-horvat.hr"
                value={manualForm.website}
                onChange={(e) => setManualForm({ ...manualForm, website: e.target.value })}
              />
            </div>

            <div>
              <label className="font-medium">Djelatnost / opis poslovanja:</label>
              <Input
                placeholder="Izrada masivnog namještaja po mjeri"
                value={manualForm.activity_category}
                onChange={(e) => setManualForm({ ...manualForm, activity_category: e.target.value })}
              />
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/30">
              <span>Odmah generiraj Gemini AI personalizirani mail</span>
              <Switch
                checked={manualForm.autoGenerateAi}
                onCheckedChange={(checked) => setManualForm({ ...manualForm, autoGenerateAi: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setManualDialogOpen(false)}>
              Odustani
            </Button>
            <Button onClick={handleManualAdd}>
              Dodaj u bazu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: EVIDENCIJA UPLATE DONACIJE (DONATOR) */}
      <Dialog open={donorDialogOpen} onOpenChange={setDonorDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <HeartHandshake className="h-5 w-5" />
              Evidencija uplate donacije
            </DialogTitle>
            <DialogDescription>
              Označite subjekt kao donatora nakon što je evidentirana uplata na račun društva.
            </DialogDescription>
          </DialogHeader>

          {donorLead && (
            <div className="space-y-4 py-2 text-xs">
              <div className="p-3 rounded-lg bg-muted/40 border space-y-1">
                <div className="font-semibold text-sm text-foreground">{donorLead.name}</div>
                <div className="text-muted-foreground">
                  {donorLead.contact_person ? `Kontakt: ${donorLead.contact_person} · ` : ""}{donorLead.city || "Hrvatska"}
                </div>
                <div className="font-mono text-[11px] text-primary">{donorLead.email}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-semibold">Uplaćeni iznos (EUR):</label>
                  <Input
                    placeholder="50.00"
                    value={donorAmount}
                    onChange={(e) => setDonorAmount(e.target.value)}
                    className="font-mono font-medium"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-semibold">Datum uplate:</label>
                  <Input
                    type="date"
                    value={donorDate}
                    onChange={(e) => setDonorDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold">Napomena uz uplatu:</label>
                <Input
                  placeholder="npr. Uplata po HUB-3 uplatnici preko banke..."
                  value={donorNote}
                  onChange={(e) => setDonorNote(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDonorDialogOpen(false)}>
              Odustani
            </Button>
            <Button
              onClick={handleSaveDonor}
              disabled={savingDonor}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {savingDonor ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
              Potvrdi i označi donatora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
