"use client"

import React, { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  AlertCircle,
  ArrowRightLeft,
  CheckCircle2,
  GitMerge,
  Inbox,
  Mail,
  Paperclip,
  Search,
  Sparkles,
  Trash2,
  UserCheck,
  X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CloseActionButton, ModalActionFooter, SaveActionButton } from "@/components/ui/action-bar"
import { formatDateDMY } from "@/lib/utils"
import {
  compareInquiriesFifo,
  pickEarliestInquiryDate,
  seedInitialSourceMessage,
} from "@/lib/inquiry-grouping"
import type { ResearchInquiry } from "@/components/research-inquiries-tab"

export function InquiryMergeModal({
  open,
  inquiries,
  initialTargetId,
  user,
  onClose,
  onMerged,
}: {
  open: boolean
  inquiries: ResearchInquiry[]
  initialTargetId?: number | null
  user: any
  onClose: () => void
  onMerged: (mergedInquiry: ResearchInquiry) => void
}) {
  const openInquiries = useMemo(() => {
    return inquiries
      .filter((i) => i.status !== "completed" && i.status !== "rejected" && !i.feedback)
      .slice()
      .sort(compareInquiriesFifo)
  }, [inquiries])

  const [targetId, setTargetId] = useState<number | null>(null)
  const [sourceIds, setSourceIds] = useState<number[]>([])
  const [search, setSearch] = useState("")
  const [merging, setMerging] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setError("")
    setSearch("")
    const fallbackId =
      initialTargetId && openInquiries.some((i) => i.id === initialTargetId)
        ? initialTargetId
        : openInquiries[0]?.id ?? null
    setTargetId(fallbackId)
    setSourceIds([])
  }, [open, initialTargetId, openInquiries])

  const targetInquiry = useMemo(
    () => openInquiries.find((i) => i.id === targetId) || null,
    [openInquiries, targetId]
  )

  const selectedSources = useMemo(
    () => openInquiries.filter((i) => sourceIds.includes(i.id)),
    [openInquiries, sourceIds]
  )

  const candidateSources = useMemo(() => {
    const q = search.trim().toLowerCase()
    const targetEmail = (targetInquiry?.requester_email || "").trim().toLowerCase()
    const targetName = (targetInquiry?.requester_name || "").trim().toLowerCase()

    const list = openInquiries.filter((i) => {
      if (i.id === targetId) return false
      if (!q) return true
      return (
        String(i.id).includes(q) ||
        i.subject.toLowerCase().includes(q) ||
        i.requester_name.toLowerCase().includes(q) ||
        (i.requester_email || "").toLowerCase().includes(q) ||
        (i.assigned_to_name || "").toLowerCase().includes(q)
      )
    })

    return list.sort((a, b) => {
      const aMatch =
        (targetEmail && (a.requester_email || "").trim().toLowerCase() === targetEmail) ||
        (targetName && a.requester_name.trim().toLowerCase() === targetName)
      const bMatch =
        (targetEmail && (b.requester_email || "").trim().toLowerCase() === targetEmail) ||
        (targetName && b.requester_name.trim().toLowerCase() === targetName)
      if (aMatch !== bMatch) return aMatch ? -1 : 1
      return compareInquiriesFifo(a, b)
    })
  }, [openInquiries, targetId, targetInquiry, search])

  const earliestSelectedSource = useMemo(() => {
    if (!targetInquiry || selectedSources.length === 0) return null
    const allSorted = [targetInquiry, ...selectedSources].sort(compareInquiriesFifo)
    return allSorted[0].id !== targetInquiry.id ? allSorted[0] : null
  }, [targetInquiry, selectedSources])

  const previewSummary = useMemo(() => {
    if (!targetInquiry) return null
    const targetSourceCount =
      Array.isArray(targetInquiry.source_messages) && targetInquiry.source_messages.length > 0
        ? targetInquiry.source_messages.length
        : 1
    const addedSourceCount = selectedSources.reduce((sum, s) => {
      const cnt =
        Array.isArray(s.source_messages) && s.source_messages.length > 0
          ? s.source_messages.length
          : 1
      return sum + cnt
    }, 0)
    const totalAttachments =
      (targetInquiry.attachments || []).length +
      selectedSources.reduce((sum, s) => sum + (s.attachments || []).length, 0)
    const earliestFifoDate = pickEarliestInquiryDate(
      targetInquiry.inquiry_date,
      ...selectedSources.map((s) => s.inquiry_date)
    )
    const inheritedResearcher =
      targetInquiry.assigned_to_name ||
      selectedSources.find((s) => s.assigned_to_name)?.assigned_to_name ||
      null

    return {
      earliestFifoDate,
      totalMessages: targetSourceCount + addedSourceCount,
      maxAttachments: totalAttachments,
      inheritedResearcher,
    }
  }, [targetInquiry, selectedSources])

  if (!open) return null

  const toggleSource = (id: number) => {
    setSourceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const handleConfirmMerge = async () => {
    if (!targetId || sourceIds.length === 0) {
      setError("Odaberite glavni predmet i barem jedan predmet za spajanje.")
      return
    }
    setMerging(true)
    setError("")
    try {
      const res = await fetch("/api/projects/inquiries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(user
            ? {
                "x-user-id": String(user.id ?? ""),
                "x-user-role": String(user.role ?? ""),
                "x-user-email": String(user.email ?? ""),
              }
            : {}),
        },
        body: JSON.stringify({
          action: "merge",
          targetId,
          sourceIds,
          actor: user
            ? { id: user.id, name: user.name, role: user.role, email: user.email }
            : undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) {
        throw new Error(data.error || "Greška pri spajanju istraživačkih predmeta.")
      }
      toast.success(
        `Predmeti (${sourceIds.map((id) => `#${id}`).join(", ")}) spojeni su u predmet #${targetId}.`
      )
      onMerged(data.inquiry)
    } catch (e: any) {
      setError(e?.message || "Greška pri spajanju istraživačkih predmeta.")
    } finally {
      setMerging(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-0 sm:p-4 bg-black/65 backdrop-blur-xs animate-in fade-in">
      <div className="bg-background border border-border rounded-none sm:rounded-3xl shadow-2xl max-w-3xl w-full h-[100dvh] sm:h-auto sm:max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-[#1E3A5F] border-b-2 border-[#D97706] text-white flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <GitMerge className="h-4 w-4 text-[#D97706] shrink-0" />
              <h3 className="font-serif text-lg font-bold truncate">
                Spajanje otvorenih istraživačkih predmeta (Administrator)
              </h3>
            </div>
            <p className="text-xs text-slate-200 mt-0.5">
              Spojite više upita iste osobe u jedan jedinstveni predmet bez gubitka sadržaja, privitaka i FIFO redoslijeda.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={merging}
            aria-label="Zatvori prozor"
            className="p-1.5 rounded-full hover:bg-white/10 text-white/80 shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {openInquiries.length < 2 ? (
            <div className="py-10 text-center text-xs text-muted-foreground border border-dashed border-border rounded-2xl">
              Za spajanje su potrebna najmanje 2 otvorena predmeta (Zaprimljeno ili U radu).
            </div>
          ) : (
            <>
              {/* 1. Glavni predmet */}
              <div className="rounded-2xl border border-[#CEA369]/60 bg-[#FEFCE8]/60 p-4 space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-[#7C2D12] block">
                  1. Glavni predmet u koji se sve spaja (ostaje aktivan)
                </label>
                <select
                  value={targetId || ""}
                  onChange={(e) => {
                    const nextId = Number(e.target.value) || null
                    setTargetId(nextId)
                    if (nextId) {
                      setSourceIds((prev) => prev.filter((id) => id !== nextId))
                    }
                  }}
                  className="w-full h-10 rounded-xl border border-[#CEA369]/60 bg-white px-3 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20"
                >
                  {openInquiries.map((inq) => (
                    <option key={inq.id} value={inq.id}>
                      #{inq.id} • {formatDateDMY(inq.inquiry_date)} • {inq.requester_name} — {inq.subject} (
                      {inq.status === "active" ? `U radu: ${inq.assigned_to_name || "dodijeljeno"}` : "Zaprimljeno"})
                    </option>
                  ))}
                </select>
                {targetInquiry && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-700 pt-1">
                    <span>
                      Podnositelj: <strong>{targetInquiry.requester_name}</strong>
                      {targetInquiry.requester_email ? ` (${targetInquiry.requester_email})` : ""}
                    </span>
                    <span>
                      Zaprimljeno: <strong>{formatDateDMY(targetInquiry.inquiry_date)}</strong>
                    </span>
                    <span>
                      E-mailova:{" "}
                      <strong>
                        {Array.isArray(targetInquiry.source_messages) && targetInquiry.source_messages.length > 0
                          ? targetInquiry.source_messages.length
                          : seedInitialSourceMessage(targetInquiry)
                          ? 1
                          : 1}
                      </strong>
                    </span>
                    <span>
                      Privitaka: <strong>{(targetInquiry.attachments || []).length}</strong>
                    </span>
                  </div>
                )}
              </div>

              {earliestSelectedSource && (
                <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-start gap-2">
                    <Sparkles className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                    <span>
                      Odabrani predmet <strong>#{earliestSelectedSource.id}</strong> zaprimljen je ranije (
                      <strong>{formatDateDMY(earliestSelectedSource.inquiry_date)}</strong>). Sustav će u svakom slučaju sačuvati najraniji FIFO datum zaprimanja, a po želji ga možete postaviti kao glavni predmet.
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const oldTarget = targetId
                      setTargetId(earliestSelectedSource.id)
                      setSourceIds((prev) => {
                        const filtered = prev.filter((id) => id !== earliestSelectedSource.id)
                        return oldTarget && !filtered.includes(oldTarget)
                          ? [...filtered, oldTarget]
                          : filtered
                      })
                    }}
                    className="rounded-full h-8 px-3 text-[11px] border-amber-400 bg-white text-amber-950 hover:bg-amber-100 shrink-0 gap-1"
                  >
                    <ArrowRightLeft className="h-3 w-3" />
                    Postavi #{earliestSelectedSource.id} kao glavni
                  </Button>
                </div>
              )}

              {/* 2. Sekundarni predmeti */}
              <div className="space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-primary">
                    2. Odaberite predmete koje želite pripojiti glavnom predmetu ({sourceIds.length} odabrano)
                  </label>
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Pretraži po broju, imenu ili temi..."
                      className="pl-8 h-8 text-xs rounded-full bg-white"
                    />
                  </div>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {candidateSources.map((inq) => {
                    const checked = sourceIds.includes(inq.id)
                    const isSameRequester =
                      (targetInquiry?.requester_email &&
                        (inq.requester_email || "").trim().toLowerCase() ===
                          targetInquiry.requester_email.trim().toLowerCase()) ||
                      (targetInquiry?.requester_name &&
                        inq.requester_name.trim().toLowerCase() ===
                          targetInquiry.requester_name.trim().toLowerCase())
                    const srcCount =
                      Array.isArray(inq.source_messages) && inq.source_messages.length > 0
                        ? inq.source_messages.length
                        : 1

                    return (
                      <label
                        key={inq.id}
                        className={`flex items-start gap-3 rounded-2xl border p-3 cursor-pointer transition-all ${
                          checked
                            ? "border-[#1E3A5F] bg-[#EFF5FB] ring-1 ring-[#CEA369]"
                            : isSameRequester
                            ? "border-emerald-300 bg-emerald-50/40 hover:border-emerald-500"
                            : "border-border bg-white hover:border-[#1E3A5F]/40"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSource(inq.id)}
                          className="mt-1 rounded border-slate-300"
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-white">
                                #{inq.id}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${
                                  inq.status === "active"
                                    ? "bg-amber-50 text-amber-800 border-amber-300"
                                    : "bg-purple-50 text-purple-900 border-purple-300"
                                }`}
                              >
                                {inq.status === "active" ? "U radu" : "Zaprimljeno"}
                              </Badge>
                              {isSameRequester && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                                  <Sparkles className="h-2.5 w-2.5" /> Isti podnositelj
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-muted-foreground">
                              Zaprimljeno: <strong className="text-foreground">{formatDateDMY(inq.inquiry_date)}</strong>
                            </span>
                          </div>

                          <p className="font-serif text-sm font-bold text-primary line-clamp-1">
                            {inq.subject}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-600">
                            <span>
                              <strong>{inq.requester_name}</strong>
                              {inq.requester_email ? ` (${inq.requester_email})` : ""}
                            </span>
                            {inq.assigned_to_name ? (
                              <span className="inline-flex items-center gap-1 text-amber-900">
                                <UserCheck className="h-3 w-3" /> {inq.assigned_to_name}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-purple-800">
                                <Inbox className="h-3 w-3" /> Nedodijeljeno
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1">
                              <Mail className="h-3 w-3" /> {srcCount} e-mail(a)
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Paperclip className="h-3 w-3" /> {(inq.attachments || []).length} priloga
                            </span>
                          </div>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* 3. Live Merge Summary */}
              {previewSummary && selectedSources.length > 0 && (
                <div className="rounded-2xl border border-[#1E3A5F]/25 bg-slate-50 p-4 space-y-2 text-xs">
                  <div className="font-bold text-[#1E3A5F] flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Sažetak nakon spajanja u predmet #{targetInquiry?.id}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700">
                    <div>
                      • Sačuvani FIFO datum: <strong>{formatDateDMY(previewSummary.earliestFifoDate)}</strong>
                    </div>
                    <div>
                      • Ukupno povezanih e-mailova: <strong>{previewSummary.totalMessages}</strong>
                    </div>
                    <div>
                      • Privitci: do <strong>{previewSummary.maxAttachments}</strong> (identični duplikati automatski se preskaču)
                    </div>
                    <div>
                      • Istraživač:{" "}
                      <strong>{previewSummary.inheritedResearcher || "Čeka dodjelu"}</strong>
                    </div>
                  </div>
                  <div className="flex items-start gap-1.5 text-[11px] text-slate-600 pt-1 border-t border-slate-200">
                    <Trash2 className="h-3.5 w-3.5 text-slate-500 shrink-0 mt-0.5" />
                    <span>
                      Spojeni predmeti ({selectedSources.map((s) => `#${s.id}`).join(", ")}) automatski se spremaju u <strong>Smeće (/trash)</strong> radi sigurnosne evidencije, a sve njihove Gmail značke u Inboxu automatski upućuju na predmet <strong>#{targetInquiry?.id}</strong>.
                    </span>
                  </div>
                </div>
              )}

              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2 font-medium">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <ModalActionFooter
          right={
            <>
              <CloseActionButton label="Odustani" onClick={onClose} disabled={merging} />
              <SaveActionButton
                label="Potvrdi spajanje predmeta"
                loading={merging}
                disabled={!targetId || sourceIds.length === 0}
                onClick={handleConfirmMerge}
              />
            </>
          }
        />
      </div>
    </div>
  )
}
