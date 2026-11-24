"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Database,
  FileText,
  FolderOpen,
  HardDrive,
  Image as ImageIcon,
  Layers,
  Loader2,
  RefreshCw,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { formatDateTimeDMY } from "@/lib/utils"
import type { StorageStatsReport } from "@/lib/storage-stats"

function formatBytes(bytes?: number | null): string {
  const b = Math.max(0, Number(bytes) || 0)
  if (b === 0) return "0 B"
  if (b < 1024) return `${b.toLocaleString("hr-HR")} B`
  if (b < 1024 * 1024) {
    return `${(b / 1024).toFixed(1).replace(".", ",")} KB`
  }
  if (b < 1024 * 1024 * 1024) {
    return `${(b / (1024 * 1024)).toFixed(2).replace(".", ",")} MB`
  }
  return `${(b / (1024 * 1024 * 1024)).toFixed(2).replace(".", ",")} GB`
}

const CATEGORY_LABELS: Record<string, { label: string; cls: string }> = {
  image: { label: "Slika", cls: "bg-violet-100 text-violet-900 border-violet-300" },
  pdf: { label: "PDF", cls: "bg-rose-100 text-rose-900 border-rose-300" },
  document: { label: "Dokument", cls: "bg-sky-100 text-sky-900 border-sky-300" },
  other: { label: "Ostalo", cls: "bg-slate-100 text-slate-800 border-slate-300" },
}

