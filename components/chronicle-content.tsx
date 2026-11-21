"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Check,
  Clipboard,
  Download,
  ExternalLink,
  FileDown,
  FileText,
  Filter,
  FolderKanban,
  Gavel,
  History,
  Info,
  Layers,
  Library,
  Loader2,
  Mic,
  RefreshCw,
  ScrollText,
  Search,
  ShieldCheck,
  Users,
  Archive,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  CHRONICLE_CATEGORIES,
  buildChroniclePlainText,
  buildChronicleWordHtml,
  type ChronicleCategory,
  type ChronicleEventItem,
  type ChronicleReport,
} from "@/lib/chronology"

const CATEGORY_COLORS: Record<ChronicleCategory, string> = {
  meetings: "bg-slate-100 text-slate-800 border-slate-300",
  lectures: "bg-amber-50 text-amber-900 border-amber-300",
  projects: "bg-blue-50 text-blue-900 border-blue-200",
  membership: "bg-emerald-50 text-emerald-900 border-emerald-200",
  research: "bg-purple-50 text-purple-900 border-purple-200",
  library: "bg-orange-50 text-orange-900 border-orange-200",
  archive: "bg-teal-50 text-teal-900 border-teal-200",
  governance: "bg-indigo-50 text-indigo-900 border-indigo-200",
  system: "bg-zinc-100 text-zinc-800 border-zinc-300",
}

