"use client"

import React, { useMemo, useState, useEffect } from "react"
import Link from "next/link"
import { 
  Search, User, Settings, Lock, Users, FolderKanban, FileText, UserPlus, 
  Upload, ChevronLeft, ChevronRight, FileDown, TrendingUp, AlertCircle, 
  UserX, CheckCircle, Calendar, Clock, MapPin, Video, BookOpen, 
  Link as LinkIcon, Sparkles, X, ShieldAlert, Award, Euro, MessageSquare, 
  Activity, Check, Edit2, AlertTriangle, PlusCircle, CheckSquare,
  HeartHandshake, Heart
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { formatDateShort, getMemberActiveFunctions } from "@/lib/utils"
import { AddMemberDialog } from "@/components/add-member-dialog"
import { useMembers } from "@/contexts/members-context"
import { useMeetings } from "@/contexts/meetings-context"
import { useLectures } from "@/contexts/lectures-context"
import { useAuth } from "@/contexts/auth-context"
import { useSettings } from "@/contexts/settings-context"
import { useActivityLog } from "@/contexts/activity-log-context"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

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
  const [pendingPolls, setPendingPolls] = useState<any[]>([])

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
    targetPurpose: 'Specijalizirani knjižni skener i oprema za digitalizaciju arhivske građe'
  })

  // Board Noticeboard editing state
  const [isEditingNotice, setIsEditingNotice] = useState(false)
  const [noticeDraft, setNoticeDraft] = useState("")
  const [isSavingNotice, setIsSavingNotice] = useState(false)

  const canEditNotice = user?.role === "admin" || user?.role === "moderator"

  useEffect(() => {
    setMounted(true)
    if (settings.boardNotice) {
      setNoticeDraft(settings.boardNotice)
    }
  }, [settings.boardNotice])

  // Fetch donation stats for dashboard (public for all authenticated members)
  useEffect(() => {
    if (mounted) {
      fetch('/api/donations/stats')
        .then(res => res.json())
        .then(data => {
          if (data && typeof data.totalDonatedEur === 'number') {
            setDonationStats(data)
          }
        })
        .catch(() => {})
    }
  }, [mounted])

  // Check pending polls for the user
  useEffect(() => {
    if (!user) return
    fetch(`/api/polls?memberId=${user.id}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setPendingPolls(data)
        }
      })
      .catch(err => console.error("Failed to fetch pending polls:", err))
  }, [user])

  // Fetch summary of what's new
  const fetchSummary = (forceModal = false) => {
    if (!user) return
    fetch(`/api/dashboard/summary?userId=${user.id}`)
      .then(res => res.json())
      .then(data => {
        setSummaryData(data)
        if (forceModal) {
          setShowSummaryModal(true)
        } else {
          const sessionKey = `shown_login_summary_${user.id}`
          const alreadyShown = sessionStorage.getItem(sessionKey)
          if (!alreadyShown) {
            if (
              data.newMembers > 0 ||
              data.newMeetings > 0 ||
              data.newPaymentsCount > 0 ||
              data.newVotesCount > 0 ||
              data.newInquiriesCount > 0 ||
              data.newVideos > 0 ||
              data.newBooks > 0 ||
              data.newProjects > 0
            ) {
              setShowSummaryModal(true)
            } else {
              sessionStorage.setItem(sessionKey, 'true')
            }
          }
        }
      })
      .catch(err => console.error('Failed to fetch dashboard summary:', err))
  }

  useEffect(() => {
    if (mounted && user) {
      fetchSummary(false)
    }
  }, [mounted, user])

  const handleCloseSummary = () => {
    if (user) {
      sessionStorage.setItem(`shown_login_summary_${user.id}`, 'true')
    }
    setShowSummaryModal(false)
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
    const societyMembers = members.filter(m => m.role !== 'admin')
    
    if (!societyMembers || societyMembers.length === 0) {
      return { 
        total: 0, 
        active: 0, 
        overdue: 0, 
        expelled: 0, 
        newThisMonth: 0, 
        growth: 0, 
        chartData: [],
        thisYearCollected: 0,
        activeFunctionsCount: 0
      }
    }

    const total = societyMembers.length
    const active = societyMembers.filter(m => m.status === 'active').length
    const overdue = societyMembers.filter(m => m.paymentStatus === 'overdue').length
    const expelled = societyMembers.filter(m => m.expelled).length
    
    // Active functions count
    const activeFunctionsCount = societyMembers.filter(m => getMemberActiveFunctions(m).length > 0).length

    // Finances for current year
    const currentYear = new Date().getFullYear()
    const allPayments = societyMembers.flatMap(m => m.payments || [])
    const thisYearPayments = allPayments.filter(p => {
      if (!p.date) return false
      return new Date(p.date).getFullYear() === currentYear
    })
    const thisYearCollected = thisYearPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0)

    // New members this month vs last month
    const now = new Date()
    const thisMonth = now.getMonth()
    const thisYear = now.getFullYear()
    
    const lastMonthDate = new Date()
    lastMonthDate.setMonth(now.getMonth() - 1)
    const lastMonth = lastMonthDate.getMonth()
    const lastMonthYear = lastMonthDate.getFullYear()

    const newThisMonth = societyMembers.filter(m => {
      const d = new Date(m.joinDate)
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear
    }).length

    const newLastMonth = societyMembers.filter(m => {
      const d = new Date(m.joinDate)
      return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear
    }).length

    const growth = newLastMonth === 0 ? (newThisMonth * 100) : Math.round(((newThisMonth - newLastMonth) / newLastMonth) * 100)

    // Chart data for last 12 months
    const monthNames = ["Sij", "Velj", "Ožu", "Tra", "Svi", "Lip", "Srp", "Kol", "Ruj", "Lis", "Stu", "Pro"]
    const chartData = []
    
    for (let i = 11; i >= 0; i--) {
      const d = new Date()
      d.setMonth(now.getMonth() - i)
      const m = d.getMonth()
      const y = d.getFullYear()
      
      const count = societyMembers.filter(member => {
        const jd = new Date(member.joinDate)
        return jd.getMonth() === m && jd.getFullYear() === y
      }).length
      
      chartData.push({
        name: monthNames[m],
        prijave: count
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
      activeFunctionsCount
    }
  }, [members])

  const nextMeeting = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return meetings
      .filter(m => m.status === 'scheduled' && m.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null
  }, [meetings])

  const upcomingLectures = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return lectures
      .filter(l => l.status === 'scheduled' && l.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [lectures])

  const recentLogs = useMemo(() => {
    return (logs || []).slice(0, 5)
  }, [logs])

  return (
    <>
      <main className="flex-1 min-w-0 overflow-auto bg-[#fafafa]">
        {/* Top Navigation */}
        <header className="hidden md:block md:sticky md:top-0 md:z-10 border-b border-border bg-white/85 backdrop-blur-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between px-4 md:px-8 py-3.5 gap-4 md:gap-0">
            <div className="flex items-center gap-6">
              <h1 className="font-serif text-lg font-bold uppercase tracking-tight text-primary">HRD Uprava</h1>
              <nav className="flex items-center gap-1">
                <Link href="/" className="border-b-2 border-primary px-3 py-1.5 text-xs font-bold text-primary">Nadzorna ploča</Link>
                {(user?.role === 'admin' || user?.accessRights?.members?.view) && (
                  <Link href="/members" className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">Članovi</Link>
                )}
                <Link href="/meetings" className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">Sjednice</Link>
                {(user?.role === 'admin' || user?.accessRights?.projects?.view) && (
                  <Link href="/projects" className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">Projekti</Link>
                )}
                {(user?.role === 'admin' || user?.accessRights?.archive?.view) && (
                  <Link href="/archive" className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">Arhiv</Link>
                )}
              </nav>
            </div>

            <div className="flex items-center gap-3">
              {/* Button to reopen "What's new" summary */}
              <button
                onClick={() => fetchSummary(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200/80 hover:bg-amber-100 hover:border-amber-300 transition-all shadow-sm"
                title="Pogledajte sažetak promjena od zadnje prijave"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-600 animate-pulse" />
                <span>Što je novo?</span>
              </button>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input 
                  placeholder="Pretraži sustav..." 
                  className="w-56 border-border bg-muted/40 pl-9 h-8 text-xs rounded-full focus:bg-background transition-all"
                />
              </div>
            </div>
          </div>
        </header>

        {/* Action Required Banner: Unvoted Polls */}
        {pendingPolls.length > 0 && (
          <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white px-4 md:px-8 py-3 shadow-md">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 max-w-7xl mx-auto">
              <div className="flex items-center gap-2.5">
                <div className="p-1 rounded-full bg-white/20">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <p className="text-xs md:text-sm font-semibold">
                  <strong>Hitna akcija:</strong> Imate {pendingPolls.length} otvoreno glasovanje na sjednici na koje još niste dali svoj glas!
                </p>
              </div>
              <Link href="/meetings">
                <Button size="sm" variant="secondary" className="rounded-full text-xs font-bold h-7 px-4 shadow">
                  Glasuj odmah →
                </Button>
              </Link>
            </div>
          </div>
        )}

        <div className="p-4 md:p-8 pb-16 max-w-7xl mx-auto space-y-6">
          {/* Page Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="h-px w-6 bg-accent" />
                <p className="text-[10px] text-accent font-bold uppercase tracking-[0.2em]">
                  Hrvatsko rodoslovno društvo „Pavao Ritter Vitezović”
                </p>
              </div>
              <h2 className="font-serif text-3xl md:text-4xl font-bold tracking-tight text-primary">
                Nadzorna ploča
              </h2>
              <p className="mt-1 text-xs md:text-sm text-muted-foreground">
                Dobrodošli natrag, <strong className="text-foreground">{user?.name}</strong> ({user?.role === 'admin' ? 'Administrator' : 'Član odbora'}).
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5">
              {(user?.role === 'admin' || user?.accessRights?.members?.edit) && (
                <AddMemberDialog>
                  <Button size="sm" className="rounded-full px-4 shadow-sm hover:scale-105 transition-all text-xs font-bold">
                    <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Dodaj člana
                  </Button>
                </AddMemberDialog>
              )}

              <Link href="/meetings">
                <Button size="sm" variant="outline" className="rounded-full px-4 border-border bg-white hover:bg-muted text-xs font-bold">
                  <Calendar className="mr-1.5 h-3.5 w-3.5" /> Sjednice
                </Button>
              </Link>

              {(user?.role === 'admin' || user?.accessRights?.projects?.edit) && (
                <Link href="/projects">
                  <Button size="sm" variant="outline" className="rounded-full px-4 border-border bg-white hover:bg-muted text-xs font-bold">
                    <PlusCircle className="mr-1.5 h-3.5 w-3.5" /> Novi upit / projekt
                  </Button>
                </Link>
              )}
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
            {/* 1. Members */}
            <Link 
              href="/members" 
              className="group rounded-2xl border border-border bg-white p-4 md:p-5 shadow-sm transition-all hover:shadow-lg hover:-translate-y-0.5 block"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Users className="h-4 w-4" />
                </div>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase">
                  {stats.active} aktivnih
                </span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Ukupno članova
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="font-serif text-3xl font-bold text-primary">{stats.total}</span>
                <span className="text-[11px] font-bold text-emerald-600">
                  +{stats.newThisMonth} ovaj mj.
                </span>
              </div>
            </Link>

            {/* 2. Finances / Payments this Year */}
            <Link 
              href="/members?paymentStatus=overdue" 
              className="group rounded-2xl border border-border bg-white p-4 md:p-5 shadow-sm transition-all hover:shadow-lg hover:-translate-y-0.5 block"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <Euro className="h-4 w-4" />
                </div>
                <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full uppercase">
                  {stats.overdue} dugovanja
                </span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Članarine ({new Date().getFullYear()}.)
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="font-serif text-3xl font-bold text-primary">{stats.thisYearCollected} €</span>
                <span className="text-[10px] text-muted-foreground font-semibold">Prikupljeno</span>
              </div>
            </Link>

            {/* 3. Donacije za digitalizaciju */}
            <div 
              onClick={() => {
                if (user?.role === 'admin') {
                  window.location.href = '/admin/donations'
                }
              }}
              className={cn(
                "group rounded-2xl border border-rose-200/80 bg-gradient-to-br from-rose-50/50 via-white to-amber-50/30 p-4 md:p-5 shadow-sm transition-all hover:shadow-lg hover:-translate-y-0.5 block",
                user?.role === 'admin' ? "cursor-pointer" : "cursor-default"
              )}
              title={user?.role === 'admin' ? "Otvori modul donacija (Admin)" : "Namjenske donacije za opremu i digitalizaciju"}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-xl bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white transition-colors">
                  <HeartHandshake className="h-4 w-4" />
                </div>
                <span className="text-[10px] font-bold text-rose-700 bg-rose-100/70 px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
                  <Heart className="h-2.5 w-2.5 fill-rose-600" />
                  {donationStats.donorCount} uplate
                </span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Donacije / Digitalizacija
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="font-serif text-3xl font-bold text-rose-600">
                  {donationStats.totalDonatedEur.toFixed(2)} €
                </span>
                <span className="text-[10px] text-muted-foreground font-semibold">
                  {donationStats.sentCount} poslanih
                </span>
              </div>
            </div>

            {/* 4. Active Board Functions & Mandates */}
            <Link 
              href="/members" 
              className="group rounded-2xl border border-border bg-white p-4 md:p-5 shadow-sm transition-all hover:shadow-lg hover:-translate-y-0.5 block"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                  <Award className="h-4 w-4" />
                </div>
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full uppercase">
                  Mandat aktivan
                </span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Tijela i dužnosti
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="font-serif text-3xl font-bold text-primary">{stats.activeFunctionsCount}</span>
                <span className="text-[10px] text-muted-foreground font-semibold">Dužnosnika</span>
              </div>
            </Link>

            {/* 5. Meetings & Decisions */}
            <Link 
              href="/meetings" 
              className="group rounded-2xl border border-border bg-white p-4 md:p-5 shadow-sm transition-all hover:shadow-lg hover:-translate-y-0.5 block"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-xl bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                  <Calendar className="h-4 w-4" />
                </div>
                <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full uppercase">
                  {nextMeeting ? "Zakazano" : "Uredno"}
                </span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Sjednice društva
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="font-serif text-3xl font-bold text-primary">{meetings.length}</span>
                <span className="text-[10px] text-muted-foreground font-semibold">
                  {nextMeeting ? `Iduća: ${formatDateShort(nextMeeting.date)}` : "Nema novih"}
                </span>
              </div>
            </Link>
          </div>

          {/* Main Layout: 2 Columns */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column (2 spans): Next Meeting, Lectures & Growth Chart */}
            <div className="lg:col-span-2 space-y-6">
              {/* Next Meeting Widget */}
              {nextMeeting ? (
                <div className="rounded-3xl border border-amber-200/80 bg-gradient-to-br from-amber-50/50 to-white p-5 md:p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm">
                        <Calendar className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                          Sljedeća sjednica
                        </p>
                        <h4 className="font-serif text-lg font-bold text-primary leading-tight">
                          {nextMeeting.title}
                        </h4>
                      </div>
                    </div>
                    <Link href="/meetings">
                      <Button size="sm" variant="outline" className="rounded-full text-xs font-bold h-7 bg-white">
                        Otvori sjednicu →
                      </Button>
                    </Link>
                  </div>

                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mb-4 pt-1">
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      <Calendar className="h-3.5 w-3.5 text-amber-600" />
                      {new Date(nextMeeting.date).toLocaleDateString('hr-HR', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </span>
                    {nextMeeting.start_time && (
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        {nextMeeting.start_time}{nextMeeting.end_time ? `–${nextMeeting.end_time}` : ''}
                      </span>
                    )}
                    {nextMeeting.location && (
                      <span className="flex items-center gap-1.5 truncate max-w-xs">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                        {nextMeeting.location}
                      </span>
                    )}
                  </div>

                  {nextMeeting.agenda && nextMeeting.agenda.length > 0 && (
                    <div className="border-t border-amber-200/50 pt-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Dnevni red ({nextMeeting.agenda.length} točaka)
                        </span>
                      </div>
                      <ul className="space-y-1">
                        {nextMeeting.agenda.slice(0, 3).map((item: any, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[9px] font-bold text-amber-800 mt-0.5">
                              {i + 1}
                            </span>
                            <span className="line-clamp-1 text-foreground/90">{item.text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-border bg-white p-6 text-center">
                  <Calendar className="mx-auto h-8 w-8 text-muted-foreground/30 mb-1" />
                  <p className="text-sm font-semibold text-primary">Nema zakazanih budućih sjednica</p>
                  <Link href="/meetings" className="text-xs text-accent hover:underline font-bold mt-1 inline-block">
                    Zakaži sjednicu →
                  </Link>
                </div>
              )}

              {/* Monthly Trend Chart */}
              <div className="rounded-3xl border border-border bg-white p-5 md:p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-serif text-xl font-bold text-primary">Prijave novih članova</h3>
                    <p className="text-xs text-muted-foreground">Trend registracije članova po mjesecima kroz zadnjih 12 mjeseci</p>
                  </div>
                  <Badge variant="outline" className="rounded-full text-[10px]">
                    12 mjeseci
                  </Badge>
                </div>

                <div className="h-[240px] w-full">
                  {mounted ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#c5a059" stopOpacity={0.9}/>
                            <stop offset="100%" stopColor="#c5a059" stopOpacity={0.2}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis 
                          dataKey="name" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 11, fontWeight: 500, fill: '#888' }} 
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 11, fontWeight: 500, fill: '#888' }} 
                        />
                        <Tooltip 
                          cursor={{ fill: '#f9f9f9' }}
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 16px -2px rgba(0,0,0,0.08)' }}
                        />
                        <Bar dataKey="prijave" radius={[6, 6, 0, 0]} barSize={22}>
                          {stats.chartData.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={index === (stats.chartData.length - 1) ? '#c5a059' : '#e5e5e5'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-muted/10 rounded-xl">
                      <p className="text-xs text-muted-foreground">Učitavanje grafikona...</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Upcoming Lectures */}
              <div className="rounded-3xl border border-border bg-white p-5 md:p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-serif text-xl font-bold text-primary">Predstojeća predavanja</h3>
                    <p className="text-xs text-muted-foreground">Najave predavanja i tribina društva</p>
                  </div>
                  <Link href="/lectures">
                    <Button variant="ghost" size="sm" className="text-accent gap-1 text-xs font-bold uppercase tracking-wider h-7">
                      Sva predavanja <ChevronRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>

                <div className="space-y-2.5">
                  {upcomingLectures.length > 0 ? (
                    upcomingLectures.slice(0, 3).map((l) => {
                      const [y, m, d] = l.date.split("-").map(Number)
                      const date = new Date(y, m - 1, d)
                      const month = date.toLocaleDateString('hr-HR', { month: 'short' }).toUpperCase()
                      
                      return (
                        <div key={l.id} className="flex items-center gap-3.5 p-2 rounded-2xl hover:bg-muted/30 transition-colors">
                          <div className="flex flex-col items-center justify-center w-11 h-12 rounded-xl bg-accent/10 border border-accent/20 text-accent font-bold shrink-0">
                            <span className="text-[10px] uppercase leading-none">{month}</span>
                            <span className="text-lg leading-tight mt-0.5">{d}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h5 className="text-xs md:text-sm font-bold text-primary truncate">{l.title}</h5>
                            <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                              <span><Clock className="h-3 w-3 inline mr-1" />{l.start_time || "18:00"}</span>
                              {l.location && <span className="truncate max-w-[200px]"><MapPin className="h-3 w-3 inline mr-1" />{l.location}</span>}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                      Trenutno nema zakazanih predavanja.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Board Noticeboard & Activity Stream */}
            <div className="space-y-6">
              {/* 1. Board Noticeboard (Interna oglasna ploča odbora) */}
              <div className="rounded-3xl border border-amber-300/80 bg-gradient-to-br from-amber-500/10 via-amber-50/50 to-white p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-xl bg-amber-500 text-white shadow-sm">
                      <MessageSquare className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-serif text-base font-bold text-primary leading-tight">
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
                      variant="ghost"
                      onClick={() => setIsEditingNotice(true)}
                      className="h-7 text-xs font-bold text-amber-800 hover:bg-amber-100 rounded-full"
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
                      className="w-full rounded-2xl border border-amber-300 bg-white p-3 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                      value={noticeDraft}
                      onChange={(e) => setNoticeDraft(e.target.value)}
                    />
                    <div className="flex items-center justify-between">
                      {settings.boardNotice && (
                        <button
                          type="button"
                          onClick={handleClearNotice}
                          disabled={isSavingNotice}
                          className="text-[11px] text-red-600 hover:underline font-semibold"
                        >
                          Ukloni obavijest
                        </button>
                      )}
                      <div className="flex gap-2 ml-auto">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setNoticeDraft(settings.boardNotice || "")
                            setIsEditingNotice(false)
                          }}
                          className="h-7 text-xs rounded-full"
                        >
                          Odustani
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSaveNotice}
                          disabled={isSavingNotice}
                          className="h-7 text-xs rounded-full px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold"
                        >
                          {isSavingNotice ? "Spremanje..." : "Objavi"}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : settings.boardNotice ? (
                  <div className="space-y-2">
                    <div className="p-3.5 rounded-2xl bg-white border border-amber-200/80 text-xs text-foreground leading-relaxed shadow-xs whitespace-pre-wrap">
                      {settings.boardNotice}
                    </div>
                    {settings.boardNoticeAuthor && (
                      <p className="text-[10px] text-muted-foreground text-right italic">
                        Objavio/la: {settings.boardNoticeAuthor}{" "}
                        {settings.boardNoticeDate && `(${new Date(settings.boardNoticeDate).toLocaleDateString('hr-HR')})`}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    <p className="italic">Trenutno nema aktivnih napomena za članove odbora.</p>
                    {canEditNotice && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsEditingNotice(true)}
                        className="mt-2.5 rounded-full text-xs font-bold border-amber-200 hover:bg-amber-50"
                      >
                        + Dodaj obavijest za odbor
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* 2. Donacijski fond & Digitalizacija baštine */}
              <div className="rounded-3xl border border-rose-200/80 bg-gradient-to-br from-rose-50/50 via-white to-amber-50/40 p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-xl bg-rose-500 text-white shadow-sm">
                      <HeartHandshake className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-serif text-base font-bold text-primary leading-tight">
                        Donacijski fond društva
                      </h4>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                        Digitalizacija rodoslovne baštine
                      </p>
                    </div>
                  </div>
                  {user?.role === "admin" && (
                    <Link href="/admin/donations">
                      <Button size="sm" variant="outline" className="h-7 text-xs font-bold rounded-full bg-white hover:bg-rose-50 border-rose-200 text-rose-700">
                        Upravljanje →
                      </Button>
                    </Link>
                  )}
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  Namjensko prikupljanje sredstava za nabavu profesionalnog A3 knjižnog skenera i opreme za trajnu digitalizaciju matičnih knjiga.
                </p>

                {/* Progress bar */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-rose-700 dark:text-rose-400 font-bold">
                      {donationStats.totalDonatedEur.toFixed(2)} € prikupljeno
                    </span>
                    <span className="text-muted-foreground text-[11px]">
                      Cilj: {donationStats.targetEur || 5000} €
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden border">
                    <div 
                      className="h-full bg-gradient-to-r from-rose-500 to-amber-500 rounded-full transition-all duration-500"
                      style={{ 
                        width: `${Math.min(100, Math.max(4, Math.round((donationStats.totalDonatedEur / (donationStats.targetEur || 5000)) * 100)))}%` 
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-rose-100 text-center">
                  <div className="p-2 rounded-xl bg-white/80 border border-rose-100">
                    <div className="text-[10px] font-bold uppercase text-muted-foreground">Donatora</div>
                    <div className="text-base font-bold text-foreground mt-0.5">{donationStats.donorCount}</div>
                  </div>
                  <div className="p-2 rounded-xl bg-white/80 border border-rose-100">
                    <div className="text-[10px] font-bold uppercase text-muted-foreground">Poslano</div>
                    <div className="text-base font-bold text-foreground mt-0.5">{donationStats.sentCount}</div>
                  </div>
                  <div className="p-2 rounded-xl bg-white/80 border border-rose-100">
                    <div className="text-[10px] font-bold uppercase text-muted-foreground">Baza tvrtki</div>
                    <div className="text-base font-bold text-foreground mt-0.5">{donationStats.totalLeads}</div>
                  </div>
                </div>
              </div>

              {/* 3. Activity Stream (Zadnje aktivnosti) */}
              <div className="rounded-3xl border border-border bg-white p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-xl bg-slate-100 text-slate-700">
                      <Activity className="h-4 w-4" />
                    </div>
                    <h4 className="font-serif text-base font-bold text-primary">Zadnje aktivnosti</h4>
                  </div>
                  {user?.role === "admin" && (
                    <Link href="/logs" className="text-[11px] font-bold text-accent hover:underline">
                      Svi logovi →
                    </Link>
                  )}
                </div>

                <div className="space-y-3">
                  {recentLogs.length > 0 ? (
                    recentLogs.map((log) => (
                      <div key={log.id} className="text-xs p-2.5 rounded-xl border border-border/50 bg-muted/20 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-primary truncate max-w-[150px]">{log.action}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(log.timestamp).toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-1">{log.details}</p>
                        <p className="text-[10px] text-muted-foreground/70 font-mono">Korisnik: {log.userName}</p>
                      </div>
                    ))
                  ) : (
                    <div className="py-6 text-center text-xs text-muted-foreground">
                      Nema nedavnih zabilježenih aktivnosti.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Executive Briefing Modal: Što je novo od zadnje prijave */}
      {showSummaryModal && summaryData && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm transition-opacity" onClick={handleCloseSummary} />
          <div className="fixed left-1/2 top-1/2 z-[70] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-border bg-white p-6 md:p-8 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95">
            <button onClick={handleCloseSummary} className="absolute right-4 top-4 rounded-full bg-secondary p-2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 border border-amber-300/40">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-serif text-2xl font-bold text-primary">Što je novo u društvu?</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {summaryData.hasPreviousLogin 
                    ? `Pregled promjena od vaše zadnje odjave (${new Date(summaryData.previousLoginTime).toLocaleString('hr-HR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })})`
                    : 'Pregled aktivnosti u proteklih 7 dana'}
                </p>
              </div>
            </div>

            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              {/* New Members */}
              {summaryData.newMembers > 0 && (
                <div className="p-3.5 rounded-2xl border border-blue-100 bg-blue-50/50 flex items-start gap-3">
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

              {/* New Payments */}
              {summaryData.newPaymentsCount > 0 && (
                <div className="p-3.5 rounded-2xl border border-emerald-100 bg-emerald-50/50 flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700 shrink-0">
                    <Euro className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-emerald-950">
                      Zabilježeno {summaryData.newPaymentsCount} uplata članarina
                    </p>
                    <p className="text-xs text-emerald-800/80 mt-0.5">
                      Ukupno prikupljeno: <strong>{summaryData.newPaymentsTotal} €</strong>
                    </p>
                  </div>
                </div>
              )}

              {/* New Meetings */}
              {summaryData.newMeetings > 0 && (
                <div className="p-3.5 rounded-2xl border border-purple-100 bg-purple-50/50 flex items-start gap-3">
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

              {/* New Votes / Polls */}
              {summaryData.newVotesCount > 0 && (
                <div className="p-3.5 rounded-2xl border border-amber-100 bg-amber-50/50 flex items-start gap-3">
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

              {/* New Inquiries */}
              {summaryData.newInquiriesCount > 0 && (
                <div className="p-3.5 rounded-2xl border border-orange-100 bg-orange-50/50 flex items-start gap-3">
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

              {/* Books & Videos */}
              {(summaryData.newBooks > 0 || summaryData.updatedBooks > 0 || summaryData.newVideos > 0) && (
                <div className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 flex items-start gap-3">
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
            </div>

            <div className="mt-6 flex justify-end">
              <Button onClick={handleCloseSummary} className="rounded-full px-8 font-bold">
                U redu, pregledano
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
