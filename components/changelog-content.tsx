"use client"

import React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  History,
  Sparkles,
  CheckCircle2,
  Wrench,
  ShieldCheck,
  Database,
  Mail,
  FileBarChart,
  HeartHandshake,
  BookOpen,
  Calendar,
} from "lucide-react"
import { CHANGELOG_DATA } from "@/lib/changelog-data"

export { CHANGELOG_DATA }

export function ChangelogContent() {
  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <History className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Popis promjena i nadogradnji (Changelog)
              </h1>
              <p className="text-sm text-muted-foreground">
                Kronološki pregled svih funkcionalnosti, poboljšanja i ispravaka u sustavu Rodoslovac (HRD-CMS)
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-[#1B2B36] text-[#CEA369] border border-[#CEA369] text-xs px-3 py-1 font-mono">
            Aktualna verzija: v19.11.2026
          </Badge>
        </div>
      </div>

      {/* Info kartica o lokaciji baza i sustavu */}
      <Card className="border-border bg-slate-50/70 shadow-xs">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-slate-700">
            <Database className="h-4 w-4 text-[#CEA369] shrink-0" />
            <span>
              <strong>Produkcijska pohrana baza podataka:</strong>{" "}
              <code className="px-1.5 py-0.5 rounded bg-white border font-mono text-[11px]">
                /var/data/prv_data/db/
              </code>{" "}
              (app.db, mailcrawl.db, company_scraper.db)
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
            <ShieldCheck className="h-4 w-4" />
            <span>100% obuhvaćeno automatskim Backupom i Dry-Run provjerom</span>
          </div>
        </CardContent>
      </Card>

      {/* Vremenska crta izdanja */}
      <div className="space-y-6">
        {CHANGELOG_DATA.map((entry) => (
          <Card
            key={entry.version}
            className={`border overflow-hidden transition-shadow ${
              entry.isLatest ? "border-[#CEA369] shadow-md ring-1 ring-[#CEA369]/30" : "border-border shadow-xs"
            }`}
          >
            <CardHeader className={`${entry.isLatest ? "bg-[#1B2B36] text-white" : "bg-muted/40"} pb-4`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`font-mono text-sm font-bold px-2.5 py-1 rounded-md ${
                      entry.isLatest
                        ? "bg-[#CEA369] text-[#1B2B36]"
                        : "bg-primary/10 text-primary border border-primary/20"
                    }`}
                  >
                    {entry.version}
                  </span>
                  <span className={`text-xs flex items-center gap-1 ${entry.isLatest ? "text-slate-300" : "text-muted-foreground"}`}>
                    <Calendar className="h-3.5 w-3.5" />
                    {entry.dateLabel}
                  </span>
                </div>
                <Badge
                  variant={entry.isLatest ? "default" : "secondary"}
                  className={entry.isLatest ? "bg-emerald-600 text-white border-none text-xs" : "text-xs"}
                >
                  {entry.badge}
                </Badge>
              </div>
              <CardTitle className={`text-base mt-2 ${entry.isLatest ? "text-white" : "text-foreground"}`}>
                {entry.title}
              </CardTitle>
            </CardHeader>

            <CardContent className="p-5">
              <ul className="space-y-3">
                {entry.changes.map((c, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-xs sm:text-sm leading-relaxed">
                    {c.type === "novo" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0 mt-0.5">
                        <Sparkles className="h-3 w-3" /> Novo
                      </span>
                    )}
                    {c.type === "poboljsanje" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 shrink-0 mt-0.5">
                        <CheckCircle2 className="h-3 w-3" /> Poboljšanje
                      </span>
                    )}
                    {c.type === "ispravak" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200 shrink-0 mt-0.5">
                        <Wrench className="h-3 w-3" /> Ispravak
                      </span>
                    )}
                    <span className="text-slate-700">{c.text}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
