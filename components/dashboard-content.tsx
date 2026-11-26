"use client"

import React, { useMemo, useState, useEffect } from "react"
import Link from "next/link"
import dynamic from "next/dynamic"
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  Cake,
  Calendar,
  CheckCircle,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Edit2,
  Euro,
  FileSearch,
  FileText,
  FolderKanban,
  Heart,
  HeartHandshake,
  History,
  Mail,
  MapPin,
  MessageSquare,
  Mic,
  Send,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react"
import { cn, formatDateShort, formatDateDMY, formatDateTimeDMY, getMemberActiveFunctions } from "@/lib/utils"
import { inspectMemberDate } from "@/lib/date-validation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SectionTabsBar, type SectionTabItem } from "@/components/ui/section-tabs"
import {
  CloseActionButton,
  DeleteActionButton,
  FinishActionButton,
  ModalActionFooter,
  SaveActionButton,
} from "@/components/ui/action-bar"
import { AddMemberDialog } from "@/components/add-member-dialog"
import { BirthdayEmailDialog } from "@/components/birthday-email-dialog"
import {
  BoardAnnouncementDialog,
  canUserSendBoardAnnouncement,
  canUserViewBoardAnnouncementHistory,
} from "@/components/board-announcement-dialog"
import { DesktopHeaderNav, HeaderUserLogout } from "@/components/desktop-header-nav"
import type { DashboardMembersChartDatum } from "@/components/dashboard-members-chart"
import { Member, useMembers } from "@/contexts/members-context"
import { useMeetings } from "@/contexts/meetings-context"
import { useLectures } from "@/contexts/lectures-context"
import { useAuth } from "@/contexts/auth-context"
import { useSettings } from "@/contexts/settings-context"
import { useActivityLog } from "@/contexts/activity-log-context"
import { getUserAccessRights, getInquiryPermissions } from "@/lib/inquiry-permissions"
import { fetchPendingPollsForMember } from "@/lib/polls-client"

const DashboardMembersChart = dynamic(
  () => import("@/components/dashboard-members-chart").then((m) => m.DashboardMembersChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex items-center justify-center bg-[#FBF9F6] rounded-2xl border border-[#E8E4DE]">
        <p className="text-xs text-muted-foreground">Učitavanje grafikona...</p>
      </div>
    ),
  }
)

const LECTURE_TYPE_META: Record<string, { label: string; badgeCls: string }> = {
  lecture:   { label: "Predavanje",          badgeCls: "border-[#1E3A5F]/25 bg-[#E8F1FA] text-[#1E3A5F]" },
  gathering: { label: "Rodoslovno druženje", badgeCls: "border-teal-300/80 bg-teal-50 text-teal-800" },
  visit:     { label: "Gostovanje",          badgeCls: "border-sky-300/80 bg-sky-50 text-sky-800" },
  guest:     { label: "Gost predavač",       badgeCls: "border-emerald-300/80 bg-emerald-50 text-emerald-800" },
  workshop:  { label: "Radionica",           badgeCls: "border-amber-300/80 bg-amber-50 text-amber-900" },
  excursion: { label: "Izlet",               badgeCls: "border-indigo-300/80 bg-indigo-50 text-indigo-800" },
}

const SHORT_MONTHS_HR = ["Sij", "Velj", "Ožu", "Tra", "Svi", "Lip", "Srp", "Kol", "Ruj", "Lis", "Stu", "Pro"]
const FULL_MONTHS_HR = [
  "Siječanj",
  "Veljača",
  "Ožujak",
  "Travanj",
  "Svibanj",
  "Lipanj",
  "Srpanj",
  "Kolovoz",
  "Rujan",
  "Listopad",
  "Studeni",
  "Prosinac",
]

type LogCategory = "members" | "email" | "system"

function safeFormatDate(val?: string | Date | null): string {
  if (!val) return ""
  return formatDateDMY(val, "")
}

function getDaysUntilMeta(dateStr?: string | null): {
  label: string
  tone: "today" | "soon" | "future"
} | null {
  if (!dateStr) return null
  const iso = inspectMemberDate(dateStr).isoDate || (dateStr.length >= 10 ? dateStr.slice(0, 10) : "")
  const parts = iso.split("-").map(Number)
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null
  const [y, m, d] = parts
  const target = new Date(y, m - 1, d)
  if (isNaN(target.getTime())) return null
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return null
  if (diffDays === 0) return { label: "Danas", tone: "today" }
  if (diffDays === 1) return { label: "Sutra", tone: "soon" }
  return {
    label: `Za ${diffDays} dana`,
    tone: diffDays <= 7 ? "soon" : "future",
  }
}

function parseDateTileParts(dateStr?: string | null): { month: string; day: string } {
  if (!dateStr) return { month: "—", day: "—" }
  const iso = inspectMemberDate(dateStr).isoDate
  if (iso) {
    const [y, m, d] = iso.split("-").map(Number)
    const dt = new Date(y, (m || 1) - 1, d || 1)
    if (!isNaN(dt.getTime())) {
      return {
        month: SHORT_MONTHS_HR[dt.getMonth()]?.toUpperCase() || "—",
        day: String(d),
      }
    }
  }
  const dt = new Date(dateStr)
  if (!isNaN(dt.getTime())) {
    return {
      month: SHORT_MONTHS_HR[dt.getMonth()]?.toUpperCase() || "—",
      day: String(dt.getDate()),
    }
  }
  return { month: "—", day: "—" }
}

function categorizeLog(action: string, details: string): LogCategory {
  const haystack = `${action || ""} ${details || ""}`.toLowerCase()
  if (
    haystack.includes("mail") ||
    haystack.includes("poruk") ||
    haystack.includes("čestitk") ||
    haystack.includes("obavijest tijel") ||
    haystack.includes("podsjetnik") ||
    haystack.includes("pozivnic") ||
    haystack.includes("donacij") ||
    haystack.includes("gmail")
  ) {
    return "email"
  }
  if (
    haystack.includes("član") ||
    haystack.includes("uplat") ||
    haystack.includes("prijav") ||
    haystack.includes("karton") ||
    haystack.includes("dopun") ||
    haystack.includes("podatak") ||
    haystack.includes("rođendan")
  ) {
    return "members"
  }
  return "system"
}