function getCategoryIcon(cat: ChronicleCategory) {
  switch (cat) {
    case "meetings":
      return Gavel
    case "lectures":
      return Mic
    case "projects":
      return FolderKanban
    case "membership":
      return Users
    case "research":
      return Search
    case "library":
      return Library
    case "archive":
      return Archive
    case "governance":
      return ShieldCheck
    case "system":
      return History
    default:
      return BookOpen
  }
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function ChronicleContent() {
  const currentYear = React.useMemo(() => new Date().getFullYear(), [])

  const [mode, setMode] = React.useState<"range" | "all">("range")
  const [startDate, setStartDate] = React.useState<string>(`${currentYear}-01-01`)
  const [endDate, setEndDate] = React.useState<string>(`${currentYear}-12-31`)
  const [selectedYearFilter, setSelectedYearFilter] = React.useState<string>(String(currentYear))
  const [categories, setCategories] = React.useState<ChronicleCategory[]>(() =>
    CHRONICLE_CATEGORIES.filter((c) => c.defaultEnabled).map((c) => c.key)
  )

  const [report, setReport] = React.useState<ChronicleReport | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [errorMsg, setErrorMsg] = React.useState("")
  const [searchQuery, setSearchQuery] = React.useState("")
  const [activeTab, setActiveTab] = React.useState("narrative")
  const [copied, setCopied] = React.useState(false)
  const [pdfDownloading, setPdfDownloading] = React.useState(false)

  const fetchReport = React.useCallback(
    async (opts?: {
      mode?: "range" | "all"
      startDate?: string
      endDate?: string
      categories?: ChronicleCategory[]
    }) => {
      const m = opts?.mode ?? mode
      const s = opts?.startDate ?? startDate
      const e = opts?.endDate ?? endDate
      const cats = opts?.categories ?? categories

      setLoading(true)
      setErrorMsg("")
      try {
        const params = new URLSearchParams()
        params.set("mode", m)
        if (m === "range") {
          params.set("startDate", s)
          params.set("endDate", e)
        }
        if (cats.length > 0) {
          params.set("categories", cats.join(","))
        }

        const res = await fetch(`/api/chronicle?${params.toString()}`, {
          cache: "no-store",
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(data.error || "Nije moguće učitati Ljetopis društva.")
        }
        setReport(data as ChronicleReport)
      } catch (err: any) {
        setErrorMsg(err?.message || "Pogreška prilikom generiranja Ljetopisa.")
      } finally {
        setLoading(false)
      }
    },
    [mode, startDate, endDate, categories]
  )

  React.useEffect(() => {
    fetchReport()
  }, [fetchReport])

  const applyPresetCurrentYear = () => {
    const s = `${currentYear}-01-01`
    const e = `${currentYear}-12-31`
    setMode("range")
    setStartDate(s)
    setEndDate(e)
    setSelectedYearFilter(String(currentYear))
  }

  const applyPresetPreviousYear = () => {
    const py = currentYear - 1
    setMode("range")
    setStartDate(`${py}-01-01`)
    setEndDate(`${py}-12-31`)
    setSelectedYearFilter(String(py))
  }

  const applyPresetLast12Months = () => {
    const now = new Date()
    const past = new Date(now)
    past.setFullYear(past.getFullYear() - 1)
    setMode("range")
    setStartDate(toIsoDate(past))
    setEndDate(toIsoDate(now))
    setSelectedYearFilter("")
  }

  const applyPresetAllHistory = () => {
    setMode("all")
    setSelectedYearFilter("all")
  }

  const handleSelectSingleYear = (val: string) => {
    setSelectedYearFilter(val)
    if (val === "all") {
      setMode("all")
    } else if (/^\d{4}$/.test(val)) {
      setMode("range")
      setStartDate(`${val}-01-01`)
      setEndDate(`${val}-12-31`)
    }
  }

  const toggleCategory = (cat: ChronicleCategory) => {
    setCategories((prev) => {
      if (prev.includes(cat)) {
        if (prev.length === 1) return prev // najmanje jedna cjelina mora ostati uključena
        return prev.filter((x) => x !== cat)
      }
      return [...prev, cat]
    })
  }

  const selectAllCategories = () => {
    setCategories(CHRONICLE_CATEGORIES.map((c) => c.key))
  }

  const plainManuscript = React.useMemo(() => {
    if (!report) return ""
    return buildChroniclePlainText(report)
  }, [report])

  const handleCopyText = async () => {
    if (!plainManuscript) return
    try {
      await navigator.clipboard.writeText(plainManuscript)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      setCopied(false)
    }
  }

  const handleDownloadTxt = () => {
    if (!report || !plainManuscript) return
    const slug =
      report.period.mode === "all"
        ? "cjelokupna_povijest"
        : `${report.period.startDate}_do_${report.period.endDate}`
    const blob = new Blob([plainManuscript], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `ljetopis_hrd_${slug}.txt`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const handleDownloadWord = () => {
    if (!report) return
    const html = buildChronicleWordHtml(report)
    const slug =
      report.period.mode === "all"
        ? "cjelokupna_povijest"
        : `${report.period.startDate}_do_${report.period.endDate}`
    const blob = new Blob(["\ufeff", html], { type: "application/msword;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `Ljetopis_HRD_${slug}.doc`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const handleDownloadPdf = async () => {
    setPdfDownloading(true)
    try {
      const res = await fetch("/api/chronicle/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, startDate, endDate, categories }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || "Izvoz PDF-a nije uspio.")
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const slug =
        mode === "all" ? "cjelokupna_povijest" : `${startDate}_do_${endDate}`
      const a = document.createElement("a")
      a.href = url
      a.download = `Ljetopis_HRD_${slug}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err: any) {
      setErrorMsg(err?.message || "Pogreška prilikom izrade PDF ljetopisa.")
    } finally {
      setPdfDownloading(false)
    }
  }

  const filteredYearGroups = React.useMemo(() => {
    if (!report) return []
    const q = searchQuery.trim().toLowerCase()
    if (!q) return report.yearGroups
    return report.yearGroups
      .map((grp) => ({
        ...grp,
        events: grp.events.filter(
          (ev) =>
            ev.title.toLowerCase().includes(q) ||
            ev.narrative.toLowerCase().includes(q) ||
            ev.details.some((d) => d.toLowerCase().includes(q)) ||
            ev.people.some((p) => p.toLowerCase().includes(q)) ||
            ev.sourceRef.toLowerCase().includes(q) ||
            (ev.location || "").toLowerCase().includes(q)
        ),
      }))
      .filter((grp) => grp.events.length > 0)
  }, [report, searchQuery])

  const renderEventCard = (ev: ChronicleEventItem) => {
    const CatIcon = getCategoryIcon(ev.category)
    const badgeClass = CATEGORY_COLORS[ev.category] || CATEGORY_COLORS.meetings
    return (
      <div
        key={ev.id}
        className="rounded-xl border border-border bg-white p-4 sm:p-5 shadow-xs space-y-2.5 transition-colors hover:border-[#CEA369]/60"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="font-mono text-xs bg-[#1B2B36] text-[#CEA369] border-[#1B2B36]"
            >
              {ev.dateDisplay}
            </Badge>
            <Badge variant="outline" className={`text-[11px] gap-1 ${badgeClass}`}>
              <CatIcon className="h-3 w-3" />
              {ev.categoryLabel}
            </Badge>
          </div>
          <span className="text-[11px] font-mono text-muted-foreground">
            Izvor: {ev.sourceRef}
          </span>
        </div>

        <h4 className="font-serif text-base sm:text-lg font-bold text-[#1B2B36] leading-snug">
          {ev.title}
        </h4>

        <p className="text-sm text-slate-800 leading-relaxed text-pretty">{ev.narrative}</p>

        {ev.details.length > 0 && (
          <ul className="space-y-1 pl-4 text-xs text-slate-600 list-disc">
            {ev.details.map((det, idx) => (
              <li key={idx} className="leading-relaxed">
                {det}
              </li>
            ))}
          </ul>
        )}

        {(ev.people.length > 0 && !ev.id.startsWith("membership-joins-")) || ev.externalUrl ? (
          <div className="pt-1 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 text-xs">
            {ev.people.length > 0 && !ev.id.startsWith("membership-joins-") ? (
              <span className="text-slate-600">
                <strong className="text-slate-700">Sudionici / osobe:</strong>{" "}
                {ev.people.join(", ")}
              </span>
            ) : (
              <span />
            )}
            {ev.externalUrl && (
              <a
                href={ev.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[#1F77C5] hover:underline font-medium shrink-0"
              >
                Vanjska poveznica <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Zaglavlje */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-1.5 font-medium shrink-0">
              <ArrowLeft className="h-4 w-4" /> Nazad
            </Button>
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold font-serif text-[#1B2B36]">
                Ljetopis društva
              </h1>
              <Badge
                variant="outline"
                className="border-[#CEA369] bg-[#FEFCE8] text-[#7C2D12] text-xs font-medium"
              >
                Podloga za spomenicu i monografiju
              </Badge>
            </div>
            <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
              Skup provjerenih podataka iz službene baze u pripovjednom obliku za odabrano razdoblje.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={handleDownloadPdf}
            disabled={loading || pdfDownloading || !report}
            className="gap-1.5 bg-[#1B2B36] hover:bg-[#1B2B36]/90 text-white"
          >
            {pdfDownloading ? (
              <Loader2 className="h-4 w-4 animate-spin text-[#CEA369]" />
            ) : (
              <FileDown className="h-4 w-4 text-[#CEA369]" />
            )}
            PDF Ljetopis
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadWord}
            disabled={loading || !report}
            className="gap-1.5 border-[#CEA369] text-[#1B2B36] hover:bg-[#FEFCE8]"
          >
            <FileText className="h-4 w-4 text-[#7C2D12]" /> Word (.doc)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadTxt}
            disabled={loading || !report}
            className="gap-1.5"
          >
            <Download className="h-4 w-4" /> Preuzmi TXT
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyText}
            disabled={loading || !report}
            className="gap-1.5"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-emerald-600" /> Kopirano
              </>
            ) : (
              <>
                <Clipboard className="h-4 w-4" /> Kopiraj tekst
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Kontrolna ploča razdoblja i cjelina */}
      <Card className="border-[#CEA369]/40 bg-[#FBF9F6] shadow-xs">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
            {/* Brzi odabiri i godine */}
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-[#CEA369]" /> Odabir razdoblja
              </Label>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant={
                    mode === "range" &&
                    startDate === `${currentYear}-01-01` &&
                    endDate === `${currentYear}-12-31`
                      ? "default"
                      : "outline"
                  }
                  onClick={applyPresetCurrentYear}
                  className="h-8 text-xs"
                >
                  Tekuća ({currentYear}.)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={
                    mode === "range" &&
                    startDate === `${currentYear - 1}-01-01` &&
                    endDate === `${currentYear - 1}-12-31`
                      ? "default"
                      : "outline"
                  }
                  onClick={applyPresetPreviousYear}
                  className="h-8 text-xs"
                >
                  Prethodna ({currentYear - 1}.)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={applyPresetLast12Months}
                  className="h-8 text-xs"
                >
                  Zadnjih 12 mjeseci
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={mode === "all" ? "default" : "outline"}
                  onClick={applyPresetAllHistory}
                  className="h-8 text-xs"
                >
                  Cijela povijest (sve godine)
                </Button>
              </div>
            </div>

            {/* Prilagođeni datumi i padajuća godina */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end">
              <div className="space-y-1">
                <Label htmlFor="chronicleYear" className="text-[11px] text-muted-foreground">
                  Pojedinačna godina
                </Label>
                <select
                  id="chronicleYear"
                  value={mode === "all" ? "all" : selectedYearFilter}
                  onChange={(e) => handleSelectSingleYear(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-white px-2.5 text-xs font-medium"
                >
                  <option value="">Prilagođeni raspon</option>
                  <option value="all">Sve godine</option>
                  {(report?.availableYears || [currentYear, currentYear - 1]).map((yr) => (
                    <option key={yr} value={String(yr)}>
                      {yr}. godina
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="chronicleFrom" className="text-[11px] text-muted-foreground">
                  Datum od
                </Label>
                <Input
                  id="chronicleFrom"
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setMode("range")
                    setSelectedYearFilter("")
                    setStartDate(e.target.value)
                  }}
                  className="h-9 bg-white text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="chronicleTo" className="text-[11px] text-muted-foreground">
                  Datum do
                </Label>
                <Input
                  id="chronicleTo"
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setMode("range")
                    setSelectedYearFilter("")
                    setEndDate(e.target.value)
                  }}
                  className="h-9 bg-white text-xs"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fetchReport()}
                disabled={loading}
                className="h-9 gap-1.5 bg-white"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                Osvježi
              </Button>
            </div>
          </div>

          {/* Odabir cjelina / izvora iz baze */}
          <div className="pt-3 border-t border-border/70 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-[#CEA369]" /> Provjereni izvori iz baze za uključenje u ljetopis
              </span>
              <button
                type="button"
                onClick={selectAllCategories}
                className="text-[11px] font-medium text-[#1F77C5] hover:underline"
              >
                Uključi sve cjeline
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CHRONICLE_CATEGORIES.map((meta) => {
                const active = categories.includes(meta.key)
                const CatIcon = getCategoryIcon(meta.key)
                return (
                  <button
                    key={meta.key}
                    type="button"
                    onClick={() => toggleCategory(meta.key)}
                    title={meta.description}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      active
                        ? "bg-[#1B2B36] text-white border-[#1B2B36]"
                        : "bg-white text-slate-600 border-border hover:bg-slate-100"
                    }`}
                  >
                    <CatIcon className={`h-3.5 w-3.5 ${active ? "text-[#CEA369]" : "text-slate-400"}`} />
                    {meta.label}
                  </button>
                )
              })}
            </div>
          </div>

          {report && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/70 text-xs text-slate-600">
              <span>
                Aktivno razdoblje: <strong className="text-[#1B2B36]">{report.period.label}</strong>
              </span>
              <span className="font-mono text-[11px]">
                Generirano iz baze app.db: {report.period.generatedAt}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {errorMsg && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 flex items-center justify-between gap-3">
          <span>{errorMsg}</span>
          <Button size="sm" variant="outline" onClick={() => fetchReport()}>
            Pokušaj ponovno
          </Button>
        </div>
      )}

      {loading && !report && (
        <Card className="bg-white">
          <CardContent className="p-12 text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-[#1B2B36] mx-auto" />
            <p className="text-sm text-muted-foreground">
              Prikupljanje i oblikovanje provjerenih podataka iz baze za odabrano razdoblje…
            </p>
          </CardContent>
        </Card>
      )}

      {report && (
        <>
          {/* KPI sažetak razdoblja */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card className="bg-white border-border">
              <CardContent className="p-3.5">
                <p className="text-[11px] font-medium text-muted-foreground">Ljetopisnih zapisa</p>
                <p className="text-2xl font-bold font-serif text-[#1B2B36] mt-0.5">
                  {report.summary.totalEvents}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {report.yearGroups.length} {report.yearGroups.length === 1 ? "godina" : "godina/e"}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-white border-border">
              <CardContent className="p-3.5">
                <p className="text-[11px] font-medium text-muted-foreground">Sjednice i skupštine</p>
                <p className="text-2xl font-bold font-serif text-[#1B2B36] mt-0.5">
                  {report.summary.meetingsCount}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {report.summary.activeMandatesCount} aktivnih mandata
                </p>
              </CardContent>
            </Card>
            <Card className="bg-white border-border">
              <CardContent className="p-3.5">
                <p className="text-[11px] font-medium text-muted-foreground">Predavanja i susreti</p>
                <p className="text-2xl font-bold font-serif text-[#1B2B36] mt-0.5">
                  {report.summary.lecturesCount}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5 truncate" title={report.summary.lectureCities.join(", ")}>
                  {report.summary.lectureCities.length > 0
                    ? report.summary.lectureCities.join(", ")
                    : "Nema zabilježenih gradova"}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-white border-border">
              <CardContent className="p-3.5">
                <p className="text-[11px] font-medium text-muted-foreground">Projekti</p>
                <p className="text-2xl font-bold font-serif text-[#1B2B36] mt-0.5">
                  {report.summary.projectsCount}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">u odabranom razdoblju</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-border">
              <CardContent className="p-3.5">
                <p className="text-[11px] font-medium text-muted-foreground">Novoupisani članovi</p>
                <p className="text-2xl font-bold font-serif text-[#1B2B36] mt-0.5">
                  {report.summary.newMembersCount}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  ukupno {report.summary.totalMembersCount} u knjizi
                </p>
              </CardContent>
            </Card>
            <Card className="bg-white border-border">
              <CardContent className="p-3.5">
                <p className="text-[11px] font-medium text-muted-foreground">Knjižnica i upiti</p>
                <p className="text-2xl font-bold font-serif text-[#1B2B36] mt-0.5">
                  {report.summary.libraryTotalBooks}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  knjiga • {report.summary.inquiriesCount} upita
                </p>
              </CardContent>
            </Card>
          </div>

          {/* 4 kartice prikaza */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 h-auto p-1 bg-[#E8E4DE]">
              <TabsTrigger value="narrative" className="gap-1.5 py-2 text-xs font-semibold">
                <BookOpen className="h-3.5 w-3.5" /> Pripovjedni ljetopis
              </TabsTrigger>
              <TabsTrigger value="thematic" className="gap-1.5 py-2 text-xs font-semibold">
                <Layers className="h-3.5 w-3.5" /> Tematske cjeline ({report.thematicSections.length})
              </TabsTrigger>
              <TabsTrigger value="appendices" className="gap-1.5 py-2 text-xs font-semibold">
                <ScrollText className="h-3.5 w-3.5" /> Prilozi i kazala
              </TabsTrigger>
              <TabsTrigger value="manuscript" className="gap-1.5 py-2 text-xs font-semibold">
                <FileText className="h-3.5 w-3.5" /> Rukopis (čisti tekst)
              </TabsTrigger>
            </TabsList>

            {/* 1. PRIPOVJEDNI LJETOPIS */}
            <TabsContent value="narrative" className="space-y-6">
              {/* Uvodni pripovjedni sažetak */}
              <Card className="border-[#CEA369]/50 bg-[#FEFCE8]/70 shadow-xs">
                <CardHeader className="pb-2">
                  <CardTitle className="font-serif text-lg text-[#7C2D12] flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-[#CEA369]" />
                    Uvodni pripovjedni sažetak razdoblja ({report.period.label})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5 text-sm text-slate-800 leading-relaxed">
                  {report.introNarrative.map((p, idx) => (
                    <p key={idx}>{p}</p>
                  ))}
                </CardContent>
              </Card>

              {/* Pretraga i brzi skok na godinu */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative w-full sm:max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Pretraži po imenu, gradu, naslovu, temi…"
                    className="pl-9 bg-white"
                  />
                </div>
                {report.yearGroups.length > 1 && (
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-muted-foreground font-medium">Skok na godinu:</span>
                    {report.yearGroups.map((g) => (
                      <a
                        key={g.year}
                        href={`#chronicle-year-${g.year}`}
                        className="rounded-md border border-border bg-white px-2 py-1 font-mono font-semibold text-[#1B2B36] hover:border-[#CEA369] hover:bg-[#FEFCE8]"
                      >
                        {g.year}.
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {/* Kronologija po godinama */}
              {filteredYearGroups.length === 0 ? (
                <Card className="bg-white">
                  <CardContent className="p-10 text-center space-y-2">
                    <p className="font-serif text-base font-semibold text-[#1B2B36]">
                      Nema zapisa za odabrano razdoblje ili pojam pretrage
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Odaberite šire razdoblje (npr. „Cijela povijest”) ili uključite dodatne izvore iz baze.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-8">
                  {filteredYearGroups.map((grp) => (
                    <section
                      key={grp.year}
                      id={`chronicle-year-${grp.year}`}
                      className="space-y-3"
                    >
                      <div className="rounded-xl bg-[#1B2B36] text-white px-4 py-3 border-b-2 border-[#CEA369] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <h3 className="font-serif text-xl font-bold text-white">
                            {grp.year}. godina
                          </h3>
                          <p className="text-xs text-slate-300">{grp.yearSummary}</p>
                        </div>
                        <Badge className="bg-[#CEA369] text-[#1B2B36] font-mono font-bold self-start sm:self-auto">
                          {grp.events.length} zapisa
                        </Badge>
                      </div>

                      <div className="space-y-3 pl-0 sm:pl-3 border-l-0 sm:border-l-2 sm:border-[#CEA369]/40">
                        {grp.events.map(renderEventCard)}
                      </div>
                    </section>
                  ))}
                </div>
              )}

              {/* Napomene o provjerenosti */}
              <Card className="border-border bg-white/90">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold flex items-center gap-2 text-[#1B2B36]">
                    <Info className="h-4 w-4 text-[#CEA369]" />
                    Napomene o izvorima, privatnosti i provjerenosti podataka
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1.5 text-xs text-slate-600 list-disc pl-5">
                    {report.dataQualityNotes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 2. TEMATSKE CJELINE */}
            <TabsContent value="thematic" className="space-y-6">
              {report.thematicSections.length === 0 ? (
                <Card className="bg-white">
                  <CardContent className="p-10 text-center text-sm text-muted-foreground">
                    Nema zapisa za prikaz po tematskim cjelinama u odabranom razdoblju.
                  </CardContent>
                </Card>
              ) : (
                report.thematicSections.map((sec) => (
                  <Card key={sec.category} className="bg-white border-border">
                    <CardHeader className="border-b border-border/60 bg-[#FBF9F6]">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <CardTitle className="font-serif text-lg text-[#1B2B36]">
                            {sec.title}
                          </CardTitle>
                          <CardDescription className="text-xs mt-0.5">
                            {sec.intro}
                          </CardDescription>
                        </div>
                        <Badge variant="secondary" className="font-mono">
                          {sec.events.length} zapisa
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-5 space-y-3 bg-[#F7F5F0]/50">
                      {sec.events.map(renderEventCard)}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            {/* 3. PRILOZI I KAZALA ZA SPOMENICU */}
            <TabsContent value="appendices" className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Mandati tijela Društva */}
                <Card className="bg-white border-border">
                  <CardHeader>
                    <CardTitle className="font-serif text-base text-[#1B2B36]">
                      Tijela Društva i mandati u razdoblju ({report.appendices.mandates.length})
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Dužnosnici čiji se mandat preklapa s odabranim razdobljem.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {report.appendices.mandates.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nema evidentiranih funkcija.</p>
                    ) : (
                      <div className="divide-y divide-border text-xs">
                        {report.appendices.mandates.map((m, idx) => (
                          <div key={idx} className="py-2 flex items-center justify-between gap-2">
                            <div>
                              <p className="font-semibold text-[#1B2B36]">{m.functionName}</p>
                              <p className="text-slate-600">{m.memberName}</p>
                            </div>
                            <Badge variant={m.isActive ? "default" : "outline"} className="font-mono text-[11px]">
                              {m.fromYear ? `${m.fromYear}.` : "—"} – {m.toYear ? `${m.toYear}.` : "danas"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Popis predavanja */}
                <Card className="bg-white border-border">
                  <CardHeader>
                    <CardTitle className="font-serif text-base text-[#1B2B36]">
                      Popis predavanja i gostovanja ({report.appendices.lecturesList.length})
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Pregled po gradovima, lokacijama i predavačima.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {report.appendices.lecturesList.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nema evidentiranih predavanja.</p>
                    ) : (
                      <div className="divide-y divide-border text-xs">
                        {report.appendices.lecturesList.map((l, idx) => (
                          <div key={idx} className="py-2 space-y-0.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-[#1B2B36]">{l.title}</span>
                              <span className="font-mono text-[11px] text-muted-foreground shrink-0">
                                {l.dateDisplay}
                              </span>
                            </div>
                            <p className="text-slate-600">
                              {[l.city !== "—" ? l.city : "", l.location !== "—" ? l.location : ""]
                                .filter(Boolean)
                                .join(" — ") || "Lokacija nije navedena"}
                              {l.host !== "—" ? ` • Predavač/domaćin: ${l.host}` : ""}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Novoupisani, Počasni, In memoriam */}
                <Card className="bg-white border-border">
                  <CardHeader>
                    <CardTitle className="font-serif text-base text-[#1B2B36]">
                      Članstvo, počasni članovi i In memoriam
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Novoupisani ({report.appendices.newMembers.length}), Počasni ({report.appendices.honoraryMembers.length}), In memoriam ({report.appendices.inMemoriam.length})
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 text-xs">
                    <div>
                      <p className="font-bold text-[#7C2D12] mb-1.5">
                        Novoupisani članovi s potvrđenim datumom ({report.appendices.newMembers.length})
                      </p>
                      {report.appendices.newMembers.length === 0 ? (
                        <p className="text-muted-foreground">Nema upisa s potvrđenim datumom u ovom razdoblju.</p>
                      ) : (
                        <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 pr-1">
                          {report.appendices.newMembers.map((nm, idx) => (
                            <div key={idx} className="py-1 flex justify-between gap-2">
                              <span className="font-medium text-slate-800">{nm.name}</span>
                              <span className="font-mono text-muted-foreground">{nm.dateDisplay}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {report.appendices.honoraryMembers.length > 0 && (
                      <div className="pt-2 border-t border-border">
                        <p className="font-bold text-[#7C2D12] mb-1">Počasni članovi</p>
                        <ul className="space-y-1 list-disc pl-4">
                          {report.appendices.honoraryMembers.map((h, i) => (
                            <li key={i}>
                              <strong>{h.name}</strong>
                              {h.joinDateDisplay ? ` (član od ${h.joinDateDisplay})` : ""}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {report.appendices.inMemoriam.length > 0 && (
                      <div className="pt-2 border-t border-border">
                        <p className="font-bold text-[#7C2D12] mb-1">In memoriam</p>
                        <ul className="space-y-1 list-disc pl-4">
                          {report.appendices.inMemoriam.map((im, i) => (
                            <li key={i}>
                              <strong>† {im.name}</strong> — {im.deathDateDisplay}
                              {im.joinDateDisplay ? `, član od ${im.joinDateDisplay}` : ""}
                              {im.functions.length > 0 ? ` (${im.functions.join(", ")})` : ""}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Kazalo spomenutih osoba */}
                <Card className="bg-white border-border">
                  <CardHeader>
                    <CardTitle className="font-serif text-base text-[#1B2B36]">
                      Kazalo spomenutih osoba ({report.appendices.peopleIndex.length})
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Abecedni popis dužnosnika, predavača, voditelja projekata i sudionika za imensko kazalo monografije.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {report.appendices.peopleIndex.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nema evidentiranih osoba za kazalo.</p>
                    ) : (
                      <div className="max-h-80 overflow-y-auto divide-y divide-border text-xs pr-1">
                        {report.appendices.peopleIndex.map((p, idx) => (
                          <div key={idx} className="py-1.5 flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold text-[#1B2B36]">{p.name}</p>
                              <p className="text-[11px] text-slate-500">{p.roles.join(" • ")}</p>
                            </div>
                            <span className="font-mono text-[11px] text-muted-foreground shrink-0">
                              {p.mentionsCount}× ({p.years.join(", ")})
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* 4. RUKOPIS (ČISTI TEKST) */}
            <TabsContent value="manuscript">
              <Card className="border-primary/20 bg-[#FBF9F6]">
                <CardHeader className="pb-3 border-b border-border">
                  <CardTitle className="font-serif text-lg text-[#1B2B36]">
                    Tekstualni rukopis Ljetopisa za pisca spomenice
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Cjeloviti pripovjedni tekst s provjerenim činjenicama, izvorima i prilozima spreman za kopiranje u tekstualni uređivač.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                  <ScrollArea className="h-[640px] rounded-xl border border-border bg-white p-6 sm:p-8 shadow-inner">
                    <div className="whitespace-pre-wrap font-mono text-[12.5px] leading-relaxed text-slate-800">
                      {plainManuscript}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}
