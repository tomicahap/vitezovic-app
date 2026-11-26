"use client"

import React, { useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  BarChart3,
  Check,
  Download,
  Euro,
  ImageDown,
  Layers,
  MapPin,
  PieChart as PieChartIcon,
  TrendingUp,
  UserPlus,
  Users,
  X,
} from "lucide-react"
import { cn, formatDateDMY } from "@/lib/utils"
import { inspectMemberDate } from "@/lib/date-validation"
import type { Member, MemberPayment } from "@/contexts/members-context"
import { SectionTabsBar, type SectionTabItem } from "@/components/ui/section-tabs"

// ─── Kompatibilni legacy export ─────────────────────────────────────────────
interface DashboardMembersChartProps {
  data: Array<{ name: string; prijave: number }>
}

export function DashboardMembersChart({ data }: DashboardMembersChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="legacyNavyBar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#264E82" stopOpacity={0.95} />
            <stop offset="100%" stopColor="#1E3A5F" stopOpacity={0.88} />
          </linearGradient>
          <linearGradient id="legacyGoldBar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#D8B178" stopOpacity={1} />
            <stop offset="100%" stopColor="#B5843E" stopOpacity={0.95} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8E4DE" />
        <XAxis
          dataKey="name"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fontWeight: 500, fill: "#6B7280" }}
        />
        <YAxis
          allowDecimals={false}
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fontWeight: 500, fill: "#6B7280" }}
        />
        <Tooltip
          cursor={{ fill: "#F2EFE9", opacity: 0.7 }}
          contentStyle={{
            borderRadius: "12px",
            border: "1px solid #CEA369",
            backgroundColor: "#1B2B36",
            color: "#F2EFE9",
          }}
        />
        <Bar dataKey="prijave" radius={[6, 6, 0, 0]} barSize={22}>
          {data.map((_, index) => (
            <Cell
              key={`cell-${index}`}
              fill={index === data.length - 1 ? "url(#legacyGoldBar)" : "url(#legacyNavyBar)"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Pomoćne funkcije i konstante ───────────────────────────────────────────

type AnalyticsTab = "registrations" | "structure" | "payments" | "age" | "geo"
type RegRange = "6m" | "12m" | "years"
type RegChartMode = "bar" | "area" | "cumulative"

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

interface ParsedDateParts {
  year: number
  month: number // 1..12
  day: number
  iso: string
}

function parseIsoParts(raw?: string | null): ParsedDateParts | null {
  if (!raw) return null
  const inspected = inspectMemberDate(raw)
  if (inspected.isoDate) {
    const [y, m, d] = inspected.isoDate.split("-").map(Number)
    if (y && m && d) {
      return { year: y, month: m, day: d, iso: inspected.isoDate }
    }
  }
  const dt = new Date(raw)
  if (!isNaN(dt.getTime())) {
    const y = dt.getFullYear()
    const m = dt.getMonth() + 1
    const d = dt.getDate()
    return {
      year: y,
      month: m,
      day: d,
      iso: `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    }
  }
  return null
}

function parseMemberPayments(member: Member): MemberPayment[] {
  const rawPayments: unknown = member.payments
  if (Array.isArray(rawPayments)) return rawPayments as MemberPayment[]
  if (typeof rawPayments === "string" && rawPayments.trim()) {
    try {
      const parsed = JSON.parse(rawPayments)
      return Array.isArray(parsed) ? (parsed as MemberPayment[]) : []
    } catch {
      return []
    }
  }
  return []
}

function formatMembersNoun(count: number): string {
  const abs = Math.abs(count)
  if (abs === 1) return "1 član"
  if (abs >= 2 && abs <= 4) return `${count} člana`
  return `${count} članova`
}

function formatNewMembersNoun(count: number): string {
  const abs = Math.abs(count)
  if (abs === 1) return "1 nova prijava"
  if (abs >= 2 && abs <= 4) return `${count} nove prijave`
  return `${count} novih prijava`
}

const FOREIGN_KEYWORDS = [
  "slovenij",
  "ljubljan",
  "maribor",
  "njemačk",
  "deutsch",
  "münchen",
  "frankfurt",
  "berlin",
  "stuttgart",
  "austrij",
  "beč",
  "wien",
  "graz",
  "švicarsk",
  "zürich",
  "basel",
  "bih",
  "bosn",
  "sarajev",
  "mostar",
  "banja luka",
  "tuzla",
  "srbij",
  "beograd",
  "novi sad",
  "subotic",
  "italij",
  "rim",
  "milano",
  "trst",
  "mađarsk",
  "budapest",
  "francusk",
  "pariz",
  "irska",
  "dublin",
  "london",
  "velika britan",
  "švedsk",
  "stockholm",
  "sad",
  "usa",
  "united states",
  "new york",
  "chicago",
  "kanad",
  "canada",
  "toronto",
  "austral",
  "sydney",
  "melbourne",
  "argentin",
  "čile",
]

function extractCityAndRegion(address?: string | null): {
  city: string
  region: "zagreb" | "croatia" | "abroad" | "unknown"
} {
  if (!address || !address.trim()) {
    return { city: "", region: "unknown" }
  }
  const clean = address.replace(/\s+/g, " ").trim()
  const lower = clean.toLowerCase()
  const isAbroad = FOREIGN_KEYWORDS.some((kw) => lower.includes(kw))

  let city = ""
  // 1. Pokušaj izvući grad iza peteroznamenkastog poštanskog broja (npr. "10000 Zagreb")
  const hrPostalMatch = clean.match(/\b(\d{5})\s+([A-ZČĆŽŠĐa-zčćžšđ][A-ZČĆŽŠĐa-zčćžšđ\s\-]{1,35})/)
  if (hrPostalMatch) {
    city = hrPostalMatch[2].split(/[,;\n]/)[0].trim()
  } else {
    // 2. Fallback: uzmi zadnji smisleni segment odvojen zarezom bez ulica/brojeva
    const parts = clean
      .split(/[,;\n]+/)
      .map((p) => p.trim())
      .filter(Boolean)
    for (let i = parts.length - 1; i >= 0; i--) {
      const seg = parts[i].replace(/^(RH|HR|Hrvatska|Croatia)$/i, "").trim()
      if (!seg) continue
      // Makni eventualni strani poštanski broj na početku
      const stripped = seg.replace(/^[A-Z]{0,2}-?\d{4,6}\s+/, "").trim()
      if (stripped && !/^\d+$/.test(stripped) && stripped.length >= 2) {
        city = stripped
        break
      }
    }
  }

  city = city.replace(/^(Hrvatska|Croatia|RH)$/i, "").replace(/\.$/, "").trim()
  if (/^zagreb/i.test(city) || /\b10000\b/.test(clean)) {
    return { city: "Zagreb", region: "zagreb" }
  }
  if (!city) {
    return { city: "", region: isAbroad ? "abroad" : "unknown" }
  }
  // Lijepa kapitalizacija prve riječi ako je sve malim/velikim slovima
  const normalizedCity = city
    .split(/\s+/)
    .map((w) =>
      w.length <= 2 && /^(na|u|i|kod|pod)$/i.test(w)
        ? w.toLowerCase()
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    )
    .join(" ")

  return {
    city: normalizedCity,
    region: isAbroad ? "abroad" : "croatia",
  }
}

const AGE_BUCKETS = [
  { id: "under30", label: "< 30 god.", min: 0, max: 29 },
  { id: "30_44", label: "30–44 god.", min: 30, max: 44 },
  { id: "45_59", label: "45–59 god.", min: 45, max: 59 },
  { id: "60_74", label: "60–74 god.", min: 60, max: 74 },
  { id: "75plus", label: "75+ god.", min: 75, max: 150 },
] as const

const STRUCTURE_META = [
  {
    key: "active",
    label: "Aktivni (redovni)",
    color: "#1E3A5F",
    badgeBg: "bg-[#EFF5FB] text-[#1E3A5F] border-[#1E3A5F]/20",
    href: "/members?status=active",
  },
  {
    key: "honorary",
    label: "Počasni / oslobođeni",
    color: "#CEA369",
    badgeBg: "bg-[#FEFCE8] text-[#8E622A] border-[#CEA369]/50",
    href: "/members?status=active",
  },
  {
    key: "overdue",
    label: "S dugovanjem",
    color: "#DC2626",
    badgeBg: "bg-red-50 text-red-700 border-red-200",
    href: "/members?status=all&paymentStatus=overdue",
  },
  {
    key: "inactive",
    label: "Neaktivni / ispisani",
    color: "#94A3B8",
    badgeBg: "bg-slate-100 text-slate-700 border-slate-200",
    href: "/members?status=all",
  },
  {
    key: "deceased",
    label: "Preminuli (In memoriam)",
    color: "#334155",
    badgeBg: "bg-slate-200/70 text-slate-800 border-slate-300",
    href: "/members?status=all",
  },
] as const

// ─── Prilagođeni Tooltip ────────────────────────────────────────────────────

interface RichTooltipLine {
  label: string
  value: string
  tone?: "default" | "gold" | "positive" | "negative"
}

function RichChartTooltip({
  title,
  lines,
  hint,
}: {
  title: string
  lines: RichTooltipLine[]
  hint?: string
}) {
  return (
    <div className="rounded-2xl border border-[#CEA369]/70 bg-[#1B2B36] px-3.5 py-2.5 text-[#F2EFE9] shadow-xl max-w-[260px]">
      <p className="text-[11px] font-bold uppercase tracking-wider text-[#CEA369]">{title}</p>
      <div className="mt-1 space-y-0.5">
        {lines.map((line, i) => (
          <div key={i} className="flex items-baseline justify-between gap-3 text-xs">
            <span className="text-slate-300">{line.label}:</span>
            <span
              className={cn(
                "font-bold tabular-nums",
                line.tone === "gold"
                  ? "text-[#F3D19C]"
                  : line.tone === "positive"
                  ? "text-emerald-300"
                  : line.tone === "negative"
                  ? "text-rose-300"
                  : "text-white"
              )}
            >
              {line.value}
            </span>
          </div>
        ))}
      </div>
      {hint && <p className="mt-1.5 border-t border-white/10 pt-1 text-[10px] text-[#CEA369]/90">{hint}</p>}
    </div>
  )
}

// ─── Glavna analitička komponenta ───────────────────────────────────────────

export function DashboardMembersAnalytics({ members }: { members: Member[] }) {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>("registrations")

  // Tab 1: Prijave novih članova
  const [regRange, setRegRange] = useState<RegRange>("12m")
  const [regMode, setRegMode] = useState<RegChartMode>("bar")
  const [compareLastYear, setCompareLastYear] = useState(false)
  const [selectedRegBucketKey, setSelectedRegBucketKey] = useState<string | null>(null)

  // Tab 3: Članarine po mjesecima
  const [paymentMetric, setPaymentMetric] = useState<"amount" | "count">("amount")
  const [comparePaymentsPrevYear, setComparePaymentsPrevYear] = useState(true)

  // Tab 4: Dobna struktura
  const [ageScope, setAgeScope] = useState<"active" | "living">("active")
  const [selectedAgeBucketId, setSelectedAgeBucketId] = useState<string | null>(null)

  // Tab 5: Gradovi i područja
  const [geoMode, setGeoMode] = useState<"cities" | "areas">("cities")

  // Spotlight hover indeks + izvoz PNG povratna poruka
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [exportSuccessLabel, setExportSuccessLabel] = useState<string | null>(null)
  const chartContainerRef = useRef<HTMLDivElement>(null)

  const societyMembers = useMemo(
    () => (members || []).filter((m) => m && m.role !== "admin"),
    [members]
  )

  const now = useMemo(() => new Date(), [])
  const currentYear = now.getFullYear()
  const prevYear = currentYear - 1

  // ── 1. Podaci za tab "Novi članovi"
  const registrationsModel = useMemo(() => {
    interface RegDatum {
      key: string
      name: string
      fullLabel: string
      prijave: number
      proslaGodina: number
      kumulativno: number
      members: Member[]
    }

    const memberBuckets = new Map<string, Member[]>()
    let earliestYear = currentYear
    let baselineBefore12m = 0

    const cutoff12m = new Date(currentYear, now.getMonth() - 11, 1)
    const cutoff6m = new Date(currentYear, now.getMonth() - 5, 1)
    let baselineBefore6m = 0

    for (const m of societyMembers) {
      const p = parseIsoParts(m.joinDate)
      if (!p) continue
      if (p.year < earliestYear && p.year >= 1990) earliestYear = p.year

      const ymKey = `${p.year}-${String(p.month).padStart(2, "0")}`
      const yKey = `${p.year}`
      if (!memberBuckets.has(ymKey)) memberBuckets.set(ymKey, [])
      memberBuckets.get(ymKey)!.push(m)
      if (!memberBuckets.has(yKey)) memberBuckets.set(yKey, [])
      memberBuckets.get(yKey)!.push(m)

      const mDate = new Date(p.year, p.month - 1, 1)
      if (mDate < cutoff12m) baselineBefore12m += 1
      if (mDate < cutoff6m) baselineBefore6m += 1
    }

    const points: RegDatum[] = []
    if (regRange === "years") {
      const startYear = Math.min(earliestYear, currentYear - 4)
      let running = 0
      for (let y = startYear; y <= currentYear; y++) {
        const key = `${y}`
        const list = memberBuckets.get(key) ?? []
        running += list.length
        points.push({
          key,
          name: key,
          fullLabel: `${y}. godina`,
          prijave: list.length,
          proslaGodina: 0,
          kumulativno: running,
          members: list,
        })
      }
    } else {
      const monthsCount = regRange === "6m" ? 6 : 12
      let running = regRange === "6m" ? baselineBefore6m : baselineBefore12m
      for (let i = monthsCount - 1; i >= 0; i--) {
        const d = new Date(currentYear, now.getMonth() - i, 1)
        const y = d.getFullYear()
        const mIdx = d.getMonth()
        const key = `${y}-${String(mIdx + 1).padStart(2, "0")}`
        const prevKey = `${y - 1}-${String(mIdx + 1).padStart(2, "0")}`
        const list = memberBuckets.get(key) ?? []
        const prevList = memberBuckets.get(prevKey) ?? []
        running += list.length
        points.push({
          key,
          name: SHORT_MONTHS_HR[mIdx],
          fullLabel: `${FULL_MONTHS_HR[mIdx]} ${y}.`,
          prijave: list.length,
          proslaGodina: prevList.length,
          kumulativno: running,
          members: list,
        })
      }
    }

    const total = points.reduce((s, p) => s + p.prijave, 0)
    const prevTotal = points.reduce((s, p) => s + p.proslaGodina, 0)
    const avg = points.length > 0 ? Number((total / points.length).toFixed(1)) : 0
    const best = points.reduce<RegDatum | null>(
      (acc, cur) => (!acc || cur.prijave > acc.prijave ? cur : acc),
      null
    )
    const trendPct =
      regRange === "years"
        ? null
        : prevTotal === 0
        ? total > 0
          ? 100
          : 0
        : Math.round(((total - prevTotal) / prevTotal) * 100)

    return { points, total, prevTotal, avg, best, trendPct }
  }, [societyMembers, regRange, currentYear, now])

  // ── 2. Podaci za tab "Struktura članstva" (međusobno isključive skupine)
  const structureModel = useMemo(() => {
    const counts: Record<(typeof STRUCTURE_META)[number]["key"], number> = {
      active: 0,
      honorary: 0,
      overdue: 0,
      inactive: 0,
      deceased: 0,
    }

    for (const m of societyMembers) {
      if (m.deceased) {
        counts.deceased += 1
      } else if (!m.expelled && (m.honorary || m.exemptFromPayment)) {
        counts.honorary += 1
      } else if (!m.expelled && m.paymentStatus === "overdue") {
        counts.overdue += 1
      } else if (!m.expelled && m.status === "active") {
        counts.active += 1
      } else {
        counts.inactive += 1
      }
    }

    const total = societyMembers.length
    const living = total - counts.deceased
    const activeTotal = counts.active + counts.honorary
    const activeRatePct = living > 0 ? Math.round((activeTotal / living) * 100) : 0

    const slices = STRUCTURE_META.map((meta) => ({
      ...meta,
      count: counts[meta.key],
      pct: total > 0 ? Number(((counts[meta.key] / total) * 100).toFixed(1)) : 0,
    }))

    return { slices, total, living, activeTotal, activeRatePct, counts }
  }, [societyMembers])

  // ── 3. Podaci za tab "Članarine po mjesecima (€)"
  const paymentsModel = useMemo(() => {
    const curAmount = new Array(12).fill(0)
    const curCount = new Array(12).fill(0)
    const prevAmount = new Array(12).fill(0)
    const prevCount = new Array(12).fill(0)

    for (const m of societyMembers) {
      for (const p of parseMemberPayments(m)) {
        const parsed = parseIsoParts(p?.date)
        if (!parsed) continue
        const amt = Number(p?.amount) || 0
        const idx = parsed.month - 1
        if (idx < 0 || idx > 11) continue
        if (parsed.year === currentYear) {
          curAmount[idx] += amt
          curCount[idx] += 1
        } else if (parsed.year === prevYear) {
          prevAmount[idx] += amt
          prevCount[idx] += 1
        }
      }
    }

    const points = SHORT_MONTHS_HR.map((short, idx) => ({
      name: short,
      fullLabel: `${FULL_MONTHS_HR[idx]} ${currentYear}.`,
      amount: Math.round(curAmount[idx] * 100) / 100,
      prevAmount: Math.round(prevAmount[idx] * 100) / 100,
      count: curCount[idx],
      prevCount: prevCount[idx],
    }))

    const totalEur = Math.round(curAmount.reduce((s, v) => s + v, 0) * 100) / 100
    const prevTotalEur = Math.round(prevAmount.reduce((s, v) => s + v, 0) * 100) / 100
    const totalCount = curCount.reduce((s, v) => s + v, 0)
    const yoyPct =
      prevTotalEur === 0
        ? totalEur > 0
          ? 100
          : 0
        : Math.round(((totalEur - prevTotalEur) / prevTotalEur) * 100)
    const bestMonth = points.reduce<(typeof points)[number] | null>(
      (acc, cur) =>
        !acc || (paymentMetric === "amount" ? cur.amount > acc.amount : cur.count > acc.count) ? cur : acc,
      null
    )

    return { points, totalEur, prevTotalEur, totalCount, yoyPct, bestMonth }
  }, [societyMembers, currentYear, prevYear, paymentMetric])

  // ── 4. Podaci za tab "Dobna struktura"
  const ageModel = useMemo(() => {
    const scopeMembers =
      ageScope === "active"
        ? societyMembers.filter((m) => !m.deceased && !m.expelled && m.status === "active")
        : societyMembers.filter((m) => !m.deceased && !m.expelled)

    const ages: number[] = []
    const buckets = AGE_BUCKETS.map((b) => ({
      id: b.id,
      label: b.label,
      count: 0,
      members: [] as Array<{ member: Member; age: number }>,
    }))

    for (const m of scopeMembers) {
      const p = parseIsoParts(m.birthDate)
      if (!p) continue
      let age = currentYear - p.year
      if (now.getMonth() + 1 < p.month || (now.getMonth() + 1 === p.month && now.getDate() < p.day)) {
        age -= 1
      }
      if (age < 5 || age > 115) continue
      ages.push(age)
      const idx = AGE_BUCKETS.findIndex((b) => age >= b.min && age <= b.max)
      if (idx !== -1) {
        buckets[idx].count += 1
        buckets[idx].members.push({ member: m, age })
      }
    }

    for (const b of buckets) {
      b.members.sort((a, b2) => a.age - b2.age)
    }

    const sortedAges = [...ages].sort((a, b) => a - b)
    const avgAge = ages.length > 0 ? Number((ages.reduce((s, a) => s + a, 0) / ages.length).toFixed(1)) : 0
    const medianAge =
      sortedAges.length === 0
        ? 0
        : sortedAges.length % 2 === 1
        ? sortedAges[(sortedAges.length - 1) / 2]
        : Number(((sortedAges[sortedAges.length / 2 - 1] + sortedAges[sortedAges.length / 2]) / 2).toFixed(1))

    const topBucket = buckets.reduce<(typeof buckets)[number] | null>(
      (acc, cur) => (!acc || cur.count > acc.count ? cur : acc),
      null
    )

    return {
      buckets,
      totalInScope: scopeMembers.length,
      withBirthDate: ages.length,
      avgAge,
      medianAge,
      topBucket,
    }
  }, [societyMembers, ageScope, currentYear, now])

  // ── 5. Podaci za tab "Gradovi i područja istraživanja"
  const geoModel = useMemo(() => {
    const cityCounts = new Map<string, number>()
    const areaCounts = new Map<string, number>()
    let zagrebCount = 0
    let croatiaOtherCount = 0
    let abroadCount = 0

    for (const m of societyMembers) {
      const { city, region } = extractCityAndRegion(m.address)
      if (region === "zagreb") zagrebCount += 1
      else if (region === "croatia") croatiaOtherCount += 1
      else if (region === "abroad") abroadCount += 1

      if (city) {
        cityCounts.set(city, (cityCounts.get(city) || 0) + 1)
      }

      const rawAreas = Array.isArray(m.researchAreas) ? m.researchAreas : []
      for (const area of rawAreas) {
        const trimmed = String(area || "").trim()
        if (!trimmed) continue
        areaCounts.set(trimmed, (areaCounts.get(trimmed) || 0) + 1)
      }
    }

    const topCities = Array.from(cityCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "hr"))
      .slice(0, 8)

    const topAreas = Array.from(areaCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "hr"))
      .slice(0, 8)

    const knownRegionTotal = zagrebCount + croatiaOtherCount + abroadCount
    return {
      topCities,
      topAreas,
      zagrebCount,
      croatiaOtherCount,
      abroadCount,
      knownRegionTotal,
      uniqueCities: cityCounts.size,
      uniqueAreas: areaCounts.size,
    }
  }, [societyMembers])

  // Aktivni drill-down zapisi
  const selectedRegBucket = useMemo(
    () => registrationsModel.points.find((p) => p.key === selectedRegBucketKey) ?? null,
    [registrationsModel.points, selectedRegBucketKey]
  )
  const selectedAgeBucket = useMemo(
    () => ageModel.buckets.find((b) => b.id === selectedAgeBucketId) ?? null,
    [ageModel.buckets, selectedAgeBucketId]
  )

  // Naslovi po tabu
  const tabHeader = useMemo(() => {
    switch (activeTab) {
      case "registrations":
        return {
          title: "Prijave novih članova",
          subtitle:
            regRange === "years"
              ? "Povijesni pregled upisa po godinama (kliknite na stupac za popis članova)"
              : `Trend registracije članova kroz zadnjih ${regRange === "6m" ? "6" : "12"} mjeseci (kliknite na stupac za popis)`,
        }
      case "structure":
        return {
          title: "Struktura članstva Društva",
          subtitle: "Pregled aktivnih, počasnih, dužnika, neaktivnih i preminulih članova u registru",
        }
      case "payments":
        return {
          title: `Članarine po mjesecima (${currentYear}.)`,
          subtitle: `Dinamika prikupljenih uplata i usporedba s ${prevYear}. godinom`,
        }
      case "age":
        return {
          title: "Dobna struktura članstva",
          subtitle: "Raspodjela članova po dobnim skupinama (kliknite na skupinu za pregled popisa)",
        }
      case "geo":
        return {
          title: "Gradovi i područja istraživanja",
          subtitle: "Geografska rasprostranjenost članova i najzastupljenije rodoslovne regije",
        }
    }
  }, [activeTab, regRange, currentYear, prevYear])

  const analyticsTabs: SectionTabItem<AnalyticsTab>[] = useMemo(
    () => [
      { id: "registrations", label: "Novi članovi", shortLabel: "Prijave", icon: UserPlus, count: registrationsModel.total },
      { id: "structure", label: "Struktura", icon: PieChartIcon, count: structureModel.total },
      { id: "payments", label: "Članarine (€)", shortLabel: "Članarine", icon: Euro },
      { id: "age", label: "Dobna struktura", shortLabel: "Dob", icon: Users },
      { id: "geo", label: "Gradovi i područja", shortLabel: "Područja", icon: MapPin },
    ],
    [registrationsModel.total, structureModel.total]
  )

  // ── Izvoz CSV-a (UTF-8 BOM + točka-zarez za HR Excel)
  const handleExportCsv = () => {
    const lines: string[] = []
    const esc = (val: string | number) => `"${String(val).replace(/"/g, '""')}"`

    if (activeTab === "registrations") {
      lines.push(["Razdoblje", "Novi članovi", "Prošla godina", "Kumulativno"].map(esc).join(";"))
      for (const p of registrationsModel.points) {
        lines.push([p.fullLabel, p.prijave, p.proslaGodina, p.kumulativno].map(esc).join(";"))
      }
    } else if (activeTab === "structure") {
      lines.push(["Kategorija", "Broj članova", "Udio (%)"].map(esc).join(";"))
      for (const s of structureModel.slices) {
        lines.push([s.label, s.count, `${s.pct}%`].map(esc).join(";"))
      }
    } else if (activeTab === "payments") {
      lines.push(
        ["Mjesec", `${currentYear}. (€)`, `${currentYear}. (uplate)`, `${prevYear}. (€)`, `${prevYear}. (uplate)`]
          .map(esc)
          .join(";")
      )
      for (const p of paymentsModel.points) {
        lines.push([p.fullLabel, p.amount, p.count, p.prevAmount, p.prevCount].map(esc).join(";"))
      }
    } else if (activeTab === "age") {
      lines.push(["Dobna skupina", "Broj članova"].map(esc).join(";"))
      for (const b of ageModel.buckets) {
        lines.push([b.label, b.count].map(esc).join(";"))
      }
    } else {
      const list = geoMode === "cities" ? geoModel.topCities : geoModel.topAreas
      lines.push([geoMode === "cities" ? "Grad / mjesto" : "Područje istraživanja", "Broj članova"].map(esc).join(";"))
      for (const item of list) {
        lines.push([item.name, item.count].map(esc).join(";"))
      }
    }

    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    const todayIso = now.toISOString().slice(0, 10)
    a.href = url
    a.download = `hrd-analitika-${activeTab}-${todayIso}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setExportSuccessLabel("CSV preuzet")
    setTimeout(() => setExportSuccessLabel(null), 2000)
  }

  // ── Izvoz slike grafa (PNG 2× rezolucija)
  const handleExportPng = () => {
    const container = chartContainerRef.current
    if (!container) return
    const svgEl = container.querySelector("svg")
    if (!svgEl) return

    const rect = svgEl.getBoundingClientRect()
    const width = Math.max(600, Math.round(rect.width || 680))
    const height = Math.max(240, Math.round(rect.height || 260))

    const cloned = svgEl.cloneNode(true) as SVGSVGElement
    cloned.setAttribute("xmlns", "http://www.w3.org/2000/svg")
    cloned.setAttribute("width", String(width))
    cloned.setAttribute("height", String(height))

    const svgData = new XMLSerializer().serializeToString(cloned)
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" })
    const svgUrl = URL.createObjectURL(svgBlob)

    const img = new Image()
    img.onload = () => {
      const scale = 2
      const headerHeight = 52
      const pad = 20
      const canvas = document.createElement("canvas")
      canvas.width = (width + pad * 2) * scale
      canvas.height = (height + headerHeight + pad) * scale
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        URL.revokeObjectURL(svgUrl)
        return
      }
      ctx.scale(scale, scale)
      ctx.fillStyle = "#FFFFFF"
      ctx.fillRect(0, 0, width + pad * 2, height + headerHeight + pad)

      // Zaglavlje na PNG izvozu
      ctx.fillStyle = "#1E3A5F"
      ctx.fillRect(0, 0, width + pad * 2, 4)
      ctx.fillStyle = "#1B2B36"
      ctx.font = "bold 15px Georgia, serif"
      ctx.fillText(`HRD „Pavao Ritter Vitezović” — ${tabHeader.title}`, pad, 28)
      ctx.fillStyle = "#6B7280"
      ctx.font = "11px sans-serif"
      ctx.fillText(`Stanje na dan: ${formatDateDMY(now)}`, pad, 44)

      ctx.drawImage(img, pad, headerHeight, width, height)
      URL.revokeObjectURL(svgUrl)

      canvas.toBlob((blob) => {
        if (!blob) return
        const pngUrl = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = pngUrl
        a.download = `hrd-graf-${activeTab}-${now.toISOString().slice(0, 10)}.png`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(pngUrl)
        setExportSuccessLabel("PNG spremljen")
        setTimeout(() => setExportSuccessLabel(null), 2000)
      }, "image/png")
    }
    img.onerror = () => {
      URL.revokeObjectURL(svgUrl)
    }
    img.src = svgUrl
  }

  // Promjena taba čisti hover i drill-down odabir
  const handleTabChange = (nextTab: AnalyticsTab) => {
    setActiveTab(nextTab)
    setHoveredIndex(null)
    setSelectedRegBucketKey(null)
    setSelectedAgeBucketId(null)
  }

  return (
    <div className="rounded-3xl border border-border bg-white p-5 md:p-6 shadow-sm space-y-4">
      {/* Zaglavlje kartice + gumbi izvoza */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h3 className="font-serif text-xl font-bold text-primary leading-tight">{tabHeader.title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{tabHeader.subtitle}</p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {exportSuccessLabel && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
              <Check className="h-3 w-3" /> {exportSuccessLabel}
            </span>
          )}
          <button
            type="button"
            onClick={handleExportCsv}
            title="Preuzmi podatke u CSV tablici (Excel)"
            className="inline-flex items-center gap-1 rounded-full border border-[#E8E4DE] bg-[#FBF9F6] px-2.5 py-1 text-[11px] font-bold text-[#1E3A5F] hover:bg-[#EFF5FB] hover:border-[#1E3A5F]/40 transition-colors"
          >
            <Download className="h-3 w-3 text-[#CEA369]" />
            <span>CSV</span>
          </button>
          <button
            type="button"
            onClick={handleExportPng}
            title="Spremi sliku grafa (PNG)"
            className="inline-flex items-center gap-1 rounded-full border border-[#E8E4DE] bg-[#FBF9F6] px-2.5 py-1 text-[11px] font-bold text-[#1E3A5F] hover:bg-[#EFF5FB] hover:border-[#1E3A5F]/40 transition-colors"
          >
            <ImageDown className="h-3 w-3 text-[#264E82]" />
            <span>PNG</span>
          </button>
        </div>
      </div>

      {/* Izbornik 5 analitičkih pogleda (SectionTabsBar) */}
      <SectionTabsBar
        tabs={analyticsTabs}
        value={activeTab}
        onValueChange={handleTabChange}
        variant="compact"
        mobileLayout="scroll"
        fullWidth
        ariaLabel="Analitika članstva Društva"
      />

      {/* Traka od 4 dinamične mini-statistike */}
      {activeTab === "registrations" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="rounded-2xl border border-[#E8E4DE] bg-[#FBF9F6] px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Ukupno upisa
            </span>
            <span className="font-serif text-lg font-bold text-[#1B2B36] tabular-nums">
              {registrationsModel.total}
            </span>
          </div>
          <div className="rounded-2xl border border-[#E8E4DE] bg-[#FBF9F6] px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              {regRange === "years" ? "Ukupno godina" : "Vs. prošla god."}
            </span>
            {regRange === "years" ? (
              <span className="font-serif text-lg font-bold text-[#1E3A5F] tabular-nums">
                {registrationsModel.points.length}
              </span>
            ) : (
              <span
                className={cn(
                  "font-serif text-lg font-bold tabular-nums",
                  (registrationsModel.trendPct ?? 0) > 0
                    ? "text-emerald-700"
                    : (registrationsModel.trendPct ?? 0) < 0
                    ? "text-rose-700"
                    : "text-[#1B2B36]"
                )}
              >
                {(registrationsModel.trendPct ?? 0) > 0
                  ? `+${registrationsModel.trendPct}%`
                  : `${registrationsModel.trendPct ?? 0}%`}
              </span>
            )}
          </div>
          <div className="rounded-2xl border border-[#E8E4DE] bg-[#FBF9F6] px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Najjači period
            </span>
            <span className="text-xs sm:text-sm font-bold text-[#1E3A5F] tabular-nums truncate block mt-0.5">
              {registrationsModel.best && registrationsModel.best.prijave > 0
                ? `${registrationsModel.best.name} (${registrationsModel.best.prijave})`
                : "—"}
            </span>
          </div>
          <div className="rounded-2xl border border-[#E8E4DE] bg-[#FBF9F6] px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Prosjek
            </span>
            <span className="font-serif text-lg font-bold text-[#8E622A] tabular-nums">
              {registrationsModel.avg}
              <span className="text-[11px] font-sans font-semibold text-muted-foreground">
                {regRange === "years" ? " / god." : " / mj."}
              </span>
            </span>
          </div>
        </div>
      )}

      {activeTab === "structure" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="rounded-2xl border border-[#E8E4DE] bg-[#FBF9F6] px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Aktivni članovi
            </span>
            <span className="font-serif text-lg font-bold text-[#1E3A5F] tabular-nums">
              {structureModel.activeTotal}{" "}
              <span className="text-xs font-sans text-muted-foreground">
                ({structureModel.activeRatePct}%)
              </span>
            </span>
          </div>
          <div className="rounded-2xl border border-[#E8E4DE] bg-[#FBF9F6] px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Počasni / oslobođeni
            </span>
            <span className="font-serif text-lg font-bold text-[#8E622A] tabular-nums">
              {structureModel.counts.honorary}
            </span>
          </div>
          <div className="rounded-2xl border border-[#E8E4DE] bg-[#FBF9F6] px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              S dugovanjem
            </span>
            <span className="font-serif text-lg font-bold text-red-700 tabular-nums">
              {structureModel.counts.overdue}
            </span>
          </div>
          <div className="rounded-2xl border border-[#E8E4DE] bg-[#FBF9F6] px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Ukupno u registru
            </span>
            <span className="font-serif text-lg font-bold text-[#1B2B36] tabular-nums">
              {structureModel.total}
            </span>
          </div>
        </div>
      )}

      {activeTab === "payments" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="rounded-2xl border border-[#E8E4DE] bg-[#FBF9F6] px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Prikupljeno ({currentYear}.)
            </span>
            <span className="font-serif text-lg font-bold text-[#1B2B36] tabular-nums">
              {paymentsModel.totalEur.toLocaleString("hr-HR", { maximumFractionDigits: 2 })} €
            </span>
          </div>
          <div className="rounded-2xl border border-[#E8E4DE] bg-[#FBF9F6] px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Vs. {prevYear}. god.
            </span>
            <span
              className={cn(
                "font-serif text-lg font-bold tabular-nums",
                paymentsModel.yoyPct > 0
                  ? "text-emerald-700"
                  : paymentsModel.yoyPct < 0
                  ? "text-rose-700"
                  : "text-[#1B2B36]"
              )}
            >
              {paymentsModel.yoyPct > 0 ? `+${paymentsModel.yoyPct}%` : `${paymentsModel.yoyPct}%`}
            </span>
          </div>
          <div className="rounded-2xl border border-[#E8E4DE] bg-[#FBF9F6] px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Evidentirane uplate
            </span>
            <span className="font-serif text-lg font-bold text-[#1E3A5F] tabular-nums">
              {paymentsModel.totalCount}
            </span>
          </div>
          <div className="rounded-2xl border border-[#E8E4DE] bg-[#FBF9F6] px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Najjači mjesec
            </span>
            <span className="text-xs sm:text-sm font-bold text-[#8E622A] tabular-nums truncate block mt-0.5">
              {paymentsModel.bestMonth && (paymentsModel.bestMonth.amount > 0 || paymentsModel.bestMonth.count > 0)
                ? paymentMetric === "amount"
                  ? `${paymentsModel.bestMonth.name} (${paymentsModel.bestMonth.amount} €)`
                  : `${paymentsModel.bestMonth.name} (${paymentsModel.bestMonth.count})`
                : "—"}
            </span>
          </div>
        </div>
      )}

      {activeTab === "age" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="rounded-2xl border border-[#E8E4DE] bg-[#FBF9F6] px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Prosječna dob
            </span>
            <span className="font-serif text-lg font-bold text-[#1E3A5F] tabular-nums">
              {ageModel.avgAge > 0 ? `${ageModel.avgAge} god.` : "—"}
            </span>
          </div>
          <div className="rounded-2xl border border-[#E8E4DE] bg-[#FBF9F6] px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Medijan dobi
            </span>
            <span className="font-serif text-lg font-bold text-[#1B2B36] tabular-nums">
              {ageModel.medianAge > 0 ? `${ageModel.medianAge} god.` : "—"}
            </span>
          </div>
          <div className="rounded-2xl border border-[#E8E4DE] bg-[#FBF9F6] px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Najbrojnija skupina
            </span>
            <span className="text-xs sm:text-sm font-bold text-[#8E622A] tabular-nums truncate block mt-0.5">
              {ageModel.topBucket && ageModel.topBucket.count > 0 ? ageModel.topBucket.label : "—"}
            </span>
          </div>
          <div className="rounded-2xl border border-[#E8E4DE] bg-[#FBF9F6] px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Poznat datum rođ.
            </span>
            <span className="font-serif text-lg font-bold text-[#1B2B36] tabular-nums">
              {ageModel.withBirthDate} / {ageModel.totalInScope}
            </span>
          </div>
        </div>
      )}

      {activeTab === "geo" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="rounded-2xl border border-[#E8E4DE] bg-[#FBF9F6] px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Zagreb
            </span>
            <span className="font-serif text-lg font-bold text-[#1E3A5F] tabular-nums">
              {geoModel.zagrebCount}{" "}
              <span className="text-xs font-sans text-muted-foreground">
                ({geoModel.knownRegionTotal > 0 ? Math.round((geoModel.zagrebCount / geoModel.knownRegionTotal) * 100) : 0}%)
              </span>
            </span>
          </div>
          <div className="rounded-2xl border border-[#E8E4DE] bg-[#FBF9F6] px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Ostatak Hrvatske
            </span>
            <span className="font-serif text-lg font-bold text-[#1B2B36] tabular-nums">
              {geoModel.croatiaOtherCount}{" "}
              <span className="text-xs font-sans text-muted-foreground">
                ({geoModel.knownRegionTotal > 0 ? Math.round((geoModel.croatiaOtherCount / geoModel.knownRegionTotal) * 100) : 0}%)
              </span>
            </span>
          </div>
          <div className="rounded-2xl border border-[#E8E4DE] bg-[#FBF9F6] px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Inozemstvo
            </span>
            <span className="font-serif text-lg font-bold text-[#8E622A] tabular-nums">
              {geoModel.abroadCount}
            </span>
          </div>
          <div className="rounded-2xl border border-[#E8E4DE] bg-[#FBF9F6] px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Područja interesa
            </span>
            <span className="font-serif text-lg font-bold text-[#1B2B36] tabular-nums">
              {geoModel.uniqueAreas}
            </span>
          </div>
        </div>
      )}

      {/* Sekundarne kontrole za odabrani tab */}
      {activeTab === "registrations" && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="inline-flex rounded-xl bg-[#F2EFE9] border border-[#E8E4DE] p-0.5">
              {(
                [
                  { id: "6m", label: "6 mj." },
                  { id: "12m", label: "12 mj." },
                  { id: "years", label: "Po godinama" },
                ] as const
              ).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setRegRange(r.id)
                    setSelectedRegBucketKey(null)
                    setHoveredIndex(null)
                  }}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors",
                    regRange === r.id
                      ? "bg-[#1E3A5F] text-white shadow-2xs"
                      : "text-[#1E3A5F]/80 hover:text-[#1E3A5F]"
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {regRange !== "years" && regMode !== "cumulative" && (
              <button
                type="button"
                onClick={() => setCompareLastYear((v) => !v)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[11px] font-bold transition-colors",
                  compareLastYear
                    ? "border-[#CEA369] bg-[#FEFCE8] text-[#7C2D12]"
                    : "border-[#E8E4DE] bg-[#FBF9F6] text-muted-foreground hover:text-[#1E3A5F]"
                )}
              >
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    compareLastYear ? "bg-[#CEA369]" : "bg-slate-300"
                  )}
                />
                Usporedi s prošlom god.
              </button>
            )}
          </div>

          <div className="inline-flex rounded-xl bg-[#F2EFE9] border border-[#E8E4DE] p-0.5">
            <button
              type="button"
              onClick={() => setRegMode("bar")}
              className={cn(
                "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors",
                regMode === "bar" ? "bg-[#1E3A5F] text-white shadow-2xs" : "text-[#1E3A5F]/80 hover:text-[#1E3A5F]"
              )}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              <span>Stupci</span>
            </button>
            <button
              type="button"
              onClick={() => setRegMode("area")}
              className={cn(
                "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors",
                regMode === "area" ? "bg-[#1E3A5F] text-white shadow-2xs" : "text-[#1E3A5F]/80 hover:text-[#1E3A5F]"
              )}
            >
              <TrendingUp className="h-3.5 w-3.5" />
              <span>Krivulja</span>
            </button>
            <button
              type="button"
              onClick={() => setRegMode("cumulative")}
              className={cn(
                "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors",
                regMode === "cumulative"
                  ? "bg-[#1E3A5F] text-white shadow-2xs"
                  : "text-[#1E3A5F]/80 hover:text-[#1E3A5F]"
              )}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Kumulativno</span>
            </button>
          </div>
        </div>
      )}

      {activeTab === "payments" && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
          <div className="inline-flex rounded-xl bg-[#F2EFE9] border border-[#E8E4DE] p-0.5">
            <button
              type="button"
              onClick={() => setPaymentMetric("amount")}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors",
                paymentMetric === "amount"
                  ? "bg-[#1E3A5F] text-white shadow-2xs"
                  : "text-[#1E3A5F]/80 hover:text-[#1E3A5F]"
              )}
            >
              Iznos (€)
            </button>
            <button
              type="button"
              onClick={() => setPaymentMetric("count")}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors",
                paymentMetric === "count"
                  ? "bg-[#1E3A5F] text-white shadow-2xs"
                  : "text-[#1E3A5F]/80 hover:text-[#1E3A5F]"
              )}
            >
              Broj uplata
            </button>
          </div>

          <button
            type="button"
            onClick={() => setComparePaymentsPrevYear((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[11px] font-bold transition-colors",
              comparePaymentsPrevYear
                ? "border-[#CEA369] bg-[#FEFCE8] text-[#7C2D12]"
                : "border-[#E8E4DE] bg-[#FBF9F6] text-muted-foreground hover:text-[#1E3A5F]"
            )}
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                comparePaymentsPrevYear ? "bg-[#CEA369]" : "bg-slate-300"
              )}
            />
            Usporedi s {prevYear}. godinom
          </button>
        </div>
      )}

      {activeTab === "age" && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
          <div className="inline-flex rounded-xl bg-[#F2EFE9] border border-[#E8E4DE] p-0.5">
            <button
              type="button"
              onClick={() => {
                setAgeScope("active")
                setSelectedAgeBucketId(null)
              }}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors",
                ageScope === "active"
                  ? "bg-[#1E3A5F] text-white shadow-2xs"
                  : "text-[#1E3A5F]/80 hover:text-[#1E3A5F]"
              )}
            >
              Samo aktivni članovi
            </button>
            <button
              type="button"
              onClick={() => {
                setAgeScope("living")
                setSelectedAgeBucketId(null)
              }}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors",
                ageScope === "living"
                  ? "bg-[#1E3A5F] text-white shadow-2xs"
                  : "text-[#1E3A5F]/80 hover:text-[#1E3A5F]"
              )}
            >
              Svi živi članovi
            </button>
          </div>
          <span className="text-[11px] text-muted-foreground">Kliknite na stupac za popis članova u skupini</span>
        </div>
      )}

      {activeTab === "geo" && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
          <div className="inline-flex rounded-xl bg-[#F2EFE9] border border-[#E8E4DE] p-0.5">
            <button
              type="button"
              onClick={() => {
                setGeoMode("cities")
                setHoveredIndex(null)
              }}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors",
                geoMode === "cities"
                  ? "bg-[#1E3A5F] text-white shadow-2xs"
                  : "text-[#1E3A5F]/80 hover:text-[#1E3A5F]"
              )}
            >
              Top gradovi ({geoModel.uniqueCities})
            </button>
            <button
              type="button"
              onClick={() => {
                setGeoMode("areas")
                setHoveredIndex(null)
              }}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors",
                geoMode === "areas"
                  ? "bg-[#1E3A5F] text-white shadow-2xs"
                  : "text-[#1E3A5F]/80 hover:text-[#1E3A5F]"
              )}
            >
              Područja istraživanja ({geoModel.uniqueAreas})
            </button>
          </div>
          <span className="text-[11px] text-muted-foreground">Prikaz 8 najzastupljenijih stavki</span>
        </div>
      )}

      {/* ─── Područje samog grafikona ────────────────────────────────────────── */}
      <div
        key={`${activeTab}-${regRange}-${regMode}-${geoMode}-${ageScope}-${paymentMetric}`}
        ref={chartContainerRef}
        className="hrd-chart-panel-in w-full"
      >
        {/* 1. NOVI ČLANOVI */}
        {activeTab === "registrations" && (
          <div className="h-[255px] w-full">
            {regMode === "area" ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={registrationsModel.points} margin={{ top: 14, right: 12, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="hrdRegAreaFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#264E82" stopOpacity={0.32} />
                      <stop offset="100%" stopColor="#264E82" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8E4DE" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fontWeight: 600, fill: "#6B7280" }}
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fontWeight: 500, fill: "#6B7280" }}
                  />
                  {registrationsModel.avg > 0 && (
                    <ReferenceLine
                      y={registrationsModel.avg}
                      stroke="#CEA369"
                      strokeDasharray="4 4"
                      strokeOpacity={0.9}
                    />
                  )}
                  <Tooltip
                    cursor={{ stroke: "#CEA369", strokeWidth: 1.5, strokeDasharray: "3 3" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const p = payload[0]?.payload as (typeof registrationsModel.points)[number]
                      if (!p) return null
                      const lines: RichTooltipLine[] = [
                        { label: "Novi upisi", value: formatNewMembersNoun(p.prijave), tone: "gold" },
                      ]
                      if (compareLastYear && regRange !== "years") {
                        lines.push({ label: "Isto razdoblje lani", value: formatNewMembersNoun(p.proslaGodina) })
                      }
                      lines.push({ label: "Ukupno u bazi", value: String(p.kumulativno) })
                      return <RichChartTooltip title={p.fullLabel} lines={lines} />
                    }}
                  />
                  {compareLastYear && regRange !== "years" && (
                    <Area
                      type="monotone"
                      dataKey="proslaGodina"
                      stroke="#94A3B8"
                      strokeWidth={1.75}
                      strokeDasharray="4 4"
                      fillOpacity={0}
                      dot={false}
                      animationDuration={450}
                    />
                  )}
                  <Area
                    type="monotone"
                    dataKey="prijave"
                    stroke="#1E3A5F"
                    strokeWidth={2.5}
                    fill="url(#hrdRegAreaFill)"
                    dot={{ r: 3.5, fill: "#1E3A5F", stroke: "#FFFFFF", strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: "#CEA369", stroke: "#1B2B36", strokeWidth: 2 }}
                    animationDuration={450}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : regMode === "cumulative" ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={registrationsModel.points} margin={{ top: 14, right: 4, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="hrdRegNavy" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#264E82" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#1E3A5F" stopOpacity={0.85} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8E4DE" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fontWeight: 600, fill: "#6B7280" }}
                  />
                  <YAxis
                    yAxisId="left"
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fontWeight: 500, fill: "#6B7280" }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fontWeight: 600, fill: "#B5843E" }}
                  />
                  <Tooltip
                    cursor={{ fill: "#F2EFE9", opacity: 0.7 }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const p = payload[0]?.payload as (typeof registrationsModel.points)[number]
                      if (!p) return null
                      return (
                        <RichChartTooltip
                          title={p.fullLabel}
                          lines={[
                            { label: "Novi u razdoblju", value: formatNewMembersNoun(p.prijave) },
                            { label: "Ukupan kumulativ", value: formatMembersNoun(p.kumulativno), tone: "gold" },
                          ]}
                          hint="Kliknite na stupac za popis članova"
                        />
                      )
                    }}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="prijave"
                    radius={[7, 7, 2, 2]}
                    maxBarSize={28}
                    animationDuration={450}
                    className="cursor-pointer"
                    onMouseEnter={(_d, idx) => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    onClick={(_d, idx) => {
                      const pt = registrationsModel.points[idx]
                      if (pt) setSelectedRegBucketKey((cur) => (cur === pt.key ? null : pt.key))
                    }}
                  >
                    {registrationsModel.points.map((entry, idx) => (
                      <Cell
                        key={`cum-${entry.key}`}
                        fill="url(#hrdRegNavy)"
                        fillOpacity={hoveredIndex === null || hoveredIndex === idx ? 1 : 0.42}
                      />
                    ))}
                  </Bar>
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="kumulativno"
                    stroke="#CEA369"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "#CEA369", stroke: "#1B2B36", strokeWidth: 1.5 }}
                    activeDot={{ r: 5.5, fill: "#1B2B36", stroke: "#CEA369", strokeWidth: 2 }}
                    animationDuration={500}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={registrationsModel.points} margin={{ top: 14, right: 12, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="hrdBarNavy" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#264E82" stopOpacity={0.96} />
                      <stop offset="100%" stopColor="#1E3A5F" stopOpacity={0.88} />
                    </linearGradient>
                    <linearGradient id="hrdBarGold" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#D8B178" stopOpacity={1} />
                      <stop offset="100%" stopColor="#B5843E" stopOpacity={0.95} />
                    </linearGradient>
                    <linearGradient id="hrdBarZero" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#E8E4DE" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#DFD9CE" stopOpacity={0.85} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8E4DE" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fontWeight: 600, fill: "#6B7280" }}
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fontWeight: 500, fill: "#6B7280" }}
                  />
                  {registrationsModel.avg > 0 && (
                    <ReferenceLine
                      y={registrationsModel.avg}
                      stroke="#CEA369"
                      strokeDasharray="4 4"
                      strokeOpacity={0.9}
                    />
                  )}
                  <Tooltip
                    cursor={{ fill: "#F2EFE9", opacity: 0.7 }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const p = payload[0]?.payload as (typeof registrationsModel.points)[number]
                      if (!p) return null
                      const idx = registrationsModel.points.findIndex((x) => x.key === p.key)
                      const prev = idx > 0 ? registrationsModel.points[idx - 1] : null
                      const delta = prev ? p.prijave - prev.prijave : null
                      const lines: RichTooltipLine[] = [
                        { label: "Novi upisi", value: formatNewMembersNoun(p.prijave), tone: "gold" },
                      ]
                      if (delta !== null) {
                        lines.push({
                          label: "Vs. prethodni",
                          value: delta > 0 ? `+${delta}` : String(delta),
                          tone: delta > 0 ? "positive" : delta < 0 ? "negative" : "default",
                        })
                      }
                      if (compareLastYear && regRange !== "years") {
                        lines.push({ label: "Isto lani", value: formatNewMembersNoun(p.proslaGodina) })
                      }
                      return (
                        <RichChartTooltip
                          title={p.fullLabel}
                          lines={lines}
                          hint="Kliknite na stupac za popis osoba"
                        />
                      )
                    }}
                  />
                  {compareLastYear && regRange !== "years" && (
                    <Bar
                      dataKey="proslaGodina"
                      fill="#CBD5E1"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={18}
                      animationDuration={400}
                    />
                  )}
                  <Bar
                    dataKey="prijave"
                    radius={[8, 8, 2, 2]}
                    maxBarSize={30}
                    animationDuration={450}
                    className="cursor-pointer"
                    onMouseEnter={(_d, idx) => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    onClick={(_d, idx) => {
                      const pt = registrationsModel.points[idx]
                      if (pt) setSelectedRegBucketKey((cur) => (cur === pt.key ? null : pt.key))
                    }}
                  >
                    {registrationsModel.points.map((entry, idx) => {
                      const isLast = idx === registrationsModel.points.length - 1
                      const isSelected = selectedRegBucketKey === entry.key
                      const fill =
                        isLast || isSelected
                          ? "url(#hrdBarGold)"
                          : entry.prijave === 0
                          ? "url(#hrdBarZero)"
                          : "url(#hrdBarNavy)"
                      return (
                        <Cell
                          key={`reg-${entry.key}`}
                          fill={fill}
                          fillOpacity={hoveredIndex === null || hoveredIndex === idx ? 1 : 0.42}
                          stroke={isSelected ? "#1B2B36" : undefined}
                          strokeWidth={isSelected ? 1.5 : 0}
                        />
                      )
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        )}

        {/* 2. STRUKTURA ČLANSTVA (DONUT) */}
        {activeTab === "structure" && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center min-h-[255px]">
            <div className="md:col-span-2 relative h-[230px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const s = payload[0]?.payload as (typeof structureModel.slices)[number]
                      if (!s) return null
                      return (
                        <RichChartTooltip
                          title={s.label}
                          lines={[
                            { label: "Broj", value: formatMembersNoun(s.count), tone: "gold" },
                            { label: "Udio", value: `${s.pct}%` },
                          ]}
                        />
                      )
                    }}
                  />
                  <Pie
                    data={structureModel.slices}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={88}
                    paddingAngle={2.5}
                    animationDuration={450}
                    onMouseEnter={(_d, idx) => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  >
                    {structureModel.slices.map((s, idx) => (
                      <Cell
                        key={s.key}
                        fill={s.color}
                        fillOpacity={hoveredIndex === null || hoveredIndex === idx ? 1 : 0.4}
                        stroke="#FFFFFF"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              {/* Središnji broj u Donut prstenu */}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="font-serif text-2xl font-bold text-[#1B2B36] tabular-nums leading-none">
                  {structureModel.total}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1">
                  Članova
                </span>
              </div>
            </div>

            <div className="md:col-span-3 space-y-2">
              {structureModel.slices.map((s, idx) => (
                <Link
                  key={s.key}
                  href={s.href}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-xs transition-all",
                    hoveredIndex === idx
                      ? "border-[#CEA369] bg-[#FEFCE8]/70 shadow-2xs"
                      : "border-[#E8E4DE] bg-[#FBF9F6] hover:bg-white"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="font-semibold text-[#1B2B36] truncate">{s.label}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 tabular-nums">
                    <span className="font-bold text-[#1B2B36]">{s.count}</span>
                    <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold", s.badgeBg)}>
                      {s.pct}%
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* 3. ČLANARINE PO MJESECIMA (€) */}
        {activeTab === "payments" && (
          <div className="h-[255px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={paymentsModel.points} margin={{ top: 14, right: 12, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="hrdPayGold" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#D8B178" stopOpacity={1} />
                    <stop offset="100%" stopColor="#B5843E" stopOpacity={0.92} />
                  </linearGradient>
                  <linearGradient id="hrdPayNavy" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#264E82" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#1E3A5F" stopOpacity={0.85} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8E4DE" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fontWeight: 600, fill: "#6B7280" }}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fontWeight: 500, fill: "#6B7280" }}
                />
                <Tooltip
                  cursor={{ fill: "#F2EFE9", opacity: 0.7 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const p = payload[0]?.payload as (typeof paymentsModel.points)[number]
                    if (!p) return null
                    const lines: RichTooltipLine[] = [
                      { label: `${currentYear}. iznos`, value: `${p.amount.toFixed(2)} €`, tone: "gold" },
                      { label: `${currentYear}. uplata`, value: String(p.count) },
                    ]
                    if (comparePaymentsPrevYear) {
                      lines.push({
                        label: `${prevYear}. (${paymentMetric === "amount" ? "€" : "upl."})`,
                        value:
                          paymentMetric === "amount" ? `${p.prevAmount.toFixed(2)} €` : String(p.prevCount),
                      })
                    }
                    return <RichChartTooltip title={p.fullLabel} lines={lines} />
                  }}
                />
                {comparePaymentsPrevYear && (
                  <Bar
                    dataKey={paymentMetric === "amount" ? "prevAmount" : "prevCount"}
                    fill="#CBD5E1"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={18}
                    animationDuration={400}
                  />
                )}
                <Bar
                  dataKey={paymentMetric === "amount" ? "amount" : "count"}
                  radius={[8, 8, 2, 2]}
                  maxBarSize={28}
                  animationDuration={450}
                  onMouseEnter={(_d, idx) => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  {paymentsModel.points.map((p, idx) => (
                    <Cell
                      key={`pay-${p.name}`}
                      fill={idx === now.getMonth() ? "url(#hrdPayGold)" : "url(#hrdPayNavy)"}
                      fillOpacity={hoveredIndex === null || hoveredIndex === idx ? 1 : 0.42}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 4. DOBNA STRUKTURA */}
        {activeTab === "age" && (
          <div className="h-[255px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ageModel.buckets} margin={{ top: 14, right: 12, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="hrdAgeNavy" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#264E82" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#1E3A5F" stopOpacity={0.86} />
                  </linearGradient>
                  <linearGradient id="hrdAgeGold" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#D8B178" stopOpacity={1} />
                    <stop offset="100%" stopColor="#B5843E" stopOpacity={0.94} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8E4DE" />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fontWeight: 600, fill: "#6B7280" }}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fontWeight: 500, fill: "#6B7280" }}
                />
                <Tooltip
                  cursor={{ fill: "#F2EFE9", opacity: 0.7 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const b = payload[0]?.payload as (typeof ageModel.buckets)[number]
                    if (!b) return null
                    const pct =
                      ageModel.withBirthDate > 0
                        ? Math.round((b.count / ageModel.withBirthDate) * 100)
                        : 0
                    return (
                      <RichChartTooltip
                        title={`Skupina ${b.label}`}
                        lines={[
                          { label: "Broj članova", value: formatMembersNoun(b.count), tone: "gold" },
                          { label: "Udio", value: `${pct}%` },
                        ]}
                        hint="Kliknite na stupac za popis članova"
                      />
                    )
                  }}
                />
                <Bar
                  dataKey="count"
                  radius={[8, 8, 2, 2]}
                  maxBarSize={44}
                  animationDuration={450}
                  className="cursor-pointer"
                  onMouseEnter={(_d, idx) => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onClick={(_d, idx) => {
                    const bucket = ageModel.buckets[idx]
                    if (bucket) setSelectedAgeBucketId((cur) => (cur === bucket.id ? null : bucket.id))
                  }}
                >
                  {ageModel.buckets.map((b, idx) => {
                    const isTop = ageModel.topBucket?.id === b.id && b.count > 0
                    const isSelected = selectedAgeBucketId === b.id
                    return (
                      <Cell
                        key={b.id}
                        fill={isTop || isSelected ? "url(#hrdAgeGold)" : "url(#hrdAgeNavy)"}
                        fillOpacity={hoveredIndex === null || hoveredIndex === idx ? 1 : 0.42}
                      />
                    )
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 5. GRADOVI I PODRUČJA ISTRAŽIVANJA */}
        {activeTab === "geo" && (
          <div className="h-[255px] w-full">
            {(geoMode === "cities" ? geoModel.topCities : geoModel.topAreas).length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={geoMode === "cities" ? geoModel.topCities : geoModel.topAreas}
                  layout="vertical"
                  margin={{ top: 6, right: 20, left: 10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="hrdGeoNavy" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#1E3A5F" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#264E82" stopOpacity={0.98} />
                    </linearGradient>
                    <linearGradient id="hrdGeoGold" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#B5843E" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#D8B178" stopOpacity={1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E8E4DE" />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fontWeight: 500, fill: "#6B7280" }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={126}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fontWeight: 600, fill: "#1B2B36" }}
                  />
                  <Tooltip
                    cursor={{ fill: "#F2EFE9", opacity: 0.7 }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const item = payload[0]?.payload as { name: string; count: number }
                      if (!item) return null
                      const pct =
                        societyMembers.length > 0
                          ? Math.round((item.count / societyMembers.length) * 100)
                          : 0
                      return (
                        <RichChartTooltip
                          title={item.name}
                          lines={[
                            { label: "Članova", value: formatMembersNoun(item.count), tone: "gold" },
                            { label: "Udio u registru", value: `${pct}%` },
                          ]}
                        />
                      )
                    }}
                  />
                  <Bar
                    dataKey="count"
                    radius={[0, 8, 8, 0]}
                    barSize={18}
                    animationDuration={450}
                    onMouseEnter={(_d, idx) => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  >
                    {(geoMode === "cities" ? geoModel.topCities : geoModel.topAreas).map((item, idx) => (
                      <Cell
                        key={`geo-${item.name}`}
                        fill={idx === 0 ? "url(#hrdGeoGold)" : "url(#hrdGeoNavy)"}
                        fillOpacity={hoveredIndex === null || hoveredIndex === idx ? 1 : 0.42}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center rounded-2xl border border-dashed border-[#E8E4DE] bg-[#FBF9F6] text-xs text-muted-foreground">
                Nema dovoljno upisanih adresa ili područja istraživanja u registru.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Drill-down panel: Novo-upisani članovi ──────────────────────────── */}
      {activeTab === "registrations" && selectedRegBucket && (
        <div className="hrd-chart-panel-in rounded-2xl border border-[#CEA369]/60 bg-[#FBF9F6] p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#1E3A5F] text-[11px] font-bold text-[#CEA369] tabular-nums shrink-0">
                {selectedRegBucket.members.length}
              </span>
              <p className="text-xs font-bold text-[#1B2B36] truncate">
                Upisani članovi — {selectedRegBucket.fullLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedRegBucketKey(null)}
              aria-label="Zatvori popis upisanih članova"
              className="rounded-full p-1 text-muted-foreground hover:bg-white hover:text-[#1B2B36] transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {selectedRegBucket.members.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
              {selectedRegBucket.members.map((m) => (
                <Link
                  key={m.id}
                  href={`/members/${m.id}`}
                  className="flex items-center justify-between gap-2 rounded-xl border border-[#E8E4DE] bg-white px-3 py-2 text-xs hover:border-[#CEA369] hover:shadow-2xs transition-all"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#EFF5FB] text-[10px] font-bold text-[#1E3A5F]">
                      {m.initials || m.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="font-semibold text-[#1B2B36] truncate">{m.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
                      {formatDateDMY(m.joinDate, "—")}
                    </span>
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        m.status === "active" ? "bg-emerald-600" : "bg-slate-400"
                      )}
                      title={m.status === "active" ? "Aktivan" : "Neaktivan"}
                    />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              U odabranom razdoblju nema novih prijava članova.
            </p>
          )}
        </div>
      )}

      {/* ─── Drill-down panel: Dobna skupina ─────────────────────────────────── */}
      {activeTab === "age" && selectedAgeBucket && (
        <div className="hrd-chart-panel-in rounded-2xl border border-[#CEA369]/60 bg-[#FBF9F6] p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#1E3A5F] text-[11px] font-bold text-[#CEA369] tabular-nums shrink-0">
                {selectedAgeBucket.members.length}
              </span>
              <p className="text-xs font-bold text-[#1B2B36] truncate">
                Dobna skupina {selectedAgeBucket.label}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedAgeBucketId(null)}
              aria-label="Zatvori popis dobne skupine"
              className="rounded-full p-1 text-muted-foreground hover:bg-white hover:text-[#1B2B36] transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {selectedAgeBucket.members.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
              {selectedAgeBucket.members.map(({ member, age }) => (
                <Link
                  key={member.id}
                  href={`/members/${member.id}`}
                  className="flex items-center justify-between gap-2 rounded-xl border border-[#E8E4DE] bg-white px-3 py-2 text-xs hover:border-[#CEA369] hover:shadow-2xs transition-all"
                >
                  <span className="font-semibold text-[#1B2B36] truncate">{member.name}</span>
                  <span className="text-[11px] font-mono font-bold text-[#1E3A5F] tabular-nums shrink-0">
                    {age} god.
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">Nema članova u ovoj dobnoj skupini.</p>
          )}
        </div>
      )}
    </div>
  )
}