export function SettingsStorageMonitorCard() {
  const { user } = useAuth()
  const isAdmin = user?.role === "admin"

  const [stats, setStats] = useState<StorageStatsReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({})

  const fetchStats = useCallback(async () => {
    if (!isAdmin || !user) return
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/admin/storage-stats", {
        cache: "no-store",
        headers: {
          "x-user-id": String(user.id ?? ""),
          "x-user-role": String(user.role ?? ""),
          "x-user-email": String(user.email ?? ""),
        },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || "Greška pri dohvaćanju podataka o zauzeću prostora.")
      }
      setStats(data as StorageStatsReport)
    } catch (e: any) {
      setError(e?.message || "Nije moguće izračunati veličinu pohrane.")
    } finally {
      setLoading(false)
    }
  }, [isAdmin, user])

  useEffect(() => {
    if (isAdmin) {
      fetchStats()
    }
  }, [isAdmin, fetchStats])

  const maxModuleBytes = useMemo(() => {
    if (!stats?.modules?.length) return 1
    return Math.max(1, ...stats.modules.map((m) => m.totalBytes))
  }, [stats])

  if (!isAdmin) return null

  const otherUploadsBytes = stats
    ? Math.max(0, stats.uploads.totalBytes - stats.uploads.imagesBytes)
    : 0
  const otherUploadsCount = stats
    ? Math.max(0, stats.uploads.totalFiles - stats.uploads.imagesCount)
    : 0

  const toggleModule = (key: string) => {
    setExpandedModules((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <Card className="border-2 border-[#CEA369]/50 bg-[#FBF9F6]/70 shadow-xs">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="flex items-center gap-2 text-lg text-[#1B2B36]">
                <HardDrive className="h-5 w-5 text-[#CEA369]" />
                Brojač veličine baza, slika i prostora po modulima
              </CardTitle>
              <Badge className="bg-[#1B2B36] text-[#F2EFE9] border border-[#CEA369] text-[10px] font-semibold">
                Samo za administratora
              </Badge>
            </div>
            <CardDescription>
              Stvarni pregled veličine SQLite baza podataka, slika, privitaka i zauzeća prostora za svaki pojedini modul sustava „Rodoslovac”.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {stats?.generatedAt && (
              <span className="text-[11px] font-mono text-muted-foreground hidden md:inline">
                Mjereno: {formatDateTimeDMY(stats.generatedAt)}
              </span>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fetchStats}
              disabled={loading}
              className="rounded-full border-2 border-[#CEA369]/70 bg-white hover:bg-[#F2EFE9] text-[#1B2B36] font-semibold gap-1.5"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#CEA369]" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 text-[#CEA369]" />
              )}
              {loading ? "Mjerenje..." : "Osvježi mjerenje"}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {error && (
          <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-xs font-medium text-red-800 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading && !stats ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-[#CEA369]" />
            <span>Analiza baza podataka i datoteka u tijeku...</span>
          </div>
        ) : stats ? (
          <>
            {/* 1. Glavni brojači (KPI) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <div className="rounded-2xl border-2 border-[#1B2B36]/20 bg-[#1B2B36] text-[#F2EFE9] p-4 shadow-xs">
                <div className="flex items-center justify-between text-xs text-[#F2EFE9]/80">
                  <span className="font-semibold uppercase tracking-wider text-[10px]">
                    Ukupni prostor sustava
                  </span>
                  <HardDrive className="h-4 w-4 text-[#CEA369]" />
                </div>
                <p className="mt-1.5 font-serif text-2xl font-bold text-white">
                  {formatBytes(stats.grandTotalBytes)}
                </p>
                <p className="mt-1 text-[11px] text-[#F2EFE9]/75">
                  Baze na disku ({formatBytes(stats.totalDatabasesDiskBytes)}) + uploads (
                  {formatBytes(stats.uploads.totalBytes)})
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-white p-4 shadow-2xs">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-semibold uppercase tracking-wider text-[10px]">
                    SQLite baze podataka
                  </span>
                  <Database className="h-4 w-4 text-[#1B2B36]" />
                </div>
                <p className="mt-1.5 font-serif text-2xl font-bold text-[#1B2B36]">
                  {formatBytes(stats.totalDatabasesDiskBytes)}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Podaci i indeksi: {formatBytes(stats.totalDatabasesLogicalBytes)} •{" "}
                  {stats.databases.filter((d) => d.exists).length}/3 aktivne baze
                </p>
              </div>

              <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4 shadow-2xs">
                <div className="flex items-center justify-between text-xs text-violet-900">
                  <span className="font-semibold uppercase tracking-wider text-[10px]">
                    Slike ukupno
                  </span>
                  <ImageIcon className="h-4 w-4 text-violet-700" />
                </div>
                <p className="mt-1.5 font-serif text-2xl font-bold text-violet-950">
                  {formatBytes(stats.images.totalBytes)}
                </p>
                <p className="mt-1 text-[11px] text-violet-900/80">
                  uploads/: {stats.images.uploadedImagesCount} ({formatBytes(stats.images.uploadedImagesBytes)})
                  {stats.images.embeddedDbImagesCount > 0
                    ? ` • u bazi: ${stats.images.embeddedDbImagesCount} (${formatBytes(stats.images.embeddedDbImagesBytes)})`
                    : ""}
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-2xs">
                <div className="flex items-center justify-between text-xs text-emerald-900">
                  <span className="font-semibold uppercase tracking-wider text-[10px]">
                    Dokumenti i privitci
                  </span>
                  <FileText className="h-4 w-4 text-emerald-700" />
                </div>
                <p className="mt-1.5 font-serif text-2xl font-bold text-emerald-950">
                  {formatBytes(otherUploadsBytes)}
                </p>
                <p className="mt-1 text-[11px] text-emerald-900/80">
                  {otherUploadsCount} datoteka ({stats.uploads.pdfCount} PDF •{" "}
                  {stats.uploads.documentCount} dok. • {stats.uploads.otherCount} ostalo)
                </p>
              </div>
            </div>

            {/* 2. Tri odvojene SQLite baze */}
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#1B2B36] flex items-center gap-1.5">
                  <Database className="h-3.5 w-3.5 text-[#CEA369]" />
                  Pojedinačne SQLite baze podataka
                </h4>
                <span className="text-[11px] font-mono text-muted-foreground truncate max-w-full">
                  Mapa baza: {stats.dbDir}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {stats.databases.map((dbInfo) => (
                  <div
                    key={dbInfo.key}
                    className="rounded-xl border border-border bg-white p-3.5 space-y-2 shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold text-[#1B2B36]">{dbInfo.label}</p>
                        <p className="text-[11px] font-mono text-muted-foreground">{dbInfo.fileName}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          dbInfo.exists
                            ? "border-emerald-300 bg-emerald-50 text-emerald-800 text-[10px]"
                            : "border-slate-300 bg-slate-50 text-slate-600 text-[10px]"
                        }
                      >
                        {dbInfo.exists ? "Aktivna" : "Nije kreirana"}
                      </Badge>
                    </div>
                    <div className="flex items-baseline justify-between border-t border-border/60 pt-2">
                      <span className="font-serif text-lg font-bold text-[#1B2B36]">
                        {formatBytes(dbInfo.totalDiskBytes)}
                      </span>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {dbInfo.tableCount} tablica • {dbInfo.totalRows.toLocaleString("hr-HR")} zapisa
                      </span>
                    </div>
                    {dbInfo.exists && (
                      <div className="text-[10px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                        <span>Glavna: {formatBytes(dbInfo.mainBytes)}</span>
                        {dbInfo.walBytes > 0 && <span>WAL: {formatBytes(dbInfo.walBytes)}</span>}
                        {dbInfo.freeBytes > 0 && (
                          <span>Slobodno (freelist): {formatBytes(dbInfo.freeBytes)}</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Zauzeće po modulima Rodoslovca */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#1B2B36] flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-[#CEA369]" />
                  Zauzeće prostora po modulima Rodoslovca
                </h4>
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-[#1B2B36]" />
                    Baza (tablice + indeksi)
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-violet-600" />
                    Slike (uploads)
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-emerald-600" />
                    Dokumenti / privitci
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-white overflow-hidden divide-y divide-border">
                {stats.modules.map((mod) => {
                  const isOpen = Boolean(expandedModules[mod.key])
                  const totalBarPct = maxModuleBytes > 0 ? Math.min(100, (mod.totalBytes / maxModuleBytes) * 100) : 0
                  const dbSegmentPct = mod.totalBytes > 0 ? (mod.dbBytes / mod.totalBytes) * 100 : 0
                  const imgSegmentPct = mod.totalBytes > 0 ? (mod.imageBytes / mod.totalBytes) * 100 : 0
                  const otherSegmentPct = mod.totalBytes > 0 ? (mod.otherUploadBytes / mod.totalBytes) * 100 : 0

                  return (
                    <div key={mod.key} className="bg-white">
                      <button
                        type="button"
                        onClick={() => mod.tables.length > 0 && toggleModule(mod.key)}
                        className={`w-full text-left px-4 py-3 transition-colors ${
                          mod.tables.length > 0 ? "hover:bg-[#FBF9F6] cursor-pointer" : "cursor-default"
                        }`}
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                          <div className="flex items-start gap-2 min-w-0 flex-1">
                            <div className="mt-0.5 text-muted-foreground shrink-0 w-4">
                              {mod.tables.length > 0 ? (
                                isOpen ? (
                                  <ChevronDown className="h-4 w-4 text-[#1B2B36]" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )
                              ) : null}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-bold text-[#1B2B36]">{mod.label}</span>
                                <span className="text-[11px] text-muted-foreground font-mono">
                                  {mod.rowCount.toLocaleString("hr-HR")} zapisa
                                  {mod.uploadCount > 0 ? ` • ${mod.uploadCount} datoteka` : ""}
                                </span>
                                {mod.embeddedImageBytes > 0 && (
                                  <span
                                    className="rounded-md border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900"
                                    title="Base64 slike pohranjene izravno u SQLite bazi (već uključeno u stupac Baza)"
                                  >
                                    Slike u bazi: {formatBytes(mod.embeddedImageBytes)}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                {mod.description}
                              </p>
                              <div className="mt-2 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className="h-full flex rounded-full overflow-hidden transition-all"
                                  style={{ width: `${Math.max(mod.totalBytes > 0 ? 1.5 : 0, totalBarPct)}%` }}
                                >
                                  {dbSegmentPct > 0 && (
                                    <div
                                      className="h-full bg-[#1B2B36]"
                                      style={{ width: `${dbSegmentPct}%` }}
                                    />
                                  )}
                                  {imgSegmentPct > 0 && (
                                    <div
                                      className="h-full bg-violet-600"
                                      style={{ width: `${imgSegmentPct}%` }}
                                    />
                                  )}
                                  {otherSegmentPct > 0 && (
                                    <div
                                      className="h-full bg-emerald-600"
                                      style={{ width: `${otherSegmentPct}%` }}
                                    />
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-4 gap-3 lg:w-[420px] shrink-0 text-right items-center pl-6 lg:pl-0">
                            <div>
                              <span className="block text-[10px] uppercase text-muted-foreground">Baza</span>
                              <span className="text-xs font-mono font-semibold text-[#1B2B36]">
                                {formatBytes(mod.dbBytes)}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[10px] uppercase text-muted-foreground">Slike</span>
                              <span className="text-xs font-mono font-semibold text-violet-800">
                                {formatBytes(mod.imageBytes)}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[10px] uppercase text-muted-foreground">Dokumenti</span>
                              <span className="text-xs font-mono font-semibold text-emerald-800">
                                {formatBytes(mod.otherUploadBytes)}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[10px] uppercase text-muted-foreground">Ukupno</span>
                              <span className="text-xs font-mono font-bold text-[#1B2B36]">
                                {formatBytes(mod.totalBytes)}
                              </span>
                              <span className="block text-[10px] font-mono text-[#b58442]">
                                {mod.sharePercent.toFixed(1).replace(".", ",")}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>

                      {isOpen && mod.tables.length > 0 && (
                        <div className="border-t border-border/60 bg-[#FBF9F6] px-10 py-2.5">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                            SQLite tablice u modulu:
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {mod.tables.map((tbl) => (
                              <div
                                key={tbl.name}
                                className="flex items-center justify-between rounded-lg border border-border/80 bg-white px-2.5 py-1.5 text-xs"
                              >
                                <div className="min-w-0 pr-2">
                                  <span className="font-mono font-semibold text-[#1B2B36] truncate block">
                                    {tbl.name}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {tbl.rowCount.toLocaleString("hr-HR")} redaka
                                  </span>
                                </div>
                                <span className="font-mono font-semibold text-slate-700 shrink-0">
                                  {formatBytes(tbl.bytes)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 4. Ugrađene slike u bazi i najveće datoteke u uploads/ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-xl border border-border bg-white p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#1B2B36] flex items-center gap-1.5">
                    <ImageIcon className="h-3.5 w-3.5 text-violet-700" />
                    Ugrađene slike unutar baze (app.db)
                  </h4>
                  <span className="text-xs font-mono font-bold text-violet-900">
                    {formatBytes(stats.images.embeddedDbImagesBytes)}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Ove Base64 slike već su uračunate u veličinu tablica <code className="font-mono">settings</code> i{" "}
                  <code className="font-mono">members</code> pa se ne zbrajaju dvaput u ukupni prostor sustava.
                </p>
                {stats.images.embeddedBreakdown.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-2">
                    Nema ugrađenih Base64 slika u bazi.
                  </p>
                ) : (
                  <div className="space-y-1.5 pt-1">
                    {stats.images.embeddedBreakdown.map((item) => (
                      <div
                        key={item.key}
                        className="flex items-center justify-between rounded-lg border border-violet-100 bg-violet-50/40 px-3 py-1.5 text-xs"
                      >
                        <span className="font-medium text-violet-950">
                          {item.label}{" "}
                          <span className="text-muted-foreground">({item.count}×)</span>
                        </span>
                        <span className="font-mono font-semibold text-violet-900">
                          {formatBytes(item.bytes)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-border bg-white p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#1B2B36] flex items-center gap-1.5">
                    <FolderOpen className="h-3.5 w-3.5 text-[#CEA369]" />
                    Najveće datoteke u uploads/ (Top 5)
                  </h4>
                  <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[180px]" title={stats.uploadDir}>
                    {stats.uploadDir}
                  </span>
                </div>
                {stats.uploads.largestFiles.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-3">
                    Mapa učitanih datoteka (<code className="font-mono">uploads/</code>) trenutačno je prazna.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {stats.uploads.largestFiles.map((file) => {
                      const cat = CATEGORY_LABELS[file.category] || CATEGORY_LABELS.other
                      return (
                        <div
                          key={file.relativePath}
                          className="flex items-center justify-between gap-2 rounded-lg border border-border/80 bg-[#FBF9F6]/70 px-3 py-1.5 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-mono font-medium text-[#1B2B36]" title={file.relativePath}>
                              {file.name}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`rounded border px-1.5 py-0 text-[9px] font-semibold ${cat.cls}`}>
                                {cat.label}
                              </span>
                              <span className="text-[10px] text-muted-foreground truncate">
                                {file.moduleLabel}
                              </span>
                            </div>
                          </div>
                          <span className="font-mono font-bold text-[#1B2B36] shrink-0">
                            {formatBytes(file.bytes)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}
