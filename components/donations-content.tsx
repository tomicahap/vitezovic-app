"use client"

import * as React from "react"
import Link from "next/link"
import * as XLSX from "xlsx"
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
  ShieldCheck,
  Check,
  X,
  ExternalLink,
  Plus,
  Play,
  Save,
  Upload,
  Heart,
  HeartHandshake,
  RotateCcw,
  History,
  Layers,
  Zap,
  ListChecks,
  Wand2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  ShieldBan,
  Square
} from "lucide-react"
import { cn, formatDateDMY, formatDateTimeDMY } from "@/lib/utils"
import {
  ACTION_BUTTON_STYLES,
  CloseActionButton,
  FinishActionButton,
  SaveActionButton,
} from "@/components/ui/action-bar"
import { useAuth } from "@/contexts/auth-context"
import { useMembers, isAdminAccountEntry } from "@/contexts/members-context"
import { useActivityLog } from "@/contexts/activity-log-context"
import { buildGreeting, capitalizeRespectfulPronouns } from "@/lib/mailcrawl/ai"
import { CROATIAN_NICHE_CATEGORIES } from "@/lib/mailcrawl/constants"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
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
import { confirmAction } from "@/components/ui/confirm-dialog"
import { DonationsSettingsPanel } from "@/components/donations-settings-panel"
import { DonationsBulkSendDialog } from "@/components/donations-bulk-send-dialog"
import { DonationsImportDialog } from "@/components/donations-import-dialog"
import { DonationsOptOutDialog } from "@/components/donations-opt-out-dialog"
import {
  DonationThankYouDialog,
  type DonationThankYouTarget,
} from "@/components/donation-thank-you-dialog"
import { EmailSendProgressBanner } from "@/components/email-send-progress-banner"
import {
  consumeEmailSendStream,
  INITIAL_BULK_EMAIL_PROGRESS,
  type BulkEmailProgressState,
} from "@/lib/bulk-email-stream"
import type { Lead, CampaignSettings, SentRegistryItem, BulkSendJobState } from "@/lib/mailcrawl/types"
import type { CrawlJobState } from "@/lib/mailcrawl/crawler-state"

function formatEntityTypeLabel(entityType?: string | null): string {
  const et = String(entityType || "").trim().toLowerCase()
  if (et === "clan") return "Član Društva"
  if (et === "fizicka_osoba") return "Fizička osoba"
  if (et === "obrt") return "Obrt"
  if (et === "udruga") return "Udruga"
  if (et === "tvrtka") return "Tvrtka"
  return et || "Tvrtka"
}

