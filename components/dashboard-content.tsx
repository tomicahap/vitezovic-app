"use client"

import React, { useMemo } from "react"
import Link from "next/link"
import { Search, User, Settings, Lock, Users, FolderKanban, FileText, UserPlus, Upload, ChevronLeft, ChevronRight, FileDown, TrendingUp, AlertCircle, UserX, CheckCircle, Calendar, Clock, MapPin, Video, BookOpen, Link as LinkIcon, Sparkles, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { formatDateShort } from "@/lib/utils"
import { AddMemberDialog } from "@/components/add-member-dialog"
import { useMembers } from "@/contexts/members-context"
import { useMeetings } from "@/contexts/meetings-context"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useAuth } from "@/contexts/auth-context"
import { useLectures } from "@/contexts/lectures-context"

export function DashboardContent() {
  const { members } = useMembers()
  const { meetings } = useMeetings()
  const { lectures } = useLectures()
  const { user } = useAuth()
  const [mounted, setMounted] = React.useState(false)
  const [summaryData, setSummaryData] = React.useState<any>(null)
  const [showSummaryModal, setShowSummaryModal] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    if (!mounted || !user) return

    const sessionKey = `shown_login_summary_${user.id}`
    const alreadyShown = sessionStorage.getItem(sessionKey)

    if (!alreadyShown) {
      fetch(`/api/dashboard/summary?userId=${user.id}`)
        .then(res => res.json())
        .then(data => {
          if (
            data.newMembers > 0 ||
            data.newMeetings > 0 ||
            data.newVideos > 0 ||
            data.newBooks > 0 ||
            data.updatedBooks > 0 ||
            data.newProjects > 0 ||
            data.newContacts > 0 ||
            data.newLinks > 0
          ) {
            setSummaryData(data)
            setShowSummaryModal(true)
          } else {
            sessionStorage.setItem(sessionKey, 'true')
          }
        })
        .catch(err => console.error('Failed to fetch dashboard summary:', err))
    }
  }, [mounted, user])

  const handleCloseSummary = () => {
    if (user) {
      sessionStorage.setItem(`shown_login_summary_${user.id}`, 'true')
    }
    setShowSummaryModal(false)
  }

  const stats = useMemo(() => {
    const societyMembers = members.filter(m => m.role !== 'admin')
    
    if (!societyMembers || societyMembers.length === 0) {
      return { total: 0, active: 0, overdue: 0, expelled: 0, newThisMonth: 0, growth: 0, chartData: [] }
    }

    const total = societyMembers.length
    const active = societyMembers.filter(m => m.status === 'active').length
    const overdue = societyMembers.filter(m => m.paymentStatus === 'overdue').length
    const expelled = societyMembers.filter(m => m.expelled).length
    
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

    return { total, active, overdue, expelled, newThisMonth, growth, chartData }
  }, [members])

  const nextMeeting = React.useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return meetings
      .filter(m => m.status === 'scheduled' && m.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null
  }, [meetings])

  const upcomingLectures = React.useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return lectures
      .filter(l => l.status === 'scheduled' && l.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [lectures])

  return (
    <>
      <main className="flex-1 overflow-auto bg-[#fafafa]">
      {/* Top Navigation */}
      <header className="sticky top-0 z-10 border-b border-border bg-white/80 backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between px-4 md:px-8 py-4 gap-4 md:gap-0">
          <div className="flex items-center gap-8">
            <h1 className="font-serif text-xl font-bold uppercase tracking-tight text-primary">Administracija društva</h1>
            <nav className="flex items-center gap-1">
              <Link href="/" className="border-b-2 border-primary px-4 py-2 text-sm font-bold text-primary">Nadzorna ploča</Link>
              {(user?.role === 'admin' || user?.accessRights?.members?.view) && (
                <Link href="/members" className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Članovi</Link>
              )}
              {(user?.role === 'admin' || user?.accessRights?.archive?.view) && (
                <Link href="/archive" className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Arhiv</Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input 
                placeholder="Pretraži sustav.." 
                className="w-64 border-border bg-muted/50 pl-10 h-9 rounded-full focus:bg-background transition-all"
              />
            </div>
          </div>
        </div>
      </header>

      <div className="p-4 md:p-8 pb-16">
        {/* Page Header */}
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="h-px w-8 bg-accent" />
              <p className="text-[10px] text-accent font-bold uppercase tracking-[0.2em]">
                Hrvatsko rodoslovno društvo Pavao Ritter Vitezović
              </p>
            </div>
            <h2 className="font-serif text-5xl font-bold tracking-tight text-primary">Nadzorna ploča</h2>
            <p className="mt-4 text-sm text-muted-foreground max-w-lg">
              Pregledajte ključne statistike rasta zajednice, financijsku urednost i nedavne aktivnosti unutar arhiva.
            </p>
          </div>
          <div className="flex gap-3">
             {(user?.role === 'admin' || user?.accessRights?.members?.edit) && (
               <AddMemberDialog>
                <Button className="rounded-full px-6 shadow-lg shadow-primary/10 transition-all hover:scale-105">
                  <UserPlus className="mr-2 h-4 w-4" /> Dodaj člana
                </Button>
               </AddMemberDialog>
             )}
             <Button variant="outline" className="rounded-full px-6 border-border bg-white hover:bg-muted">
                <FileDown className="mr-2 h-4 w-4" /> Izvještaj
             </Button>
          </div>
        </div>

        {/* Dynamic Stats Cards */}
        <div className="mb-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {(user?.role === 'admin' || user?.accessRights?.members?.view) ? (
            <>
              <Link href="/members" className="group rounded-2xl border border-border bg-white p-6 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1 block cursor-pointer">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                    <Users className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ukupno članova</p>
                </div>
                <div className="flex items-end justify-between">
                  <span className="font-serif text-4xl font-bold text-primary">{stats.total}</span>
                  <div className={`flex items-center gap-1 text-[10px] font-bold ${stats.growth >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {stats.growth >= 0 ? '+' : ''}{stats.growth}%
                    <TrendingUp className={`h-3 w-3 ${stats.growth < 0 ? 'rotate-180' : ''}`} />
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground font-medium">#{stats.newThisMonth} novih ovaj mjesec</p>
              </Link>

              <Link href="/members?status=active" className="group rounded-2xl border border-border bg-white p-6 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1 block cursor-pointer">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 transition-colors group-hover:bg-emerald-600 group-hover:text-white">
                    <CheckCircle className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Aktivni</p>
                </div>
                <div className="flex items-end justify-between">
                  <span className="font-serif text-4xl font-bold text-primary">{stats.active}</span>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase">Stabilno</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground font-medium">{stats.total > 0 ? Math.round((stats.active/stats.total)*100) : 0}% ukupnog sastava</p>
              </Link>

              <Link href="/members?paymentStatus=overdue" className="group rounded-2xl border border-border bg-white p-6 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1 block cursor-pointer">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-xl bg-red-50 text-red-600 transition-colors group-hover:bg-red-600 group-hover:text-white">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Dugovanja</p>
                </div>
                <div className="flex items-end justify-between">
                  <span className="font-serif text-4xl font-bold text-primary">{stats.overdue}</span>
                  <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full uppercase">Pažnja</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground font-medium">Zahtijeva podsjetnik</p>
              </Link>

              <Link href="/members?status=expired" className="group rounded-2xl border border-border bg-white p-6 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1 block cursor-pointer">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-xl bg-gray-100 text-gray-600 transition-colors group-hover:bg-gray-600 group-hover:text-white">
                    <UserX className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ispisano</p>
                </div>
                <div className="flex items-end justify-between">
                  <span className="font-serif text-4xl font-bold text-primary">{stats.expelled}</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground font-medium">Povijesni podatak</p>
              </Link>
            </>
          ) : (
            <div className="col-span-4 py-12 text-center rounded-2xl border border-dashed border-border bg-white/50">
              <Lock className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Nimate ovlasti za pregled statistike članstva.</p>
            </div>
          )}
        </div>


        {/* Lower Content: Chart & Activities */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Trend Chart */}
          <div className="lg:col-span-2 rounded-3xl border border-border bg-white p-8 shadow-sm">
            {(user?.role === 'admin' || user?.accessRights?.members?.view) ? (
              <>
                <div className="mb-8 flex items-center justify-between">
                  <div>
                    <h3 className="font-serif text-2xl font-bold text-primary">Nove prijave</h3>
                    <p className="text-sm text-muted-foreground">Trend registracije novih članova po mjesecima (zadnjih 12 mj.)</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="rounded-full">Mesečni trend</Badge>
                  </div>
                </div>
                <div className="h-[300px] w-full">
                  {mounted ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#c5a059" stopOpacity={0.8}/>
                            <stop offset="100%" stopColor="#c5a059" stopOpacity={0.2}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis 
                          dataKey="name" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 12, fontWeight: 500, fill: '#888' }} 
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 12, fontWeight: 500, fill: '#888' }} 
                        />
                        <Tooltip 
                          cursor={{ fill: '#f9f9f9' }}
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                        />
                        <Bar dataKey="prijave" radius={[6, 6, 0, 0]} barSize={24}>
                          {stats.chartData.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={index === (stats.chartData.length - 1) ? '#c5a059' : '#e5e5e5'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-muted/20 rounded-xl">
                      <p className="text-xs text-muted-foreground">Učitavanje grafikona...</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-muted-foreground">Trendovi su dostupni samo administratorima i voditeljima članstva.</p>
              </div>
            )}
          </div>

          {/* Right Column: Meetings & Lectures */}
          <div className="space-y-6">
            {/* Next Meeting Widget */}
            {(user?.role === 'admin' || user?.accessRights?.meetings?.view) ? (
              nextMeeting ? (
                <Link href="/meetings" className="block rounded-3xl border border-accent/30 bg-accent/5 p-6 hover:border-accent/60 transition-all mb-0">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent text-accent-foreground"><Calendar className="h-4 w-4" /></div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-accent">Sljedeća sjednica</p>
                  </div>
                  <p className="mb-2 font-serif text-base font-bold leading-tight text-primary">{nextMeeting.title}</p>
                  <div className="space-y-1 text-sm text-muted-foreground mb-3">
                    <div className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5 flex-shrink-0" />{new Date(nextMeeting.date).toLocaleDateString('hr-HR',{day:'2-digit',month:'long',year:'numeric'})}</div>
                    {nextMeeting.start_time && <div className="flex items-center gap-2"><Clock className="h-3.5 w-3.5 flex-shrink-0" />{nextMeeting.start_time}{nextMeeting.end_time && `–${nextMeeting.end_time}`}</div>}
                    {nextMeeting.location && <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 flex-shrink-0" /><span className="truncate">{nextMeeting.location}</span></div>}
                  </div>
                  
                  {nextMeeting.agenda && nextMeeting.agenda.length > 0 && (
                    <div className="mt-4 space-y-2 border-t border-accent/20 pt-4">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-accent">Dnevni red</p>
                        <Badge variant="outline" className="h-5 border-accent/30 bg-accent/5 px-2 text-[9px] font-bold text-accent">
                          {nextMeeting.agenda.length} stavki
                        </Badge>
                      </div>
                      <ul className="space-y-1.5">
                        {nextMeeting.agenda.slice(0, 4).map((item: any, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground leading-tight">
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[9px] font-bold text-accent">
                              {i + 1}
                            </span>
                            <span className="line-clamp-1">{item.text}</span>
                          </li>
                        ))}
                        {nextMeeting.agenda.length > 4 && (
                          <li className="pl-6 text-[10px] font-medium text-accent">
                            + još {nextMeeting.agenda.length - 4} stavki...
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </Link>
              ) : (
                <div className="rounded-3xl border border-dashed border-border p-6 text-center">
                  <Calendar className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm font-medium text-muted-foreground">Nema zakazanih sjednica</p>
                  {(user?.role === 'admin' || user?.accessRights?.meetings?.edit) && (
                    <Link href="/meetings" className="mt-1 inline-block text-xs text-accent hover:underline">Zakaži sjednicu →</Link>
                  )}
                </div>
              )
            ) : (
              <div className="rounded-3xl bg-muted/20 p-6 flex flex-col items-center justify-center text-center border border-border">
                <Calendar className="h-8 w-8 text-muted-foreground/20 mb-2" />
                <p className="text-sm text-muted-foreground">Sjednice su ograničene.</p>
              </div>
            )}

            {/* Upcoming Lectures Calendar View */}
            <div className="rounded-3xl border border-border bg-white p-8 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="font-serif text-2xl font-bold text-primary">Kalendar predavanja</h3>
                  <p className="text-sm text-muted-foreground">Buduća predavanja i gostovanja</p>
                </div>
                <Link href="/lectures">
                  <Button variant="ghost" size="sm" className="text-accent hover:text-accent/80 hover:bg-accent/5 gap-1.5 font-bold uppercase tracking-wider text-[10px]">
                    Sva predavanja <ChevronRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>

              <div className="space-y-4">
                {upcomingLectures.length > 0 ? (
                  upcomingLectures.slice(0, 5).map((l, i) => {
                    const [y, m, d] = l.date.split("-").map(Number)
                    const date = new Date(y, m - 1, d)
                    const day = d
                    const month = date.toLocaleDateString('hr-HR', { month: 'short' }).toUpperCase().replace('.', '')
                    
                    return (
                      <div key={l.id} className="group flex items-center gap-4 rounded-2xl border border-transparent p-2 transition-all hover:bg-muted/30">
                        <div className="flex flex-col items-center justify-center w-12 h-14 rounded-xl bg-accent/10 border border-accent/20 group-hover:bg-accent group-hover:text-white transition-colors">
                          <span className="text-xs font-bold leading-none">{month}</span>
                          <span className="text-xl font-bold leading-none mt-1">{day}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-bold text-primary truncate group-hover:text-accent transition-colors">{l.title}</h4>
                          <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {l.start_time || "Nije definirano"}</span>
                            {l.location && <span className="flex items-center gap-1 truncate"><MapPin className="h-3 w-3" /> {l.location}</span>}
                          </div>
                        </div>
                        <div className="h-2 w-2 rounded-full bg-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    )
                  })
                ) : (
                  <div className="py-12 text-center rounded-2xl border border-dashed border-border bg-muted/10">
                    <Calendar className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">Nema zakazanih budućih predavanja.</p>
                  </div>
                )}
              </div>
              
              {upcomingLectures.length > 5 && (
                <p className="mt-6 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  + još {upcomingLectures.length - 5} predavanja u planu
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>

    {/* Login Summary Modal */}
    {showSummaryModal && summaryData && (
      <>
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm transition-opacity duration-300" onClick={handleCloseSummary} />
        <div className="fixed left-1/2 top-1/2 z-[70] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-white/20 bg-white/80 p-8 shadow-2xl backdrop-blur-xl transition-all duration-300 animate-in fade-in zoom-in-95 duration-200">
          <button onClick={handleCloseSummary} className="absolute right-6 top-6 rounded-full bg-secondary/50 p-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition-all duration-200">
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 animate-pulse">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-serif text-2xl font-bold text-primary">Dobrodošli natrag!</h3>
              <p className="text-xs text-muted-foreground mt-0.5 font-sans">
                {summaryData.hasPreviousLogin 
                  ? `Novosti od vaše zadnje prijave (${new Date(summaryData.previousLoginTime).toLocaleDateString('hr-HR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })})`
                  : 'Pregled novosti u proteklih 7 dana'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 max-h-[40vh] overflow-y-auto pr-1 py-1">
            {summaryData.newMembers > 0 && (
              <div className="flex items-center gap-3.5 rounded-2xl border border-blue-100 bg-blue-50/40 p-4 transition-all hover:scale-[1.02] duration-200 shadow-sm">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                  <Users className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="text-sm font-black text-blue-950 font-sans">{summaryData.newMembers}</p>
                  <p className="text-[10px] uppercase font-bold tracking-wider text-blue-700/80 font-sans">Novi članovi</p>
                </div>
              </div>
            )}

            {summaryData.newMeetings > 0 && (
              <div className="flex items-center gap-3.5 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 transition-all hover:scale-[1.02] duration-200 shadow-sm">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                  <Calendar className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="text-sm font-black text-indigo-950 font-sans">{summaryData.newMeetings}</p>
                  <p className="text-[10px] uppercase font-bold tracking-wider text-indigo-700/80 font-sans">Nove sjednice</p>
                </div>
              </div>
            )}

            {summaryData.newVideos > 0 && (
              <div className="flex items-center gap-3.5 rounded-2xl border border-red-100 bg-red-50/40 p-4 transition-all hover:scale-[1.02] duration-200 shadow-sm">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
                  <Video className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="text-sm font-black text-red-950 font-sans">{summaryData.newVideos}</p>
                  <p className="text-[10px] uppercase font-bold tracking-wider text-red-700/80 font-sans">Novi video zapisi</p>
                </div>
              </div>
            )}

            {(summaryData.newBooks > 0 || summaryData.updatedBooks > 0) && (
              <div className="flex items-center gap-3.5 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4 transition-all hover:scale-[1.02] duration-200 shadow-sm">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                  <BookOpen className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-emerald-950 leading-tight font-sans">
                    {summaryData.newBooks + summaryData.updatedBooks}
                  </p>
                  <p className="text-[10px] uppercase font-bold tracking-wider text-emerald-700/80 truncate font-sans">
                    Knjige ({summaryData.newBooks} n, {summaryData.updatedBooks} u)
                  </p>
                </div>
              </div>
            )}

            {summaryData.newProjects > 0 && (
              <div className="flex items-center gap-3.5 rounded-2xl border border-amber-100 bg-amber-50/40 p-4 transition-all hover:scale-[1.02] duration-200 shadow-sm">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                  <FolderKanban className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="text-sm font-black text-amber-950 font-sans">{summaryData.newProjects}</p>
                  <p className="text-[10px] uppercase font-bold tracking-wider text-amber-700/80 font-sans">Novi projekti</p>
                </div>
              </div>
            )}

            {summaryData.newContacts > 0 && (
              <div className="flex items-center gap-3.5 rounded-2xl border border-sky-100 bg-sky-50/40 p-4 transition-all hover:scale-[1.02] duration-200 shadow-sm">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-600">
                  <User className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="text-sm font-black text-sky-950 font-sans">{summaryData.newContacts}</p>
                  <p className="text-[10px] uppercase font-bold tracking-wider text-sky-700/80 font-sans">Novi kontakti</p>
                </div>
              </div>
            )}

            {summaryData.newLinks > 0 && (
              <div className="flex items-center gap-3.5 rounded-2xl border border-teal-100 bg-teal-50/40 p-4 transition-all hover:scale-[1.02] duration-200 shadow-sm">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-600">
                  <LinkIcon className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="text-sm font-black text-teal-950 font-sans">{summaryData.newLinks}</p>
                  <p className="text-[10px] uppercase font-bold tracking-wider text-teal-700/80 font-sans">Korisni linkovi</p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 flex justify-end">
            <Button onClick={handleCloseSummary} className="rounded-full px-8 shadow-lg shadow-primary/10">
              U redu
            </Button>
          </div>
        </div>
      </>
    )}
  </>
)
}
