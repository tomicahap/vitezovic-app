"use client"

import React, { useState, useEffect } from "react"
import { useSettings } from "@/contexts/settings-context"
import { useAuth } from "@/contexts/auth-context"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
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
  Clock,
  ArrowRight
} from "lucide-react"

export function ReportsContent() {
  const { settings } = useSettings()
  const { user } = useAuth()

  // Default to current year: from Jan 1st to today
  const todayStr = new Date().toISOString().slice(0, 10)
  const currentYearStart = `${new Date().getFullYear()}-01-01`

  const [startDate, setStartDate] = useState(currentYearStart)
  const [endDate, setEndDate] = useState(todayStr)
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState<any | null>(null)
  const [error, setError] = useState("")

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

  const setPreset = (preset: "this-year" | "last-year" | "last-30" | "last-90") => {
    const now = new Date()
    const today = now.toISOString().slice(0, 10)
    let s = ""
    let e = today

    if (preset === "this-year") {
      s = `${now.getFullYear()}-01-01`
      e = today
    } else if (preset === "last-year") {
      s = `${now.getFullYear() - 1}-01-01`
      e = `${now.getFullYear() - 1}-12-31`
    } else if (preset === "last-30") {
      const d = new Date()
      d.setDate(d.getDate() - 30)
      s = d.toISOString().slice(0, 10)
    } else if (preset === "last-90") {
      const d = new Date()
      d.setDate(d.getDate() - 90)
      s = d.toISOString().slice(0, 10)
    }

    setStartDate(s)
    setEndDate(e)
    fetchReport(s, e)
  }

  const handlePrint = () => {
    window.print()
  }

  const handleExportCsv = () => {
    if (!reportData) return
    const rows = [
      ["Izvješće o radu Društva", `Period: ${startDate} do ${endDate}`],
      ["Generirano:", new Date().toLocaleString("hr-HR")],
      [],
      ["KATEGORIJA", "POKAZATELJ", "VRIJEDNOST"],
      ["Članstvo", "Novi članovi u periodu", reportData.summary.newMembersCount],
      ["Članstvo", "Ukupno registrirano članova", reportData.summary.totalMembers],
      ["Članstvo", "Aktivni članovi", reportData.summary.activeMembers],
      ["Članstvo", "Članovi u statusu DUG", reportData.summary.overdueMembers],
      ["Financije", "Broj uplata članarina", reportData.summary.paymentsCount],
      ["Financije", "Ukupan iznos članarina (€)", reportData.summary.paymentsTotalAmount],
      ["Donacije", "Broj donacija", reportData.summary.donationsCount],
      ["Donacije", "Ukupan iznos donacija (€)", reportData.summary.donationsTotalAmount],
      ["Ukupni prihodi", "Članarine + Donacije (€)", reportData.summary.totalRevenue],
      ["Aktivnosti", "Održane sjednice odbora", reportData.summary.meetingsCount],
      ["Aktivnosti", "Održana predavanja / druženja", reportData.summary.lecturesCount],
      ["Komunikacija", "Poslano opomena za članarinu", reportData.summary.paymentRemindersSent],
    ]

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + rows.map(e => e.join(";")).join("\n")
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
      {/* Zaglavlje (ne ispisuje se na printeru) */}
      <div className="print:hidden flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileText className="h-6 w-6 text-[#CEA369]" /> Generator periodičkih izvješća
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Odaberite vremenski raspon za cjelovit pregled novih članova, uplata, donacija, sjednica i komunikacije.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={!reportData || loading} className="gap-1.5">
            <Download className="h-4 w-4" /> Izvoz u CSV / Excel
          </Button>
          <Button size="sm" onClick={handlePrint} disabled={!reportData || loading} className="gap-1.5 bg-[#1B2B36] hover:bg-[#1B2B36]/90 border border-[#CEA369] text-white">
            <Printer className="h-4 w-4 text-[#CEA369]" /> Ispiši / PDF
          </Button>
        </div>
      </div>

      {/* Filter datuma (sakriven kod ispisa) */}
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
                className="gap-1.5 bg-primary text-primary-foreground h-9"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                Prikaži izvješće
              </Button>
            </div>

            {/* Brzi prečaci */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-muted-foreground font-medium mr-1">Prečaci:</span>
              <Button variant="outline" size="sm" className="h-7 text-xs px-2.5" onClick={() => setPreset("last-30")}>
                Zadnjih 30 dana
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
        </CardContent>
      </Card>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* GLAVNI DOKUMENT IZVJEŠĆA (formatiran za ekran i za ispis/PDF) */}
      {reportData && (
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
                  &bdquo;Pavao Ritter Vitezović&rdquo; &bull; Službeno periodičko izvješće
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Izvještajno razdoblje: <strong>{new Date(startDate).toLocaleDateString("hr-HR")}</strong> &mdash; <strong>{new Date(endDate).toLocaleDateString("hr-HR")}</strong>
                </p>
              </div>
            </div>

            <div className="text-right text-xs text-slate-500 font-mono">
              <div>Generirano: {new Date(reportData.generatedAt).toLocaleString("hr-HR")}</div>
              <div>Pripremio: {user?.name || "Administrator"} ({user?.role || "admin"})</div>
            </div>
          </div>

          {/* KPI KARTICE - KLJUČNI BROJEVI */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3.5 rounded-xl border border-border bg-slate-50 space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
                <Users className="h-3.5 w-3.5 text-blue-600" /> Novi članovi
              </span>
              <p className="text-2xl font-bold text-slate-900">{reportData.summary.newMembersCount}</p>
              <span className="text-[10px] text-slate-500">Ukupno članova: {reportData.summary.totalMembers}</span>
            </div>

            <div className="p-3.5 rounded-xl border border-border bg-slate-50 space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
                <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> Članarine (€)
              </span>
              <p className="text-2xl font-bold text-emerald-700">{reportData.summary.paymentsTotalAmount.toFixed(2)} €</p>
              <span className="text-[10px] text-slate-500">{reportData.summary.paymentsCount} uplata</span>
            </div>

            <div className="p-3.5 rounded-xl border border-border bg-slate-50 space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
                <HeartHandshake className="h-3.5 w-3.5 text-[#CEA369]" /> Donacije (€)
              </span>
              <p className="text-2xl font-bold text-[#CEA369]">{reportData.summary.donationsTotalAmount.toFixed(2)} €</p>
              <span className="text-[10px] text-slate-500">{reportData.summary.donationsCount} donacija</span>
            </div>

            <div className="p-3.5 rounded-xl border border-border bg-slate-50 space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-purple-600" /> Sjednice
              </span>
              <p className="text-2xl font-bold text-slate-900">{reportData.summary.meetingsCount}</p>
              <span className="text-[10px] text-slate-500">Upravni odbor</span>
            </div>

            <div className="p-3.5 rounded-xl border border-border bg-slate-50 space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
                <Mic className="h-3.5 w-3.5 text-amber-600" /> Predavanja
              </span>
              <p className="text-2xl font-bold text-slate-900">{reportData.summary.lecturesCount}</p>
              <span className="text-[10px] text-slate-500">i druženja</span>
            </div>

            <div className="p-3.5 rounded-xl border border-border bg-slate-50 space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
                <Mail className="h-3.5 w-3.5 text-red-600" /> Opomene
              </span>
              <p className="text-2xl font-bold text-red-600">{reportData.summary.paymentRemindersSent}</p>
              <span className="text-[10px] text-slate-500">Članarina (Dug: {reportData.summary.overdueMembers})</span>
            </div>
          </div>

          {/* DETALJNI TABLIČNI PRIKAZI */}
          <div className="space-y-6 pt-2">
            {/* 1. NOVI ČLANOVI */}
            <div className="space-y-2">
              <h3 className="font-bold text-sm text-[#1B2B36] uppercase tracking-wider flex items-center gap-2 border-b border-border pb-1.5">
                <Users className="h-4 w-4 text-[#CEA369]" />
                Novi članovi učlanjeni u odabranom periodu ({reportData.details.newMembers.length})
              </h3>
              {reportData.details.newMembers.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-2">U ovom razdoblju nije zabilježeno novih članova.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-border">
                      <tr>
                        <th className="p-2.5">Ime i prezime</th>
                        <th className="p-2.5">E-mail</th>
                        <th className="p-2.5">Broj matice</th>
                        <th className="p-2.5">Datum učlanjenja</th>
                        <th className="p-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {reportData.details.newMembers.map((m: any) => (
                        <tr key={m.id} className="hover:bg-slate-50/70">
                          <td className="p-2.5 font-medium text-slate-900">{m.name}</td>
                          <td className="p-2.5 text-slate-600 font-mono text-[11px]">{m.email || "—"}</td>
                          <td className="p-2.5 font-mono text-[11px]">{m.registryNumber || "—"}</td>
                          <td className="p-2.5 text-slate-600">
                            {m.joinDate ? new Date(m.joinDate).toLocaleDateString("hr-HR") : (m.created_at ? new Date(m.created_at).toLocaleDateString("hr-HR") : "—")}
                          </td>
                          <td className="p-2.5">
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

            {/* 2. UPLATE ČLANARINA */}
            <div className="space-y-2">
              <h3 className="font-bold text-sm text-[#1B2B36] uppercase tracking-wider flex items-center justify-between border-b border-border pb-1.5">
                <span className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-[#CEA369]" />
                  Uplate članarina u odabranom periodu ({reportData.details.payments.length})
                </span>
                <span className="text-emerald-700 font-bold text-sm">
                  Ukupno: {reportData.summary.paymentsTotalAmount.toFixed(2)} €
                </span>
              </h3>
              {reportData.details.payments.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-2">U ovom razdoblju nema evidentiranih uplata članarina.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border text-xs max-h-72 overflow-y-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-border sticky top-0">
                      <tr>
                        <th className="p-2.5">Datum uplate</th>
                        <th className="p-2.5">Član</th>
                        <th className="p-2.5">Matica</th>
                        <th className="p-2.5">Napomena</th>
                        <th className="p-2.5 text-right">Iznos (€)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {reportData.details.payments.map((p: any) => (
                        <tr key={p.id} className="hover:bg-slate-50/70">
                          <td className="p-2.5 text-slate-600">
                            {p.date ? new Date(p.date).toLocaleDateString("hr-HR") : new Date(p.created_at).toLocaleDateString("hr-HR")}
                          </td>
                          <td className="p-2.5 font-medium text-slate-900">{p.memberName || `Član #${p.memberId}`}</td>
                          <td className="p-2.5 font-mono text-[11px]">{p.registryNumber || "—"}</td>
                          <td className="p-2.5 text-slate-500 italic">{p.note || "Godišnja članarina"}</td>
                          <td className="p-2.5 text-right font-bold text-emerald-700">{Number(p.amount).toFixed(2)} €</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 3. DONACIJE */}
            {reportData.details.donations.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-bold text-sm text-[#1B2B36] uppercase tracking-wider flex items-center justify-between border-b border-border pb-1.5">
                  <span className="flex items-center gap-2">
                    <HeartHandshake className="h-4 w-4 text-[#CEA369]" />
                    Primljene donacije ({reportData.details.donations.length})
                  </span>
                  <span className="text-[#CEA369] font-bold text-sm">
                    Ukupno: {reportData.summary.donationsTotalAmount.toFixed(2)} €
                  </span>
                </h3>
                <div className="overflow-x-auto rounded-lg border border-border text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-border">
                      <tr>
                        <th className="p-2.5">Donator / Subjekt</th>
                        <th className="p-2.5">Grad</th>
                        <th className="p-2.5">Datum donacije</th>
                        <th className="p-2.5">Svrha / Napomena</th>
                        <th className="p-2.5 text-right">Iznos (€)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {reportData.details.donations.map((d: any) => (
                        <tr key={d.id} className="hover:bg-slate-50/70">
                          <td className="p-2.5 font-medium text-slate-900">{d.name}</td>
                          <td className="p-2.5 text-slate-600">{d.city || "—"}</td>
                          <td className="p-2.5 text-slate-600">{new Date(d.donated_at).toLocaleDateString("hr-HR")}</td>
                          <td className="p-2.5 text-slate-500 italic">{d.donation_note || "Podrška radu društva"}</td>
                          <td className="p-2.5 text-right font-bold text-[#CEA369]">{Number(d.donated_amount).toFixed(2)} €</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 4. ODRŽANA DOGAĐANJA: Sjednice & Predavanja */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Sjednice */}
              <div className="space-y-2">
                <h3 className="font-bold text-sm text-[#1B2B36] uppercase tracking-wider flex items-center gap-2 border-b border-border pb-1.5">
                  <Calendar className="h-4 w-4 text-[#CEA369]" />
                  Sjednice Odbora ({reportData.details.meetings.length})
                </h3>
                {reportData.details.meetings.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-2">Nema sjednica u ovom razdoblju.</p>
                ) : (
                  <div className="space-y-2">
                    {reportData.details.meetings.map((m: any) => (
                      <div key={m.id} className="p-2.5 rounded-lg border border-border bg-slate-50/50 text-xs flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-slate-900">{m.title}</p>
                          <p className="text-[11px] text-slate-500">
                            {new Date(m.date).toLocaleDateString("hr-HR")} {m.start_time ? `u ${m.start_time}` : ""} &bull; {m.location || "Sjedište društva"}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-[10px]">
                          {m.status || "održano"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Predavanja */}
              <div className="space-y-2">
                <h3 className="font-bold text-sm text-[#1B2B36] uppercase tracking-wider flex items-center gap-2 border-b border-border pb-1.5">
                  <Mic className="h-4 w-4 text-[#CEA369]" />
                  Predavanja & Rodoslovna druženja ({reportData.details.lectures.length})
                </h3>
                {reportData.details.lectures.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-2">Nema predavanja u ovom razdoblju.</p>
                ) : (
                  <div className="space-y-2">
                    {reportData.details.lectures.map((l: any) => (
                      <div key={l.id} className="p-2.5 rounded-lg border border-border bg-slate-50/50 text-xs flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-slate-900">{l.title}</p>
                          <p className="text-[11px] text-slate-500">
                            {new Date(l.date).toLocaleDateString("hr-HR")} &bull; Predavač: {l.host || "—"}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-[10px]">
                          {l.status || "održano"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 5. E-MAIL KOMUNIKACIJA: Pošiljatelji */}
            {reportData.details.mailSendersStats.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-bold text-sm text-[#1B2B36] uppercase tracking-wider flex items-center gap-2 border-b border-border pb-1.5">
                  <Mail className="h-4 w-4 text-[#CEA369]" />
                  Evidencija poslanih e-mailova po korisnicima ({reportData.details.mailSendersStats.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  {reportData.details.mailSendersStats.map((st: any, i: number) => (
                    <div key={i} className="p-3 rounded-lg border border-border bg-slate-50 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">{st.user_name}</p>
                        <p className="text-[11px] text-slate-500 capitalize">{st.user_role || "korisnik"} &bull; {st.action_type === "reply" ? "Odgovori" : "Nove poruke"}</p>
                      </div>
                      <Badge className="bg-[#1B2B36] text-white text-xs px-2.5 py-0.5">
                        {st.count} mail(ova)
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Podnožje za ispis */}
          <div className="pt-8 mt-8 border-t border-slate-200 text-xs text-slate-400 flex items-center justify-between">
            <div>Hrvatsko rodoslovno društvo &bdquo;Pavao Ritter Vitezović&rdquo; Zagreb</div>
            <div>Stranica 1 / 1</div>
          </div>
        </div>
      )}
    </div>
  )
}