export function DonationsContent() {
  const { user } = useAuth()
  const { members } = useMembers()
  const { addLog } = useActivityLog()
  const [activeTab, setActiveTab] = React.useState("search")

  const hasLoggedViewRef = React.useRef(false)
  React.useEffect(() => {
    if (user && !hasLoggedViewRef.current) {
      hasLoggedViewRef.current = true
      addLog({
        userId: user.id.toString(),
        userName: user.name,
        userRole: user.role,
        action: 'Pregled donacija',
        details: `Korisnik ${user.name} je pregledao modul donacija i kampanja`
      })
    }
  }, [user?.id])
  
  // Stats
  const [stats, setStats] = React.useState<{
    total: number
    newCount: number
    draftCount: number
    remainingCount?: number
    sentCount: number
    donorCount?: number
    totalDonatedEur?: number
    rejectedCount: number
    registrySentTotal: number
    optOutCount?: number
    dailySentCount?: number
    dailyLimit?: number
    serperConfigured?: boolean
    tavilyConfigured?: boolean
    firecrawlConfigured?: boolean
    byType: { tvrtka: number; obrt: number; udruga: number }
  }>({
    total: 0,
    newCount: 0,
    draftCount: 0,
    remainingCount: 0,
    sentCount: 0,
    donorCount: 0,
    totalDonatedEur: 0,
    rejectedCount: 0,
    registrySentTotal: 0,
    optOutCount: 0,
    dailySentCount: 0,
    dailyLimit: 150,
    serperConfigured: false,
    tavilyConfigured: false,
    firecrawlConfigured: false,
    byType: { tvrtka: 0, obrt: 0, udruga: 0 }
  })

  // Crawler state
  const [crawlStatus, setCrawlStatus] = React.useState<CrawlJobState>({
    running: false,
    cancelled: false,
    phase: 'idle',
    provider: 'web',
    totalTerms: 0,
    completedTerms: 0,
    currentTerm: '',
    firecrawlUsedCount: 0,
    logs: [],
    foundCount: 0,
    insertedCount: 0,
    duplicateCount: 0,
    startedAt: null,
    finishedAt: null
  })
  const [cancellingCrawl, setCancellingCrawl] = React.useState(false)

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

  // Search History & Duplicate Search Warning
  const [searchHistory, setSearchHistory] = React.useState<any[]>([])
  const [alreadySearchedInfo, setAlreadySearchedInfo] = React.useState<any | null>(null)

  // Term Generator state
  const [generatorCount, setGeneratorCount] = React.useState<number>(5)
  const [generatorCategory, setGeneratorCategory] = React.useState<string>("")
  const [generatorCity, setGeneratorCity] = React.useState<string>("")
  const [generatedTerms, setGeneratedTerms] = React.useState<Array<{
    id: string
    query: string
    city: string
    category: string
    reason?: string
  }>>([])
  const [isGeneratingTerms, setIsGeneratingTerms] = React.useState(false)
  const [generatorSource, setGeneratorSource] = React.useState<"gemini" | "catalog" | null>(null)
  const [generatorMode, setGeneratorMode] = React.useState<"catalog" | "gemini">("catalog")
  const [batchAiMode, setBatchAiMode] = React.useState<"none" | "template" | "gemini">("template")
  const [batchMaxPerTerm, setBatchMaxPerTerm] = React.useState<string>("5")
  const [newTermQuery, setNewTermQuery] = React.useState("")
  const [newTermCity, setNewTermCity] = React.useState("")
  const [showAddTermInline, setShowAddTermInline] = React.useState(false)

  // Direct Manual Donation Dialog (for members and external donors outside email campaigns)
  const [directDonorDialogOpen, setDirectDonorDialogOpen] = React.useState(false)
  const [savingDirectDonor, setSavingDirectDonor] = React.useState(false)
  const [directDonorMode, setDirectDonorMode] = React.useState<"external" | "member">("external")
  const [memberSearchQuery, setMemberSearchQuery] = React.useState("")
  const [directDonorForm, setDirectDonorForm] = React.useState({
    member_id: null as number | null,
    name: "",
    entity_type: "fizicka_osoba",
    oib: "",
    city: "",
    address: "",
    email: "",
    phone: "",
    donated_amount: "50.00",
    donated_at: new Date().toISOString().slice(0, 10),
    payment_method: "Žiro račun / Transakcijski račun",
    donation_note: "Donacija za rad društva i digitalizaciju"
  })

  const selectableMemberDonors = React.useMemo(() => {
    const q = memberSearchQuery.trim().toLowerCase()
    return (members || [])
      .filter((m) => !isAdminAccountEntry(m))
      .filter((m) => {
        if (!q) return true
        return (
          (m.name || "").toLowerCase().includes(q) ||
          (m.email || "").toLowerCase().includes(q) ||
          (m.membershipNumber || "").toLowerCase().includes(q) ||
          (m.registryNumber || "").toLowerCase().includes(q) ||
          (m.oib || "").toLowerCase().includes(q)
        )
      })
      .sort((a, b) => (a.name || "").localeCompare(b.name || "", "hr-HR"))
  }, [members, memberSearchQuery])

  const selectedMemberDonor = React.useMemo(() => {
    if (!directDonorForm.member_id) return null
    return (members || []).find((m) => Number(m.id) === Number(directDonorForm.member_id)) || null
  }, [members, directDonorForm.member_id])

  const handleSelectDirectDonorMember = (m: (typeof members)[number]) => {
    setDirectDonorForm((prev) => ({
      ...prev,
      member_id: m.id,
      name: m.name || "",
      entity_type: "clan",
      oib: m.oib || "",
      address: m.address || "",
      email: m.email || "",
      phone: m.phone || m.landlinePhone || "",
    }))
    if (m.doNotContact) {
      setOpenThankYouAfterDirectSave(false)
    }
  }

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
  const [leadFilterStatus, setLeadFilterStatus] = React.useState("pending")
  const [leadFilterType, setLeadFilterType] = React.useState("all")
  const [leadSearchQuery, setLeadSearchQuery] = React.useState("")
  const [leadsLoading, setLeadsLoading] = React.useState(false)

  // Sent Registry list state
  const [sentRegistry, setSentRegistry] = React.useState<SentRegistryItem[]>([])
  const [sentFilter, setSentFilter] = React.useState("")
  const [donorSentItem, setDonorSentItem] = React.useState<SentRegistryItem | null>(null)
  const [resendItem, setResendItem] = React.useState<SentRegistryItem | null>(null)
  const [resendDialogOpen, setResendDialogOpen] = React.useState(false)
  const [resendSubject, setResendSubject] = React.useState("")
  const [resendBody, setResendBody] = React.useState("")
  const [resendRecipient, setResendRecipient] = React.useState("")
  const [resendingMail, setResendingMail] = React.useState(false)
  const [historyItem, setHistoryItem] = React.useState<SentRegistryItem | null>(null)
  const [historyDialogOpen, setHistoryDialogOpen] = React.useState(false)
  const [editEmailDialogOpen, setEditEmailDialogOpen] = React.useState(false)
  const [editingSentItem, setEditingSentItem] = React.useState<SentRegistryItem | null>(null)
  const [newEmailInput, setNewEmailInput] = React.useState("")
  const [savingNewEmail, setSavingNewEmail] = React.useState(false)

  // Campaign Settings state
  const [settings, setSettings] = React.useState<CampaignSettings | null>(null)
  const [hub3PreviewUrl, setHub3PreviewUrl] = React.useState<string>("")

  // Bulk Selection, Pagination, Dialogs & Progress state
  const [selectedLeadIds, setSelectedLeadIds] = React.useState<number[]>([])
  const [leadsPage, setLeadsPage] = React.useState(1)
  const [leadsPageSize, setLeadsPageSize] = React.useState(25)
  const [selectedSentIds, setSelectedSentIds] = React.useState<number[]>([])
  const [sentPage, setSentPage] = React.useState(1)
  const [sentPageSize, setSentPageSize] = React.useState(25)
  const [importDialogOpen, setImportDialogOpen] = React.useState(false)
  const [optOutDialogOpen, setOptOutDialogOpen] = React.useState(false)
  const [bulkSendDialog, setBulkSendDialog] = React.useState<{
    open: boolean
    mode: "initial" | "resend"
    ids: number[]
  }>({ open: false, mode: "initial", ids: [] })
  const [bulkSendJob, setBulkSendJob] = React.useState<BulkSendJobState | null>(null)
  const [cancellingBulkSend, setCancellingBulkSend] = React.useState(false)
  const [draftGenProgress, setDraftGenProgress] = React.useState<BulkEmailProgressState>(INITIAL_BULK_EMAIL_PROGRESS)
  const draftGenAbortRef = React.useRef<AbortController | null>(null)

  // Lead preview / edit dialog
  const [selectedLead, setSelectedLead] = React.useState<Lead | null>(null)
  const [previewDialogOpen, setPreviewDialogOpen] = React.useState(false)
  const [previewData, setPreviewData] = React.useState<{
    html: string
    plainText: string
    barcodeDataUrl: string
    from?: string
  } | null>(null)
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
  const previewTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const previewAbortRef = React.useRef<AbortController | null>(null)

  const defaultTestEmail = React.useMemo(
    () => (user?.email || settings?.sender_email || "").trim(),
    [user?.email, settings?.sender_email]
  )

  React.useEffect(() => {
    if (defaultTestEmail && !testEmailAddress) {
      setTestEmailAddress(defaultTestEmail)
    }
  }, [defaultTestEmail, testEmailAddress])
  // Donor modal state
  const [donorDialogOpen, setDonorDialogOpen] = React.useState(false)
  const [donorLead, setDonorLead] = React.useState<Lead | null>(null)
  const [donorAmount, setDonorAmount] = React.useState("50.00")
  const [donorDate, setDonorDate] = React.useState(new Date().toISOString().split("T")[0])
  const [donorNote, setDonorNote] = React.useState("Uplaćeno prema pozivu za donaciju")
  const [savingDonor, setSavingDonor] = React.useState(false)
  const [openThankYouAfterDonorSave, setOpenThankYouAfterDonorSave] = React.useState(false)
  const [openThankYouAfterDirectSave, setOpenThankYouAfterDirectSave] = React.useState(false)

  // Personalized Thank-You Dialog state
  const [thankYouDialogOpen, setThankYouDialogOpen] = React.useState(false)
  const [thankYouTarget, setThankYouTarget] = React.useState<DonationThankYouTarget | null>(null)

  const openThankYouDialog = (target: DonationThankYouTarget) => {
    setThankYouTarget(target)
    setThankYouDialogOpen(true)
  }

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
  const fetchSearchHistory = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/mailcrawl/crawl/search")
      const data = await res.json()
      if (data.ok && Array.isArray(data.history)) {
        setSearchHistory(data.history)
      }
    } catch {}
  }, [])

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
    }
  }, [])

  // Fetch & poll bulk-send job status
  const prevBulkRunningRef = React.useRef(false)
  const fetchBulkSendStatus = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/mailcrawl/leads/bulk-send/status", { cache: "no-store" })
      if (!res.ok) return
      const job: BulkSendJobState = await res.json()
      setBulkSendJob(job)
      if (!job.running) {
        setCancellingBulkSend(false)
      }
      if (prevBulkRunningRef.current && !job.running) {
        fetchStats()
        fetchLeads()
        fetchSentRegistry()
        if (job.sent > 0 || job.failed > 0) {
          toast.success(
            `Skupno slanje završeno: poslano ${job.sent}/${job.total}${job.failed > 0 ? `, neuspjelo ${job.failed}` : ""}.`
          )
        }
      }
      prevBulkRunningRef.current = Boolean(job.running)
    } catch {}
  }, [fetchStats, fetchLeads, fetchSentRegistry])

  React.useEffect(() => {
    fetchBulkSendStatus()
  }, [fetchBulkSendStatus])

  React.useEffect(() => {
    if (!bulkSendJob?.running) return
    const timer = setInterval(fetchBulkSendStatus, 1000)
    return () => clearInterval(timer)
  }, [bulkSendJob?.running, fetchBulkSendStatus])

  const bulkSendProgress = React.useMemo<BulkEmailProgressState>(() => {
    if (!bulkSendJob || (!bulkSendJob.running && bulkSendJob.total === 0)) {
      return INITIAL_BULK_EMAIL_PROGRESS
    }
    const status: BulkEmailProgressState["status"] = bulkSendJob.running
      ? "running"
      : bulkSendJob.cancelled
      ? "cancelled"
      : bulkSendJob.pausedReason
      ? "error"
      : "done"
    const lastErrLog = [...(bulkSendJob.logs || [])].reverse().find((l) => l.type === "error")
    return {
      active: bulkSendJob.running,
      status,
      total: bulkSendJob.total,
      processed: bulkSendJob.processed,
      sent: bulkSendJob.sent,
      failed: bulkSendJob.failed,
      skipped: bulkSendJob.skipped,
      currentName: bulkSendJob.currentName,
      currentEmail: bulkSendJob.currentEmail,
      lastError: lastErrLog?.message,
      startedAt: bulkSendJob.startedAt,
      finishedAt: bulkSendJob.finishedAt,
      delayMs: Math.round((bulkSendJob.delaySec || 3.5) * 1000),
      pausedReason: bulkSendJob.pausedReason,
      dailySentCount: bulkSendJob.dailySentCount,
      dailyLimit: bulkSendJob.dailyLimit,
      label:
        bulkSendJob.mode === "resend"
          ? "Skupno slanje podsjetnika"
          : "Skupno slanje donacijskih poziva",
    }
  }, [bulkSendJob])

  // Keep selections synced and reset pagination on filter changes
  React.useEffect(() => {
    setLeadsPage(1)
  }, [leadFilterStatus, leadFilterType, leadSearchQuery])

  React.useEffect(() => {
    const validIds = new Set(leads.map((l) => Number(l.id)).filter((id) => Number.isFinite(id)))
    setSelectedLeadIds((prev) => prev.filter((id) => validIds.has(id)))
  }, [leads])

  React.useEffect(() => {
    setSentPage(1)
  }, [sentFilter])

  // Polling crawler status when running
  React.useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    const checkCrawl = async () => {
      try {
        const res = await fetch("/api/admin/mailcrawl/crawl/status", { cache: "no-store" })
        if (res.ok) {
          const st: CrawlJobState = await res.json()
          setCrawlStatus(st)
          if (!st.running) {
            setCancellingCrawl(false)
          }
          if (!st.running && interval) {
            clearInterval(interval)
            fetchStats()
            fetchLeads()
            fetchSearchHistory()
          }
        }
      } catch {}
    }

    checkCrawl()
    if (crawlStatus.running) {
      interval = setInterval(checkCrawl, 1200)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [crawlStatus.running, fetchStats, fetchLeads, fetchSearchHistory])

  // Scroll logs to bottom
  React.useEffect(() => {
    if (crawlStatus.running && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [crawlStatus.logs, crawlStatus.running])

  // Cleanup preview timers/abort on dialog close or unmount
  React.useEffect(() => {
    if (!previewDialogOpen) {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current)
      if (previewAbortRef.current) previewAbortRef.current.abort()
    }
  }, [previewDialogOpen])

  React.useEffect(() => {
    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current)
      if (previewAbortRef.current) previewAbortRef.current.abort()
    }
  }, [])

  // Initial load
  React.useEffect(() => {
    fetchStats()
    fetchLeads()
    fetchSentRegistry()
    fetchSearchHistory()
    fetchSettings()
  }, [fetchStats, fetchLeads, fetchSentRegistry, fetchSearchHistory, fetchSettings])

  // Start search crawler
  const handleStartSearch = async (forceRepeat: boolean = false) => {
    setAlreadySearchedInfo(null)
    try {
      const res = await fetch("/api/admin/mailcrawl/crawl/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: searchQuery,
          city: searchCity,
          entityType: searchEntityType,
          registrySource: searchSource,
          maxResults: parseInt(searchMax, 10) || 20,
          autoGenerateAi,
          aiMode: autoGenerateAi ? "gemini" : "template",
          forceRepeat
        })
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        toast.success("Pretraživanje pokrenuto!")
        setCrawlStatus(prev => ({ ...prev, running: true, cancelled: false }))
        setTimeout(() => fetchSearchHistory(), 3000)
      } else if (data.alreadySearched) {
        setAlreadySearchedInfo(data.previousSearch)
        toast.warning(data.error || "Ovaj pojam je već pretraživan.")
      } else {
        toast.error(data.error || "Nije uspjelo pokretanje.")
      }
    } catch {
      toast.error("Došlo je do greške pri pokretanju.")
    }
  }

  // Cancel running crawl
  const handleCancelCrawl = async () => {
    setCancellingCrawl(true)
    try {
      const res = await fetch("/api/admin/mailcrawl/crawl/cancel", { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) {
        toast.info(data.message || "Zahtjev za zaustavljanje pretrage poslan.")
      } else {
        toast.error(data.error || "Nije moguće zaustaviti pretragu.")
        setCancellingCrawl(false)
      }
    } catch {
      toast.error("Greška pri zaustavljanju pretrage.")
      setCancellingCrawl(false)
    }
  }

  // Cancel running bulk send
  const handleCancelBulkSend = async () => {
    setCancellingBulkSend(true)
    try {
      const res = await fetch("/api/admin/mailcrawl/leads/bulk-send/cancel", { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) {
        toast.info(data.message || "Zaustavljam skupno slanje nakon trenutnog maila...")
      } else {
        setCancellingBulkSend(false)
      }
    } catch {
      setCancellingBulkSend(false)
    }
  }

  // Generator pojmova za pretragu bez preklapanja (Korak 1)
  const handleGenerateTerms = async (countOverride?: number) => {
    const countToUse = countOverride || generatorCount
    setIsGeneratingTerms(true)
    try {
      const res = await fetch("/api/admin/mailcrawl/terms/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          count: countToUse,
          category: generatorCategory === "all" ? "" : generatorCategory,
          city: generatorCity,
          mode: generatorMode
        })
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        setGeneratedTerms(data.terms || [])
        setGeneratorSource(data.source || "catalog")
        toast.success(
          `Generirano ${data.terms?.length || 0} novih pojmova bez preklapanja (${data.source === "gemini" ? "Gemini AI" : "Brzi katalog"})!`
        )
      } else {
        toast.error(data.error || "Nije uspjelo generiranje pojmova.")
      }
    } catch {
      toast.error("Došlo je do greške pri generiranju pojmova.")
    } finally {
      setIsGeneratingTerms(false)
    }
  }

  // Uklanjanje pojedinog pojma iz liste
  const handleRemoveGeneratedTerm = (id: string) => {
    setGeneratedTerms(prev => prev.filter(t => t.id !== id))
    toast.info("Pojam uklonjen iz liste.")
  }

  // Ručno dodavanje pojma u pripremljenu listu
  const handleAddCustomTerm = () => {
    if (!newTermQuery.trim()) {
      toast.error("Unesite naziv pojma ili djelatnosti.")
      return
    }
    const newTerm = {
      id: `custom_${Date.now()}`,
      query: newTermQuery.trim(),
      city: newTermCity.trim(),
      category: "Korisnički unos",
      reason: "Ručno dodan pojam za pretragu"
    }
    setGeneratedTerms(prev => [newTerm, ...prev])
    setNewTermQuery("")
    setNewTermCity("")
    setShowAddTermInline(false)
    toast.success("Pojam dodan u listu za obradu.")
  }

  // Pokretanje serijske pretrage i pripreme mailova (Korak 2)
  const handleStartBatchCrawl = async () => {
    if (generatedTerms.length === 0) {
      toast.error("Nema pripremljenih pojmova. Prvo generirajte pojmove.")
      return
    }
    try {
      const res = await fetch("/api/admin/mailcrawl/crawl/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          terms: generatedTerms.map(t => ({ query: t.query, city: t.city })),
          entityType: searchEntityType,
          registrySource: searchSource,
          maxPerTerm: parseInt(batchMaxPerTerm, 10) || 5,
          aiMode: batchAiMode
        })
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        toast.success(data.message || `Pokrenuta obrada za ${generatedTerms.length} pojmova!`)
        setCrawlStatus(prev => ({
          ...prev,
          running: true,
          cancelled: false,
          totalTerms: generatedTerms.length,
          completedTerms: 0
        }))
        setTimeout(() => fetchSearchHistory(), 3000)
      } else {
        toast.error(data.error || "Nije uspjelo pokretanje serijske obrade.")
      }
    } catch {
      toast.error("Došlo je do greške pri pokretanju serijske obrade.")
    }
  }

  // Save direct manual donation
  const handleSaveDirectDonation = async () => {
    if (directDonorMode === "member" && !directDonorForm.member_id) {
      toast.error("Odaberite člana Društva s popisa prije spremanja donacije.")
      return
    }
    if (!directDonorForm.name.trim() || !directDonorForm.donated_amount.trim()) {
      toast.error("Ime/naziv donatora i iznos donacije su obavezni.")
      return
    }
    setSavingDirectDonor(true)
    try {
      const res = await fetch("/api/admin/mailcrawl/leads/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...directDonorForm,
          member_id: directDonorMode === "member" ? directDonorForm.member_id : null,
          entity_type: directDonorMode === "member" ? "clan" : directDonorForm.entity_type,
          isDirectDonation: true
        })
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        toast.success(`Uspješno evidentirana donacija: ${directDonorForm.name} (${directDonorForm.donated_amount} EUR)`)
        const shouldOpenThankYou =
          openThankYouAfterDirectSave &&
          Boolean(data.lead?.id) &&
          !(selectedMemberDonor?.doNotContact)
        const savedLeadId = data.lead?.id ? Number(data.lead.id) : undefined
        setDirectDonorDialogOpen(false)
        setOpenThankYouAfterDirectSave(false)
        setDirectDonorMode("external")
        setMemberSearchQuery("")
        setDirectDonorForm({
          member_id: null,
          name: "",
          entity_type: "fizicka_osoba",
          oib: "",
          city: "",
          address: "",
          email: "",
          phone: "",
          donated_amount: "50.00",
          donated_at: new Date().toISOString().slice(0, 10),
          payment_method: "Žiro račun / Transakcijski račun",
          donation_note: "Donacija za rad društva i digitalizaciju"
        })
        fetchStats()
        fetchLeads()
        fetchSentRegistry()
        if (shouldOpenThankYou && savedLeadId) {
          openThankYouDialog({ leadId: savedLeadId })
        }
      } else {
        toast.error(data.error || "Greška pri spremanju direktne donacije.")
      }
    } catch {
      toast.error("Greška pri spajanju s poslužiteljem.")
    } finally {
      setSavingDirectDonor(false)
    }
  }

  // Single or multi-URL website crawl
  const handleSingleUrlCrawl = async () => {
    const rawText = singleUrl.trim()
    if (!rawText) {
      toast.error("Unesite barem jednu URL adresu web stranice.")
      return
    }
    const parsedUrls = rawText
      .split(/[\r\n,;]+/)
      .map((u) => u.trim())
      .filter((u) => u.length >= 4 && u.includes("."))

    if (parsedUrls.length === 0) {
      toast.error("Unesite valjanu URL adresu (npr. https://tvrtka.hr).")
      return
    }

    setSingleLoading(true)
    try {
      if (parsedUrls.length === 1) {
        const res = await fetch("/api/admin/mailcrawl/crawl/url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: parsedUrls[0],
            autoGenerateAi: autoGenerateAi
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
      } else {
        const res = await fetch("/api/admin/mailcrawl/crawl/urls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            urls: parsedUrls,
            entityType: searchEntityType,
            city: searchCity,
            aiMode: autoGenerateAi ? "template" : "none"
          })
        })
        const data = await res.json()
        if (res.ok && data.ok) {
          toast.success(data.message || `Pokrenuta paralelna analiza za ${parsedUrls.length} URL-ova!`)
          setSingleUrl("")
          setCrawlStatus((prev) => ({
            ...prev,
            running: true,
            cancelled: false,
            provider: "urls",
            totalTerms: parsedUrls.length,
            completedTerms: 0
          }))
        } else {
          toast.error(data.error || "Greška pri pokretanju analize URL-ova.")
        }
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
  const handleSaveLeadEdits = async (quiet: boolean = false): Promise<Lead | null> => {
    if (!selectedLead?.id) return null
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
        if (!quiet) {
          toast.success("Podaci subjekta i tekst maila uspješno spremljeni!")
          refreshPreview({
            email: data.lead.email,
            subject: data.lead.email_subject,
            body: data.lead.email_body,
            contact: data.lead.contact_person,
            lead: data.lead,
            immediate: true
          })
        }
        return data.lead as Lead
      } else {
        toast.error(data.error || "Greška pri spremanju.")
        return null
      }
    } catch {
      toast.error("Greška pri spremanju izmjena.")
      return null
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

  // Open donor dialog for lead
  const openDonorDialog = (lead: Lead) => {
    setDonorSentItem(null)
    setDonorLead(lead)
    setDonorAmount(lead.donated_amount || settings?.suggested_amount_eur || "50.00")
    setDonorDate(lead.donated_at || new Date().toISOString().split("T")[0])
    setDonorNote(lead.donation_note || "Uplaćeno prema pozivu za donaciju")
    setDonorDialogOpen(true)
  }

  // Open donor dialog for sent registry item
  const openDonorDialogForSent = (item: SentRegistryItem) => {
    setDonorLead(null)
    setDonorSentItem(item)
    setDonorAmount(item.donated_amount || settings?.suggested_amount_eur || "50.00")
    setDonorDate(item.donated_at || new Date().toISOString().split("T")[0])
    setDonorNote(item.donation_note || "Uplaćeno prema pozivu za donaciju")
    setDonorDialogOpen(true)
  }

  // Open resend dialog for sent registry item
  const openResendDialog = (item: SentRegistryItem) => {
    setResendItem(item)
    setResendRecipient(item.recipient_email || item.email_norm)
    const baseSubj = item.subject || `Zamolba za podršku Hrvatskom rodoslovnom društvu`
    setResendSubject(baseSubj.startsWith("[Podsjetnik]") ? baseSubj : `[Podsjetnik] ${baseSubj}`)
    const greeting = buildGreeting({ contact_person: item.contact_person })
    const bodyText = item.body || `${greeting},\n\nLjubazno Vam se ponovno obraćamo vezano uz podršku radu Hrvatskog rodoslovnog društva "Pavao Ritter Vitezović".\n\nVaša podrška digitalizaciji arhivske građe, nabavi specijaliziranog skenera i informatičke opreme bila bi od iznimnog značaja za trajno očuvanje hrvatske kulturne i povijesne baštine.\n\nU privitku Vam dostavljamo podatke za uplatu donacije s 2D HUB-3A barkodom.\n\nS poštovanjem,\nHrvatsko rodoslovno društvo "Pavao Ritter Vitezović"`
    setResendBody(capitalizeRespectfulPronouns(bodyText))
    setResendDialogOpen(true)
  }

  // Execute resend mail
  const handleExecuteResend = async () => {
    if (!resendItem?.id) return
    if (!resendRecipient || !resendRecipient.includes("@")) {
      toast.error("Unesite ispravnu e-mail adresu primatelja.")
      return
    }
    setResendingMail(true)
    try {
      const res = await fetch(`/api/admin/mailcrawl/sent-registry/${resendItem.id}/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: resendRecipient,
          subject: resendSubject,
          emailBody: resendBody
        })
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        toast.success(data.message || `Mail uspješno ponovno poslan na ${resendRecipient}!`)
        setResendDialogOpen(false)
        fetchSentRegistry()
        fetchStats()
        if (user) {
          addLog({
            userId: user.id.toString(),
            userName: user.name,
            userRole: user.role,
            action: 'Ponovno slanje donacijskog maila',
            details: `Korisnik ${user.name} je ponovno poslao donacijski mail za subjekt "${resendItem.company_name}" na ${resendRecipient}`
          })
        }
      } else {
        toast.error(data.error || "Greška pri ponovnom slanju.")
      }
    } catch {
      toast.error("Greška pri pozivu poslužitelja.")
    } finally {
      setResendingMail(false)
    }
  }

  // Open history dialog
  const openHistoryDialog = (item: SentRegistryItem) => {
    setHistoryItem(item)
    setHistoryDialogOpen(true)
  }

  // Mark sent item email as invalid
  const handleMarkInvalid = async (item: SentRegistryItem) => {
    if (!item.id) return
    try {
      const res = await fetch("/api/admin/mailcrawl/sent-registry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "mark_invalid_email",
          id: item.id
        })
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        toast.warning(`E-mail adresa za "${item.company_name}" označena kao neispravna i subjekt je stavljen u neaktivno stanje.`)
        fetchSentRegistry()
        fetchLeads()
        if (user) {
          addLog({
            userId: user.id.toString(),
            userName: user.name,
            userRole: user.role,
            action: 'Oznaka neispravne adrese',
            details: `Označena neispravna e-mail adresa (${item.recipient_email || item.email_norm}) za subjekt: "${item.company_name}"`
          })
        }
      } else {
        toast.error(data.error || "Greška pri označavanju.")
      }
    } catch {
      toast.error("Greška pri komunikaciji s poslužiteljem.")
    }
  }

  // Unmark invalid email
  const handleUnmarkInvalid = async (item: SentRegistryItem) => {
    if (!item.id) return
    try {
      const res = await fetch("/api/admin/mailcrawl/sent-registry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "unmark_invalid_email",
          id: item.id
        })
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        toast.success(`E-mail adresa za "${item.company_name}" vraćena u aktivno stanje.`)
        fetchSentRegistry()
        fetchLeads()
      }
    } catch {
      toast.error("Greška.")
    }
  }

  // Open edit email dialog
  const openEditEmailDialog = (item: SentRegistryItem) => {
    setEditingSentItem(item)
    setNewEmailInput(item.recipient_email || item.email_norm || "")
    setEditEmailDialogOpen(true)
  }

  // Save new email address
  const handleSaveNewEmail = async () => {
    if (!editingSentItem?.id) return
    const trimmed = newEmailInput.trim()
    if (!trimmed || !trimmed.includes("@") || !trimmed.includes(".")) {
      toast.error("Unesite valjanu e-mail adresu (mora sadržavati @ i domenu).")
      return
    }
    setSavingNewEmail(true)
    try {
      const res = await fetch("/api/admin/mailcrawl/sent-registry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_email",
          id: editingSentItem.id,
          newEmail: trimmed
        })
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        toast.success(`E-mail adresa uspješno ažurirana na "${trimmed}"! Subjekt je ponovno aktivan za slanje.`)
        setEditEmailDialogOpen(false)
        fetchSentRegistry()
        fetchLeads()
        if (user) {
          addLog({
            userId: user.id.toString(),
            userName: user.name,
            userRole: user.role,
            action: 'Ispravak e-mail adrese',
            details: `Ažurirana nova ispravna e-mail adresa (${trimmed}) za subjekt: "${editingSentItem.company_name}"`
          })
        }
      } else {
        toast.error(data.error || "Greška pri ažuriranju adrese.")
      }
    } catch {
      toast.error("Greška pri pozivu poslužitelja.")
    } finally {
      setSavingNewEmail(false)
    }
  }

  // Save donor payment
  const handleSaveDonor = async () => {
    if (!donorLead?.id && !donorSentItem?.id) return
    setSavingDonor(true)
    try {
      if (donorSentItem?.id) {
        const res = await fetch("/api/admin/mailcrawl/sent-registry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "record_donation",
            id: donorSentItem.id,
            leadId: donorSentItem.lead_id,
            donorName: donorSentItem.company_name,
            donorAmount: donorAmount,
            donorDate: donorDate,
            donorNote: donorNote
          })
        })
        const data = await res.json()
        if (res.ok && data.ok) {
          toast.success(`Subjekt "${donorSentItem.company_name}" uspješno evidentiran kao donator (${donorAmount} EUR)!`)
          const shouldOpenThankYou = openThankYouAfterDonorSave
          const targetPayload: DonationThankYouTarget = {
            sentId: donorSentItem.id,
            leadId: donorSentItem.lead_id || undefined,
          }
          setDonorDialogOpen(false)
          setOpenThankYouAfterDonorSave(false)
          fetchStats()
          fetchSentRegistry()
          fetchLeads()
          if (user) {
            addLog({
              userId: user.id.toString(),
              userName: user.name,
              userRole: user.role,
              action: 'Evidentiranje donatora',
              details: `Korisnik ${user.name} je evidentirao uplatu donacije za subjekt: "${donorSentItem.company_name}" u iznosu ${donorAmount} EUR`
            })
          }
          if (shouldOpenThankYou) {
            openThankYouDialog(targetPayload)
          }
        } else {
          toast.error(data.error || "Greška pri spremanju uplate donatora.")
        }
      } else if (donorLead?.id) {
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
          const shouldOpenThankYou = openThankYouAfterDonorSave
          const targetPayload: DonationThankYouTarget = { leadId: donorLead.id }
          setDonorDialogOpen(false)
          setOpenThankYouAfterDonorSave(false)
          fetchStats()
          fetchSentRegistry()
          if (user) {
            addLog({
              userId: user.id.toString(),
              userName: user.name,
              userRole: user.role,
              action: 'Evidentiranje donatora',
              details: `Korisnik ${user.name} je evidentirao uplatu donacije za subjekt: "${donorLead.name}" u iznosu ${donorAmount} EUR`
            })
          }
          if (shouldOpenThankYou) {
            openThankYouDialog(targetPayload)
          }
        } else {
          toast.error(data.error || "Greška pri spremanju uplate donatora.")
        }
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

  // Refresh visual preview (debounced by default + AbortController)
  const executePreviewFetch = React.useCallback(async (params: {
    leadId: number
    email: string
    subject: string
    body: string
    contact: string
  }) => {
    if (previewAbortRef.current) previewAbortRef.current.abort()
    const controller = new AbortController()
    previewAbortRef.current = controller
    try {
      const res = await fetch(`/api/admin/mailcrawl/leads/${params.leadId}/preview-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          email: params.email,
          email_subject: params.subject,
          email_body: params.body,
          contact_person: params.contact
        })
      })
      if (res.ok) {
        const data = await res.json()
        setPreviewData(data)
      }
    } catch {}
  }, [])

  const refreshPreview = React.useCallback((overrides?: {
    email?: string
    subject?: string
    body?: string
    contact?: string
    lead?: Lead
    immediate?: boolean
  }) => {
    const targetLead = overrides?.lead ?? selectedLead
    if (!targetLead?.id) return

    const params = {
      leadId: targetLead.id,
      email: overrides?.email ?? editEmail,
      subject: overrides?.subject ?? editSubject,
      body: overrides?.body ?? editBody,
      contact: overrides?.contact ?? editContact
    }

    if (previewTimerRef.current) clearTimeout(previewTimerRef.current)
    if (overrides?.immediate) {
      executePreviewFetch(params)
    } else {
      previewTimerRef.current = setTimeout(() => {
        executePreviewFetch(params)
      }, 450)
    }
  }, [selectedLead, editEmail, editSubject, editBody, editContact, executePreviewFetch])

  // Open preview modal for lead
  const openLeadPreview = async (lead: Lead) => {
    setSelectedLead(lead)
    const normalizedSubject = capitalizeRespectfulPronouns(lead.email_subject || `${lead.name} i očuvanje hrvatskih korijena`)
    const normalizedBody = capitalizeRespectfulPronouns(lead.email_body || "")
    setEditSubject(normalizedSubject)
    setEditBody(normalizedBody)
    setEditEmail(lead.email || "")
    setEditContact(lead.contact_person || "")
    setCustomAiPrompt("")
    setTestEmailAddress(prev => prev || defaultTestEmail)
    setPreviewDialogOpen(true)

    if (user) {
      addLog({
        userId: user.id.toString(),
        userName: user.name,
        userRole: user.role,
        action: 'Pregled maila za donaciju',
        details: `Korisnik ${user.name} je otvorio pregled i pripremu maila za subjekt: "${lead.name}" (${lead.email || 'bez email adrese'})`
      })
    }

    refreshPreview({
      lead,
      email: lead.email || "",
      subject: normalizedSubject,
      body: normalizedBody,
      contact: lead.contact_person || "",
      immediate: true
    })
  }

  const currentLeadIndex = React.useMemo(() => {
    if (!selectedLead?.id) return -1
    return leads.findIndex((l) => l.id === selectedLead.id)
  }, [leads, selectedLead?.id])

  const handleNavigateLead = (delta: number) => {
    if (currentLeadIndex < 0) return
    const nextIdx = currentLeadIndex + delta
    if (nextIdx >= 0 && nextIdx < leads.length) {
      openLeadPreview(leads[nextIdx])
    }
  }

  const handleSaveLeadAndNext = async () => {
    const saved = await handleSaveLeadEdits(true)
    if (!saved) return
    toast.success("Izmjene spremljene!")
    if (currentLeadIndex >= 0 && currentLeadIndex + 1 < leads.length) {
      openLeadPreview(leads[currentLeadIndex + 1])
    }
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
        if (user) {
          addLog({
            userId: user.id.toString(),
            userName: user.name,
            userRole: user.role,
            action: 'Slanje donacijskog maila',
            details: `Poslan donacijski mail subjektu "${selectedLead.name}" na ${editEmail}`
          })
        }
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
        if (user) {
          addLog({
            userId: user.id.toString(),
            userName: user.name,
            userRole: user.role,
            action: 'Slanje test donacijskog maila',
            details: `Poslan testni donacijski mail za subjekt "${selectedLead.name}" na osobnu adresu: ${testEmailAddress}`
          })
        }
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

  // Bulk generate (streamed live counter)
  const handleBulkGenerate = async (ids?: number[], mode: "gemini" | "template" = "gemini") => {
    if (draftGenAbortRef.current) {
      draftGenAbortRef.current.abort()
    }
    const controller = new AbortController()
    draftGenAbortRef.current = controller

    try {
      const result = await consumeEmailSendStream<{
        ok?: boolean
        cancelled?: boolean
        generated?: number
        failed?: number
        total?: number
        message?: string
        error?: string
      }>(
        "/api/admin/mailcrawl/leads/bulk-generate",
        { ids, mode },
        (prog) =>
          setDraftGenProgress({
            ...prog,
            label:
              mode === "template"
                ? "Brza priprema nacrta predloškom"
                : "Gemini AI priprema nacrta mailova",
          }),
        controller.signal
      )

      if (result?.total === 0) {
        toast.info("Nema novih subjekata bez pripremljenog nacrta.")
      } else if (result?.cancelled) {
        toast.info(result.message || "Priprema nacrta zaustavljena.")
      } else {
        toast.success(
          result?.message || `Pripremljeno ${result?.generated || 0} novih nacrta mailova!`
        )
      }
      fetchStats()
      fetchLeads()
    } catch (err: any) {
      if (err?.name === "AbortError") {
        setDraftGenProgress((prev) => ({
          ...prev,
          active: false,
          status: "cancelled",
          finishedAt: new Date().toISOString(),
        }))
        toast.info("Priprema nacrta je zaustavljena.")
        fetchStats()
        fetchLeads()
      } else {
        toast.error(err?.message || "Greška pri masovnom generiranju.")
      }
    } finally {
      draftGenAbortRef.current = null
    }
  }

  // Bulk lead actions (delete -> TrashService, reject, reset_draft, opt_out)
  const handleBulkLeadAction = async (
    action: "delete" | "reject" | "reset_draft" | "opt_out",
    ids: number[]
  ) => {
    if (ids.length === 0) return

    if (action === "delete") {
      if (!(await confirmAction(`Premjestiti ${ids.length} odabranih kontakata u Smeće?`))) {
        return
      }
    } else if (action === "opt_out") {
      if (
        !(await confirmAction(
          `Dodati ${ids.length} odabranih subjekata na trajnu listu odjava (Ne kontaktirati)?`
        ))
      ) {
        return
      }
    }

    try {
      const res = await fetch("/api/admin/mailcrawl/leads/bulk-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) {
        toast.success(data.message || `Obrađeno ${data.affected || ids.length} zapisa.`)
        setSelectedLeadIds([])
        fetchStats()
        fetchLeads()
      } else {
        toast.error(data.error || "Greška pri skupnoj radnji.")
      }
    } catch {
      toast.error("Greška pri spajanju s poslužiteljem.")
    }
  }

  // Add sent registry item (or lead) to permanent opt-out list ("Ne kontaktirati")
  const handleOptOutItem = async (payload: {
    email?: string
    website?: string
    oib?: string
    companyName?: string
    reason?: string
  }) => {
    if (
      !(await confirmAction(
        `Dodati subjekt "${payload.companyName || payload.email}" na trajnu listu odjava (Ne kontaktirati)?\n\nSustav mu više nikada neće poslati donacijski poziv niti podsjetnik.`
      ))
    ) {
      return false
    }

    try {
      const res = await fetch("/api/admin/mailcrawl/opt-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) {
        toast.success(
          `Subjekt "${payload.companyName || payload.email}" dodan na listu odjava (Ne kontaktirati).`
        )
        fetchStats()
        fetchLeads()
        fetchSentRegistry()
        return true
      } else {
        toast.error(data.error || "Greška pri dodavanju na listu odjava.")
        return false
      }
    } catch {
      toast.error("Greška pri spajanju s poslužiteljem.")
      return false
    }
  }

  // Export candidates & sent registry to .xlsx workbook
  const handleExportXlsx = () => {
    try {
      const leadRows = leads.map((l) => ({
        ID: l.id ?? "",
        Naziv: l.name || "",
        Vrsta: l.entity_type || "",
        OIB: l.oib || "",
        Grad: l.city || "",
        Adresa: l.address || "",
        Email: l.email || "",
        Web: l.website || "",
        Telefon: l.phone || "",
        "Kontakt osoba": l.contact_person || "",
        Funkcija: l.contact_role || "",
        Djelatnost: l.activity_category || "",
        Status: l.status || "",
        "Predmet maila": l.email_subject || "",
        "Donirano (EUR)": l.donated_amount || "",
        "Datum donacije": l.donated_at ? formatDateDMY(l.donated_at, l.donated_at) : "",
        Izvor: l.source || "",
        "Datum unosa": l.created_at ? formatDateTimeDMY(l.created_at, "") : "",
      }))

      const sentRows = sentRegistry.map((s) => ({
        ID: s.id ?? "",
        Subjekt: s.company_name || "",
        OIB: s.oib || "",
        "Kontakt osoba": s.contact_person || "",
        "E-mail": s.recipient_email || s.email_norm || "",
        Predmet: s.subject || "",
        "Broj slanja": s.send_count || 1,
        Status: s.status || "sent",
        "Neispravna adresa": s.is_invalid_email === 1 ? "DA" : "NE",
        "Donirano (EUR)": s.donated_amount || "",
        "Datum donacije": s.donated_at ? formatDateDMY(s.donated_at, s.donated_at) : "",
        "Zadnje slanje": s.sent_at ? formatDateTimeDMY(s.sent_at, "") : "",
      }))

      const wb = XLSX.utils.book_new()
      const wsLeads = XLSX.utils.json_to_sheet(
        leadRows.length > 0 ? leadRows : [{ Napomena: "Nema zapisa u trenutnom filtru." }]
      )
      const wsSent = XLSX.utils.json_to_sheet(
        sentRows.length > 0 ? sentRows : [{ Napomena: "Nema poslanih mailova." }]
      )
      XLSX.utils.book_append_sheet(wb, wsLeads, "Kandidati")
      XLSX.utils.book_append_sheet(wb, wsSent, "Poslani i donatori")

      const stamp = new Date().toISOString().slice(0, 10)
      XLSX.writeFile(wb, `HRD_Donacije_${stamp}.xlsx`)
      toast.success(
        `Izvezena Excel tablica (${leadRows.length} kandidata, ${sentRows.length} poslanih).`
      )
    } catch {
      toast.error("Greška pri izvozu Excel (.xlsx) datoteke.")
    }
  }

  const leadsTotalPages = Math.max(1, Math.ceil(leads.length / leadsPageSize))
  const safeLeadsPage = Math.min(leadsPage, leadsTotalPages)
  const paginatedLeads = React.useMemo(() => {
    const start = (safeLeadsPage - 1) * leadsPageSize
    return leads.slice(start, start + leadsPageSize)
  }, [leads, safeLeadsPage, leadsPageSize])

  const filteredSent = React.useMemo(() => {
    return sentRegistry.filter(s => {
      if (!sentFilter) return true
      const term = sentFilter.toLowerCase()
      return (
        (s.company_name || "").toLowerCase().includes(term) ||
        (s.email_norm || "").toLowerCase().includes(term) ||
        (s.oib || "").includes(term) ||
        (s.subject || "").toLowerCase().includes(term)
      )
    })
  }, [sentRegistry, sentFilter])

  React.useEffect(() => {
    const validSent = new Set(sentRegistry.map((s) => Number(s.id)).filter((id) => Number.isFinite(id)))
    setSelectedSentIds((prev) => prev.filter((id) => validSent.has(id)))
  }, [sentRegistry])

  const sentTotalPages = Math.max(1, Math.ceil(filteredSent.length / sentPageSize))
  const safeSentPage = Math.min(sentPage, sentTotalPages)
  const paginatedSent = React.useMemo(() => {
    const start = (safeSentPage - 1) * sentPageSize
    return filteredSent.slice(start, start + sentPageSize)
  }, [filteredSent, safeSentPage, sentPageSize])

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 max-w-7xl mx-auto w-full">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-amber-500" />
              Donacije i Mail Crawler
            </h1>
            <Badge variant="outline" className="border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20">
              Admin modul
            </Badge>
            <Badge
              variant="outline"
              className="border-[#1E3A5F]/30 text-[#1E3A5F] bg-[#FEFCE8] font-mono text-[11px]"
              title="Broj poslanih donacijskih mailova u zadnja 24 sata u odnosu na sigurni dnevni limit"
            >
              Danas poslano: {stats.dailySentCount || 0} / {stats.dailyLimit || 150}
            </Badge>
            {stats.serperConfigured && (
              <Badge
                variant="outline"
                className="border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 text-[11px]"
              >
                <Zap className="h-3 w-3 mr-1" />
                Serper.dev aktivan
              </Badge>
            )}
            {stats.tavilyConfigured && (
              <Badge
                variant="outline"
                className="border-sky-500/40 text-sky-700 dark:text-sky-400 bg-sky-500/10 text-[11px]"
              >
                <Zap className="h-3 w-3 mr-1" />
                Tavily aktivan
              </Badge>
            )}
            {stats.firecrawlConfigured && (
              <Badge
                variant="outline"
                className="border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-500/10 text-[11px]"
              >
                <Globe className="h-3 w-3 mr-1" />
                Firecrawl fallback
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Brzo prikupljanje kontakata hrvatskih subjekata, skupno slanje s anti-spam razmakom, Google Gemini AI personalizacija i HUB-3A 2D barkod.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { fetchStats(); fetchLeads(); fetchSentRegistry(); }}>
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Osvježi
          </Button>
          <Button size="sm" variant="outline" onClick={() => setImportDialogOpen(true)}>
            <FileSpreadsheet className="h-4 w-4 mr-1.5 text-emerald-600" />
            Uvoz Excel/CSV
          </Button>
          <Button size="sm" variant="outline" onClick={handleExportXlsx}>
            <Download className="h-4 w-4 mr-1.5 text-primary" />
            Izvoz (.xlsx)
          </Button>
          <Button size="sm" variant="outline" onClick={() => setOptOutDialogOpen(true)}>
            <ShieldBan className="h-4 w-4 mr-1.5 text-rose-600" />
            Odjave ({stats.optOutCount || 0})
          </Button>
          <Button size="sm" variant="outline" onClick={() => setManualDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Ručni unos subjekta
          </Button>
          <Button size="sm" className="bg-rose-600 hover:bg-rose-700 text-white" onClick={() => setDirectDonorDialogOpen(true)}>
            <Heart className="h-4 w-4 mr-1.5 fill-current" />
            + Upiši donatora / donaciju
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
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 max-w-3xl h-auto">
          <TabsTrigger value="search" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            <span>Pretraživanje</span>
          </TabsTrigger>
          <TabsTrigger value="leads" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            <span>Za slanje</span>
            {(stats.remainingCount !== undefined ? stats.remainingCount : (stats.newCount + stats.draftCount)) > 0 && (
              <span className="ml-1 rounded-full bg-amber-500 text-white text-[10px] px-1.5 py-0.2 font-semibold">
                {stats.remainingCount !== undefined ? stats.remainingCount : (stats.newCount + stats.draftCount)}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="sent" className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            <span>Poslani mailovi</span>
            {stats.sentCount > 0 && (
              <span className="ml-1 rounded-full bg-emerald-600 text-white text-[10px] px-1.5 py-0.2 font-semibold">
                {stats.sentCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span>Postavke kampanje</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: PRETRAŽIVANJE I PRONALAZAK SUBJEKATA */}
        <TabsContent value="search" className="space-y-6 mt-6">
          {/* PAMETNI GENERATOR POJMOVA I SERIJSKA PRETRAGA */}
          <div className="rounded-xl border-2 border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 p-5 shadow-sm space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base tracking-tight">
                        Generator pojmova za pretragu (Pametno traženje bez preklapanja)
                      </h3>
                      <Badge variant="secondary" className="text-[11px] font-normal">
                        AI + Registri
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Automatski generirajte 5, 10 ili 15 novih pojmova. Sustav pamti sve prethodno pretraživane pojmove kako bi izbjegao ponavljanje, pretražuje registre i priprema personalizirane nacrte mailova.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs bg-muted/60 px-3 py-1.5 rounded-lg border shrink-0">
                <History className="h-4 w-4 text-primary shrink-0" />
                <span>Iskorištenih pojmova u bazi:</span>
                <strong className="text-foreground">{searchHistory.length}</strong>
              </div>
            </div>

            {/* KORAK 1: KONTROLE ZA GENERIRANJE */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
              <div className="space-y-2">
                <label className="text-xs font-semibold flex items-center gap-1.5">
                  <ListChecks className="h-3.5 w-3.5 text-primary" />
                  Broj novih pojmova:
                </label>
                <div className="grid grid-cols-3 gap-1.5 bg-muted/50 p-1 rounded-lg border">
                  {[5, 10, 15].map((cnt) => (
                    <Button
                      key={cnt}
                      type="button"
                      size="sm"
                      variant={generatorCount === cnt ? "default" : "ghost"}
                      className="h-8 text-xs font-semibold"
                      onClick={() => setGeneratorCount(cnt)}
                      disabled={isGeneratingTerms || crawlStatus.running}
                    >
                      {cnt} pojmova
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-primary" />
                  Način generiranja:
                </label>
                <div className="grid grid-cols-2 gap-1.5 bg-muted/50 p-1 rounded-lg border">
                  <Button
                    type="button"
                    size="sm"
                    variant={generatorMode === "catalog" ? "default" : "ghost"}
                    className="h-8 text-xs font-semibold"
                    onClick={() => setGeneratorMode("catalog")}
                    disabled={isGeneratingTerms || crawlStatus.running}
                  >
                    Brzi katalog (0 s)
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={generatorMode === "gemini" ? "default" : "ghost"}
                    className="h-8 text-xs font-semibold"
                    onClick={() => setGeneratorMode("gemini")}
                    disabled={isGeneratingTerms || crawlStatus.running}
                  >
                    Gemini AI
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-primary" />
                  Djelatnost / Sektor (opcionalno):
                </label>
                <Select
                  value={generatorCategory}
                  onValueChange={setGeneratorCategory}
                  disabled={isGeneratingTerms || crawlStatus.running}
                >
                  <SelectTrigger className="h-10 text-xs">
                    <SelectValue placeholder="Svi sektori (Maksimalna raznolikost)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Svi sektori (Maksimalna raznolikost)</SelectItem>
                    {CROATIAN_NICHE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.category} value={cat.category}>
                        {cat.category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-primary" />
                  Grad / Regija (opcionalno):
                </label>
                <Input
                  placeholder="npr. Zagreb, Split, ili prazno za cijelu RH"
                  value={generatorCity}
                  onChange={(e) => setGeneratorCity(e.target.value)}
                  disabled={isGeneratingTerms || crawlStatus.running}
                  className="h-10 text-xs"
                />
              </div>

              <div>
                <Button
                  onClick={() => handleGenerateTerms()}
                  disabled={isGeneratingTerms || crawlStatus.running}
                  className="w-full h-10 font-semibold text-xs shadow-sm"
                >
                  {isGeneratingTerms ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Generiram pojmove...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generiraj {generatorCount} pojmova
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* KORAK 2: PREGLED GENERIRANIH POJMOVA I POKRETANJE */}
            {generatedTerms.length > 0 && (
              <div className="space-y-4 pt-3 border-t">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs font-bold">
                      Pripremljeni pojmovi za pretragu ({generatedTerms.length}):
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      Izvor: {generatorSource === "gemini" ? "Gemini AI" : "Katalog registara"}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => setShowAddTermInline(!showAddTermInline)}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Dodaj pojam ručno
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => setGeneratedTerms([])}
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />
                      Očisti listu
                    </Button>
                  </div>
                </div>

                {showAddTermInline && (
                  <div className="p-3 rounded-lg border bg-muted/40 flex flex-col sm:flex-row gap-2 items-center">
                    <Input
                      placeholder="Novi pojam (npr. arhitekti)"
                      value={newTermQuery}
                      onChange={(e) => setNewTermQuery(e.target.value)}
                      className="h-8 text-xs"
                    />
                    <Input
                      placeholder="Grad (opcionalno)"
                      value={newTermCity}
                      onChange={(e) => setNewTermCity(e.target.value)}
                      className="h-8 text-xs sm:w-48"
                    />
                    <Button size="sm" className="h-8 text-xs shrink-0" onClick={handleAddCustomTerm}>
                      Dodaj u listu
                    </Button>
                  </div>
                )}

                {/* Grid kartica pojmova */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 max-h-64 overflow-y-auto p-1">
                  {generatedTerms.map((term, idx) => (
                    <div
                      key={term.id}
                      className="group relative p-3 rounded-lg border bg-card hover:border-primary/50 transition-all text-xs space-y-1.5 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="font-semibold text-foreground line-clamp-1">
                          {idx + 1}. {term.query}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveGeneratedTerm(term.id)}
                          className="text-muted-foreground hover:text-destructive p-0.5 rounded opacity-60 group-hover:opacity-100 transition-opacity"
                          title="Ukloni pojam"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {term.city && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {term.city}
                          </Badge>
                        )}
                        {term.category && (
                          <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                            {term.category}
                          </span>
                        )}
                      </div>

                      {term.reason && (
                        <p className="text-[10px] text-muted-foreground line-clamp-2 leading-tight">
                          {term.reason}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Pokretanje serijske obrade */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-xl bg-primary/10 border border-primary/20">
                  <div className="space-y-1 text-xs">
                    <div className="font-semibold text-foreground flex items-center gap-1.5">
                      <Zap className="h-4 w-4 text-primary" />
                      Spremno za paralelnu pretragu i obradu kontakata
                    </div>
                    <p className="text-muted-foreground">
                      Sustav paralelno pretražuje {generatedTerms.length} pojmova
                      {stats.serperConfigured
                        ? " putem Serper.dev Google API-ja"
                        : stats.tavilyConfigured
                        ? " putem Tavily Search API-ja"
                        : ""}
                      {stats.serperConfigured && stats.tavilyConfigured ? " (uz Tavily fallback)" : ""}
                      {stats.firecrawlConfigured ? " i Firecrawl za JS/zaštićene stranice" : ""}, izvlači provjerene e-mailove (s MX provjerom domene) i po izboru odmah priprema nacrte.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 shrink-0 w-full lg:w-auto">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span>Max po pojmu:</span>
                      <Select value={batchMaxPerTerm} onValueChange={setBatchMaxPerTerm} disabled={crawlStatus.running}>
                        <SelectTrigger className="h-9 w-18 text-xs bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="3">3</SelectItem>
                          <SelectItem value="5">5</SelectItem>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="15">15</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span>Priprema maila:</span>
                      <Select
                        value={batchAiMode}
                        onValueChange={(v) => setBatchAiMode(v as "none" | "template" | "gemini")}
                        disabled={crawlStatus.running}
                      >
                        <SelectTrigger className="h-9 w-48 text-xs bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Samo adrese (najbrže)</SelectItem>
                          <SelectItem value="template">Brzi predložak (0 s)</SelectItem>
                          <SelectItem value="gemini">Gemini AI paralelno</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      onClick={handleStartBatchCrawl}
                      disabled={crawlStatus.running}
                      className="font-bold text-xs shadow-md bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-5"
                    >
                      {crawlStatus.running ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Pretraga u tijeku...
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2 fill-current" />
                          Pokreni pretragu ({generatedTerms.length})
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

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
                        <SelectItem value="croatiabiz">Croatia.biz katalog (sporije)</SelectItem>
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

                {alreadySearchedInfo && (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs space-y-2">
                    <div className="font-semibold flex items-center gap-1.5">
                      <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                      Pojam je već pretraživan!
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      Pojam <strong>&quot;{alreadySearchedInfo.query}&quot;</strong> {alreadySearchedInfo.city ? `(${alreadySearchedInfo.city})` : ""} pretražen je <strong>{formatDateTimeDMY(alreadySearchedInfo.searched_at)}</strong> (pronađeno: {alreadySearchedInfo.found_count}, spremljeno: {alreadySearchedInfo.inserted_count}).
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-7 text-xs border-amber-400 bg-white hover:bg-amber-100 text-amber-900"
                      onClick={() => handleStartSearch(true)}
                    >
                      Pretraži ponovno svejedno
                    </Button>
                  </div>
                )}

                <Button
                  className="w-full"
                  onClick={() => handleStartSearch(false)}
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

              {/* Direct URL analysis box (1 to 50 URLs) */}
              <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
                <div className="flex items-center gap-2 border-b pb-2">
                  <Globe className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">Izravna analiza web stranica</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Zalijepite jednu ili do 50 web adresa tvrtki/obrta (svaku u novi redak) za brzo paralelno izvlačenje kontakata i adresa.
                </p>
                <div className="space-y-2">
                  <Textarea
                    rows={3}
                    placeholder={"https://tvrtka-primjer1.hr\nhttps://tvrtka-primjer2.hr"}
                    value={singleUrl}
                    onChange={(e) => setSingleUrl(e.target.value)}
                    disabled={singleLoading || crawlStatus.running}
                    className="text-xs font-mono"
                  />
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={handleSingleUrlCrawl}
                    disabled={singleLoading || crawlStatus.running}
                  >
                    {singleLoading ? (
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Globe className="h-4 w-4 mr-2" />
                    )}
                    Analiziraj URL-ove
                  </Button>
                </div>
              </div>

              {/* Povijest pretraživanih pojmova */}
              <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-sm">Već pretraživani pojmovi</h3>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">{searchHistory.length}</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Sustav pamti sve pretražene pojmove kako ne biste tražili duplo. Ako u registrima nema rezultata, automatski se pretražuje prvih 20 tvrtki na Googleu.
                </p>
                {searchHistory.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-1">Još nema zabilježenih pretraga.</p>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                    {searchHistory.map((item: any) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          setSearchQuery(item.query)
                          if (item.city) setSearchCity(item.city)
                        }}
                        className="p-2 rounded-lg border bg-muted/30 hover:bg-muted/60 cursor-pointer transition-colors flex items-center justify-between text-xs"
                      >
                        <div className="truncate pr-2">
                          <span className="font-medium text-foreground">{item.query}</span>
                          {item.city && <span className="text-muted-foreground ml-1">({item.city})</span>}
                          <div className="text-[10px] text-muted-foreground">{formatDateTimeDMY(item.searched_at)}</div>
                        </div>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          +{item.inserted_count}/{item.found_count}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Live Progress & Terminal Column */}
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4 flex flex-col h-[560px]">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                  <div className="flex items-center gap-2">
                    <div className={`h-2.5 w-2.5 rounded-full ${crawlStatus.running ? 'bg-amber-500 animate-pulse' : crawlStatus.cancelled ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                    <h3 className="font-semibold text-sm">
                      {crawlStatus.running ? "Pretraživanje i dubinska analiza u tijeku..." : "Dnevnik pretraživanja"}
                    </h3>
                    {(crawlStatus.running || crawlStatus.totalTerms > 0) && (
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {crawlStatus.provider === "serper"
                          ? "Serper.dev"
                          : crawlStatus.provider === "tavily"
                          ? "Tavily Search"
                          : crawlStatus.provider === "urls"
                          ? "URL analiza"
                          : "Web + Registri"}
                      </Badge>
                    )}
                    {crawlStatus.firecrawlUsedCount > 0 && (
                      <Badge variant="outline" className="text-[10px] font-mono border-amber-500/40 text-amber-700 dark:text-amber-400">
                        Firecrawl: {crawlStatus.firecrawlUsedCount}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span>Pronađeno: <strong className="text-foreground">{crawlStatus.foundCount}</strong></span>
                    <span>Spremljeno: <strong className="text-emerald-600 dark:text-emerald-400">{crawlStatus.insertedCount}</strong></span>
                    <span>Preskočeno (duplikati): <strong className="text-amber-600">{crawlStatus.duplicateCount}</strong></span>
                    {crawlStatus.running && (
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={handleCancelCrawl}
                        disabled={cancellingCrawl || crawlStatus.cancelled}
                        className="h-7 text-xs px-2.5"
                      >
                        {cancellingCrawl || crawlStatus.cancelled ? (
                          <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <Square className="h-3 w-3 mr-1 fill-current" />
                        )}
                        {cancellingCrawl || crawlStatus.cancelled ? "Zaustavljam..." : "Zaustavi pretragu"}
                      </Button>
                    )}
                  </div>
                </div>

                {(crawlStatus.running || crawlStatus.totalTerms > 0) && (
                  <div className="space-y-1.5 rounded-lg border bg-muted/40 px-3 py-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground truncate">
                        {crawlStatus.currentTerm
                          ? `Trenutno: ${crawlStatus.currentTerm}`
                          : crawlStatus.running
                          ? "Obrada u tijeku..."
                          : crawlStatus.cancelled
                          ? "Pretraga zaustavljena"
                          : "Obrada dovršena"}
                      </span>
                      {crawlStatus.totalTerms > 0 && (
                        <span className="font-mono text-muted-foreground shrink-0">
                          {crawlStatus.completedTerms} / {crawlStatus.totalTerms} pojmova
                        </span>
                      )}
                    </div>
                    {crawlStatus.totalTerms > 0 && (
                      <Progress
                        value={Math.min(
                          100,
                          Math.round((crawlStatus.completedTerms / Math.max(1, crawlStatus.totalTerms)) * 100)
                        )}
                        className="h-2"
                      />
                    )}
                  </div>
                )}

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
                      Analiziram kontakte na webu i pripremam nacrte...
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
          {(bulkSendJob?.mode !== "resend") && (
            <EmailSendProgressBanner
              progress={bulkSendProgress}
              onCancel={bulkSendJob?.running ? handleCancelBulkSend : undefined}
              cancelling={cancellingBulkSend}
            />
          )}
          <EmailSendProgressBanner
            progress={draftGenProgress}
            onCancel={draftGenProgress.active ? () => draftGenAbortRef.current?.abort() : undefined}
          />

          {/* Filters and action bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border">
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" className="bg-rose-600 hover:bg-rose-700 text-white h-9 text-xs" onClick={() => setDirectDonorDialogOpen(true)}>
                <Heart className="h-3.5 w-3.5 mr-1.5 fill-current" />
                + Ručni upis donatora (izvan maila)
              </Button>
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
                  <SelectItem value="pending">Preostalo za slanje</SelectItem>
                  <SelectItem value="all">Svi statusi</SelectItem>
                  <SelectItem value="draft_ready">Nacrt spreman</SelectItem>
                  <SelectItem value="new">Novi (bez teksta)</SelectItem>
                  <SelectItem value="sent">Poslano (Čeka uplatu)</SelectItem>
                  <SelectItem value="donor">Donatori (Uplaćeno)</SelectItem>
                  <SelectItem value="rejected">Odbijeno</SelectItem>
                </SelectContent>
              </Select>

              <Select value={leadFilterType} onValueChange={setLeadFilterType}>
                <SelectTrigger className="w-40 h-9 text-xs">
                  <SelectValue placeholder="Vrsta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Sve vrste</SelectItem>
                  <SelectItem value="clan">Član Društva</SelectItem>
                  <SelectItem value="fizicka_osoba">Fizička osoba</SelectItem>
                  <SelectItem value="tvrtka">Tvrtka</SelectItem>
                  <SelectItem value="obrt">Obrt</SelectItem>
                  <SelectItem value="udruga">Udruga</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="ghost" size="sm" onClick={() => fetchLeads()} className="h-9">
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={draftGenProgress.active}
                onClick={() => handleBulkGenerate(undefined, "template")}
                className="h-9 text-xs"
                title="Odmah priprema nacrte za sve nove subjekte bez pozivanja Gemini AI-ja"
              >
                <Zap className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
                Brzi predložak za nove
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={draftGenProgress.active}
                onClick={() => handleBulkGenerate(undefined, "gemini")}
                className="h-9 text-xs"
              >
                <Bot className="h-3.5 w-3.5 mr-1.5 text-amber-500" />
                AI generiraj sve nacrte
              </Button>
            </div>
          </div>

          {/* Quick-select strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl border bg-muted/30 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-muted-foreground font-medium mr-1">Brzi odabir:</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-[11px]"
                onClick={() => {
                  const draftIds = leads
                    .filter((l) => l.status === "draft_ready" && l.id)
                    .map((l) => Number(l.id))
                  setSelectedLeadIds(draftIds)
                }}
              >
                Spremni nacrti
              </Button>
              {[10, 25, 50].map((limit) => (
                <Button
                  key={limit}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px]"
                  onClick={() => {
                    const eligibleIds = leads
                      .filter((l) => l.id && l.status !== "sent" && l.status !== "donor" && l.status !== "rejected")
                      .slice(0, limit)
                      .map((l) => Number(l.id))
                    setSelectedLeadIds(eligibleIds)
                  }}
                >
                  Prvih {limit}
                </Button>
              ))}
              {selectedLeadIds.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[11px] text-muted-foreground"
                  onClick={() => setSelectedLeadIds([])}
                >
                  Očisti ({selectedLeadIds.length})
                </Button>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground">
              Prikazano <strong className="text-foreground">{paginatedLeads.length}</strong> od <strong className="text-foreground">{leads.length}</strong> kandidata
            </div>
          </div>

          {/* Sticky HRD Bulk Action Bar */}
          {selectedLeadIds.length > 0 && (
            <div className="sticky top-2 z-20 flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[#1E3A5F] border-b-2 border-[#D97706] text-white shadow-lg">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <CheckCircle2 className="h-4 w-4 text-[#D97706]" />
                <span>Odabrano subjekata: {selectedLeadIds.length}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={Boolean(bulkSendJob?.running)}
                  onClick={() =>
                    setBulkSendDialog({ open: true, mode: "initial", ids: selectedLeadIds })
                  }
                  className="h-8 text-xs bg-[#D97706] hover:bg-amber-600 text-white font-semibold border border-amber-300/30"
                >
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                  Pošalji odabrane ({selectedLeadIds.length})
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={draftGenProgress.active}
                  onClick={() => handleBulkGenerate(selectedLeadIds, "gemini")}
                  className="h-8 text-xs"
                >
                  <Bot className="h-3.5 w-3.5 mr-1 text-amber-600" />
                  AI pripremi
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={draftGenProgress.active}
                  onClick={() => handleBulkGenerate(selectedLeadIds, "template")}
                  className="h-8 text-xs"
                >
                  <Zap className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                  Brzi predložak
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => handleBulkLeadAction("opt_out", selectedLeadIds)}
                  className="h-8 text-xs"
                >
                  <ShieldBan className="h-3.5 w-3.5 mr-1 text-rose-600" />
                  Ne kontaktirati
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => handleBulkLeadAction("reject", selectedLeadIds)}
                  className="h-8 text-xs"
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Odbij
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => handleBulkLeadAction("delete", selectedLeadIds)}
                  className="h-8 text-xs"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Obriši
                </Button>
              </div>
            </div>
          )}

          {/* Leads table */}
          <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b text-muted-foreground font-medium">
                  <tr>
                    <th className="py-3 px-3 w-10">
                      <Checkbox
                        aria-label="Odaberi sve na stranici"
                        checked={
                          paginatedLeads.length > 0 &&
                          paginatedLeads.every((l) => l.id && selectedLeadIds.includes(Number(l.id)))
                        }
                        onCheckedChange={(checked) => {
                          const pageIds = paginatedLeads
                            .map((l) => Number(l.id))
                            .filter((id) => Number.isFinite(id) && id > 0)
                          if (checked) {
                            setSelectedLeadIds((prev) => Array.from(new Set([...prev, ...pageIds])))
                          } else {
                            const pageSet = new Set(pageIds)
                            setSelectedLeadIds((prev) => prev.filter((id) => !pageSet.has(id)))
                          }
                        }}
                      />
                    </th>
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
                      <td colSpan={7} className="py-12 text-center text-muted-foreground">
                        <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                        Učitavanje liste kontakata...
                      </td>
                    </tr>
                  ) : leads.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-muted-foreground">
                        Nema kontakata za prikaz. Pokrenite pretraživanje u kartici &quot;Pretraživanje&quot; ili unesite subjekt ručno.
                      </td>
                    </tr>
                  ) : (
                    paginatedLeads.map((lead) => {
                      const isDonor = lead.status === "donor"
                      const isDraftReady = lead.status === "draft_ready"
                      const isSent = lead.status === "sent"
                      const isRejected = lead.status === "rejected"
                      const leadIdNum = Number(lead.id || 0)
                      const isChecked = leadIdNum > 0 && selectedLeadIds.includes(leadIdNum)

                      return (
                        <tr key={lead.id} className={cn("hover:bg-muted/40 transition-colors", isChecked && "bg-primary/5")}>
                          <td className="py-3 px-3">
                            <Checkbox
                              aria-label={`Odaberi ${lead.name}`}
                              checked={isChecked}
                              onCheckedChange={(checked) => {
                                if (!leadIdNum) return
                                if (checked) {
                                  setSelectedLeadIds((prev) => Array.from(new Set([...prev, leadIdNum])))
                                } else {
                                  setSelectedLeadIds((prev) => prev.filter((id) => id !== leadIdNum))
                                }
                              }}
                            />
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium text-foreground flex flex-wrap items-center gap-1.5">
                              <span>{lead.name}</span>
                              {(lead.member_id || lead.entity_type === "clan") && (
                                lead.member_id ? (
                                  <Link
                                    href={`/members/${lead.member_id}`}
                                    className="inline-flex items-center rounded-full border border-[#CEA369] bg-[#FEFCE8] px-2 py-0.5 text-[10px] font-semibold text-[#1E3A5F] hover:bg-amber-100"
                                    title="Otvori karton člana u Registru članova"
                                  >
                                    Član Društva ↗
                                  </Link>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] border-[#CEA369] bg-[#FEFCE8] text-[#1E3A5F]">
                                    Član Društva
                                  </Badge>
                                )
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                              <span>{formatEntityTypeLabel(lead.entity_type)}</span>
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
                                <>
                                  <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium border-0 shadow-xs">
                                    <HeartHandshake className="h-3 w-3 mr-1" />
                                    Donator: {lead.donated_amount ? `${lead.donated_amount} EUR` : "Uplaćeno"}
                                  </Badge>
                                  {lead.thank_you_sent_at && (
                                    <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                                      ✓ Zahvala poslana ({formatDateDMY(lead.thank_you_sent_at)})
                                    </span>
                                  )}
                                </>
                              ) : isSent ? (
                                <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20">
                                  <Check className="h-3 w-3 mr-1" />
                                  Poslano {formatDateTimeDMY(lead.sent_at, "")}
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

                              {/* Gumb za personaliziranu zahvalu donatoru */}
                              {isDonor && lead.id && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className={cn(
                                    "h-7 text-xs px-2.5",
                                    lead.thank_you_sent_at
                                      ? "border-emerald-500/40 text-emerald-700 bg-emerald-50/70 hover:bg-emerald-100"
                                      : "border-[#D97706] bg-[#FEFCE8] text-[#7C2D12] hover:bg-amber-100 font-semibold"
                                  )}
                                  onClick={() => openThankYouDialog({ leadId: lead.id })}
                                  title="Pripremi i pošalji personaliziranu zahvalu za donaciju"
                                >
                                  <HeartHandshake className="h-3.5 w-3.5 mr-1 text-[#D97706]" />
                                  {lead.thank_you_sent_at ? "Zahvala ✓" : "Pošalji zahvalu"}
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

            {leads.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t bg-muted/20 text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>Po stranici:</span>
                  <Select
                    value={String(leadsPageSize)}
                    onValueChange={(v) => {
                      setLeadsPageSize(parseInt(v, 10) || 25)
                      setLeadsPage(1)
                    }}
                  >
                    <SelectTrigger className="h-7 w-18 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                  <span>
                    Stranica <strong className="text-foreground">{safeLeadsPage}</strong> / {leadsTotalPages} · Ukupno {leads.length}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs px-2"
                    disabled={safeLeadsPage <= 1}
                    onClick={() => setLeadsPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                    Prethodna
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs px-2"
                    disabled={safeLeadsPage >= leadsTotalPages}
                    onClick={() => setLeadsPage((p) => Math.min(leadsTotalPages, p + 1))}
                  >
                    Sljedeća
                    <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* TAB 3: POSLANI DONACIJSKI MAILOVI & DONATORI */}
        <TabsContent value="sent" className="space-y-4 mt-6">
          {bulkSendJob?.mode === "resend" && (
            <EmailSendProgressBanner
              progress={bulkSendProgress}
              onCancel={bulkSendJob?.running ? handleCancelBulkSend : undefined}
              cancelling={cancellingBulkSend}
            />
          )}

          <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-3">
              <div>
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  Poslani donacijski mailovi & Evidencija donacija
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Pregled svih poslanih mailova, broj poslanih podsjetnika po subjektu, skupno slanje podsjetnika te evidencija uplata.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {selectedSentIds.length > 0 && (
                  <Button
                    size="sm"
                    disabled={Boolean(bulkSendJob?.running)}
                    className="h-9 text-xs bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white border border-[#D97706]"
                    onClick={() =>
                      setBulkSendDialog({ open: true, mode: "resend", ids: selectedSentIds })
                    }
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                    Pošalji podsjetnik odabranima ({selectedSentIds.length})
                  </Button>
                )}
                <Button size="sm" className="bg-rose-600 hover:bg-rose-700 text-white h-9 text-xs" onClick={() => setDirectDonorDialogOpen(true)}>
                  <Heart className="h-3.5 w-3.5 mr-1.5 fill-current" />
                  + Ručni upis donatora
                </Button>
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Pretraži poslane..."
                    className="pl-8 text-xs h-9"
                    value={sentFilter}
                    onChange={(e) => setSentFilter(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b text-muted-foreground font-medium">
                  <tr>
                    <th className="py-2.5 px-3 w-10">
                      <Checkbox
                        aria-label="Odaberi sve aktivne na stranici"
                        checked={
                          paginatedSent.some((s) => !(s.status === "donor" || Boolean(s.donated_amount)) && s.is_invalid_email !== 1 && s.id) &&
                          paginatedSent
                            .filter((s) => !(s.status === "donor" || Boolean(s.donated_amount)) && s.is_invalid_email !== 1 && s.id)
                            .every((s) => selectedSentIds.includes(Number(s.id)))
                        }
                        onCheckedChange={(checked) => {
                          const eligiblePageIds = paginatedSent
                            .filter((s) => !(s.status === "donor" || Boolean(s.donated_amount)) && s.is_invalid_email !== 1 && s.id)
                            .map((s) => Number(s.id))
                          if (checked) {
                            setSelectedSentIds((prev) => Array.from(new Set([...prev, ...eligiblePageIds])))
                          } else {
                            const pageSet = new Set(eligiblePageIds)
                            setSelectedSentIds((prev) => prev.filter((id) => !pageSet.has(id)))
                          }
                        }}
                      />
                    </th>
                    <th className="py-2.5 px-4">Subjekt & OIB</th>
                    <th className="py-2.5 px-4">Kontakt & E-mail</th>
                    <th className="py-2.5 px-4">Slanja & Povijest</th>
                    <th className="py-2.5 px-4">Status uplate</th>
                    <th className="py-2.5 px-4 text-right">Akcije</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredSent.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground">
                        Još nema poslanih donacijskih poziva.
                      </td>
                    </tr>
                  ) : (
                    paginatedSent.map((s) => {
                      const isDonor = s.status === "donor" || Boolean(s.donated_amount)
                      const sendCount = s.send_count || 1
                      const isInvalid = s.is_invalid_email === 1
                      const sentIdNum = Number(s.id || 0)
                      const canBulkResend = sentIdNum > 0 && !isDonor && !isInvalid
                      const isChecked = canBulkResend && selectedSentIds.includes(sentIdNum)

                      return (
                        <tr 
                          key={s.id} 
                          className={cn(
                            "transition-colors", 
                            isInvalid 
                              ? "bg-rose-50/70 dark:bg-rose-950/25 border-l-4 border-l-rose-500" 
                              : isChecked
                              ? "bg-primary/5"
                              : "hover:bg-muted/30"
                          )}
                        >
                          <td className="py-3 px-3">
                            <Checkbox
                              aria-label={`Odaberi ${s.company_name}`}
                              disabled={!canBulkResend}
                              checked={isChecked}
                              onCheckedChange={(checked) => {
                                if (!canBulkResend) return
                                if (checked) {
                                  setSelectedSentIds((prev) => Array.from(new Set([...prev, sentIdNum])))
                                } else {
                                  setSelectedSentIds((prev) => prev.filter((id) => id !== sentIdNum))
                                }
                              }}
                            />
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium text-foreground flex flex-wrap items-center gap-1.5">
                              <span>{s.company_name}</span>
                              {s.member_id && (
                                <Link
                                  href={`/members/${s.member_id}`}
                                  className="inline-flex items-center rounded-full border border-[#CEA369] bg-[#FEFCE8] px-2 py-0.5 text-[10px] font-semibold text-[#1E3A5F] hover:bg-amber-100"
                                  title="Otvori karton člana u Registru članova"
                                >
                                  Član Društva ↗
                                </Link>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              {s.oib ? `OIB: ${s.oib}` : "OIB nije naveden"}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            {s.contact_person && (
                              <div className="font-medium text-foreground">{s.contact_person}</div>
                            )}
                            <div className={cn("font-mono text-[11px]", isInvalid ? "text-rose-600 dark:text-rose-400 font-semibold line-through decoration-rose-500" : "text-primary")}>
                              {s.recipient_email || String(s.email_norm || "").replace(/#don-.*$/, "")}
                            </div>
                            {isInvalid ? (
                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                <Badge variant="outline" className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/40 text-[10px] font-semibold flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3 text-rose-500 shrink-0" />
                                  Neispravna adresa
                                </Badge>
                                <span className="text-[10px] text-rose-600 dark:text-rose-400 italic">
                                  (Neaktivno do ispravka)
                                </span>
                              </div>
                            ) : s.subject ? (
                              <div className="text-[10px] text-muted-foreground truncate max-w-xs mt-0.5" title={s.subject}>
                                {s.subject}
                              </div>
                            ) : null}
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex flex-col gap-1 items-start">
                              <div className="flex items-center gap-1.5">
                                <Badge variant={sendCount > 1 ? "secondary" : "outline"} className={cn("text-[11px] font-semibold", sendCount > 1 && "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30")}>
                                  <Send className="h-3 w-3 mr-1" />
                                  Poslano {sendCount}x
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                                  onClick={() => openHistoryDialog(s)}
                                  title="Prikaži detaljnu povijest svih slanja"
                                >
                                  <Clock className="h-3 w-3 mr-1" />
                                  Povijest
                                </Button>
                              </div>
                              <span className="text-[10px] text-muted-foreground">
                                Zadnje: {formatDateTimeDMY(s.sent_at)}
                              </span>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            {isDonor ? (
                              <div className="flex flex-col gap-1 items-start">
                                <div className="flex items-center gap-1.5">
                                  <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium border-0 shadow-xs">
                                    <HeartHandshake className="h-3 w-3 mr-1" />
                                    Donator: {s.donated_amount ? `${s.donated_amount} EUR` : "Uplaćeno"}
                                  </Badge>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 text-muted-foreground hover:text-emerald-600"
                                    onClick={() => openDonorDialogForSent(s)}
                                    title="Uredi podatke o uplatitelju"
                                  >
                                    <SlidersHorizontal className="h-3 w-3" />
                                  </Button>
                                </div>
                                {s.thank_you_sent_at && (
                                  <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                                    ✓ Zahvala poslana ({formatDateDMY(s.thank_you_sent_at)})
                                  </span>
                                )}
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                onClick={() => openDonorDialogForSent(s)}
                              >
                                <HeartHandshake className="h-3.5 w-3.5 mr-1" />
                                Zabilježi uplatu
                              </Button>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              {isInvalid ? (
                                <>
                                  <Button
                                    size="sm"
                                    className="h-7 text-xs bg-rose-600 hover:bg-rose-700 text-white font-medium shadow-xs"
                                    onClick={() => openEditEmailDialog(s)}
                                    title="Upišite ispravnu e-mail adresu za reaktivaciju subjekta"
                                  >
                                    <Mail className="h-3 w-3 mr-1" />
                                    Ispravi e-mail
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled
                                    className="h-7 text-xs opacity-50 cursor-not-allowed border-dashed text-muted-foreground"
                                    title="Subjekt je neaktivan jer je adresa neispravna. Prvo upišite ispravnu adresu."
                                  >
                                    <RotateCcw className="h-3 w-3 mr-1" />
                                    Pošalji ponovno
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                                    onClick={() => handleUnmarkInvalid(s)}
                                    title="Poništi status neispravne adrese"
                                  >
                                    Poništi
                                  </Button>
                                </>
                              ) : (
                                <>
                                  {isDonor && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className={cn(
                                        "h-7 text-xs px-2.5",
                                        s.thank_you_sent_at
                                          ? "border-emerald-500/40 text-emerald-700 bg-emerald-50/70 hover:bg-emerald-100"
                                          : "border-[#D97706] bg-[#FEFCE8] text-[#7C2D12] hover:bg-amber-100 font-semibold"
                                      )}
                                      onClick={() =>
                                        openThankYouDialog({
                                          sentId: s.id,
                                          leadId: s.lead_id || undefined,
                                        })
                                      }
                                      title="Pripremi i pošalji personaliziranu zahvalu za donaciju"
                                    >
                                      <HeartHandshake className="h-3.5 w-3.5 mr-1 text-[#D97706]" />
                                      {s.thank_you_sent_at ? "Ponovi zahvalu ✓" : "Pošalji zahvalu"}
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                                    onClick={() => openResendDialog(s)}
                                    title="Pošalji ponovno donacijski mail ili podsjetnik"
                                  >
                                    <RotateCcw className="h-3 w-3 mr-1" />
                                    Pošalji ponovno
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-[11px] text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                    onClick={() => handleMarkInvalid(s)}
                                    title="Označi ovu adresu kao neispravnu (bounced/pogrešna adresa)"
                                  >
                                    <AlertTriangle className="h-3.5 w-3.5 mr-1 text-rose-500" />
                                    Neispravan mail
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-[11px] text-muted-foreground hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                    onClick={() =>
                                      handleOptOutItem({
                                        email: s.recipient_email || s.email_norm,
                                        oib: s.oib,
                                        companyName: s.company_name,
                                        reason: "Označeno kao Ne kontaktirati iz registra poslanih mailova",
                                      })
                                    }
                                    title="Dodaj na trajnu listu odjava (Ne kontaktirati)"
                                  >
                                    <ShieldBan className="h-3.5 w-3.5 mr-1 text-rose-600" />
                                    Ne kontaktirati
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {filteredSent.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>Po stranici:</span>
                  <Select
                    value={String(sentPageSize)}
                    onValueChange={(v) => {
                      setSentPageSize(parseInt(v, 10) || 25)
                      setSentPage(1)
                    }}
                  >
                    <SelectTrigger className="h-7 w-18 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                  <span>
                    Stranica <strong className="text-foreground">{safeSentPage}</strong> / {sentTotalPages} · Ukupno {filteredSent.length}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs px-2"
                    disabled={safeSentPage <= 1}
                    onClick={() => setSentPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                    Prethodna
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs px-2"
                    disabled={safeSentPage >= sentTotalPages}
                    onClick={() => setSentPage((p) => Math.min(sentTotalPages, p + 1))}
                  >
                    Sljedeća
                    <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* TAB 4: POSTAVKE KAMPANJE */}
        <TabsContent value="settings" className="space-y-6 mt-6">
          <DonationsSettingsPanel
            externalSettings={settings}
            externalHub3PreviewUrl={hub3PreviewUrl}
            onSettingsSaved={(updated, newHub3) => {
              setSettings(updated)
              if (newHub3) setHub3PreviewUrl(newHub3)
              fetchStats()
            }}
          />
        </TabsContent>
      </Tabs>

      {/* MODAL 1: PREGLED & ODOBRAVANJE MAILA (PREGLEDNI SPLIT VIEW) */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="sm:max-w-[1400px] w-[98vw] h-[95vh] max-h-[95vh] p-0 gap-0 flex flex-col overflow-hidden">
          {/* ZAGLAVLJE */}
          <DialogHeader className="px-6 pr-14 py-4 border-b bg-card shrink-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-lg font-bold leading-tight truncate">
                    {selectedLead?.name}
                  </DialogTitle>
                  <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>Pregled i odobrenje maila</span>
                    {selectedLead?.city && <span>· {selectedLead.city}</span>}
                    {selectedLead?.website && (
                      <a href={selectedLead.website} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">
                        web <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
              {selectedLead && (
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {leads.length > 1 && currentLeadIndex >= 0 && (
                    <div className="flex items-center gap-1 mr-1 rounded-lg border bg-muted/40 px-1.5 py-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        disabled={currentLeadIndex <= 0}
                        onClick={() => handleNavigateLead(-1)}
                      >
                        <ChevronLeft className="h-3.5 w-3.5 mr-0.5" />
                        Prethodni
                      </Button>
                      <span className="text-[11px] font-mono px-1.5 text-muted-foreground">
                        {currentLeadIndex + 1} / {leads.length}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        disabled={currentLeadIndex >= leads.length - 1}
                        onClick={() => handleNavigateLead(1)}
                      >
                        Sljedeći
                        <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                      </Button>
                    </div>
                  )}

                  {selectedLead.id && selectedLead.status !== "sent" && selectedLead.status !== "donor" && (
                    <label className="inline-flex items-center gap-1.5 rounded-md border bg-muted/30 px-2.5 py-1.5 text-xs cursor-pointer select-none">
                      <Checkbox
                        checked={selectedLeadIds.includes(Number(selectedLead.id))}
                        onCheckedChange={(checked) => {
                          const idNum = Number(selectedLead.id)
                          if (checked) {
                            setSelectedLeadIds((prev) => Array.from(new Set([...prev, idNum])))
                          } else {
                            setSelectedLeadIds((prev) => prev.filter((id) => id !== idNum))
                          }
                        }}
                      />
                      <span>Uključi u skupno slanje</span>
                    </label>
                  )}

                  <Badge variant="outline" className="text-xs uppercase font-medium">
                    {selectedLead.entity_type || "tvrtka"}
                  </Badge>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const ok = await handleOptOutItem({
                        email: editEmail || selectedLead.email,
                        website: selectedLead.website,
                        oib: selectedLead.oib,
                        companyName: selectedLead.name,
                        reason: "Označeno kao Ne kontaktirati iz pregleda kandidata",
                      })
                      if (ok) setPreviewDialogOpen(false)
                    }}
                    className="h-9 text-rose-600 hover:text-rose-700 border-rose-300"
                    title="Dodaj subjekt na trajnu listu odjava (Ne kontaktirati)"
                  >
                    <ShieldBan className="h-4 w-4 mr-1.5" />
                    Ne kontaktirati
                  </Button>

                  <SaveActionButton
                    label="Spremi izmjene"
                    size="sm"
                    loading={savingLeadEdits}
                    onClick={() => handleSaveLeadEdits()}
                  />

                  {currentLeadIndex >= 0 && currentLeadIndex + 1 < leads.length && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSaveLeadAndNext}
                      disabled={savingLeadEdits}
                      className={ACTION_BUTTON_STYLES.finishSm}
                    >
                      Spremi i sljedeći
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              )}
            </div>
            <DialogDescription className="sr-only">
              Uredite odgovornu osobu, tekst i pošaljite testni ili stvarni e-mail.
            </DialogDescription>
          </DialogHeader>

          {/* TIJELO */}
          {selectedLead && (
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(420px,5fr)_7fr] overflow-y-auto lg:overflow-hidden">
              {/* LIJEVI STUPAC: Uređivanje */}
              <div className="lg:overflow-y-auto p-5 space-y-5 border-b lg:border-b-0 lg:border-r">
                <section className="space-y-3">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    1. Primatelj
                  </h4>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium flex items-center gap-1.5">
                        <User className="h-4 w-4 text-primary" />
                        Odgovorna osoba
                      </label>
                      <span className="text-[11px] text-muted-foreground">automatski mijenja pozdrav</span>
                    </div>
                    <Input
                      placeholder="Ime i prezime (npr. Ivan Horvat)"
                      value={editContact}
                      onChange={(e) => handleContactChange(e.target.value)}
                      className="h-10 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium flex items-center gap-1.5">
                      <Mail className="h-4 w-4 text-primary" />
                      E-mail adresa
                    </label>
                    <Input
                      type="email"
                      placeholder="kontakt@tvrtka.hr"
                      value={editEmail}
                      onChange={(e) => {
                        setEditEmail(e.target.value)
                        refreshPreview({ email: e.target.value })
                      }}
                      className="h-10 text-sm font-mono"
                    />
                  </div>
                </section>

                <section className="space-y-3">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    2. Sadržaj poruke
                  </h4>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Predmet</label>
                    <Input
                      value={editSubject}
                      onChange={(e) => {
                        setEditSubject(e.target.value)
                        refreshPreview({ subject: e.target.value })
                      }}
                      className="h-10 text-sm font-medium"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Tekst maila</label>
                      <button
                        type="button"
                        onClick={() => handleContactChange(editContact)}
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                        title="Ponovno uskladi pozdrav u prvoj rečenici s imenom odgovorne osobe"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Ažuriraj pozdrav
                      </button>
                    </div>
                    <Textarea
                      value={editBody}
                      onChange={(e) => {
                        setEditBody(e.target.value)
                        refreshPreview({ body: e.target.value })
                      }}
                      className="font-sans text-sm leading-relaxed min-h-[320px] resize-y"
                      placeholder="Poštovani, ..."
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Podaci za uplatu, barkod, potpis i logo dodaju se automatski ispod teksta.
                    </p>
                  </div>
                </section>

                <section className="space-y-2 p-4 rounded-xl border border-amber-500/30 bg-amber-50/40 dark:bg-amber-950/15">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                      <Bot className="h-4 w-4" />
                      Doradi tekst s Gemini AI
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={handleGenerateAiSingle}
                      disabled={generatingAiSingle}
                    >
                      {generatingAiSingle ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
                      Generiraj
                    </Button>
                  </div>
                  <Input
                    placeholder="Dodatna uputa (npr. 'skrati na 3 rečenice')..."
                    className="h-9 text-sm bg-background"
                    value={customAiPrompt}
                    onChange={(e) => setCustomAiPrompt(e.target.value)}
                  />
                </section>
              </div>

              {/* DESNI STUPAC: Živi pretpregled */}
              <div className="flex flex-col min-h-[600px] lg:min-h-0 bg-muted/40 p-5 gap-3">
                <div className="flex items-center justify-between shrink-0">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Eye className="h-4 w-4" />
                    Pretpregled (izgled kod primatelja)
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => refreshPreview({ immediate: true })}
                    className="h-7 text-xs"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Osvježi
                  </Button>
                </div>

                <div className="flex-1 min-h-0 rounded-xl border bg-white shadow-sm flex flex-col overflow-hidden">
                  <div className="px-4 py-3 border-b bg-slate-50 text-[13px] text-slate-700 space-y-1 shrink-0">
                    <div className="flex gap-2"><span className="w-16 shrink-0 text-slate-500">Od:</span><span className="truncate">{previewData?.from || `${settings?.sender_name} <${settings?.sender_email}>`}</span></div>
                    <div className="flex gap-2"><span className="w-16 shrink-0 text-slate-500">Za:</span><span className="truncate">{editContact ? `${editContact} (${selectedLead.name}) <${editEmail}>` : (editEmail || "(nema e-maila)")}</span></div>
                    <div className="flex gap-2"><span className="w-16 shrink-0 text-slate-500">Predmet:</span><span className="truncate font-semibold text-slate-900">{editSubject}</span></div>
                  </div>
                  {previewData?.html ? (
                    <iframe
                      srcDoc={previewData.html}
                      title="Email Preview"
                      className="w-full flex-1 min-h-0 border-0 bg-white"
                    />
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground bg-slate-50">
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      Učitavanje pretpregleda...
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* PODNOŽJE */}
          <div className="px-5 py-3.5 border-t-2 border-border bg-[#FBF9F6] shrink-0 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-[0_-4px_12px_rgba(27,43,54,0.06)]">
            <div className="flex items-center gap-2 flex-1 max-w-lg">
              <span className="text-xs font-semibold whitespace-nowrap text-muted-foreground">Test na moj mail:</span>
              <Input
                placeholder={defaultTestEmail ? `npr. ${defaultTestEmail}` : "npr. vase.ime@rodoslovlje.hr"}
                value={testEmailAddress}
                onChange={(e) => setTestEmailAddress(e.target.value)}
                className="h-10 text-sm font-mono bg-background"
              />
              <Button
                variant="outline"
                size="sm"
                className="h-10 rounded-full px-4 shrink-0 font-semibold border-2 border-[#D97706] text-[#1E3A5F] hover:bg-amber-50"
                onClick={handleSendTest}
              >
                Pošalji test
              </Button>
            </div>

            <div className="flex items-center gap-2.5 justify-end flex-wrap">
              <CloseActionButton label="Zatvori" onClick={() => setPreviewDialogOpen(false)} />
              <SaveActionButton
                label="Spremi izmjene"
                loading={savingLeadEdits}
                onClick={() => handleSaveLeadEdits()}
              />
              <Button
                type="button"
                onClick={handleApproveAndSend}
                disabled={sendingEmail || selectedLead?.status === "sent"}
                className="rounded-full h-10 px-6 bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 border border-[#D97706] text-white font-bold shadow-md gap-2"
              >
                {sendingEmail ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Slanje u tijeku...
                  </>
                ) : selectedLead?.status === "sent" ? (
                  <>
                    <Check className="h-4 w-4 text-[#D97706]" />
                    Već poslano
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 text-[#D97706]" />
                    Odobri i pošalji
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: RUČNI UNOS SUBJEKTA */}
      <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
        <DialogContent className="sm:max-w-md">
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
            <CloseActionButton label="Odustani" onClick={() => setManualDialogOpen(false)} />
            <SaveActionButton label="Dodaj u bazu" onClick={handleManualAdd} />
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: EVIDENCIJA UPLATE DONACIJE (DONATOR) */}
      <Dialog open={donorDialogOpen} onOpenChange={setDonorDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <HeartHandshake className="h-5 w-5" />
              Evidencija uplate donacije
            </DialogTitle>
            <DialogDescription>
              Označite subjekt kao donatora nakon što je evidentirana uplata na račun društva.
            </DialogDescription>
          </DialogHeader>

          {(donorLead || donorSentItem) && (
            <div className="space-y-4 py-2 text-xs">
              <div className="p-3 rounded-lg bg-muted/40 border space-y-1">
                <div className="font-semibold text-sm text-foreground">
                  {donorSentItem ? donorSentItem.company_name : donorLead?.name}
                </div>
                <div className="text-muted-foreground">
                  {(donorSentItem?.contact_person || donorLead?.contact_person) ? `Kontakt: ${donorSentItem?.contact_person || donorLead?.contact_person} · ` : ""}
                  {donorSentItem ? (donorSentItem.oib ? `OIB: ${donorSentItem.oib}` : "Poslani registar") : (donorLead?.city || "Hrvatska")}
                </div>
                <div className="font-mono text-[11px] text-primary">
                  {donorSentItem ? (donorSentItem.recipient_email || donorSentItem.email_norm) : donorLead?.email}
                </div>
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

              <label className="flex items-center gap-2 rounded-lg border border-amber-200 bg-[#FEFCE8] px-3 py-2 text-xs text-[#7C2D12] cursor-pointer">
                <Checkbox
                  checked={openThankYouAfterDonorSave}
                  onCheckedChange={(checked) => setOpenThankYouAfterDonorSave(Boolean(checked))}
                />
                <span>Nakon spremanja odmah otvori pripremu zahvale za donaciju</span>
              </label>
            </div>
          )}

          <DialogFooter>
            <CloseActionButton label="Odustani" onClick={() => setDonorDialogOpen(false)} />
            <FinishActionButton
              label="Potvrdi i označi donatora"
              loading={savingDonor}
              onClick={handleSaveDonor}
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 4: PONOVNO SLANJE MAILA ZA DONACIJU */}
      <Dialog open={resendDialogOpen} onOpenChange={setResendDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-primary" />
              Ponovno slanje donacijskog maila / podsjetnika
            </DialogTitle>
            <DialogDescription>
              Pošaljite podsjetnik ili ponovni poziv za donaciju subjektu &quot;{resendItem?.company_name}&quot;. Brojač slanja će se automatski uvećati.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-muted-foreground">Primatelj (E-mail):</label>
                <Input
                  value={resendRecipient}
                  onChange={(e) => setResendRecipient(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-muted-foreground">Kontakt osoba:</label>
                <Input
                  value={resendItem?.contact_person || "(Nije navedeno)"}
                  disabled
                  className="bg-muted text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-muted-foreground">Predmet maila:</label>
              <Input
                value={resendSubject}
                onChange={(e) => setResendSubject(e.target.value)}
                className="text-xs font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-muted-foreground">Tekst poruke:</label>
              <Textarea
                rows={9}
                value={resendBody}
                onChange={(e) => setResendBody(e.target.value)}
                className="text-xs leading-relaxed font-sans resize-y"
              />
              <p className="text-[11px] text-muted-foreground italic">
                U poruku se automatski umeće HUB-3A 2D uplatnica i službeni potpis društva.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2.5">
            <CloseActionButton label="Odustani" onClick={() => setResendDialogOpen(false)} />
            <Button
              onClick={handleExecuteResend}
              disabled={resendingMail}
              className="rounded-full h-10 px-6 bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 border border-[#D97706] text-white font-bold shadow-md gap-2"
            >
              {resendingMail ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Slanje u tijeku...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 text-[#D97706]" />
                  Pošalji ponovno
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 5: DETALJNA POVIJEST SLANJA */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-indigo-500" />
              Povijest slanja mailova
            </DialogTitle>
            <DialogDescription>
              Kronološki zapis svih poslanih poziva za subjekt &quot;{historyItem?.company_name}&quot;
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="p-3 rounded-lg bg-muted/40 border">
              <div className="font-semibold text-sm">{historyItem?.company_name}</div>
              <div className="text-muted-foreground mt-0.5">
                {historyItem?.contact_person ? `Kontakt: ${historyItem.contact_person} · ` : ""}
                {historyItem?.oib ? `OIB: ${historyItem.oib}` : ""}
              </div>
              <div className="font-mono text-[11px] text-primary mt-0.5">
                {historyItem?.recipient_email || historyItem?.email_norm}
              </div>
              <div className="mt-2">
                <Badge variant="outline" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30">
                  Ukupno slanja: {historyItem?.send_count || 1}x
                </Badge>
              </div>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {(() => {
                let entries: Array<string | { sent_at?: string; sent_at_iso?: string; recipient?: string; subject?: string }> = []
                if (historyItem?.sent_history) {
                  try {
                    const parsed = JSON.parse(historyItem.sent_history)
                    if (Array.isArray(parsed)) entries = parsed
                  } catch {}
                }
                if (entries.length === 0 && historyItem?.sent_at) {
                  entries = [`${formatDateTimeDMY(historyItem.sent_at)} - Poslan poziv za donaciju (${historyItem.recipient_email || historyItem.email_norm})`]
                }

                return entries.map((entry, idx) => {
                  const isObj = typeof entry === "object" && entry !== null
                  const dateLabel = isObj
                    ? formatDateTimeDMY(entry.sent_at_iso || entry.sent_at, entry.sent_at || "")
                    : ""
                  const lineText = isObj
                    ? `${dateLabel ? `${dateLabel} — ` : ""}Poslano na ${entry.recipient || historyItem?.recipient_email || historyItem?.email_norm || ""}${entry.subject ? ` (${entry.subject})` : ""}`
                    : String(entry)

                  return (
                    <div key={idx} className="flex items-start gap-2.5 p-2.5 rounded border bg-card text-xs">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <div className="leading-relaxed">
                        <div className="font-medium text-foreground">{lineText}</div>
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
          </div>

          <DialogFooter>
            <CloseActionButton label="Zatvori" onClick={() => setHistoryDialogOpen(false)} />
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 6: ISPRAVAK E-MAIL ADRESE */}
      <Dialog open={editEmailDialogOpen} onOpenChange={setEditEmailDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <Mail className="h-5 w-5" />
              Ispravak e-mail adrese
            </DialogTitle>
            <DialogDescription>
              Unesite novu, provjerenu e-mail adresu za subjekt &quot;{editingSentItem?.company_name}&quot;. Subjekt će se odmah reaktivirati za slanje.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="p-3 rounded-lg bg-muted/40 border space-y-1">
              <div className="font-semibold text-sm">{editingSentItem?.company_name}</div>
              <div className="text-muted-foreground">
                {editingSentItem?.contact_person ? `Kontakt: ${editingSentItem.contact_person} · ` : ""}
                {editingSentItem?.oib ? `OIB: ${editingSentItem.oib}` : ""}
              </div>
              <div className="text-rose-600 dark:text-rose-400 line-through font-mono text-[11px]">
                Stara adresa: {editingSentItem?.recipient_email || editingSentItem?.email_norm}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Nova ispravna e-mail adresa:</label>
              <Input
                placeholder="npr. tajnistvo@tvrtka.hr"
                value={newEmailInput}
                onChange={(e) => setNewEmailInput(e.target.value)}
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Nakon spremanja adresa se ažurira u poslanom registru i bazi subjekata, a status prelazi u aktivan.
              </p>
            </div>
          </div>

          <DialogFooter>
            <CloseActionButton label="Odustani" onClick={() => setEditEmailDialogOpen(false)} />
            <FinishActionButton
              label="Spremi i aktiviraj"
              loading={savingNewEmail}
              onClick={handleSaveNewEmail}
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIJALOG ZA RUČNI UPIS DIREKTNOG DONATORA / DONACIJE (ČLAN DRUŠTVA ILI VANJSKI DONATOR) */}
      <Dialog open={directDonorDialogOpen} onOpenChange={setDirectDonorDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <Heart className="h-5 w-5 fill-current" />
              Ručni upis donatora i uplate donacije
            </DialogTitle>
            <DialogDescription>
              Evidentirajte donaciju člana Društva iz Registra članova ili vanjske osobe / tvrtke (neovisno o e-mail kampanji). Podatak odmah ulazi u statistiku i izvješća.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-2 text-xs">
            {/* Odabir: Član Društva ili Osoba/Tvrtka izvan društva */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setDirectDonorMode("member")
                  setDirectDonorForm((prev) => ({
                    ...prev,
                    entity_type: "clan",
                    member_id: prev.member_id || null,
                  }))
                }}
                className={cn(
                  "rounded-xl border-2 px-3 py-2.5 text-left transition-all flex items-center gap-2",
                  directDonorMode === "member"
                    ? "border-[#1E3A5F] bg-[#FEFCE8] text-[#1E3A5F] font-bold shadow-xs"
                    : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50"
                )}
              >
                <User className="h-4 w-4 shrink-0 text-[#D97706]" />
                <div>
                  <div className="text-xs leading-tight">Član Društva</div>
                  <div className="text-[10px] font-normal opacity-80">Odabir iz Registra članova</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDirectDonorMode("external")
                  setDirectDonorForm((prev) => ({
                    ...prev,
                    member_id: null,
                    entity_type: prev.entity_type === "clan" ? "fizicka_osoba" : prev.entity_type,
                  }))
                }}
                className={cn(
                  "rounded-xl border-2 px-3 py-2.5 text-left transition-all flex items-center gap-2",
                  directDonorMode === "external"
                    ? "border-[#1E3A5F] bg-[#FEFCE8] text-[#1E3A5F] font-bold shadow-xs"
                    : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50"
                )}
              >
                <Building2 className="h-4 w-4 shrink-0 text-[#D97706]" />
                <div>
                  <div className="text-xs leading-tight">Osoba / Tvrtka (nije član)</div>
                  <div className="text-[10px] font-normal opacity-80">Građanin, obrt, tvrtka, udruga</div>
                </div>
              </button>
            </div>

            {directDonorMode === "member" ? (
              <div className="rounded-xl border border-[#CEA369]/60 bg-[#FBF9F6] p-3 space-y-2.5">
                {selectedMemberDonor ? (
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2 rounded-lg border bg-white p-2.5">
                      <div className="min-w-0 space-y-0.5">
                        <div className="font-bold text-sm text-[#1E3A5F] flex flex-wrap items-center gap-1.5">
                          <span>{selectedMemberDonor.name}</span>
                          <Badge variant="outline" className="text-[10px] border-[#CEA369] bg-[#FEFCE8] text-[#7C2D12]">
                            {selectedMemberDonor.registryNumber || selectedMemberDonor.membershipNumber
                              ? `Br. ${selectedMemberDonor.registryNumber || selectedMemberDonor.membershipNumber}`
                              : `Član #${selectedMemberDonor.id}`}
                          </Badge>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {selectedMemberDonor.email || "Nema upisan e-mail"}
                          {selectedMemberDonor.oib ? ` · OIB: ${selectedMemberDonor.oib}` : ""}
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] shrink-0"
                        onClick={() =>
                          setDirectDonorForm((prev) => ({
                            ...prev,
                            member_id: null,
                            name: "",
                            oib: "",
                            email: "",
                            phone: "",
                            address: "",
                          }))
                        }
                      >
                        Promijeni člana
                      </Button>
                    </div>

                    {selectedMemberDonor.doNotContact && (
                      <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-800 flex items-center gap-2">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-600" />
                        <span>
                          Ovaj član ima oznaku „Ne kontaktirati” — donacija se može evidentirati, ali slanje e-mail zahvale je blokirano.
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="font-semibold text-[#1E3A5F]">
                      Odaberite člana Društva iz Registra članova *
                    </label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Pretraži po imenu, prezimenu, članskom broju, e-mailu ili OIB-u..."
                        value={memberSearchQuery}
                        onChange={(e) => setMemberSearchQuery(e.target.value)}
                        className="pl-8 h-8 bg-white text-xs"
                      />
                    </div>
                    <div className="max-h-44 overflow-y-auto rounded-lg border bg-white divide-y">
                      {selectableMemberDonors.length === 0 ? (
                        <div className="p-3 text-center text-muted-foreground">
                          Nema pronađenih članova za zadani upit.
                        </div>
                      ) : (
                        selectableMemberDonors.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => handleSelectDirectDonorMember(m)}
                            className="w-full text-left px-3 py-2 hover:bg-[#FEFCE8] transition-colors flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className="font-medium text-foreground truncate">{m.name}</div>
                              <div className="text-[10px] text-muted-foreground truncate">
                                {m.email || "Bez e-maila"}
                                {m.oib ? ` · OIB: ${m.oib}` : ""}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {m.doNotContact && (
                                <Badge variant="destructive" className="text-[9px] px-1.5 py-0">
                                  Ne kontaktirati
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-[10px]">
                                {m.registryNumber || m.membershipNumber || `#${m.id}`}
                              </Badge>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="font-semibold">Ime i prezime / Naziv donatora *</label>
                  <Input
                    placeholder="npr. Ivan Horvat ili Tvrtka d.o.o."
                    value={directDonorForm.name}
                    onChange={(e) => setDirectDonorForm({ ...directDonorForm, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold">Vrsta donatora</label>
                  <Select
                    value={directDonorForm.entity_type}
                    onValueChange={(val) => setDirectDonorForm({ ...directDonorForm, entity_type: val })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fizicka_osoba">Fizička osoba / Građanin</SelectItem>
                      <SelectItem value="tvrtka">Tvrtka (d.o.o. / j.d.o.o.)</SelectItem>
                      <SelectItem value="obrt">Obrt</SelectItem>
                      <SelectItem value="udruga">Udruga / Institucija</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-medium">Iznos donacije (EUR) *</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="50.00"
                  value={directDonorForm.donated_amount}
                  onChange={(e) => setDirectDonorForm({ ...directDonorForm, donated_amount: e.target.value })}
                  className="font-bold text-emerald-700"
                />
              </div>
              <div className="space-y-1">
                <label className="font-medium">Datum uplate *</label>
                <Input
                  type="date"
                  value={directDonorForm.donated_at}
                  onChange={(e) => setDirectDonorForm({ ...directDonorForm, donated_at: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-medium">Način uplate</label>
                <Select
                  value={directDonorForm.payment_method}
                  onValueChange={(val) => setDirectDonorForm({ ...directDonorForm, payment_method: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Žiro račun / Transakcijski račun">Žiro račun / Transakcijski račun</SelectItem>
                    <SelectItem value="Gotovina">Gotovina u blagajnu</SelectItem>
                    <SelectItem value="Donacijski ugovor">Donacijski ugovor</SelectItem>
                    <SelectItem value="Ostalo">Ostalo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="font-medium">OIB / Matični broj (opcionalno)</label>
                <Input
                  placeholder="12345678901"
                  maxLength={11}
                  value={directDonorForm.oib}
                  onChange={(e) => setDirectDonorForm({ ...directDonorForm, oib: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-medium">Grad / Mjesto (opcionalno)</label>
                <Input
                  placeholder="npr. Zagreb"
                  value={directDonorForm.city}
                  onChange={(e) => setDirectDonorForm({ ...directDonorForm, city: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="font-medium">E-mail ili telefon (opcionalno)</label>
                <Input
                  placeholder="kontakt@primjer.hr"
                  value={directDonorForm.email}
                  onChange={(e) => setDirectDonorForm({ ...directDonorForm, email: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-medium">Svrha uplate / Bilješka</label>
              <Input
                placeholder="npr. Donacija za nabavu knjižnog skenera"
                value={directDonorForm.donation_note}
                onChange={(e) => setDirectDonorForm({ ...directDonorForm, donation_note: e.target.value })}
              />
            </div>

            <label
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs",
                selectedMemberDonor?.doNotContact
                  ? "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                  : "border-amber-200 bg-[#FEFCE8] text-[#7C2D12] cursor-pointer"
              )}
            >
              <Checkbox
                disabled={Boolean(selectedMemberDonor?.doNotContact)}
                checked={!selectedMemberDonor?.doNotContact && openThankYouAfterDirectSave}
                onCheckedChange={(checked) => setOpenThankYouAfterDirectSave(Boolean(checked))}
              />
              <span>Nakon spremanja odmah otvori pripremu zahvale za donaciju</span>
            </label>
          </div>

          <DialogFooter>
            <CloseActionButton label="Odustani" onClick={() => setDirectDonorDialogOpen(false)} />
            <SaveActionButton
              label="Spremi donaciju"
              loading={savingDirectDonor}
              onClick={handleSaveDirectDonation}
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* NOVI DIJALOZI ZA SKUPNO SLANJE, UVOZ I ODJAVE */}
      <DonationsBulkSendDialog
        open={bulkSendDialog.open}
        onOpenChange={(open) => setBulkSendDialog((prev) => ({ ...prev, open }))}
        mode={bulkSendDialog.mode}
        selectedIds={bulkSendDialog.ids}
        defaultTestEmail={defaultTestEmail}
        onStarted={(job) => {
          prevBulkRunningRef.current = Boolean(job.running)
          setBulkSendJob(job)
          if (bulkSendDialog.mode === "initial") {
            setSelectedLeadIds([])
          } else {
            setSelectedSentIds([])
          }
        }}
      />

      <DonationsImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImported={() => {
          fetchStats()
          fetchLeads()
        }}
      />

      <DonationsOptOutDialog
        open={optOutDialogOpen}
        onOpenChange={setOptOutDialogOpen}
        onChanged={() => {
          fetchStats()
          fetchLeads()
          fetchSentRegistry()
        }}
      />

      <DonationThankYouDialog
        open={thankYouDialogOpen}
        onOpenChange={setThankYouDialogOpen}
        target={thankYouTarget}
        defaultTestEmail={defaultTestEmail}
        onSent={() => {
          fetchStats()
          fetchLeads()
          fetchSentRegistry()
        }}
      />
    </div>
  )
}
