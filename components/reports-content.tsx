"use client"

import React, { useState, useEffect } from "react"
import { useSettings } from "@/contexts/settings-context"
import { useAuth } from "@/contexts/auth-context"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { formatDateDMY, formatDateTimeDMY } from "@/lib/utils"
import { 
  FileText, 
  Calendar, 
  Download, 
  Printer, 
  Users, 
  DollarSign, 
  HeartHandshake, 
  Mic, 
  Mail, 
  Activity, 
  RefreshCw,
  Copy,
  Check,
  Inbox,
  Send
} from "lucide-react"

export function ReportsContent() {
  const { settings } = useSettings()
  const { user } = useAuth()

  // Default: zadnjih mjesec dana do dana izrade izvješća
  const getInitialDates = () => {
    const now = new Date()
    const endY = now.getFullYear()
    const endM = String(now.getMonth() + 1).padStart(2, "0")
    const endD = String(now.getDate()).padStart(2, "0")
    const today = `${endY}-${endM}-${endD}`

    const oneMonthAgo = new Date(now)
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
    const startY = oneMonthAgo.getFullYear()
    const startM = String(oneMonthAgo.getMonth() + 1).padStart(2, "0")
    const startD = String(oneMonthAgo.getDate()).padStart(2, "0")
    const monthStart = `${startY}-${startM}-${startD}`

    return { monthStart, today }
  }

  const initialDates = getInitialDates()

  const [startDate, setStartDate] = useState(initialDates.monthStart)
  const [endDate, setEndDate] = useState(initialDates.today)
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState<any | null>(null)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)
  const [viewMode, setViewMode] = useState<"document" | "rawText">("document")

  const fetchReport = async (start = startDate, end = endDate) => {
    if (!start || !end) return
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/reports/period-summary?startDate=${start}&endDate=${end}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Greška pri dohvaćanju izvješća.")
      setReportData(data)
    } catch (e: any) {
      setError(e.message || "Neuspjelo učitavanje izvješća.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReport(startDate, endDate)
  }, [])

  const setPreset = (preset: "this-year" | "last-year" | "last-month" | "last-90") => {
    const now = new Date()
    const endY = now.getFullYear()
    const endM = String(now.getMonth() + 1).padStart(2, "0")
    const endD = String(now.getDate()).padStart(2, "0")
    const today = `${endY}-${endM}-${endD}`
    let s = ""
    let e = today

    if (preset === "this-year") {
      s = `${now.getFullYear()}-01-01`
      e = today
    } else if (preset === "last-year") {
      s = `${now.getFullYear() - 1}-01-01`
      e = `${now.getFullYear() - 1}-12-31`
    } else if (preset === "last-month") {
      const d = new Date(now)
      d.setMonth(d.getMonth() - 1)
      s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    } else if (preset === "last-90") {
      const d = new Date(now)
      d.setDate(d.getDate() - 90)
      s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    }

    setStartDate(s)
    setEndDate(e)
    fetchReport(s, e)
  }

  const handlePrint = () => {
    window.print()
  }

  // Generiranje cjelovitog čistog teksta izvješća za međuspremnik ili tekstualni prikaz
  const generateRawTextReport = () => {
    if (!reportData) return ""
    const s = reportData.summary
    const d = reportData.details
    const sep = "================================================================================"
    const subsep = "--------------------------------------------------------------------------------"

    let out = `${sep}\n`
    out += `HRVATSKO RODOSLOVNO DRUŠTVO "PAVAO RITTER VITEZOVIĆ" ZAGREB\n`
    out += `SLUŽBENO PERIODIČKO IZVJEŠĆE O RADU I POSLOVANJU\n`
    out += `Izvještajno razdoblje: ${formatDateDMY(startDate)} do ${formatDateDMY(endDate)}\n`
    out += `Datum izrade: ${formatDateTimeDMY(reportData.generatedAt)}\n`
    out += `Izradio/la: ${user?.name || "Administrator"} (${user?.role || "admin"})\n`
    out += `${sep}\n\n`

    out += `I. SAŽETAK KLJUČNIH POKAZATELJA (STATISTIČKI PREGLED)\n`
    out += `${subsep}\n`
    out += `• Novi članovi učlanjeni u razdoblju: ${s.newMembersCount}\n`
    out += `• Ukupno registriranih članova na kraju razdoblja: ${s.totalMembers} (Aktivni: ${s.activeMembers}, Dug članarine: ${s.overdueMembers})\n`
    out += `• Prikupljene članarine: ${s.paymentsTotalAmount.toFixed(2)} EUR (kroz ${s.paymentsCount} uplata)\n`
    out += `• Prikupljene donacije: ${s.donationsTotalAmount.toFixed(2)} EUR (kroz ${s.donationsCount} uplata)\n`
    out += `• UKUPNI OSTVARENI PRIHODI: ${s.totalRevenue.toFixed(2)} EUR\n`
    out += `• Održane sjednice Odbora i Skupštine: ${s.meetingsCount}\n`
    out += `• Održana predavanja i druženja: ${s.lecturesCount}\n`
    out += `• UKUPNO PRIMLJENIH E-MAILOVA: ${s.receivedEmailsCount}\n`
    out += `• UKUPNO POSLANIH E-MAILOVA: ${s.sentEmailsCount}\n`
    out += `• Poslanih podsjetnika i opomena za članarinu: ${s.paymentRemindersSent}\n\n`

    out += `II. DETALJAN POPIS NOVIH ČLANOVA (${d.newMembers.length})\n`
    out += `${subsep}\n`
    if (d.newMembers.length === 0) {
      out += `U odabranom razdoblju nije bilo novih upisa članova.\n\n`
    } else {
      d.newMembers.forEach((m: any, idx: number) => {
        const join = formatDateDMY(m.joinDate || m.created_at)
        out += `${idx + 1}. ${m.name} | Matica: ${m.registryNumber || "—"} | Iskaznica: ${m.membershipNumber || "—"} | Email: ${m.email || "—"} | Tel: ${m.phone || "—"} | Datum: ${join} | Status: ${m.status_clana || "AKTIVAN"}\n`
      })
      out += `\n`
    }

    out += `III. EVIDENCIJA UPLATA ČLANARINA (${d.payments.length})\n`
    out += `${subsep}\n`
    if (d.payments.length === 0) {
      out += `U odabranom razdoblju nema evidentiranih uplata članarina.\n\n`
    } else {
      d.payments.forEach((p: any, idx: number) => {
        const dt = formatDateDMY(p.date || p.created_at)
        out += `${idx + 1}. Datum: ${dt} | Član: ${p.memberName || `Član #${p.memberId}`} | Matica: ${p.registryNumber || "—"} | Iznos: ${Number(p.amount).toFixed(2)} EUR | Napomena: ${p.note || "Godišnja članarina"}\n`
      })
      out += `UKUPAN ZBROJ UPLATA ČLANARINA: ${s.paymentsTotalAmount.toFixed(2)} EUR\n\n`
    }

    out += `IV. EVIDENCIJA DONACIJA (${d.donations.length})\n`
    out += `${subsep}\n`
    if (d.donations.length === 0) {
      out += `U odabranom razdoblju nema evidentiranih donacija.\n\n`
    } else {
      d.donations.forEach((dn: any, idx: number) => {
        const dt = formatDateDMY(dn.donated_at)
        out += `${idx + 1}. Datum: ${dt} | Donator: ${dn.name} | Grad: ${dn.city || "—"} | Email: ${dn.email || "—"} | Iznos: ${Number(dn.donated_amount).toFixed(2)} EUR | Bilješka: ${dn.donation_note || "Podrška radu"}\n`
      })
      out += `UKUPAN ZBROJ DONACIJA: ${s.donationsTotalAmount.toFixed(2)} EUR\n\n`
    }

    out += `V. ODRŽANE SJEDNICE I GLASOVANJA (${d.meetings.length})\n`
    out += `${subsep}\n`
    if (d.meetings.length === 0) {
      out += `U odabranom razdoblju nije bilo sjednica.\n\n`
    } else {
      d.meetings.forEach((m: any, idx: number) => {
        out += `${idx + 1}. Datum: ${formatDateDMY(m.date)} ${m.start_time || ""} | Naziv: ${m.title} | Tip: ${m.type || "redovna"} | Lokacija: ${m.location || "Sjedište društva"} | Status: ${m.status || "održano"}\n`
      })
      out += `\n`
    }

    out += `VI. ODRŽANA PREDAVANJA I DRUŽENJA (${d.lectures.length})\n`
    out += `${subsep}\n`
    if (d.lectures.length === 0) {
      out += `U odabranom razdoblju nije bilo predavanja.\n\n`
    } else {
      d.lectures.forEach((l: any, idx: number) => {
        out += `${idx + 1}. Datum: ${formatDateDMY(l.date)} ${l.start_time || ""} | Naslov: ${l.title} | Predavač/Domaćin: ${l.host || "—"} | Lokacija: ${l.location || "Sjedište društva"} | Status: ${l.status || "održano"}\n`
      })
      out += `\n`
    }

    out += `VII. E-MAIL KOMUNIKACIJA I KORESPONDENCIJA\n`
    out += `${subsep}\n`
    out += `• Službeni sandučić: ${s.gmailMailbox || "Google Workspace Gmail"}\n`
    out += `• Broj primljenih e-mailova u razdoblju: ${s.receivedEmailsCount}\n`
    out += `• Broj poslanih e-mailova u razdoblju: ${s.sentEmailsCount}\n`
    out += `• Poslane obavijesti i opomene za članarinu: ${s.paymentRemindersSent}\n`
    if (d.mailSendersStats && d.mailSendersStats.length > 0) {
      out += `• Pregled poslanih e-mailova po korisnicima aplikacije:\n`
      d.mailSendersStats.forEach((st: any) => {
        out += `  - ${st.user_name} (${st.user_role || "korisnik"}): ${st.count} mail(ova) [${st.action_type === "reply" ? "odgovori" : "nove poruke"}]\n`
      })
    }
    out += `\n`

    const totalOps = d.totalLogsCount ?? (d.recentLogs?.length || 0)
    out += `VIII. SAŽETAK KLJUČNIH OPERACIJA I AKTIVNOSTI SUSTAVA (UKUPNO: ${totalOps} OPERACIJA)\n`
    out += `${subsep}\n`
    if (totalOps === 0) {
      out += `Nema zabilježenih zapisa aktivnosti u odabranom razdoblju.\n\n`
    } else {
      if (d.logsSummaryByUser && d.logsSummaryByUser.length > 0) {
        out += `A) Pregled rada po korisnicima / administratorima:\n`
        d.logsSummaryByUser.forEach((u: any, idx: number) => {
          const actionsText = (u.topActions || []).map((a: any) => `${a.action} (${a.count}×)`).join(", ")
          out += `  ${idx + 1}. ${u.userName} (${u.userRole || "korisnik"}) — Ukupno: ${u.totalCount} radnji | Zadnje: ${formatDateTimeDMY(u.lastTimestamp)}\n`
          out += `     Operacije: ${actionsText}\n`
        })
        out += `\n`
      }
      if (d.logsSummaryByAction && d.logsSummaryByAction.length > 0) {
        out += `B) Sažetak po vrstama operacija u sustavu:\n`
        d.logsSummaryByAction.forEach((act: any, idx: number) => {
          out += `  ${idx + 1}. ${act.action} [${act.category}]: ${act.count}× | Izvršitelji: ${(act.users || []).join(", ")} | Zadnje: ${formatDateTimeDMY(act.lastTimestamp)}\n`
        })
        out += `\n`
      }
    }

    out += `${sep}\n`
    out += `OVJERA I POTPIS:\n\n\n`
    out += `Za Hrvatsko rodoslovno društvo "Pavao Ritter Vitezović":\n\n`
    out += `____________________________        ____________________________\n`
    out += `Predsjednik društva                 Tajnik / Administrator (${user?.name || "Administrator"})\n`
    out += `${sep}\n`

    return out
  }

  const handleCopyText = async () => {
    const txt = generateRawTextReport()
    if (!txt) return
    try {
      await navigator.clipboard.writeText(txt)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch (e) {
      console.error("Neuspjelo kopiranje:", e)
    }
  }

  const handleExportCsv = () => {
    if (!reportData) return
    const s = reportData.summary
    const d = reportData.details

    const rows = [
      ["HRVATSKO RODOSLOVNO DRUŠTVO 'PAVAO RITTER VITEZOVIĆ'"],
      ["SLUŽBENO IZVJEŠĆE O RADU I POSLOVANJU", `Period: ${formatDateDMY(startDate)} do ${formatDateDMY(endDate)}`],
      ["Generirano:", formatDateTimeDMY(reportData.generatedAt)],
      ["Izradio:", `${user?.name || "Administrator"} (${user?.role || "admin"})`],
      [],
      ["1. STATISTIČKI POKAZATELJI", "KOLIČINA / IZNOS"],
      ["Novi članovi učlanjeni u periodu", s.newMembersCount],
      ["Ukupno članova u bazi", s.totalMembers],
      ["Aktivni članovi", s.activeMembers],
      ["Članovi s dugom članarine", s.overdueMembers],
      ["Broj uplata članarina", s.paymentsCount],
      ["Ukupan iznos članarina (EUR)", s.paymentsTotalAmount.toFixed(2)],
      ["Broj donacija", s.donationsCount],
      ["Ukupan iznos donacija (EUR)", s.donationsTotalAmount.toFixed(2)],
      ["UKUPAN PRIHOD (EUR)", s.totalRevenue.toFixed(2)],
      ["Održane sjednice", s.meetingsCount],
      ["Održana predavanja", s.lecturesCount],
      ["Primljeni e-mailovi", s.receivedEmailsCount],
      ["Poslani e-mailovi", s.sentEmailsCount],
      ["Poslane opomene za članarinu", s.paymentRemindersSent],
      [],
      ["2. POPIS NOVIH ČLANOVA"],
      ["R.br.", "Ime i prezime", "E-mail", "Telefon", "Matica", "Broj iskaznice", "Datum učlanjenja", "Status"],
      ...d.newMembers.map((m: any, i: number) => [
        i + 1,
        m.name,
        m.email || "",
        m.phone || "",
        m.registryNumber || "",
        m.membershipNumber || "",
        formatDateDMY(m.joinDate || m.created_at, ""),
        m.status_clana || "AKTIVAN"
      ]),
      [],
      ["3. UPLATE ČLANARINA"],
      ["R.br.", "Datum uplate", "Član", "Matica", "Iznos (EUR)", "Napomena"],
      ...d.payments.map((p: any, i: number) => [
        i + 1,
        formatDateDMY(p.date || p.created_at, ""),
        p.memberName || `Član #${p.memberId}`,
        p.registryNumber || "",
        Number(p.amount).toFixed(2),
        p.note || "Članarina"
      ]),
      [],
      ["4. DONACIJE"],
      ["R.br.", "Datum", "Donator", "Grad", "E-mail", "Iznos (EUR)", "Napomena"],
      ...d.donations.map((dn: any, i: number) => [
        i + 1,
        formatDateDMY(dn.donated_at, ""),
        dn.name,
        dn.city || "",
        dn.email || "",
        Number(dn.donated_amount).toFixed(2),
        dn.donation_note || ""
      ]),
      [],
      ["5. ODRŽANE SJEDNICE"],
      ["R.br.", "Datum", "Vrijeme", "Naziv", "Vrsta", "Lokacija", "Status"],
      ...d.meetings.map((m: any, i: number) => [
        i + 1,
        formatDateDMY(m.date, ""),
        m.start_time || "",
        m.title,
        m.type || "redovna",
        m.location || "",
        m.status || "održano"
      ]),
      [],
      ["6. ODRŽANA PREDAVANJA I DRUŽENJA"],
      ["R.br.", "Datum", "Vrijeme", "Naslov", "Predavač", "Lokacija", "Status"],
      ...d.lectures.map((l: any, i: number) => [
        i + 1,
        formatDateDMY(l.date, ""),
        l.start_time || "",
        l.title,
        l.host || "",
        l.location || "",
        l.status || "održano"
      ])
    ]

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + rows.map(e => e.map((val: any) => `"${String(val).replace(/"/g, '""')}"`).join(";")).join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `Izvjesce_HRD_${startDate}_do_${endDate}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      {/* Zaglavlje ekrana (sakriveno kod ispisa) */}
      <div className="print:hidden flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileText className="h-6 w-6 text-[#CEA369]" /> Generator periodičkih izvješća
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tekstualno i tabelarno izvješće o radu: novi članovi, uplate, donacije, sjednice, predavanja te broj poslanih i primljenih e-mailova.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleCopyText} 
            disabled={!reportData || loading} 
            className="gap-1.5 border-border"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            {copied ? "Kopirano u međuspremnik!" : "Kopiraj tekst izvješća"}
          </Button>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleExportCsv} 
            disabled={!reportData || loading} 
            className="gap-1.5 border-border"
          >
            <Download className="h-4 w-4" /> Izvoz u CSV
          </Button>

          <Button 
            size="sm" 
            onClick={handlePrint} 
            disabled={!reportData || loading} 
            className="gap-1.5 bg-[#1B2B36] hover:bg-[#1B2B36]/90 border border-[#CEA369] text-white"
          >
            <Printer className="h-4 w-4 text-[#CEA369]" /> Ispiši / PDF
          </Button>
        </div>
      </div>

      {/* Filter datuma i prečaci (sakriveno kod ispisa) */}
      <Card className="print:hidden border-border bg-card shadow-xs">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Datum od:</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-40 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Datum do:</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-40 text-xs"
                />
              </div>

              <Button
                size="sm"
                onClick={() => fetchReport(startDate, endDate)}
                disabled={loading}
                className="gap-1.5 bg-primary text-primary-foreground h-9 text-xs"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                Prikaži izvješće
              </Button>
            </div>

            {/* Brzi prečaci */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-muted-foreground font-medium mr-1">Prečaci:</span>
              <Button variant="outline" size="sm" className="h-7 text-xs px-2.5" onClick={() => setPreset("last-month")}>
                Zadnjih mjesec dana
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs px-2.5" onClick={() => setPreset("last-90")}>
                Zadnjih 90 dana
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs px-2.5" onClick={() => setPreset("this-year")}>
                Ova godina ({new Date().getFullYear()})
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs px-2.5" onClick={() => setPreset("last-year")}>
                Prošla godina ({new Date().getFullYear() - 1})
              </Button>
            </div>
          </div>

          {/* Odabir načina prikaza na ekranu */}
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/60">
            <span className="text-xs text-muted-foreground font-medium">Prikaz:</span>
            <Button
              variant={viewMode === "document" ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs px-3"
              onClick={() => setViewMode("document")}
            >
              Strukturirani memorandum (Preporučeno)
            </Button>
            <Button
              variant={viewMode === "rawText" ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs px-3"
              onClick={() => setViewMode("rawText")}
            >
              Čisti tekstualni ispis (Zapisnik)
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* RAW TEXT PRIKAZ (Čisti tekstualni oblik) */}
      {reportData && viewMode === "rawText" && (
        <Card className="border-border shadow-xs">
          <CardContent className="p-5">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-border">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Tekstualni zapisnik spreman za kopiranje
              </span>
              <Button size="sm" variant="outline" onClick={handleCopyText} className="gap-1.5 h-8 text-xs">
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Kopirano!" : "Kopiraj cijeli tekst"}
              </Button>
            </div>
            <pre className="p-4 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs leading-relaxed whitespace-pre-wrap overflow-x-auto select-all">
              {generateRawTextReport()}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* STRUKTURIRANI MEMORANDUM (Za ekran i za ispis/PDF) */}
      {reportData && viewMode === "document" && (
        <div className="space-y-6 bg-white print:p-0 rounded-2xl border border-border p-6 sm:p-8 shadow-sm">
          {/* Memorandum za ispis */}
          <div className="border-b-2 border-[#CEA369] pb-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              {settings.logoUrl && (
                <img src={settings.logoUrl} alt="Logo" className="h-16 w-16 object-contain rounded" />
              )}
              <div>
                <h2 className="text-xl font-bold tracking-tight text-[#1B2B36]">
                  HRVATSKO RODOSLOVNO DRUŠTVO
                </h2>
                <p className="text-xs font-semibold text-[#CEA369] uppercase tracking-wider">
                  &bdquo;Pavao Ritter Vitezović&rdquo; Zagreb &bull; Službeno periodičko izvješće
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Izvještajno razdoblje: <strong>{formatDateDMY(startDate)}</strong> &mdash; <strong>{formatDateDMY(endDate)}</strong>
                </p>
              </div>
            </div>

            <div className="text-right text-xs text-slate-500 font-mono">
              <div>Generirano: {formatDateTimeDMY(reportData.generatedAt)}</div>
              <div>Izradio/la: <strong>{user?.name || "Administrator"}</strong> ({user?.role || "admin"})</div>
            </div>
          </div>

          {/* I. SAŽETAK KLJUČNIH POKAZATELJA (BROJEVI & STATISTIKA) */}
          <div>
            <h3 className="font-bold text-xs uppercase tracking-wider text-[#1B2B36] mb-3">
              I. Sažetak ključnih pokazatelja i statistika
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {/* Novi članovi */}
              <div className="p-3.5 rounded-xl border border-border bg-slate-50 space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
                  <Users className="h-3.5 w-3.5 text-blue-600" /> Novi članovi
                </span>
                <p className="text-2xl font-bold text-slate-900">{reportData.summary.newMembersCount}</p>
                <span className="text-[10px] text-slate-500">Ukupno: {reportData.summary.totalMembers}</span>
              </div>

              {/* Članarine */}
              <div className="p-3.5 rounded-xl border border-border bg-slate-50 space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
                  <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> Članarine
                </span>
                <p className="text-2xl font-bold text-emerald-700">{reportData.summary.paymentsTotalAmount.toFixed(2)} €</p>
                <span className="text-[10px] text-slate-500">{reportData.summary.paymentsCount} uplata</span>
              </div>

              {/* Donacije */}
              <div className="p-3.5 rounded-xl border border-border bg-slate-50 space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
                  <HeartHandshake className="h-3.5 w-3.5 text-[#CEA369]" /> Donacije
                </span>
                <p className="text-2xl font-bold text-[#CEA369]">{reportData.summary.donationsTotalAmount.toFixed(2)} €</p>
                <span className="text-[10px] text-slate-500">{reportData.summary.donationsCount} donacija</span>
              </div>

              {/* Primljeni e-mailovi */}
              <div className="p-3.5 rounded-xl border border-border bg-slate-50 space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
                  <Inbox className="h-3.5 w-3.5 text-sky-600" /> Primljeni mailovi
                </span>
                <p className="text-2xl font-bold text-sky-700">{reportData.summary.receivedEmailsCount}</p>
                <span className="text-[10px] text-slate-500">Gmail Inbox</span>
              </div>

              {/* Poslani e-mailovi */}
              <div className="p-3.5 rounded-xl border border-border bg-slate-50 space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
                  <Send className="h-3.5 w-3.5 text-indigo-600" /> Poslani mailovi
                </span>
                <p className="text-2xl font-bold text-indigo-700">{reportData.summary.sentEmailsCount}</p>
                <span className="text-[10px] text-slate-500">Odlazna pošta</span>
              </div>

              {/* Sjednice & Predavanja */}
              <div className="p-3.5 rounded-xl border border-border bg-slate-50 space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-purple-600" /> Događanja
                </span>
                <p className="text-2xl font-bold text-purple-700">
                  {reportData.summary.meetingsCount + reportData.summary.lecturesCount}
                </p>
                <span className="text-[10px] text-slate-500">
                  {reportData.summary.meetingsCount} sjed. / {reportData.summary.lecturesCount} pred.
                </span>
              </div>
            </div>
          </div>

          {/* II. DETALJAN POPIS NOVIH ČLANOVA */}
          <div className="space-y-2 pt-2">
            <h3 className="font-bold text-sm text-[#1B2B36] uppercase tracking-wider flex items-center justify-between border-b border-border pb-1.5">
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[#CEA369]" />
                II. Novi članovi učlanjeni u odabranom periodu ({reportData.details.newMembers.length})
              </span>
            </h3>
            {reportData.details.newMembers.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-1">U ovom razdoblju nije zabilježen upis novih članova.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-border">
                    <tr>
                      <th className="p-2">R.br.</th>
                      <th className="p-2">Ime i prezime</th>
                      <th className="p-2">E-mail</th>
                      <th className="p-2">Telefon</th>
                      <th className="p-2">Broj matice</th>
                      <th className="p-2">Iskaznica</th>
                      <th className="p-2">Datum učlanjenja</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {reportData.details.newMembers.map((m: any, idx: number) => (
                      <tr key={m.id} className="hover:bg-slate-50/70">
                        <td className="p-2 text-slate-500 font-mono">{idx + 1}.</td>
                        <td className="p-2 font-medium text-slate-900">{m.name}</td>
                        <td className="p-2 text-slate-600 font-mono text-[11px]">{m.email || "—"}</td>
                        <td className="p-2 text-slate-600 text-[11px]">{m.phone || "—"}</td>
                        <td className="p-2 font-mono text-[11px]">{m.registryNumber || "—"}</td>
                        <td className="p-2 font-mono text-[11px]">{m.membershipNumber || "—"}</td>
                        <td className="p-2 text-slate-600">
                          {formatDateDMY(m.joinDate || m.created_at)}
                        </td>
                        <td className="p-2">
                          <Badge variant="outline" className={`text-[10px] ${m.status_clana === "DUG" ? "bg-red-50 text-red-700 border-red-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>
                            {m.status_clana || "AKTIVAN"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* III. EVIDENCIJA UPLATA ČLANARINA */}
          <div className="space-y-2 pt-2">
            <h3 className="font-bold text-sm text-[#1B2B36] uppercase tracking-wider flex items-center justify-between border-b border-border pb-1.5">
              <span className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-[#CEA369]" />
                III. Evidencija uplata članarina ({reportData.details.payments.length})
              </span>
              <span className="text-emerald-700 font-bold text-sm">
                Ukupno uplate: {reportData.summary.paymentsTotalAmount.toFixed(2)} €
              </span>
            </h3>
            {reportData.details.payments.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-1">U ovom razdoblju nema evidentiranih uplata članarina.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-border">
                    <tr>
                      <th className="p-2">R.br.</th>
                      <th className="p-2">Datum uplate</th>
                      <th className="p-2">Član</th>
                      <th className="p-2">Matica</th>
                      <th className="p-2">Svrha / Napomena</th>
                      <th className="p-2 text-right">Iznos (€)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {reportData.details.payments.map((p: any, idx: number) => (
                      <tr key={p.id} className="hover:bg-slate-50/70">
                        <td className="p-2 text-slate-500 font-mono">{idx + 1}.</td>
                        <td className="p-2 text-slate-600">
                          {formatDateDMY(p.date || p.created_at)}
                        </td>
                        <td className="p-2 font-medium text-slate-900">{p.memberName || `Član #${p.memberId}`}</td>
                        <td className="p-2 font-mono text-[11px]">{p.registryNumber || "—"}</td>
                        <td className="p-2 text-slate-500 italic">{p.note || "Godišnja članarina"}</td>
                        <td className="p-2 text-right font-bold text-emerald-700">{Number(p.amount).toFixed(2)} €</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-100/70 font-bold border-t-2 border-border">
                      <td colSpan={5} className="p-2 text-right text-slate-700">UKUPAN ZBROJ UPLATA:</td>
                      <td className="p-2 text-right text-emerald-700">{reportData.summary.paymentsTotalAmount.toFixed(2)} €</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* IV. EVIDENCIJA DONACIJA */}
          {reportData.details.donations.length > 0 && (
            <div className="space-y-2 pt-2">
              <h3 className="font-bold text-sm text-[#1B2B36] uppercase tracking-wider flex items-center justify-between border-b border-border pb-1.5">
                <span className="flex items-center gap-2">
                  <HeartHandshake className="h-4 w-4 text-[#CEA369]" />
                  IV. Evidencija primljenih donacija ({reportData.details.donations.length})
                </span>
                <span className="text-[#CEA369] font-bold text-sm">
                  Ukupno donacije: {reportData.summary.donationsTotalAmount.toFixed(2)} €
                </span>
              </h3>
              <div className="overflow-x-auto rounded-lg border border-border text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-border">
                    <tr>
                      <th className="p-2">R.br.</th>
                      <th className="p-2">Donator / Pravna osoba</th>
                      <th className="p-2">Grad</th>
                      <th className="p-2">E-mail</th>
                      <th className="p-2">Datum donacije</th>
                      <th className="p-2">Svrha / Bilješka</th>
                      <th className="p-2 text-right">Iznos (€)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {reportData.details.donations.map((d: any, idx: number) => (
                      <tr key={d.id} className="hover:bg-slate-50/70">
                        <td className="p-2 text-slate-500 font-mono">{idx + 1}.</td>
                        <td className="p-2 font-medium text-slate-900">{d.name}</td>
                        <td className="p-2 text-slate-600">{d.city || "—"}</td>
                        <td className="p-2 text-slate-600 font-mono text-[11px]">{d.email || "—"}</td>
                        <td className="p-2 text-slate-600">{formatDateDMY(d.donated_at)}</td>
                        <td className="p-2 text-slate-500 italic">{d.donation_note || "Podrška radu društva"}</td>
                        <td className="p-2 text-right font-bold text-[#CEA369]">{Number(d.donated_amount).toFixed(2)} €</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-100/70 font-bold border-t-2 border-border">
                      <td colSpan={6} className="p-2 text-right text-slate-700">UKUPAN ZBROJ DONACIJA:</td>
                      <td className="p-2 text-right text-[#CEA369]">{reportData.summary.donationsTotalAmount.toFixed(2)} €</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* V. SJEDNICE I GLASOVANJA */}
          <div className="space-y-2 pt-2">
            <h3 className="font-bold text-sm text-[#1B2B36] uppercase tracking-wider flex items-center justify-between border-b border-border pb-1.5">
              <span className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[#CEA369]" />
                V. Održane sjednice Odbora i Skupštine ({reportData.details.meetings.length})
              </span>
            </h3>
            {reportData.details.meetings.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-1">U ovom razdoblju nije bilo održanih sjednica.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-border">
                    <tr>
                      <th className="p-2">R.br.</th>
                      <th className="p-2">Datum i vrijeme</th>
                      <th className="p-2">Naziv sjednice</th>
                      <th className="p-2">Vrsta</th>
                      <th className="p-2">Lokacija</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {reportData.details.meetings.map((m: any, idx: number) => (
                      <tr key={m.id} className="hover:bg-slate-50/70">
                        <td className="p-2 text-slate-500 font-mono">{idx + 1}.</td>
                        <td className="p-2 font-medium text-slate-900">
                          {formatDateDMY(m.date)} {m.start_time ? `u ${m.start_time}` : ""}
                        </td>
                        <td className="p-2 font-medium">{m.title}</td>
                        <td className="p-2 text-slate-600 capitalize">{m.type || "redovna"}</td>
                        <td className="p-2 text-slate-600">{m.location || "Sjedište društva"}</td>
                        <td className="p-2">
                          <Badge variant="outline" className="text-[10px]">{m.status || "održano"}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* VI. PREDAVANJA I DRUŽENJA */}
          <div className="space-y-2 pt-2">
            <h3 className="font-bold text-sm text-[#1B2B36] uppercase tracking-wider flex items-center justify-between border-b border-border pb-1.5">
              <span className="flex items-center gap-2">
                <Mic className="h-4 w-4 text-[#CEA369]" />
                VI. Održana predavanja i kulturna druženja ({reportData.details.lectures.length})
              </span>
            </h3>
            {reportData.details.lectures.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-1">U ovom razdoblju nije bilo predavanja.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-border">
                    <tr>
                      <th className="p-2">R.br.</th>
                      <th className="p-2">Datum i vrijeme</th>
                      <th className="p-2">Naslov i tema</th>
                      <th className="p-2">Predavač / Domaćin</th>
                      <th className="p-2">Lokacija</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {reportData.details.lectures.map((l: any, idx: number) => (
                      <tr key={l.id} className="hover:bg-slate-50/70">
                        <td className="p-2 text-slate-500 font-mono">{idx + 1}.</td>
                        <td className="p-2 font-medium text-slate-900">
                          {formatDateDMY(l.date)} {l.start_time ? `u ${l.start_time}` : ""}
                        </td>
                        <td className="p-2 font-medium">{l.title}</td>
                        <td className="p-2 text-slate-700">{l.host || "—"}</td>
                        <td className="p-2 text-slate-600">{l.location || "Sjedište društva"}</td>
                        <td className="p-2">
                          <Badge variant="outline" className="text-[10px]">{l.status || "održano"}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* VII. E-MAIL KOMUNIKACIJA I KORESPONDENCIJA */}
          <div className="space-y-3 pt-2">
            <h3 className="font-bold text-sm text-[#1B2B36] uppercase tracking-wider flex items-center justify-between border-b border-border pb-1.5">
              <span className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-[#CEA369]" />
                VII. E-mail komunikacija i korespondencija društva
              </span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-lg border border-border bg-slate-50 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase">Primljeni e-mailovi</span>
                  <p className="text-xl font-bold text-sky-700">{reportData.summary.receivedEmailsCount}</p>
                </div>
                <Inbox className="h-6 w-6 text-sky-600 opacity-60" />
              </div>

              <div className="p-3 rounded-lg border border-border bg-slate-50 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase">Poslani e-mailovi</span>
                  <p className="text-xl font-bold text-indigo-700">{reportData.summary.sentEmailsCount}</p>
                </div>
                <Send className="h-6 w-6 text-indigo-600 opacity-60" />
              </div>

              <div className="p-3 rounded-lg border border-border bg-slate-50 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase">Opomene za članarinu</span>
                  <p className="text-xl font-bold text-red-600">{reportData.summary.paymentRemindersSent}</p>
                </div>
                <Mail className="h-6 w-6 text-red-500 opacity-60" />
              </div>
            </div>

            {reportData.details.mailSendersStats && reportData.details.mailSendersStats.length > 0 && (
              <div className="pt-2">
                <p className="text-xs font-semibold text-slate-700 mb-2">Evidencija poslanih e-mailova po osoblju / korisnicima:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs">
                  {reportData.details.mailSendersStats.map((st: any, i: number) => (
                    <div key={i} className="p-2.5 rounded-lg border border-border bg-slate-50/70 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">{st.user_name}</p>
                        <p className="text-[10px] text-slate-500 capitalize">
                          {st.user_role || "korisnik"} &bull; {st.action_type === "reply" ? "Odgovori na poruke" : "Nove poruke"}
                        </p>
                      </div>
                      <Badge className="bg-[#1B2B36] text-white text-xs px-2 py-0.5">
                        {st.count} poslanih
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* VIII. SAŽETAK KLJUČNIH OPERACIJA I AKTIVNOSTI SUSTAVA */}
          <div className="space-y-3 pt-2 break-inside-avoid">
            <h3 className="font-bold text-sm text-[#1B2B36] uppercase tracking-wider flex items-center justify-between border-b border-border pb-1.5">
              <span className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-[#CEA369]" />
                VIII. Dnevnik ključnih operacija i aktivnosti sustava (Sažetak)
              </span>
              <span className="text-xs font-semibold text-slate-600 normal-case">
                Ukupno zabilježenih operacija: <strong>{reportData.details.totalLogsCount ?? (reportData.details.recentLogs?.length || 0)}</strong>
              </span>
            </h3>

            {(reportData.details.totalLogsCount ?? (reportData.details.recentLogs?.length || 0)) === 0 ? (
              <p className="text-xs text-muted-foreground italic py-1">U ovom razdoblju nema zabilježenih operacija u sustavu.</p>
            ) : (
              <div className="space-y-3">
                {/* Područja rada (kompaktne kartice) */}
                {reportData.details.logsSummaryByCategory && reportData.details.logsSummaryByCategory.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-xs">
                    {reportData.details.logsSummaryByCategory.map((cat: any, idx: number) => (
                      <div key={idx} className="p-2.5 rounded-lg border border-border bg-slate-50/80 flex flex-col justify-between">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase leading-tight">{cat.category}</span>
                        <div className="flex items-baseline justify-between mt-1.5">
                          <span className="text-base font-bold text-[#1B2B36]">{cat.count}</span>
                          <span className="text-[10px] text-slate-400">{cat.uniqueActionsCount} vrst{cat.uniqueActionsCount === 1 ? "a" : "e"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 1. Sažetak rada po korisnicima / administratorima */}
                {reportData.details.logsSummaryByUser && reportData.details.logsSummaryByUser.length > 0 && (
                  <div className="overflow-x-auto rounded-lg border border-border text-xs">
                    <div className="bg-slate-100/90 px-3 py-1.5 border-b border-border font-semibold text-slate-700 text-[11px] uppercase tracking-wider">
                      A) Pregled aktivnosti po administratorima i korisnicima sustava
                    </div>
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-border text-[11px]">
                        <tr>
                          <th className="p-2 w-44">Korisnik i uloga</th>
                          <th className="p-2">Sažetak izvršenih radnji (vrsta i broj ponavljanja)</th>
                          <th className="p-2 w-36 whitespace-nowrap">Zadnja aktivnost</th>
                          <th className="p-2 w-24 text-right whitespace-nowrap">Ukupno</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {reportData.details.logsSummaryByUser.map((u: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50/70">
                            <td className="p-2 align-top">
                              <div className="font-semibold text-slate-900">{u.userName}</div>
                              <div className="text-[10px] text-slate-500 capitalize">{u.userRole || "korisnik"}</div>
                            </td>
                            <td className="p-2 align-top">
                              <div className="flex flex-wrap gap-1">
                                {(u.topActions || []).map((a: any, i: number) => (
                                  <span
                                    key={i}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px] text-slate-700"
                                  >
                                    <span>{a.action}</span>
                                    <strong className="text-[#1B2B36] font-mono">{a.count}&times;</strong>
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="p-2 align-top text-slate-500 font-mono text-[11px] whitespace-nowrap">
                              {formatDateTimeDMY(u.lastTimestamp)}
                            </td>
                            <td className="p-2 align-top text-right font-bold text-[#1B2B36] font-mono">
                              {u.totalCount}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 2. Sažetak po vrstama operacija u sustavu */}
                {reportData.details.logsSummaryByAction && reportData.details.logsSummaryByAction.length > 0 && (
                  <div className="overflow-x-auto rounded-lg border border-border text-xs">
                    <div className="bg-slate-100/90 px-3 py-1.5 border-b border-border font-semibold text-slate-700 text-[11px] uppercase tracking-wider">
                      B) Zbirni pregled po vrstama operacija u sustavu
                    </div>
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-border text-[11px]">
                        <tr>
                          <th className="p-2">Vrsta operacije</th>
                          <th className="p-2">Područje sustava</th>
                          <th className="p-2">Izvršitelji</th>
                          <th className="p-2 whitespace-nowrap">Zadnje izvršeno</th>
                          <th className="p-2 text-right whitespace-nowrap">Broj radnji</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {reportData.details.logsSummaryByAction.map((act: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50/70">
                            <td className="p-1.5 px-2 font-semibold text-slate-800">{act.action}</td>
                            <td className="p-1.5 px-2 text-slate-500 text-[11px]">{act.category}</td>
                            <td className="p-1.5 px-2 text-slate-700 text-[11px]">{(act.users || []).join(", ")}</td>
                            <td className="p-1.5 px-2 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                              {formatDateTimeDMY(act.lastTimestamp)}
                            </td>
                            <td className="p-1.5 px-2 text-right font-bold text-[#1B2B36] font-mono">
                              {act.count}&times;
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* IX. OVJERA I POTPISI NA KRAJU IZVJEŠĆA */}
          <div className="pt-8 mt-8 border-t-2 border-slate-200">
            <div className="grid grid-cols-2 gap-8 text-xs text-slate-700">
              <div>
                <p className="font-bold uppercase tracking-wider mb-8 text-[#1B2B36]">
                  Predsjednik društva:
                </p>
                <div className="border-b border-slate-400 w-48 mb-1"></div>
                <p className="text-[11px] text-slate-500">M.P. / Potpis</p>
              </div>

              <div className="text-right flex flex-col items-end">
                <p className="font-bold uppercase tracking-wider mb-8 text-[#1B2B36]">
                  Izvješće sastavio/la:
                </p>
                <div className="border-b border-slate-400 w-48 mb-1"></div>
                <p className="text-[11px] text-slate-500 font-medium">
                  {user?.name || "Administrator"} ({user?.role || "admin"})
                </p>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
              <div>Hrvatsko rodoslovno društvo &bdquo;Pavao Ritter Vitezović&rdquo; Zagreb</div>
              <div>Generirano iz aplikacije HRD-CMS &bull; Datum: {formatDateDMY(new Date())}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
