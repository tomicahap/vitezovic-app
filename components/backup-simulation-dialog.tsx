"use client"

import React, { useState, useRef } from "react"
import { 
  ShieldCheck, AlertTriangle, CheckCircle, XCircle, Loader2, 
  FileArchive, RefreshCw, Upload, ArrowRight, Database, Paperclip, X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { BackupSimulationReport } from "@/lib/backup"

export function BackupSimulationDialog({
  isOpen,
  onClose
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const [isRunning, setIsRunning] = useState(false)
  const [report, setReport] = useState<BackupSimulationReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const runSimulation = async (file?: File) => {
    setIsRunning(true)
    setError(null)
    setReport(null)

    try {
      let res: Response
      if (file) {
        const formData = new FormData()
        formData.append("file", file)
        res = await fetch("/api/settings/backup/simulate", {
          method: "POST",
          body: formData
        })
      } else {
        res = await fetch("/api/settings/backup/simulate", {
          method: "POST"
        })
      }

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || "Greška pri pokretanju simulacije.")
      }

      const data: BackupSimulationReport = await res.json()
      setReport(data)
    } catch (e: any) {
      console.error(e)
      setError(e.message || "Neuspjela provjera.")
    } finally {
      setIsRunning(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      runSimulation(file)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-background border border-border rounded-3xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center border border-amber-500/20">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-serif text-2xl font-bold text-primary">Simulacija povrata backupa</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Provjera integriteta i usporedba podataka u izoliranom sandboxu (bez diranja radne baze)
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-muted text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Action buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => runSimulation()}
              disabled={isRunning}
              className="flex items-start gap-4 p-4 rounded-2xl border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-all text-left group disabled:opacity-50"
            >
              <div className="p-2.5 rounded-xl bg-primary text-primary-foreground group-hover:scale-105 transition-transform">
                <RefreshCw className={`h-5 w-5 ${isRunning ? "animate-spin" : ""}`} />
              </div>
              <div>
                <p className="text-sm font-bold text-primary">Provjeri automatski backup</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Generira i testira cjelokupni backup paket sustava prema propisanom protokolu.
                </p>
              </div>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isRunning}
              className="flex items-start gap-4 p-4 rounded-2xl border border-border hover:border-amber-400 bg-card hover:bg-muted/30 transition-all text-left group disabled:opacity-50"
            >
              <input
                type="file"
                ref={fileInputRef}
                accept=".zip,.db,.sqlite"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="p-2.5 rounded-xl bg-secondary text-secondary-foreground group-hover:scale-105 transition-transform">
                <Upload className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Učitaj ZIP datoteku za provjeru</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Odaberite postojeću .zip sigurnosnu kopiju s računala za testiranje.
                </p>
              </div>
            </button>
          </div>

          {/* Running State */}
          {isRunning && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3 bg-muted/20 border border-dashed border-border rounded-2xl">
              <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
              <p className="font-serif text-base font-bold text-primary">Izvršavanje simulacije u sandboxu...</p>
              <p className="text-xs text-muted-foreground max-w-sm">
                Provjera SQLite pragma integriteta, vanjskih ključeva, usporedba tablica i provjera privitaka.
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Report Display */}
          {report && (
            <div className="space-y-5 animate-in fade-in">
              {/* Status Banner */}
              <div
                className={`p-5 rounded-2xl border flex items-center gap-4 ${
                  report.isReadyForRestore
                    ? "bg-emerald-50/70 border-emerald-300 text-emerald-950"
                    : "bg-amber-50/70 border-amber-300 text-amber-950"
                }`}
              >
                <div
                  className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 ${
                    report.isReadyForRestore ? "bg-emerald-600 text-white" : "bg-amber-600 text-white"
                  }`}
                >
                  {report.isReadyForRestore ? <CheckCircle className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider block">
                    {report.isReadyForRestore ? "Status simulacije: Verificirano" : "Status simulacije: Upozorenje"}
                  </span>
                  <h4 className="font-serif text-xl font-bold leading-tight">
                    {report.isReadyForRestore
                      ? "Backup je 100% valjan i spreman za povrat"
                      : "Pronađena su manja odstupanja"}
                  </h4>
                  <p className="text-xs mt-0.5 opacity-90 truncate">
                    Izvor: {report.source} • Testirano: {new Date(report.testedAt).toLocaleTimeString("en-GB")}
                  </p>
                </div>
              </div>

              {/* Integrity KPI Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 bg-card border border-border rounded-xl text-center">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground block">SQLite Integritet</span>
                  <span className="font-bold text-sm text-emerald-600">
                    {report.integrityCheck === "ok" ? "Ispravan (OK)" : report.integrityCheck}
                  </span>
                </div>

                <div className="p-3 bg-card border border-border rounded-xl text-center">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground block">Struktura tablica</span>
                  <span className="font-bold text-sm text-primary">
                    {report.tablesFound.length} pronađeno {report.missingTables.length > 0 && `(${report.missingTables.length} fali)`}
                  </span>
                </div>

                <div className="p-3 bg-card border border-border rounded-xl text-center">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground block">Privitci i dokumenti</span>
                  <span className="font-bold text-sm text-primary">
                    {report.uploads.totalFiles} datoteka ({report.uploads.totalSizeMB} MB)
                  </span>
                </div>

                <div className="p-3 bg-card border border-border rounded-xl text-center">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground block">Integritet ključeva</span>
                  <span className="font-bold text-sm text-emerald-600">
                    {report.foreignKeyErrors === 0 ? "Bez grešaka (0)" : `${report.foreignKeyErrors} grešaka`}
                  </span>
                </div>
              </div>

              {/* Data Audit Table */}
              <div className="border border-border rounded-2xl overflow-hidden bg-card">
                <div className="p-4 border-b border-border bg-muted/20">
                  <h5 className="font-serif text-sm font-bold text-primary">
                    Usporedba podataka: Backup naspram trenutnog živog sustava
                  </h5>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border text-[10px] uppercase font-bold text-muted-foreground bg-muted/10">
                        <th className="p-3">Područje / Modul</th>
                        <th className="p-3 text-right">U testiranom backupu</th>
                        <th className="p-3 text-right">U trenutnom sustavu</th>
                        <th className="p-3 text-center">Odstupanje (Diff)</th>
                        <th className="p-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {Object.entries(report.audit).map(([tbl, data]) => {
                        const isMatch = data.diff === 0
                        return (
                          <tr key={tbl} className="hover:bg-muted/20 transition-colors">
                            <td className="p-3 font-semibold text-primary">{data.label}</td>
                            <td className="p-3 text-right font-mono font-bold">{data.backupCount}</td>
                            <td className="p-3 text-right font-mono text-muted-foreground">{data.liveCount}</td>
                            <td className="p-3 text-center font-mono">
                              {data.diff === 0 ? (
                                <span className="text-muted-foreground">0</span>
                              ) : data.diff > 0 ? (
                                <span className="text-blue-600 font-bold">+{data.diff}</span>
                              ) : (
                                <span className="text-amber-600 font-bold">{data.diff}</span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              {isMatch ? (
                                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-bold">
                                  <CheckCircle className="h-3 w-3" /> 100%
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 font-bold">
                                  {data.diff < 0 ? "Noviji unosi u bazi" : "Razlika"}
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Warnings & Notes */}
              {report.warnings && report.warnings.length > 0 && (
                <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200 space-y-1">
                  <span className="text-[11px] font-bold text-amber-900 block">Upozorenja:</span>
                  <ul className="list-disc pl-4 text-xs text-amber-800 space-y-0.5">
                    {report.warnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-[11px] text-muted-foreground italic text-center">
                Napomena: Ova provjera izvršena je u privremenom sandboxu. Niti jedan stvarni podatak u radnoj bazi nije mijenjan.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex justify-end bg-muted/10">
          <Button onClick={onClose} className="rounded-full px-6">
            Zatvori
          </Button>
        </div>
      </div>
    </div>
  )
}