export function DashboardContent() {
  const { members } = useMembers()
  const { meetings } = useMeetings()
  const { lectures } = useLectures()
  const { user } = useAuth()
  const { settings, setBoardNotice } = useSettings()
  const { logs } = useActivityLog()

  const [mounted, setMounted] = useState(false)
  const [summaryData, setSummaryData] = useState<any>(null)
  const [showSummaryModal, setShowSummaryModal] = useState(false)
  const [summaryTab, setSummaryTab] = useState<"all" | "comms" | "society">("all")
  const [pendingPolls, setPendingPolls] = useState<any[]>([])

  // Chart & interactive panel controls
  const [chartRange, setChartRange] = useState<"6m" | "12m">("12m")
  const [chartType, setChartType] = useState<"bar" | "area">("bar")
  const [expandAgenda, setExpandAgenda] = useState(false)
  const [logFilter, setLogFilter] = useState<"all" | LogCategory>("all")
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null)

  // Donation campaign stats (visible to all members on dashboard)
  const [donationStats, setDonationStats] = useState<{
    totalLeads: number
    sentCount: number
    donorCount: number
    totalDonatedEur: number
    targetEur: number
    targetPurpose: string
  }>({
    totalLeads: 0,
    sentCount: 0,
    donorCount: 0,
    totalDonatedEur: 0,
    targetEur: 5000,
    targetPurpose: "Specijalizirani knjižni skener i oprema za digitalizaciju arhivske građe",
  })

  // Board Noticeboard editing state
  const [isEditingNotice, setIsEditingNotice] = useState(false)
  const [noticeDraft, setNoticeDraft] = useState("")
  const [isSavingNotice, setIsSavingNotice] = useState(false)
  const [birthdayMember, setBirthdayMember] = useState<Member | null>(null)
  const [boardAnnouncementOpen, setBoardAnnouncementOpen] = useState(false)
  const [boardAnnouncementInitialText, setBoardAnnouncementInitialText] = useState("")
  const [boardAnnouncementInitialTab, setBoardAnnouncementInitialTab] = useState<"edit" | "history">("edit")

  const canSendBoardAnnouncement = useMemo(
    () => canUserSendBoardAnnouncement(user, members),
    [user, members]
  )
  const canViewBoardHistory = useMemo(
    () => canUserViewBoardAnnouncementHistory(user, members),
    [user, members]
  )
  const canViewGmail = Boolean(
    user?.role === "admin" || user?.accessRights?.gmail?.view || user?.accessRights?.gmail?.edit
  )
  const canEditNotice = user?.role === "admin" || user?.role === "moderator"

  const upcomingBirthdays = useMemo(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const list: Array<{
      id: number
      name: string
      diffDays: number
      dateLabel: string
      member: Member
    }> = []

    for (const m of members) {
      if (!m || m.deceased || m.expelled || !m.birthDate) continue
      const inspected = inspectMemberDate(m.birthDate)
      if (!inspected.isoDate) continue
      const parts = inspected.isoDate.split("-").map(Number)
      if (parts.length !== 3) continue
      const [, month, day] = parts
      if (!month || !day) continue

      let nextBday = new Date(today.getFullYear(), month - 1, day)
      if (nextBday.getTime() < today.getTime()) {
        nextBday = new Date(today.getFullYear() + 1, month - 1, day)
      }
      const diffDays = Math.round((nextBday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      if (diffDays >= 0 && diffDays <= 15) {
        list.push({
          id: m.id,
          name: m.name,
          diffDays,
          dateLabel: `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`,
          member: m,
        })
      }
    }

    return list.sort((a, b) => a.diffDays - b.diffDays || a.name.localeCompare(b.name, "hr"))
  }, [members])

  useEffect(() => {
    setMounted(true)
    if (settings.boardNotice) {
      setNoticeDraft(settings.boardNotice)
    }
  }, [settings.boardNotice])

  // Fetch donation stats for dashboard (public for all authenticated members)
  useEffect(() => {
    if (!mounted) return
    fetch("/api/donations/stats")
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data.totalDonatedEur === "number") {
          setDonationStats(data)
        }
      })
      .catch(() => {})
  }, [mounted])

  // Check pending polls for the user (shares cache / in-flight request with VotingOverlay)
  useEffect(() => {
    if (!user) return
    let cancelled = false
    fetchPendingPollsForMember(user.id)
      .then((data) => {
        if (!cancelled && Array.isArray(data)) {
          setPendingPolls(data)
        }
      })
      .catch((err) => console.error("Failed to fetch pending polls:", err))
    return () => {
      cancelled = true
    }
  }, [user])

  // Fetch summary of what's new (lokalni SQLite sažetak odmah, Gmail asinkrono)
  const fetchSummary = (forceModal = false, targetTab: "all" | "comms" | "society" = "all") => {
    if (!user) return
    const sessionKey = `shown_login_summary_${user.id}`
    if (forceModal) {
      setSummaryTab(targetTab)
    }

    fetch(`/api/dashboard/summary?userId=${user.id}&includeGmail=0&_t=${Date.now()}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        setSummaryData(data)
        if (forceModal) {
          setShowSummaryModal(true)
        } else {
          const hasNew =
            (data.totalNew && data.totalNew > 0) ||
            (data.newMembers || 0) > 0 ||
            (data.newMeetings || 0) > 0 ||
            (data.newLectures || 0) > 0 ||
            (data.newPaymentsCount || 0) > 0 ||
            (data.newVotesCount || 0) > 0 ||
            (data.newInquiriesCount || 0) > 0 ||
            (data.newVideos || 0) > 0 ||
            (data.newBooks || 0) > 0 ||
            (data.newProjects || 0) > 0
          const alreadyDismissedThisTab = sessionStorage.getItem(sessionKey)
          if (hasNew && !alreadyDismissedThisTab) {
            setShowSummaryModal(true)
          }
        }
      })
      .catch((err) => console.error("Failed to fetch dashboard summary:", err))

    fetch(
      `/api/dashboard/summary?userId=${user.id}&gmailOnly=1${forceModal ? "&refresh=1" : ""}&_t=${Date.now()}`,
      { cache: "no-store" }
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((gmail) => {
        if (!gmail) return
        setSummaryData((prev: any) => {
          const base = prev || {}
          const nextSent = (base.sentEmailsLogsCount || 0) + (gmail.sentEmailsCount || 0)
          const nextUnanswered = (base.pendingInquiriesCount || 0) + (gmail.unreadEmailsCount || 0)
          const localTotal = base.localTotalNew ?? base.totalNew ?? 0
          return {
            ...base,
            ...gmail,
            gmailPending: false,
            sentEmailsCount: nextSent,
            unansweredEmailsCount: nextUnanswered,
            totalNew: localTotal + (gmail.newEmailsCount || 0) + (gmail.sentEmailsCount || 0),
          }
        })
        if (!forceModal) {
          const hasGmailActivity =
            (gmail.newEmailsCount || 0) > 0 ||
            (gmail.sentEmailsCount || 0) > 0 ||
            (gmail.unreadEmailsCount || 0) > 0 ||
            Boolean(gmail.gmailConnected)
          const alreadyDismissedThisTab = sessionStorage.getItem(sessionKey)
          if (hasGmailActivity && !alreadyDismissedThisTab) {
            setShowSummaryModal(true)
          }
        }
      })
      .catch(() => {})
  }

  useEffect(() => {
    if (mounted && user) {
      fetchSummary(false)
    }
  }, [mounted, user])

  const handleAcknowledgeSummary = async () => {
    if (user) {
      sessionStorage.setItem(`shown_login_summary_${user.id}`, "true")
      try {
        await fetch("/api/dashboard/summary/acknowledge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id }),
        })
        setSummaryData((prev: any) =>
          prev
            ? {
                ...prev,
                totalNew: 0,
                newMembers: 0,
                newMeetings: 0,
                newLectures: 0,
                newPaymentsCount: 0,
                newVotesCount: 0,
                newInquiriesCount: 0,
                newVideos: 0,
                newBooks: 0,
                newProjects: 0,
              }
            : prev
        )
      } catch (e) {
        console.error("Failed to acknowledge summary:", e)
      }
    }
    setShowSummaryModal(false)
  }

  const handleCloseSummary = () => {
    handleAcknowledgeSummary()
  }

  const handleSaveNotice = async () => {
    setIsSavingNotice(true)
    try {
      await setBoardNotice(noticeDraft, user?.name)
      setIsEditingNotice(false)
    } finally {
      setIsSavingNotice(false)
    }
  }

  const handleClearNotice = async () => {
    if (!confirm("Ukloniti trenutnu obavijest s oglasne ploče?")) return
    setIsSavingNotice(true)
    try {
      await setBoardNotice("", user?.name)
      setNoticeDraft("")
      setIsEditingNotice(false)
    } finally {
      setIsSavingNotice(false)
    }
  }

  // Calculate comprehensive stats
  const stats = useMemo(() => {
    const societyMembers = (members || []).filter((m) => m && m.role !== "admin")

    if (!societyMembers || societyMembers.length === 0) {
      return {
        total: 0,
        active: 0,
        overdue: 0,
        expelled: 0,
        newThisMonth: 0,
        growth: 0,
        chartData: [] as DashboardMembersChartDatum[],
        thisYearCollected: 0,
        activeFunctionsCount: 0,
        activeSharePct: 0,
        paidSharePct: 0,
      }
    }

    const total = societyMembers.length
    const active = societyMembers.filter((m) => m && m.status === "active").length
    const overdue = societyMembers.filter((m) => m && m.paymentStatus === "overdue").length
    const expelled = societyMembers.filter((m) => m && m.expelled).length
    const relevantMembersCount = societyMembers.filter((m) => !m.deceased && !m.expelled).length

    const activeSharePct = total > 0 ? Math.round((active / total) * 100) : 0
    const paidSharePct =
      relevantMembersCount > 0
        ? Math.max(0, Math.min(100, Math.round(((relevantMembersCount - overdue) / relevantMembersCount) * 100)))
        : 0

    const activeFunctionsCount = societyMembers.filter(
      (m) => m && getMemberActiveFunctions(m).length > 0
    ).length

    const currentYear = new Date().getFullYear()
    const allPayments = societyMembers.flatMap((m) => {
      if (Array.isArray(m?.payments)) return m.payments
      if (typeof m?.payments === "string") {
        try {
          const parsed = JSON.parse(m.payments)
          return Array.isArray(parsed) ? parsed : []
        } catch {}
      }
      return []
    })

    const thisYearPayments = allPayments.filter((p) => {
      if (!p || !p.date) return false
      try {
        const d = new Date(p.date)
        return !isNaN(d.getTime()) && d.getFullYear() === currentYear
      } catch {
        return false
      }
    })
    const thisYearCollected = thisYearPayments.reduce((acc, p) => acc + (Number(p?.amount) || 0), 0)

    const now = new Date()
    const thisMonth = now.getMonth()
    const thisYear = now.getFullYear()
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonth = lastMonthDate.getMonth()
    const lastMonthYear = lastMonthDate.getFullYear()

    const matchesYearMonth = (rawJoinDate: string | undefined, targetYear: number, targetMonthZeroIdx: number) => {
      if (!rawJoinDate) return false
      const iso = inspectMemberDate(rawJoinDate).isoDate
      if (iso) {
        const [y, mo] = iso.split("-").map(Number)
        return y === targetYear && mo === targetMonthZeroIdx + 1
      }
      try {
        const d = new Date(rawJoinDate)
        return !isNaN(d.getTime()) && d.getMonth() === targetMonthZeroIdx && d.getFullYear() === targetYear
      } catch {
        return false
      }
    }

    const newThisMonth = societyMembers.filter((m) => matchesYearMonth(m?.joinDate, thisYear, thisMonth)).length
    const newLastMonth = societyMembers.filter((m) => matchesYearMonth(m?.joinDate, lastMonthYear, lastMonth)).length

    const growth =
      newLastMonth === 0
        ? newThisMonth * 100
        : Math.round(((newThisMonth - newLastMonth) / newLastMonth) * 100)

    const chartData: DashboardMembersChartDatum[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const m = d.getMonth()
      const y = d.getFullYear()
      const count = societyMembers.filter((member) => matchesYearMonth(member?.joinDate, y, m)).length
      chartData.push({
        name: SHORT_MONTHS_HR[m],
        fullLabel: `${FULL_MONTHS_HR[m]} ${y}.`,
        prijave: count,
      })
    }

    return {
      total,
      active,
      overdue,
      expelled,
      newThisMonth,
      growth,
      chartData,
      thisYearCollected: Math.round(thisYearCollected * 100) / 100,
      activeFunctionsCount,
      activeSharePct,
      paidSharePct,
    }
  }, [members])

  const visibleChartData = useMemo(
    () => (chartRange === "6m" ? stats.chartData.slice(-6) : stats.chartData),
    [stats.chartData, chartRange]
  )

  const chartPeriodTotal = useMemo(
    () => visibleChartData.reduce((sum, item) => sum + item.prijave, 0),
    [visibleChartData]
  )

  const chartPeriodAvg = useMemo(() => {
    if (visibleChartData.length === 0) return 0
    return Number((chartPeriodTotal / visibleChartData.length).toFixed(1))
  }, [chartPeriodTotal, visibleChartData.length])

  const nextMeeting = useMemo(() => {
    if (!Array.isArray(meetings)) return null
    const today = new Date().toISOString().slice(0, 10)
    return (
      meetings
        .filter((m) => m && m.status === "scheduled" && m.date && m.date >= today)
        .sort((a, b) => (a.date || "").localeCompare(b.date || ""))[0] ?? null
    )
  }, [meetings])

  const nextMeetingCountdown = useMemo(
    () => getDaysUntilMeta(nextMeeting?.date),
    [nextMeeting?.date]
  )

  const nextMeetingDateTile = useMemo(
    () => parseDateTileParts(nextMeeting?.date),
    [nextMeeting?.date]
  )

  const upcomingLectures = useMemo(() => {
    if (!Array.isArray(lectures)) return []
    const today = new Date().toISOString().slice(0, 10)
    return lectures
      .filter((l) => l && l.status === "scheduled" && l.date && l.date >= today)
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
  }, [lectures])

  const filteredRecentLogs = useMemo(() => {
    const safeLogs = Array.isArray(logs) ? logs : []
    const matched =
      logFilter === "all"
        ? safeLogs
        : safeLogs.filter((l) => categorizeLog(l.action, l.details) === logFilter)
    return matched.slice(0, 6)
  }, [logs, logFilter])

  const donationTargetEur = donationStats?.targetEur || 5000
  const donationCollectedEur = Number(donationStats?.totalDonatedEur) || 0
  const donationPct = Math.min(
    100,
    Math.max(0, Math.round((donationCollectedEur / donationTargetEur) * 100))
  )

  const summaryCounts = useMemo(() => {
    if (!summaryData) return { comms: 0, society: 0, total: 0 }
    let comms = 0
    if (canViewGmail) comms += 1 // inbox block always visible to gmail users
    if (typeof summaryData.sentEmailsCount === "number" && summaryData.sentEmailsCount > 0) comms += 1
    if ((summaryData.unreadEmailsCount || 0) > 0 || (summaryData.pendingInquiriesCount || 0) > 0) comms += 1
    if ((summaryData.newInquiriesCount || 0) > 0) comms += 1

    let society = 0
    if ((summaryData.submittedDataForms?.length || 0) > 0 || (summaryData.viewedDataForms?.length || 0) > 0) society += 1
    if (upcomingBirthdays.length > 0) society += 1
    if ((summaryData.newMembers || 0) > 0) society += 1
    if ((summaryData.newLectures || 0) > 0) society += 1
    if ((summaryData.newPaymentsCount || 0) > 0) society += 1
    if ((summaryData.newMeetings || 0) > 0) society += 1
    if ((summaryData.newVotesCount || 0) > 0) society += 1
    if ((summaryData.newProjects || 0) > 0) society += 1
    if ((summaryData.newBooks || 0) > 0 || (summaryData.updatedBooks || 0) > 0 || (summaryData.newVideos || 0) > 0) society += 1

    return { comms, society, total: comms + society }
  }, [summaryData, canViewGmail, upcomingBirthdays.length])

  const summaryTabs: SectionTabItem<"all" | "comms" | "society">[] = useMemo(
    () => [
      { id: "all", label: "Sve novosti", shortLabel: "Sve", icon: Sparkles, count: summaryCounts.total },
      { id: "comms", label: "Pošta i upiti", shortLabel: "Pošta", icon: Mail, count: summaryCounts.comms },
      { id: "society", label: "Društvo i članovi", shortLabel: "Društvo", icon: Users, count: summaryCounts.society },
    ],
    [summaryCounts]
  )

  const currentYear = mounted ? new Date().getFullYear() : 2026
  const todayLabel = mounted ? formatDateDMY(new Date()) : ""
  const newSummaryCount = Number(summaryData?.totalNew || 0)

  const showCommsTab = summaryTab === "all" || summaryTab === "comms"
  const showSocietyTab = summaryTab === "all" || summaryTab === "society"

  return (
    <>
      <main className="flex-1 min-w-0 overflow-auto bg-[#F2EFE9]">
        {/* Top Navigation - Desktop Header */}
        <header className="hidden md:flex items-center justify-between px-4 md:px-6 py-2 gap-3 fixed top-0 left-0 right-0 md:left-[var(--sidebar-width,220px)] z-40 border-b border-[#E8E4DE] bg-[#FBF9F6]/95 backdrop-blur-md shadow-[0_1px_8px_rgba(27,43,54,0.05)] h-[52px] transition-[left] duration-200">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <DesktopHeaderNav activeItem="dashboard" className="flex-1 min-w-0" />
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => fetchSummary(true, "all")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-[#FEFCE8] text-[#1E3A5F] border border-[#CEA369]/80 hover:bg-[#1E3A5F] hover:text-white hover:border-[#1E3A5F] transition-colors shadow-2xs shrink-0"
              title="Pogledajte sažetak promjena od zadnje prijave"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#B5843E]" />
              <span>Što je novo?</span>
              {newSummaryCount > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#1E3A5F] px-1 text-[10px] font-bold text-[#F2EFE9] tabular-nums">
                  {newSummaryCount}
                </span>
              )}
            </button>

            <HeaderUserLogout />
          </div>
        </header>
        <div className="hidden md:block h-[52px] w-full shrink-0" aria-hidden="true" />

        {/* Action Required Banner: Unvoted Polls */}
        {pendingPolls.length > 0 && (
          <div className="bg-gradient-to-r from-[#1E3A5F] via-[#264E82] to-[#1E3A5F] border-b-2 border-[#CEA369] text-white px-4 md:px-8 py-3 shadow-md">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 w-full">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-full bg-[#CEA369]/20 border border-[#CEA369]/60 text-[#F3D19C]">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <p className="text-xs md:text-sm font-semibold">
                  <strong>Potrebna akcija:</strong> Imate {pendingPolls.length} otvoreno glasovanje na sjednici na koje još niste dali svoj glas.
                </p>
              </div>
              <Link href="/meetings">
                <Button
                  size="sm"
                  className="rounded-full text-xs font-bold h-8 px-4 bg-[#CEA369] hover:bg-[#d8b178] text-[#1B2B36] shadow-sm"
                >
                  Glasuj odmah →
                </Button>
              </Link>
            </div>
          </div>
        )}

        <div className="w-full p-4 md:p-7 pb-16 space-y-6">
          {/* Hero Traka i Brze Akcije */}
          <section className="relative overflow-hidden rounded-3xl border border-[#E8E4DE] bg-[#FBF9F6] shadow-[0_2px_14px_rgba(27,43,54,0.05)] hrd-fade-up">
            <div className="h-1 w-full bg-gradient-to-r from-[#1E3A5F] via-[#CEA369] to-[#1E3A5F]/20" />
            <div className="p-5 md:p-6 flex flex-col xl:flex-row xl:items-center justify-between gap-5">
              <div className="space-y-3 min-w-0">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="inline-flex items-center rounded-full bg-[#1E3A5F] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#F2EFE9] border border-[#CEA369]/70">
                      Rodoslovac
                    </span>
                    <span className="h-px w-4 bg-[#CEA369]" />
                    <p className="text-[10px] text-[#8E622A] font-bold uppercase tracking-[0.18em]">
                      Hrvatsko rodoslovno društvo „Pavao Ritter Vitezović”
                    </p>
                  </div>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-[#1B2B36]">
                      Nadzorna ploča
                    </h2>
                    {todayLabel && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-[#E8E4DE] px-2.5 py-0.5 text-[11px] font-mono font-semibold text-muted-foreground tabular-nums">
                        <Calendar className="h-3 w-3 text-[#CEA369]" />
                        {todayLabel}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs md:text-sm text-muted-foreground">
                    Dobrodošli natrag, <strong className="text-[#1B2B36]">{user?.name}</strong> (
                    {user?.role === "admin" ? "Administrator" : user?.role === "moderator" ? "Član odbora" : "Član"}).
                  </p>
                </div>

                {/* Kontekstualne statusne pilule */}
                <div className="flex flex-wrap items-center gap-2">
                  {canViewGmail && (summaryData?.unreadEmailsCount || 0) > 0 && (
                    <Link
                      href="/gmail"
                      className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50/90 px-3 py-1 text-[11px] font-semibold text-sky-900 hover:bg-sky-100 transition-colors"
                    >
                      <Mail className="h-3 w-3 text-sky-700" />
                      <span className="tabular-nums">{summaryData.unreadEmailsCount} nepročitanih u Inboxu</span>
                    </Link>
                  )}

                  {Boolean(user?.assignedActiveInquiriesCount && user.assignedActiveInquiriesCount > 0) && (
                    <Link
                      href="/research"
                      className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/90 px-3 py-1 text-[11px] font-semibold text-emerald-900 hover:bg-emerald-100 transition-colors"
                    >
                      <FileSearch className="h-3 w-3 text-emerald-700" />
                      <span className="tabular-nums">
                        {user?.assignedActiveInquiriesCount} dodijeljenih istraživanja
                      </span>
                    </Link>
                  )}

                  {upcomingBirthdays.length > 0 && (
                    <button
                      type="button"
                      onClick={() => fetchSummary(true, "society")}
                      className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50/90 px-3 py-1 text-[11px] font-semibold text-rose-900 hover:bg-rose-100 transition-colors"
                    >
                      <Cake className="h-3 w-3 text-rose-600" />
                      <span className="tabular-nums">{upcomingBirthdays.length} nadolazećih rođendana</span>
                    </button>
                  )}

                  {pendingPolls.length > 0 && (
                    <Link
                      href="/meetings"
                      className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-[#FEFCE8] px-3 py-1 text-[11px] font-semibold text-[#7C2D12] hover:bg-amber-100 transition-colors"
                    >
                      <CheckSquare className="h-3 w-3 text-[#D97706]" />
                      <span className="tabular-nums">{pendingPolls.length} otvorena glasanja</span>
                    </Link>
                  )}

                  <button
                    type="button"
                    onClick={() => fetchSummary(true, "all")}
                    className="md:hidden inline-flex items-center gap-1.5 rounded-full border border-[#CEA369]/80 bg-[#FEFCE8] px-3 py-1 text-[11px] font-bold text-[#1E3A5F]"
                  >
                    <Sparkles className="h-3 w-3 text-[#B5843E]" />
                    <span>Što je novo?</span>
                    {newSummaryCount > 0 && (
                      <span className="rounded-full bg-[#1E3A5F] px-1.5 text-[10px] text-white tabular-nums">
                        {newSummaryCount}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Brze akcije */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {(user?.role === "admin" || user?.accessRights?.members?.edit) && (
                  <AddMemberDialog>
                    <Button
                      size="sm"
                      className="rounded-full h-9 px-4 bg-[#1E3A5F] hover:bg-[#264E82] text-[#F2EFE9] border-2 border-[#CEA369] text-xs font-bold shadow-sm transition-colors"
                    >
                      <UserPlus className="mr-1.5 h-3.5 w-3.5 text-[#CEA369]" /> Dodaj člana
                    </Button>
                  </AddMemberDialog>
                )}

                <Link href="/meetings">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full h-9 px-3.5 border-[#1E3A5F]/20 bg-white text-[#1E3A5F] hover:bg-[#EFF5FB] hover:border-[#1E3A5F]/45 text-xs font-bold shadow-2xs transition-colors"
                  >
                    <Calendar className="mr-1.5 h-3.5 w-3.5 text-[#264E82]" /> Sjednice
                  </Button>
                </Link>

                {(user?.role === "admin" ||
                  user?.role === "moderator" ||
                  getUserAccessRights(user).projects?.view ||
                  getUserAccessRights(user).projects?.edit) && (
                  <Link href="/projects">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full h-9 px-3.5 border-[#1E3A5F]/20 bg-white text-[#1E3A5F] hover:bg-[#EFF5FB] hover:border-[#1E3A5F]/45 text-xs font-bold shadow-2xs transition-colors"
                    >
                      <FolderKanban className="mr-1.5 h-3.5 w-3.5 text-[#264E82]" /> Projekti
                    </Button>
                  </Link>
                )}

                {getInquiryPermissions(user).canViewAny && (
                  <Link href="/research">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full h-9 px-3.5 border-[#1E3A5F]/20 bg-white text-[#1E3A5F] hover:bg-[#EFF5FB] hover:border-[#1E3A5F]/45 text-xs font-bold gap-1.5 shadow-2xs transition-colors"
                    >
                      <FileSearch className="h-3.5 w-3.5 text-[#264E82]" />
                      <span>Istraživanja</span>
                      {Boolean(user?.assignedActiveInquiriesCount && user.assignedActiveInquiriesCount > 0) && (
                        <span className="inline-flex items-center justify-center rounded-full bg-emerald-700 text-white px-1.5 py-0.5 text-[10px] font-bold leading-none tabular-nums">
                          {user?.assignedActiveInquiriesCount}
                        </span>
                      )}
                    </Button>
                  </Link>
                )}

                {canSendBoardAnnouncement && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setBoardAnnouncementInitialText("")
                      setBoardAnnouncementInitialTab("edit")
                      setBoardAnnouncementOpen(true)
                    }}
                    className="rounded-full h-9 px-3.5 border-[#D97706]/55 bg-[#FEFCE8] hover:bg-amber-100/80 text-[#7C2D12] text-xs font-bold shadow-2xs transition-colors"
                  >
                    <Mail className="mr-1.5 h-3.5 w-3.5 text-[#D97706]" /> Obavijest tijelima
                  </Button>
                )}
              </div>
            </div>
          </section>

          {/* KPI Summary Cards — Uravnotežena 3×2 Bento mreža */}
          <section className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4" aria-label="Ključni pokazatelji">
            {/* 1. Aktivni članovi */}
            <Link
              href="/members?status=active"
              className="group relative overflow-hidden rounded-2xl border border-[#E8E4DE] hover:border-emerald-400/70 bg-white p-4 sm:p-5 shadow-[0_2px_10px_rgba(27,43,54,0.04)] hrd-card-interactive hrd-fade-up hrd-delay-1 flex flex-col justify-between"
            >
              <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-emerald-600 to-emerald-400" />
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/70 group-hover:bg-emerald-700 group-hover:text-white transition-colors shrink-0">
                    <UserCheck className="h-4 w-4" />
                  </div>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-full whitespace-nowrap tabular-nums">
                    +{stats.newThisMonth} ovaj mj.
                  </span>
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Aktivni članovi
                </span>
                <div className="flex items-baseline justify-between gap-2 mt-1">
                  <span className="font-serif text-3xl sm:text-[34px] leading-none font-bold text-[#1B2B36] tabular-nums">
                    {stats.active}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                    Prikaži
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </div>
              <div className="mt-3.5 pt-2.5 border-t border-[#F2EFE9] space-y-1.5">
                <div className="h-1.5 w-full rounded-full bg-[#F2EFE9] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-600 transition-all duration-700 ease-out"
                    style={{ width: `${stats.activeSharePct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] font-medium text-muted-foreground tabular-nums">
                  <span>Udio u registru</span>
                  <span className="font-bold text-emerald-800">{stats.activeSharePct}%</span>
                </div>
              </div>
            </Link>

            {/* 2. Ukupno članova */}
            <Link
              href="/members?status=all"
              className="group relative overflow-hidden rounded-2xl border border-[#E8E4DE] hover:border-[#1E3A5F]/50 bg-white p-4 sm:p-5 shadow-[0_2px_10px_rgba(27,43,54,0.04)] hrd-card-interactive hrd-fade-up hrd-delay-2 flex flex-col justify-between"
            >
              <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#1E3A5F] to-[#264E82]" />
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="p-2 rounded-xl bg-[#EFF5FB] text-[#1E3A5F] border border-[#1E3A5F]/15 group-hover:bg-[#1E3A5F] group-hover:text-white transition-colors shrink-0">
                    <Users className="h-4 w-4" />
                  </div>
                  <span className="text-[10px] font-bold text-[#1E3A5F] bg-[#EFF5FB] border border-[#1E3A5F]/15 px-2.5 py-0.5 rounded-full whitespace-nowrap tabular-nums">
                    +{stats.newThisMonth} tekući mj.
                  </span>
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Ukupno članova
                </span>
                <div className="flex items-baseline justify-between gap-2 mt-1">
                  <span className="font-serif text-3xl sm:text-[34px] leading-none font-bold text-[#1B2B36] tabular-nums">
                    {stats.total}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1E3A5F]">
                    Registar
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </div>
              <div className="mt-3.5 pt-2.5 border-t border-[#F2EFE9] space-y-1.5">
                <div className="h-1.5 w-full rounded-full bg-[#F2EFE9] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#1E3A5F] transition-all duration-700 ease-out"
                    style={{ width: `${stats.activeSharePct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] font-medium text-muted-foreground tabular-nums">
                  <span>{stats.active} aktivnih</span>
                  <span className="font-bold text-[#1E3A5F]">{stats.activeSharePct}%</span>
                </div>
              </div>
            </Link>

            {/* 3. Članarine */}
            <Link
              href="/members?status=all&paymentStatus=overdue"
              className="group relative overflow-hidden rounded-2xl border border-[#E8E4DE] hover:border-[#CEA369] bg-white p-4 sm:p-5 shadow-[0_2px_10px_rgba(27,43,54,0.04)] hrd-card-interactive hrd-fade-up hrd-delay-3 flex flex-col justify-between"
            >
              <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#CEA369] to-[#B5843E]" />
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="p-2 rounded-xl bg-[#FEFCE8] text-[#8E622A] border border-[#CEA369]/50 group-hover:bg-[#CEA369] group-hover:text-[#1B2B36] transition-colors shrink-0">
                    <Euro className="h-4 w-4" />
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap tabular-nums border",
                      stats.overdue > 0
                        ? "text-red-700 bg-red-50 border-red-200"
                        : "text-emerald-800 bg-emerald-50 border-emerald-200"
                    )}
                  >
                    {stats.overdue} dugovanja
                  </span>
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Članarine ({currentYear}.)
                </span>
                <div className="flex items-baseline justify-between gap-2 mt-1">
                  <span className="font-serif text-2xl sm:text-[32px] leading-none font-bold text-[#1B2B36] tabular-nums">
                    {stats.thisYearCollected.toLocaleString("hr-HR", {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}{" "}
                    €
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#8E622A]">
                    Dugovi
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </div>
              <div className="mt-3.5 pt-2.5 border-t border-[#F2EFE9] space-y-1.5">
                <div className="h-1.5 w-full rounded-full bg-[#F2EFE9] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#CEA369] transition-all duration-700 ease-out"
                    style={{ width: `${stats.paidSharePct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] font-medium text-muted-foreground tabular-nums">
                  <span>Urednost plaćanja</span>
                  <span className="font-bold text-[#8E622A]">{stats.paidSharePct}%</span>
                </div>
              </div>
            </Link>

            {/* 4. Donacije za digitalizaciju */}
            {user?.role === "admin" ? (
              <Link
                href="/admin/donations"
                title="Otvori modul donacija (Admin)"
                className="group relative overflow-hidden rounded-2xl border border-[#E8E4DE] hover:border-rose-300 bg-white p-4 sm:p-5 shadow-[0_2px_10px_rgba(27,43,54,0.04)] hrd-card-interactive hrd-fade-up hrd-delay-4 flex flex-col justify-between"
              >
                <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#9F1239] to-[#D97706]" />
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="p-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200/80 group-hover:bg-rose-700 group-hover:text-white transition-colors shrink-0">
                      <HeartHandshake className="h-4 w-4" />
                    </div>
                    <span className="text-[10px] font-bold text-rose-800 bg-rose-50 border border-rose-200/80 px-2.5 py-0.5 rounded-full whitespace-nowrap flex items-center gap-1 tabular-nums">
                      <Heart className="h-2.5 w-2.5 fill-rose-600 text-rose-600" />
                      {donationStats?.donorCount || 0} uplate
                    </span>
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                    Donacije / Digitalizacija
                  </span>
                  <div className="flex items-baseline justify-between gap-2 mt-1">
                    <span className="font-serif text-2xl sm:text-[32px] leading-none font-bold text-[#1B2B36] tabular-nums">
                      {donationCollectedEur.toFixed(2)} €
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700">
                      Kampanja
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                    </span>
                  </div>
                </div>
                <div className="mt-3.5 pt-2.5 border-t border-[#F2EFE9] space-y-1.5">
                  <div className="h-1.5 w-full rounded-full bg-[#F2EFE9] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-rose-600 to-[#CEA369] transition-all duration-700 ease-out"
                      style={{ width: `${Math.max(4, donationPct)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-medium text-muted-foreground tabular-nums">
                    <span>{donationStats?.sentCount || 0} poslanih upita</span>
                    <span className="font-bold text-rose-700">{donationPct}% cilja</span>
                  </div>
                </div>
              </Link>
            ) : (
              <div
                title="Namjenske donacije za opremu i digitalizaciju"
                className="relative overflow-hidden rounded-2xl border border-[#E8E4DE] bg-white p-4 sm:p-5 shadow-[0_2px_10px_rgba(27,43,54,0.04)] hrd-fade-up hrd-delay-4 flex flex-col justify-between"
              >
                <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#9F1239] to-[#D97706]" />
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="p-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200/80 shrink-0">
                      <HeartHandshake className="h-4 w-4" />
                    </div>
                    <span className="text-[10px] font-bold text-rose-800 bg-rose-50 border border-rose-200/80 px-2.5 py-0.5 rounded-full whitespace-nowrap flex items-center gap-1 tabular-nums">
                      <Heart className="h-2.5 w-2.5 fill-rose-600 text-rose-600" />
                      {donationStats?.donorCount || 0} uplate
                    </span>
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                    Donacije / Digitalizacija
                  </span>
                  <div className="flex items-baseline justify-between gap-2 mt-1">
                    <span className="font-serif text-2xl sm:text-[32px] leading-none font-bold text-[#1B2B36] tabular-nums">
                      {donationCollectedEur.toFixed(2)} €
                    </span>
                    <span className="text-[10px] text-muted-foreground font-semibold tabular-nums">
                      Cilj {donationTargetEur} €
                    </span>
                  </div>
                </div>
                <div className="mt-3.5 pt-2.5 border-t border-[#F2EFE9] space-y-1.5">
                  <div className="h-1.5 w-full rounded-full bg-[#F2EFE9] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-rose-600 to-[#CEA369] transition-all duration-700 ease-out"
                      style={{ width: `${Math.max(4, donationPct)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-medium text-muted-foreground tabular-nums">
                    <span>{donationStats?.sentCount || 0} poslanih upita</span>
                    <span className="font-bold text-rose-700">{donationPct}% cilja</span>
                  </div>
                </div>
              </div>
            )}

            {/* 5. Tijela i dužnosti */}
            <Link
              href="/members?tab=organization"
              className="group relative overflow-hidden rounded-2xl border border-[#E8E4DE] hover:border-[#CEA369] bg-white p-4 sm:p-5 shadow-[0_2px_10px_rgba(27,43,54,0.04)] hrd-card-interactive hrd-fade-up hrd-delay-5 flex flex-col justify-between"
            >
              <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#CEA369] to-[#1E3A5F]" />
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="p-2 rounded-xl bg-[#FEFCE8] text-[#8E622A] border border-[#CEA369]/50 group-hover:bg-[#1E3A5F] group-hover:text-[#CEA369] transition-colors shrink-0">
                    <Award className="h-4 w-4" />
                  </div>
                  <span className="text-[10px] font-bold text-[#7C2D12] bg-[#FEFCE8] border border-[#CEA369]/50 px-2.5 py-0.5 rounded-full whitespace-nowrap">
                    Mandat aktivan
                  </span>
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Tijela i dužnosti
                </span>
                <div className="flex items-baseline justify-between gap-2 mt-1">
                  <span className="font-serif text-3xl sm:text-[34px] leading-none font-bold text-[#1B2B36] tabular-nums">
                    {stats.activeFunctionsCount}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1E3A5F]">
                    Ustroj
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </div>
              <div className="mt-3.5 pt-2.5 border-t border-[#F2EFE9] flex items-center justify-between text-[10px] font-medium text-muted-foreground">
                <span>Aktivnih dužnosnika u tijelima</span>
                <span className="font-bold text-[#1B2B36] tabular-nums">{stats.activeFunctionsCount}</span>
              </div>
            </Link>

            {/* 6. Sjednice društva */}
            <Link
              href="/meetings"
              className="group relative overflow-hidden rounded-2xl border border-[#E8E4DE] hover:border-[#264E82]/60 bg-white p-4 sm:p-5 shadow-[0_2px_10px_rgba(27,43,54,0.04)] hrd-card-interactive hrd-fade-up hrd-delay-6 flex flex-col justify-between"
            >
              <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#264E82] to-[#6366F1]" />
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="p-2 rounded-xl bg-[#EFF5FB] text-[#264E82] border border-[#264E82]/20 group-hover:bg-[#264E82] group-hover:text-white transition-colors shrink-0">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap border",
                      nextMeeting
                        ? "text-[#1E3A5F] bg-[#EFF5FB] border-[#264E82]/25"
                        : "text-slate-600 bg-slate-50 border-slate-200"
                    )}
                  >
                    {nextMeeting ? "Zakazano" : "Uredno"}
                  </span>
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Sjednice društva
                </span>
                <div className="flex items-baseline justify-between gap-2 mt-1">
                  <span className="font-serif text-3xl sm:text-[34px] leading-none font-bold text-[#1B2B36] tabular-nums">
                    {meetings.length}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#264E82]">
                    Kalendar
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </div>
              <div className="mt-3.5 pt-2.5 border-t border-[#F2EFE9] flex items-center justify-between text-[10px] font-medium text-muted-foreground">
                <span>Sljedeća sjednica</span>
                <span className="font-bold text-[#1E3A5F] tabular-nums">
                  {nextMeeting ? formatDateShort(nextMeeting.date) : "Nema zakazanih"}
                </span>
              </div>
            </Link>
          </section>

          {/* Main Layout: 2 Columns */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column (2 spans): Next Meeting, Chart & Upcoming Lectures */}
            <div className="lg:col-span-2 space-y-6">
              {/* Sljedeća sjednica */}
              {nextMeeting ? (
                <section className="overflow-hidden rounded-3xl border border-[#E8E4DE] bg-white shadow-[0_2px_14px_rgba(27,43,54,0.05)] hrd-fade-up">
                  <div className="bg-gradient-to-r from-[#1E3A5F] to-[#264E82] border-b-2 border-[#CEA369] px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-white">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="flex flex-col items-center justify-center w-12 h-12 rounded-2xl bg-[#1B2B36] border border-[#CEA369]/80 shrink-0 shadow-sm">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[#CEA369] leading-none">
                          {nextMeetingDateTile.month}
                        </span>
                        <span className="font-serif text-lg font-bold text-white leading-tight mt-0.5 tabular-nums">
                          {nextMeetingDateTile.day}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#F3D19C]">
                            Sljedeća sjednica
                          </span>
                          {nextMeetingCountdown && (
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[10px] font-bold",
                                nextMeetingCountdown.tone === "today"
                                  ? "bg-emerald-400 text-[#1B2B36]"
                                  : nextMeetingCountdown.tone === "soon"
                                  ? "bg-[#CEA369] text-[#1B2B36]"
                                  : "bg-white/15 text-white border border-white/25"
                              )}
                            >
                              {nextMeetingCountdown.label}
                            </span>
                          )}
                        </div>
                        <h4 className="font-serif text-base sm:text-lg font-bold text-white leading-snug mt-0.5 truncate">
                          {nextMeeting.title}
                        </h4>
                      </div>
                    </div>

                    <Link href="/meetings" className="shrink-0">
                      <Button
                        size="sm"
                        className="rounded-full text-xs font-bold h-8 px-4 bg-white text-[#1E3A5F] hover:bg-[#FEFCE8] border border-[#CEA369]"
                      >
                        Otvori sjednicu →
                      </Button>
                    </Link>
                  </div>

                  <div className="p-5 space-y-4">
                    <div className="flex flex-wrap items-center gap-2.5 text-xs">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FBF9F6] border border-[#E8E4DE] px-3 py-1 font-semibold text-[#1B2B36] tabular-nums">
                        <Calendar className="h-3.5 w-3.5 text-[#1E3A5F]" />
                        {safeFormatDate(nextMeeting.date)}
                      </span>
                      {nextMeeting.start_time && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FBF9F6] border border-[#E8E4DE] px-3 py-1 font-medium text-muted-foreground tabular-nums">
                          <Clock className="h-3.5 w-3.5 text-[#CEA369]" />
                          {nextMeeting.start_time}
                          {nextMeeting.end_time ? `–${nextMeeting.end_time}` : ""}
                        </span>
                      )}
                      {nextMeeting.location && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FBF9F6] border border-[#E8E4DE] px-3 py-1 font-medium text-muted-foreground max-w-full">
                          <MapPin className="h-3.5 w-3.5 text-[#1E3A5F] shrink-0" />
                          <span className="truncate max-w-[260px]">{nextMeeting.location}</span>
                        </span>
                      )}
                    </div>

                    {(() => {
                      let agendaItems: any[] = []
                      if (Array.isArray(nextMeeting?.agenda)) {
                        agendaItems = nextMeeting.agenda
                      } else if (typeof nextMeeting?.agenda === "string") {
                        try {
                          const parsed = JSON.parse(nextMeeting.agenda)
                          if (Array.isArray(parsed)) agendaItems = parsed
                        } catch {}
                      }
                      if (agendaItems.length === 0) return null
                      const visibleItems = expandAgenda ? agendaItems : agendaItems.slice(0, 3)

                      return (
                        <div className="border-t border-[#F2EFE9] pt-3.5">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                              Dnevni red ({agendaItems.length} točaka)
                            </span>
                            {agendaItems.length > 3 && (
                              <button
                                type="button"
                                onClick={() => setExpandAgenda((v) => !v)}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#1E3A5F] hover:text-[#264E82] hover:underline"
                              >
                                {expandAgenda ? (
                                  <>
                                    Sažmi <ChevronUp className="h-3.5 w-3.5" />
                                  </>
                                ) : (
                                  <>
                                    Prikaži sve ({agendaItems.length}) <ChevronDown className="h-3.5 w-3.5" />
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                          <ul className="space-y-1.5">
                            {visibleItems.map((item: any, i: number) => {
                              const itemText = typeof item === "string" ? item : item?.text || ""
                              return (
                                <li key={i} className="flex items-start gap-2.5 text-xs text-muted-foreground">
                                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#EFF5FB] border border-[#1E3A5F]/15 text-[10px] font-bold text-[#1E3A5F] tabular-nums">
                                    {i + 1}
                                  </span>
                                  <span className={cn("text-[#1B2B36]/90 pt-0.5", !expandAgenda && "line-clamp-1")}>
                                    {itemText}
                                  </span>
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      )
                    })()}
                  </div>
                </section>
              ) : (
                <section className="rounded-3xl border border-dashed border-[#CEA369]/60 bg-[#FBF9F6] p-6 text-center hrd-fade-up">
                  <Calendar className="mx-auto h-8 w-8 text-[#1E3A5F]/35 mb-1.5" />
                  <p className="text-sm font-semibold text-[#1B2B36]">Nema zakazanih budućih sjednica</p>
                  <Link
                    href="/meetings"
                    className="text-xs text-[#1E3A5F] hover:underline font-bold mt-1.5 inline-flex items-center gap-1"
                  >
                    Zakaži novu sjednicu <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </section>
              )}

              {/* Grafikon prijava novih članova */}
              <section className="rounded-3xl border border-[#E8E4DE] bg-white p-5 md:p-6 shadow-[0_2px_14px_rgba(27,43,54,0.05)] hrd-fade-up">
                <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-serif text-xl font-bold text-[#1B2B36]">Prijave novih članova</h3>
                      <Badge
                        variant="outline"
                        className="rounded-full border-[#CEA369]/60 bg-[#FEFCE8] text-[#7C2D12] text-[10px] font-bold tabular-nums"
                      >
                        {chartPeriodTotal} u razdoblju · Prosjek {chartPeriodAvg}/mj.
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Trend učlanjivanja kroz zadnjih {chartRange === "6m" ? "6" : "12"} mjeseci (isprekidana linija = prosjek)
                    </p>
                  </div>

                  {/* Prekidači razdoblja i vrste grafikona */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <div className="inline-flex rounded-xl bg-[#F2EFE9] border border-[#E8E4DE] p-0.5">
                      <button
                        type="button"
                        onClick={() => setChartRange("6m")}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors",
                          chartRange === "6m"
                            ? "bg-[#1E3A5F] text-white shadow-2xs"
                            : "text-[#1E3A5F]/75 hover:text-[#1E3A5F]"
                        )}
                      >
                        6 mj.
                      </button>
                      <button
                        type="button"
                        onClick={() => setChartRange("12m")}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors",
                          chartRange === "12m"
                            ? "bg-[#1E3A5F] text-white shadow-2xs"
                            : "text-[#1E3A5F]/75 hover:text-[#1E3A5F]"
                        )}
                      >
                        12 mj.
                      </button>
                    </div>

                    <div className="inline-flex rounded-xl bg-[#F2EFE9] border border-[#E8E4DE] p-0.5">
                      <button
                        type="button"
                        onClick={() => setChartType("bar")}
                        title="Stupčasti prikaz"
                        className={cn(
                          "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors",
                          chartType === "bar"
                            ? "bg-[#1E3A5F] text-white shadow-2xs"
                            : "text-[#1E3A5F]/75 hover:text-[#1E3A5F]"
                        )}
                      >
                        <BarChart3 className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Stupci</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setChartType("area")}
                        title="Krivulja trenda"
                        className={cn(
                          "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors",
                          chartType === "area"
                            ? "bg-[#1E3A5F] text-white shadow-2xs"
                            : "text-[#1E3A5F]/75 hover:text-[#1E3A5F]"
                        )}
                      >
                        <TrendingUp className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Krivulja</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="h-[250px] w-full">
                  {mounted ? (
                    <DashboardMembersChart
                      data={visibleChartData}
                      chartType={chartType}
                      average={chartPeriodAvg}
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-[#FBF9F6] rounded-2xl border border-[#E8E4DE]">
                      <p className="text-xs text-muted-foreground">Učitavanje grafikona...</p>
                    </div>
                  )}
                </div>
              </section>

              {/* Predstojeća predavanja i druženja (klikabilni redovi) */}
              <section className="rounded-3xl border border-[#E8E4DE] bg-white p-5 md:p-6 shadow-[0_2px_14px_rgba(27,43,54,0.05)] hrd-fade-up">
                <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="font-serif text-xl font-bold text-[#1B2B36]">Predstojeća predavanja / druženja</h3>
                    <p className="text-xs text-muted-foreground">
                      Kliknite na najavu za izravno otvaranje detalja, prisutnosti i priloga
                    </p>
                  </div>
                  <Link href="/lectures">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full border-[#1E3A5F]/20 bg-[#FBF9F6] text-[#1E3A5F] hover:bg-[#EFF5FB] gap-1 text-xs font-bold h-8"
                    >
                      Sva događanja <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>

                <div className="space-y-2.5">
                  {upcomingLectures.length > 0 ? (
                    upcomingLectures.slice(0, 4).map((l) => {
                      const tile = parseDateTileParts(l.date)
                      const countdown = getDaysUntilMeta(l.date)
                      const typeMeta = LECTURE_TYPE_META[l.type] || {
                        label: "Događaj",
                        badgeCls: "border-slate-200 bg-slate-50 text-slate-700",
                      }
                      const hostLabel =
                        l.hosts && l.hosts.length > 0
                          ? l.hosts.map((h) => h.name).join(", ")
                          : l.host

                      return (
                        <Link
                          key={l.id}
                          href={`/lectures?open=${l.id}`}
                          className="group flex items-center gap-3.5 p-3 rounded-2xl border border-[#E8E4DE] bg-[#FBF9F6]/70 hover:bg-white hover:border-[#CEA369] hover:shadow-sm transition-all"
                        >
                          <div className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-[#1E3A5F] text-white font-bold shrink-0 shadow-xs border border-[#CEA369]/60">
                            <span className="text-[9px] uppercase tracking-wider leading-none text-[#CEA369]">
                              {tile.month}
                            </span>
                            <span className="font-serif text-lg leading-tight mt-0.5 tabular-nums">{tile.day}</span>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5 mb-1">
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold leading-none",
                                  typeMeta.badgeCls
                                )}
                              >
                                {typeMeta.label}
                              </span>
                              {countdown && (
                                <span
                                  className={cn(
                                    "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold leading-none",
                                    countdown.tone === "today"
                                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                      : countdown.tone === "soon"
                                      ? "bg-[#FEFCE8] text-[#8E622A] border border-[#CEA369]/60"
                                      : "bg-slate-100 text-slate-700 border border-slate-200"
                                  )}
                                >
                                  {countdown.label}
                                </span>
                              )}
                            </div>

                            <h5 className="text-xs sm:text-sm font-bold text-[#1B2B36] group-hover:text-[#1E3A5F] truncate">
                              {l.title}
                            </h5>

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground mt-1">
                              <span className="inline-flex items-center gap-1 tabular-nums">
                                <Clock className="h-3 w-3 text-[#CEA369]" />
                                {l.start_time || "18:00"}
                              </span>
                              {l.location && (
                                <span className="inline-flex items-center gap-1 truncate max-w-[220px]">
                                  <MapPin className="h-3 w-3 text-[#1E3A5F] shrink-0" />
                                  {l.location}
                                </span>
                              )}
                              {hostLabel && (
                                <span className="inline-flex items-center gap-1 truncate max-w-[200px]">
                                  <Mic className="h-3 w-3 text-muted-foreground shrink-0" />
                                  {hostLabel}
                                </span>
                              )}
                            </div>
                          </div>

                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-[#1E3A5F] group-hover:translate-x-0.5 transition-all shrink-0" />
                        </Link>
                      )
                    })
                  ) : (
                    <div className="py-8 text-center text-xs text-muted-foreground bg-[#FBF9F6] rounded-2xl border border-dashed border-[#E8E4DE]">
                      Trenutno nema zakazanih predavanja ili druženja.
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* Right Column: Board Noticeboard, Donation Fund & Activity Timeline */}
            <div className="space-y-6">
              {/* 1. Oglasna ploča odbora */}
              <section className="overflow-hidden rounded-3xl border border-[#E8E4DE] bg-white shadow-[0_2px_14px_rgba(27,43,54,0.05)] hrd-fade-up">
                <div className="h-1 w-full bg-gradient-to-r from-[#CEA369] to-[#1E3A5F]" />
                <div className="p-5 space-y-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-2 rounded-xl bg-[#FEFCE8] border border-[#CEA369]/60 text-[#8E622A] shrink-0">
                        <MessageSquare className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-serif text-base font-bold text-[#1B2B36] leading-tight">
                          Oglasna ploča odbora
                        </h4>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                          Interna napomena
                        </p>
                      </div>
                    </div>

                    {canEditNotice && !isEditingNotice && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsEditingNotice(true)}
                        className="h-8 text-xs font-bold text-[#1E3A5F] border-[#E8E4DE] bg-[#FBF9F6] hover:bg-[#EFF5FB] rounded-full shrink-0"
                      >
                        <Edit2 className="h-3 w-3 mr-1" /> Uredi
                      </Button>
                    )}
                  </div>

                  {isEditingNotice ? (
                    <div className="space-y-3 pt-1">
                      <textarea
                        rows={4}
                        placeholder="Upišite kratku obavijest ili podsjetnik za članove odbora..."
                        className="w-full rounded-2xl border border-[#CEA369]/70 bg-[#FBF9F6] p-3 text-xs leading-relaxed text-[#1B2B36] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#CEA369]/30"
                        value={noticeDraft}
                        onChange={(e) => setNoticeDraft(e.target.value)}
                      />
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#F2EFE9]">
                        <div>
                          {settings.boardNotice && (
                            <DeleteActionButton
                              size="sm"
                              label="Ukloni"
                              onClick={handleClearNotice}
                              disabled={isSavingNotice}
                            />
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 ml-auto">
                          <CloseActionButton
                            size="sm"
                            label="Odustani"
                            onClick={() => {
                              setNoticeDraft(settings.boardNotice || "")
                              setIsEditingNotice(false)
                            }}
                          />
                          <SaveActionButton
                            size="sm"
                            label="Objavi"
                            loadingLabel="Spremanje…"
                            loading={isSavingNotice}
                            onClick={handleSaveNotice}
                          />
                        </div>
                      </div>
                    </div>
                  ) : settings.boardNotice ? (
                    <div className="space-y-2.5">
                      <div className="p-3.5 rounded-2xl bg-[#FBF9F6] border border-[#E8E4DE] border-l-4 border-l-[#CEA369] text-xs text-[#1B2B36] leading-relaxed whitespace-pre-wrap">
                        {settings.boardNotice}
                      </div>
                      {settings.boardNoticeAuthor && (
                        <p className="text-[10px] text-muted-foreground text-right italic">
                          Objavio/la: {settings.boardNoticeAuthor}{" "}
                          {settings.boardNoticeDate && `(${safeFormatDate(settings.boardNoticeDate)})`}
                        </p>
                      )}
                      {(canSendBoardAnnouncement || canViewBoardHistory) && (
                        <div className="pt-1 flex flex-wrap items-center justify-end gap-2">
                          {canViewBoardHistory && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setBoardAnnouncementInitialText("")
                                setBoardAnnouncementInitialTab("history")
                                setBoardAnnouncementOpen(true)
                              }}
                              className="h-8 rounded-full text-xs font-bold border-[#E8E4DE] bg-white text-[#1E3A5F] hover:bg-[#EFF5FB]"
                            >
                              <History className="mr-1.5 h-3 w-3 text-[#CEA369]" /> Povijest obavijesti
                            </Button>
                          )}
                          {canSendBoardAnnouncement && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setBoardAnnouncementInitialText(settings.boardNotice || "")
                                setBoardAnnouncementInitialTab("edit")
                                setBoardAnnouncementOpen(true)
                              }}
                              className="h-8 rounded-full text-xs font-bold border-[#D97706]/55 bg-[#FEFCE8] text-[#7C2D12] hover:bg-amber-100/80"
                            >
                              <Mail className="mr-1.5 h-3 w-3 text-[#D97706]" /> Pošalji mail tijelima
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-5 text-center text-xs text-muted-foreground bg-[#FBF9F6] rounded-2xl border border-dashed border-[#E8E4DE] px-3">
                      <p className="italic">Trenutno nema aktivnih napomena za članove odbora.</p>
                      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                        {canEditNotice && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setIsEditingNotice(true)}
                            className="h-8 rounded-full text-xs font-bold border-[#CEA369]/60 bg-white text-[#1E3A5F] hover:bg-[#FEFCE8]"
                          >
                            + Dodaj obavijest
                          </Button>
                        )}
                        {canSendBoardAnnouncement && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setBoardAnnouncementInitialText("")
                              setBoardAnnouncementInitialTab("edit")
                              setBoardAnnouncementOpen(true)
                            }}
                            className="h-8 rounded-full text-xs font-bold border-[#D97706]/55 bg-[#FEFCE8] text-[#7C2D12] hover:bg-amber-100/80"
                          >
                            <Mail className="mr-1.5 h-3 w-3 text-[#D97706]" /> Pošalji mail tijelima
                          </Button>
                        )}
                        {canViewBoardHistory && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setBoardAnnouncementInitialText("")
                              setBoardAnnouncementInitialTab("history")
                              setBoardAnnouncementOpen(true)
                            }}
                            className="h-8 rounded-full text-xs font-bold border-[#E8E4DE] bg-white text-[#1E3A5F] hover:bg-[#EFF5FB]"
                          >
                            <History className="mr-1.5 h-3 w-3 text-[#CEA369]" /> Povijest obavijesti
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* 2. Donacijski fond & Digitalizacija baštine */}
              <section className="overflow-hidden rounded-3xl border border-[#E8E4DE] bg-white shadow-[0_2px_14px_rgba(27,43,54,0.05)] hrd-fade-up">
                <div className="h-1 w-full bg-gradient-to-r from-[#9F1239] via-[#D97706] to-[#CEA369]" />
                <div className="p-5 space-y-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-2 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-700 shrink-0">
                        <HeartHandshake className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-serif text-base font-bold text-[#1B2B36] leading-tight">
                          Donacijski fond društva
                        </h4>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                          Digitalizacija rodoslovne baštine
                        </p>
                      </div>
                    </div>
                    {user?.role === "admin" ? (
                      <Link href="/admin/donations" className="shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs font-bold rounded-full bg-[#FBF9F6] hover:bg-rose-50 border-rose-200 text-rose-700"
                        >
                          Upravljanje →
                        </Button>
                      </Link>
                    ) : (
                      <span className="rounded-full bg-[#FEFCE8] border border-[#CEA369]/60 px-2.5 py-0.5 text-[11px] font-bold text-[#8E622A] tabular-nums shrink-0">
                        {donationPct}%
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Namjensko prikupljanje sredstava za nabavu profesionalnog A3 knjižnog skenera i opreme za trajnu digitalizaciju matičnih knjiga.
                  </p>

                  {/* Progress bar */}
                  <div className="space-y-1.5 pt-0.5">
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="font-bold text-[#1B2B36] tabular-nums">
                        {donationCollectedEur.toFixed(2)} €{" "}
                        <span className="font-normal text-muted-foreground">prikupljeno</span>
                      </span>
                      <span className="text-muted-foreground text-[11px] font-semibold tabular-nums">
                        {donationPct}% od {donationTargetEur} €
                      </span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-[#F2EFE9] overflow-hidden border border-[#E8E4DE]">
                      <div
                        className="h-full bg-gradient-to-r from-[#1E3A5F] via-[#264E82] to-[#CEA369] rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${Math.max(4, donationPct)}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#F2EFE9] text-center">
                    <div className="p-2.5 rounded-xl bg-[#FBF9F6] border border-[#E8E4DE]">
                      <div className="text-[10px] font-bold uppercase text-muted-foreground">Donatora</div>
                      <div className="text-base font-bold text-[#1B2B36] mt-0.5 tabular-nums">
                        {donationStats?.donorCount || 0}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#FBF9F6] border border-[#E8E4DE]">
                      <div className="text-[10px] font-bold uppercase text-muted-foreground">Poslano</div>
                      <div className="text-base font-bold text-[#1B2B36] mt-0.5 tabular-nums">
                        {donationStats?.sentCount || 0}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#FBF9F6] border border-[#E8E4DE]">
                      <div className="text-[10px] font-bold uppercase text-muted-foreground">Baza tvrtki</div>
                      <div className="text-base font-bold text-[#1B2B36] mt-0.5 tabular-nums">
                        {donationStats?.totalLeads || 0}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* 3. Vremenska crta aktivnosti (Timeline) */}
              <section className="rounded-3xl border border-[#E8E4DE] bg-white p-5 shadow-[0_2px_14px_rgba(27,43,54,0.05)] space-y-4 hrd-fade-up">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-[#EFF5FB] border border-[#1E3A5F]/15 text-[#1E3A5F]">
                      <Activity className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-serif text-base font-bold text-[#1B2B36] leading-tight">
                        Zadnje aktivnosti
                      </h4>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                        Vremenska crta sustava
                      </p>
                    </div>
                  </div>
                  {user?.role === "admin" && (
                    <Link
                      href="/logs"
                      className="text-[11px] font-bold text-[#1E3A5F] hover:text-[#264E82] hover:underline shrink-0"
                    >
                      Svi logovi →
                    </Link>
                  )}
                </div>

                {/* Brzi filter aktivnosti */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      { id: "all", label: "Sve" },
                      { id: "members", label: "Članovi" },
                      { id: "email", label: "E-pošta" },
                      { id: "system", label: "Sustav" },
                    ] as const
                  ).map((chip) => (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => setLogFilter(chip.id)}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors border",
                        logFilter === chip.id
                          ? "bg-[#1E3A5F] text-white border-[#CEA369]"
                          : "bg-[#FBF9F6] text-[#1E3A5F]/80 border-[#E8E4DE] hover:bg-[#EFF5FB]"
                      )}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>

                {filteredRecentLogs.length > 0 ? (
                  <div className="relative pl-5 border-l-2 border-[#E8E4DE] space-y-3 ml-1.5">
                    {filteredRecentLogs.map((log) => {
                      const cat = categorizeLog(log.action, log.details)
                      const isExpanded = expandedLogId === log.id
                      const dotCls =
                        cat === "email"
                          ? "bg-amber-500 ring-amber-100"
                          : cat === "members"
                          ? "bg-emerald-600 ring-emerald-100"
                          : "bg-[#1E3A5F] ring-slate-100"

                      return (
                        <button
                          key={log.id}
                          type="button"
                          onClick={() => setExpandedLogId((prev) => (prev === log.id ? null : log.id))}
                          className="relative w-full text-left rounded-2xl border border-[#E8E4DE]/90 bg-[#FBF9F6]/80 hover:bg-white hover:border-[#CEA369]/80 p-3 transition-all group"
                        >
                          <span
                            className={cn(
                              "absolute -left-[25px] top-3.5 h-2.5 w-2.5 rounded-full ring-4",
                              dotCls
                            )}
                          />
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-xs font-bold text-[#1B2B36] group-hover:text-[#1E3A5F] leading-snug">
                              {log.action}
                            </span>
                            <span className="text-[10px] font-mono text-muted-foreground tabular-nums shrink-0">
                              {formatDateTimeDMY(log.timestamp)}
                            </span>
                          </div>
                          <p
                            className={cn(
                              "mt-1 text-[11px] text-muted-foreground leading-relaxed",
                              !isExpanded && "line-clamp-2"
                            )}
                          >
                            {log.details}
                          </p>
                          <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground/80">
                            <span className="font-mono">Korisnik: {log.userName}</span>
                            <span className="font-semibold text-[#1E3A5F]/75">
                              {isExpanded ? "Sažmi" : "Detalji"}
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-muted-foreground bg-[#FBF9F6] rounded-2xl border border-dashed border-[#E8E4DE]">
                    Nema zabilježenih aktivnosti u odabranoj kategoriji.
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      </main>

      {/* Executive Briefing Modal: Što je novo od zadnje prijave */}
      {showSummaryModal && summaryData && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-[#1B2B36]/65 backdrop-blur-sm transition-opacity"
            onClick={handleCloseSummary}
          />
          <div className="fixed left-1/2 top-1/2 z-[70] w-[calc(100vw-1.5rem)] max-w-2xl max-h-[88vh] -translate-x-1/2 -translate-y-1/2 rounded-3xl border-2 border-[#1E3A5F]/20 bg-white shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95">
            {/* Zaglavlje modala */}
            <div className="shrink-0 bg-gradient-to-r from-[#1E3A5F] to-[#264E82] border-b-2 border-[#CEA369] px-5 py-4 sm:px-6 flex items-start justify-between gap-3 text-white">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1B2B36] text-[#CEA369] border border-[#CEA369]/70 shrink-0 shadow-sm">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-serif text-xl sm:text-2xl font-bold text-white leading-tight">
                    Što je novo u društvu?
                  </h3>
                  <p className="text-xs text-slate-200 mt-0.5">
                    {summaryData.hasPreviousLogin && summaryData.previousLoginTime
                      ? `Pregled promjena od vašeg posljednjeg prijavljivanja (${(() => {
                          try {
                            const raw = summaryData.previousLoginTime
                            const iso = raw.includes("T") ? raw : raw.replace(" ", "T") + "Z"
                            return formatDateTimeDMY(new Date(iso))
                          } catch {
                            return formatDateTimeDMY(summaryData.previousLoginTime)
                          }
                        })()})`
                      : "Pregled novih aktivnosti u sustavu"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseSummary}
                aria-label="Zatvori sažetak"
                className="rounded-full bg-white/15 hover:bg-white/25 p-2 text-white transition-colors shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Izbornik sekcija brifinga */}
            <SectionTabsBar
              tabs={summaryTabs}
              value={summaryTab}
              onValueChange={setSummaryTab}
              variant="detail"
              ariaLabel="Kategorije novosti"
            />

            {/* Tijelo brifinga */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#FBF9F6]/70 space-y-3">
              {/* POŠTA I UPITI */}
              {showCommsTab && (
                <>
                  {canViewGmail &&
                    (summaryData.newEmailsCount > 0 ? (
                      <div className="p-3.5 rounded-2xl border border-sky-200 bg-white flex items-start justify-between gap-3 shadow-2xs">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="p-2 rounded-xl bg-sky-100 text-sky-700 shrink-0 mt-0.5">
                            <Mail className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-sky-950">
                              {summaryData.newEmailsCount === 1
                                ? "Primljen je 1 novi e-mail od posljednje prijave"
                                : `Primljeno je ${summaryData.newEmailsCount} novih e-mailova od posljednje prijave`}
                            </p>
                            {Array.isArray(summaryData.newEmailPreviews) &&
                              summaryData.newEmailPreviews.length > 0 && (
                                <ul className="mt-1.5 space-y-0.5 text-[11px] text-sky-900/85">
                                  {summaryData.newEmailPreviews.map((preview: string, idx: number) => (
                                    <li key={idx} className="truncate">
                                      • {preview}
                                    </li>
                                  ))}
                                </ul>
                              )}
                          </div>
                        </div>
                        <Link href="/gmail" onClick={handleAcknowledgeSummary} className="shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 rounded-full text-xs font-bold border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100"
                          >
                            INBOX →
                          </Button>
                        </Link>
                      </div>
                    ) : (
                      <div className="p-3.5 rounded-2xl border border-[#E8E4DE] bg-white flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2 rounded-xl bg-slate-100 text-slate-600 shrink-0">
                            <Mail className="h-4 w-4" />
                          </div>
                          <p className="text-xs font-semibold text-slate-700">
                            Nema novih primljenih e-mailova od posljednje prijave
                          </p>
                        </div>
                      </div>
                    ))}

                  {typeof summaryData.sentEmailsCount === "number" && summaryData.sentEmailsCount > 0 && (
                    <div className="p-3.5 rounded-2xl border border-teal-200 bg-white flex items-start justify-between gap-3 shadow-2xs">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="p-2 rounded-xl bg-teal-100 text-teal-700 shrink-0 mt-0.5">
                          <Send className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-teal-950">
                            {summaryData.sentEmailsCount === 1
                              ? "Poslan je 1 e-mail od posljednje prijave"
                              : `Poslano je ${summaryData.sentEmailsCount} e-mailova od posljednje prijave`}
                          </p>
                          {Array.isArray(summaryData.sentEmailPreviews) &&
                            summaryData.sentEmailPreviews.length > 0 && (
                              <ul className="mt-1.5 space-y-0.5 text-[11px] text-teal-900/85">
                                {summaryData.sentEmailPreviews.map((preview: string, idx: number) => (
                                  <li key={idx} className="truncate">
                                    • {preview}
                                  </li>
                                ))}
                              </ul>
                            )}
                        </div>
                      </div>
                      <Link href="/gmail" onClick={handleAcknowledgeSummary} className="shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 rounded-full text-xs font-bold border-teal-300 bg-teal-50 text-teal-800 hover:bg-teal-100"
                        >
                          Pregled →
                        </Button>
                      </Link>
                    </div>
                  )}

                  {((typeof summaryData.unreadEmailsCount === "number" && summaryData.unreadEmailsCount > 0) ||
                    (typeof summaryData.pendingInquiriesCount === "number" &&
                      summaryData.pendingInquiriesCount > 0)) && (
                    <div className="p-3.5 rounded-2xl border border-amber-300 bg-[#FEFCE8] flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="p-2 rounded-xl bg-amber-100 text-amber-800 shrink-0 mt-0.5">
                          <AlertCircle className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-amber-950">
                            Stavke koje čekaju odgovor ili obradu:
                          </p>
                          <div className="mt-1 space-y-0.5 text-[11px] text-amber-900 font-medium">
                            {summaryData.unreadEmailsCount > 0 && (
                              <p>• {summaryData.unreadEmailsCount} nepročitanih poruka u INBOX-u</p>
                            )}
                            {summaryData.pendingInquiriesCount > 0 && (
                              <p>
                                • {summaryData.pendingInquiriesCount} zaprimljenih upita građana koji čekaju dodjelu i rješavanje
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        {summaryData.pendingInquiriesCount > 0 && (
                          <Link href="/research" onClick={handleAcknowledgeSummary}>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 rounded-full text-xs font-bold border-amber-400 bg-white text-amber-950 hover:bg-amber-100"
                            >
                              Upiti ({summaryData.pendingInquiriesCount}) →
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  )}

                  {summaryData.newInquiriesCount > 0 && (
                    <div className="p-3.5 rounded-2xl border border-orange-200 bg-white flex items-start gap-3 shadow-2xs">
                      <div className="p-2 rounded-xl bg-orange-100 text-orange-700 shrink-0">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-orange-950">
                          {summaryData.newInquiriesCount} novih rodoslovnih upita građana
                        </p>
                      </div>
                    </div>
                  )}

                  {summaryTab === "comms" && summaryCounts.comms === 0 && (
                    <div className="py-8 text-center text-muted-foreground space-y-2">
                      <CheckCircle className="h-10 w-10 text-emerald-600 mx-auto opacity-80" />
                      <p className="font-semibold text-sm text-[#1B2B36]">Nema novih poruka ni upita</p>
                    </div>
                  )}
                </>
              )}

              {/* DRUŠTVO I ČLANOVI */}
              {showSocietyTab && (
                <>
                  {((summaryData.submittedDataForms && summaryData.submittedDataForms.length > 0) ||
                    (summaryData.viewedDataForms && summaryData.viewedDataForms.length > 0)) && (
                    <div className="p-3.5 rounded-2xl border border-emerald-200 bg-white flex items-start gap-3 shadow-2xs">
                      <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700 shrink-0 mt-0.5">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <p className="text-xs font-bold text-emerald-950">
                          Dopuna članskih podataka putem online forme
                        </p>
                        {summaryData.submittedDataForms && summaryData.submittedDataForms.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-[11px] font-semibold text-emerald-800">
                              ✓ Popunili i predali podatke ({summaryData.submittedDataForms.length}):
                            </p>
                            <ul className="space-y-1 text-xs text-emerald-950">
                              {summaryData.submittedDataForms.map((item: any) => (
                                <li
                                  key={`sub-${item.id}`}
                                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 bg-emerald-50/70 rounded-xl px-2.5 py-1.5 border border-emerald-200/70"
                                >
                                  <div className="min-w-0">
                                    <Link
                                      href={`/members/${item.id}`}
                                      onClick={handleAcknowledgeSummary}
                                      className="font-semibold hover:underline"
                                    >
                                      {item.name}
                                    </Link>
                                    {item.updatedFields && item.updatedFields.length > 0 && (
                                      <span className="text-[11px] text-emerald-800 block truncate">
                                        Dopunjeno: {item.updatedFields.join(", ")}
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] font-mono font-medium text-emerald-700 shrink-0">
                                    {formatDateTimeDMY(item.submittedAt)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {summaryData.viewedDataForms && summaryData.viewedDataForms.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-[11px] font-semibold text-blue-800">
                              Pogledali obrazac ({summaryData.viewedDataForms.length}):
                            </p>
                            <ul className="space-y-1 text-xs text-blue-950">
                              {summaryData.viewedDataForms.map((item: any) => (
                                <li
                                  key={`view-${item.id}`}
                                  className="flex items-center justify-between gap-2 bg-blue-50/70 rounded-xl px-2.5 py-1 border border-blue-200/60"
                                >
                                  <Link
                                    href={`/members/${item.id}`}
                                    onClick={handleAcknowledgeSummary}
                                    className="font-medium hover:underline truncate"
                                  >
                                    {item.name}
                                  </Link>
                                  <span className="text-[10px] font-mono text-blue-700 shrink-0">
                                    {formatDateTimeDMY(item.viewedAt)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {upcomingBirthdays.length > 0 && (
                    <div className="p-3.5 rounded-2xl border border-pink-200 bg-white flex items-start gap-3 shadow-2xs">
                      <div className="p-2 rounded-xl bg-pink-100 text-pink-700 shrink-0 mt-0.5">
                        <Cake className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-pink-950">
                          Nadolazeći rođendani u sljedećih 15 dana ({upcomingBirthdays.length})
                        </p>
                        <ul className="mt-2 space-y-1.5 text-xs text-pink-950">
                          {upcomingBirthdays.map((b) => {
                            const sentThisYear = b.member.lastBirthdayEmailAt
                              ? new Date(b.member.lastBirthdayEmailAt).getFullYear() === new Date().getFullYear()
                              : false
                            return (
                              <li
                                key={b.id}
                                className="flex items-center justify-between gap-2 rounded-xl bg-pink-50/55 px-2.5 py-1.5 border border-pink-100"
                              >
                                <Link
                                  href={`/members/${b.id}`}
                                  onClick={handleAcknowledgeSummary}
                                  className="font-semibold hover:underline truncate"
                                >
                                  {b.name}
                                </Link>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-[11px] font-medium text-pink-800 tabular-nums">
                                    {b.dateLabel} ·{" "}
                                    {b.diffDays === 0 ? (
                                      <strong className="text-pink-700">Danas!</strong>
                                    ) : b.diffDays === 1 ? (
                                      "Sutra"
                                    ) : (
                                      `za ${b.diffDays} dana`
                                    )}
                                  </span>
                                  {b.member.doNotContact ? (
                                    <span
                                      className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800 cursor-help"
                                      title={`Na izričitu napomenu član je zatražio da ga se ne kontaktira${
                                        b.member.doNotContactDate
                                          ? ` (${formatDateDMY(b.member.doNotContactDate, b.member.doNotContactDate)})`
                                          : ""
                                      }`}
                                    >
                                      Ne kontaktirati
                                    </span>
                                  ) : (user?.role === "admin" || user?.role === "moderator") && b.member.email ? (
                                    <button
                                      type="button"
                                      onClick={() => setBirthdayMember(b.member)}
                                      title={
                                        b.member.lastBirthdayEmailAt
                                          ? `Zadnja čestitka poslana: ${formatDateTimeDMY(
                                              b.member.lastBirthdayEmailAt
                                            )}`
                                          : "Pregledaj predložak i pošalji rođendansku čestitku"
                                      }
                                      className={cn(
                                        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition-colors cursor-pointer",
                                        sentThisYear
                                          ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                                          : "bg-pink-600 text-white hover:bg-pink-700"
                                      )}
                                    >
                                      <Mail className="h-2.5 w-2.5" />
                                      {sentThisYear ? "Čestitka poslana" : "Pošalji čestitku"}
                                    </button>
                                  ) : null}
                                </div>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    </div>
                  )}

                  {summaryData.newMembers > 0 && (
                    <div className="p-3.5 rounded-2xl border border-blue-200 bg-white flex items-start gap-3 shadow-2xs">
                      <div className="p-2 rounded-xl bg-blue-100 text-blue-700 shrink-0">
                        <Users className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-blue-950">
                          {summaryData.newMembers} novih članova upisano
                        </p>
                        {summaryData.newMemberNames && summaryData.newMemberNames.length > 0 && (
                          <p className="text-xs text-blue-800/80 mt-0.5">
                            {summaryData.newMemberNames.join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {summaryData.newLectures > 0 && (
                    <div className="p-3.5 rounded-2xl border border-indigo-200 bg-white flex items-start gap-3 shadow-2xs">
                      <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700 shrink-0">
                        <Mic className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-indigo-950">
                          {summaryData.newLectures} novih predavanja / druženja najavljeno
                        </p>
                        {summaryData.newLectureTitles && summaryData.newLectureTitles.length > 0 && (
                          <p className="text-xs text-indigo-800/80 mt-0.5">
                            {summaryData.newLectureTitles.join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {summaryData.newPaymentsCount > 0 && (
                    <div className="p-3.5 rounded-2xl border border-emerald-200 bg-white flex items-start gap-3 shadow-2xs">
                      <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700 shrink-0">
                        <Euro className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-emerald-950">
                          Zabilježeno {summaryData.newPaymentsCount} uplata članarina
                        </p>
                        <p className="text-xs text-emerald-800/80 mt-0.5 tabular-nums">
                          Ukupno prikupljeno: <strong>{summaryData.newPaymentsTotal} €</strong>
                        </p>
                      </div>
                    </div>
                  )}

                  {summaryData.newMeetings > 0 && (
                    <div className="p-3.5 rounded-2xl border border-purple-200 bg-white flex items-start gap-3 shadow-2xs">
                      <div className="p-2 rounded-xl bg-purple-100 text-purple-700 shrink-0">
                        <Calendar className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-purple-950">
                          {summaryData.newMeetings} novih sjednica zakazano
                        </p>
                        {summaryData.newMeetingTitles && summaryData.newMeetingTitles.length > 0 && (
                          <p className="text-xs text-purple-800/80 mt-0.5">
                            {summaryData.newMeetingTitles.join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {summaryData.newVotesCount > 0 && (
                    <div className="p-3.5 rounded-2xl border border-amber-200 bg-white flex items-start gap-3 shadow-2xs">
                      <div className="p-2 rounded-xl bg-amber-100 text-amber-700 shrink-0">
                        <CheckSquare className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-amber-950">
                          {summaryData.newVotesCount} novih glasovanja za odbor
                        </p>
                        {summaryData.newVoteTitles && summaryData.newVoteTitles.length > 0 && (
                          <p className="text-xs text-amber-800/80 mt-0.5">
                            {summaryData.newVoteTitles.join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {summaryData.newProjects > 0 && (
                    <div className="p-3.5 rounded-2xl border border-amber-200 bg-white flex items-start gap-3 shadow-2xs">
                      <div className="p-2 rounded-xl bg-amber-100 text-amber-700 shrink-0">
                        <FolderKanban className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-amber-950">
                          {summaryData.newProjects} novih projekata
                        </p>
                      </div>
                    </div>
                  )}

                  {(summaryData.newBooks > 0 ||
                    summaryData.updatedBooks > 0 ||
                    summaryData.newVideos > 0) && (
                    <div className="p-3.5 rounded-2xl border border-[#E8E4DE] bg-white flex items-start gap-3 shadow-2xs">
                      <div className="p-2 rounded-xl bg-slate-100 text-slate-700 shrink-0">
                        <BookOpen className="h-4 w-4" />
                      </div>
                      <div className="text-xs text-slate-800">
                        <p className="font-bold">Knjižnica i multimedija:</p>
                        <p className="mt-0.5">
                          {summaryData.newBooks > 0 && `${summaryData.newBooks} novih knjiga. `}
                          {summaryData.updatedBooks > 0 && `${summaryData.updatedBooks} ažuriranih zapisa. `}
                          {summaryData.newVideos > 0 && `${summaryData.newVideos} novih video zapisa.`}
                        </p>
                      </div>
                    </div>
                  )}

                  {summaryTab === "society" && summaryCounts.society === 0 && (
                    <div className="py-8 text-center text-muted-foreground space-y-2">
                      <CheckCircle className="h-10 w-10 text-emerald-600 mx-auto opacity-80" />
                      <p className="font-semibold text-sm text-[#1B2B36]">
                        Nema novih događaja u društvu ni nadolazećih rođendana
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Empty state ako nema nikakvih novosti na tabu "Sve" */}
              {summaryTab === "all" &&
                (!summaryData.totalNew || summaryData.totalNew === 0) &&
                upcomingBirthdays.length === 0 &&
                (!summaryData.submittedDataForms || summaryData.submittedDataForms.length === 0) &&
                (!summaryData.viewedDataForms || summaryData.viewedDataForms.length === 0) &&
                !summaryData.newEmailsCount &&
                !summaryData.newMembers &&
                !summaryData.newMeetings &&
                !summaryData.newLectures &&
                !summaryData.newPaymentsCount &&
                !summaryData.newVotesCount &&
                !summaryData.newInquiriesCount &&
                !summaryData.newVideos &&
                !summaryData.newBooks &&
                !summaryData.newProjects && (
                  <div className="py-8 text-center text-muted-foreground space-y-2">
                    <CheckCircle className="h-10 w-10 text-emerald-600 mx-auto opacity-80" />
                    <p className="font-semibold text-sm text-[#1B2B36]">Sve je ažurno!</p>
                    <p className="text-xs">
                      Nema novih promjena u sustavu od vašeg posljednjeg prijavljivanja i potvrde.
                    </p>
                  </div>
                )}
            </div>

            <ModalActionFooter
              right={<FinishActionButton label="Potvrdi i zatvori" onClick={handleAcknowledgeSummary} />}
            />
          </div>
        </>
      )}

      <BirthdayEmailDialog
        member={birthdayMember}
        open={!!birthdayMember}
        onOpenChange={(open) => !open && setBirthdayMember(null)}
      />

      {(canSendBoardAnnouncement || canViewBoardHistory) && (
        <BoardAnnouncementDialog
          open={boardAnnouncementOpen}
          onOpenChange={setBoardAnnouncementOpen}
          initialMessage={boardAnnouncementInitialText}
          initialTab={boardAnnouncementInitialTab}
        />
      )}
    </>
  )
}
