"use client"

import React, { useMemo, useState } from "react"
import {
  AlertCircle,
  CheckCircle2,
  GitMerge,
  Inbox,
  Lock,
  Mail,
  Paperclip,
  Plus,
  Search,
  Sparkles,
  UserCheck,
  X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CloseActionButton, ModalActionFooter, SaveActionButton } from "@/components/ui/action-bar"
import { formatDateDMY } from "@/lib/utils"

export interface InquiryLinkCandidate {
  id: number
  subject: string
  requester_name: string
  requester_email?: string
  inquiry_date: string
  status: string
  assigned_to_id?: number | null
  assigned_to_name?: string | null
  source_count: number
  attachments_count: number
  matchReason?: string
}

export function GmailInquiryLinkModal({
  open,
  loading,
  saving,
  emailSubject,
  senderName,
  senderEmail,
  matchingOpen,
  matchingClosed,
  otherOpen,
  selectedInquiryId,
  onSelectInquiryId,
  onAttachToExisting,
  onCreateNew,
  onClose,
}: {
  open: boolean
  loading: boolean
  saving: boolean
  emailSubject: string
  senderName: string
  senderEmail: string
  matchingOpen: InquiryLinkCandidate[]
  matchingClosed: InquiryLinkCandidate[]
  otherOpen: InquiryLinkCandidate[]
  selectedInquiryId: number | null
  onSelectInquiryId: (id: number | null) => void
  onAttachToExisting: (inquiryId: number) => void
  onCreateNew: () => void
  onClose: () => void
}) {
  const [search, setSearch] = useState("")

  const filteredOther = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return otherOpen
    return otherOpen.filter(
      (item) =>
        String(item.id).includes(q) ||
        item.subject.toLowerCase().includes(q) ||
        item.requester_name.toLowerCase().includes(q) ||
        (item.requester_email || "").toLowerCase().includes(q) ||
        (item.assigned_to_name || "").toLowerCase().includes(q)
    )
  }, [otherOpen, search])

  const filteredMatching = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return matchingOpen
    return matchingOpen.filter(
      (item) =>
        String(item.id).includes(q) ||
        item.subject.toLowerCase().includes(q) ||
        item.requester_name.toLowerCase().includes(q) ||
        (item.requester_email || "").toLowerCase().includes(q) ||
        (item.assigned_to_name || "").toLowerCase().includes(q)
    )
  }, [matchingOpen, search])

  if (!open) return null

  const renderCandidateRow = (item: InquiryLinkCandidate, isRecommended: boolean) => {
    const selected = selectedInquiryId === item.id
    const isActive = item.status === "active"
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => onSelectInquiryId(item.id)}
        className={`w-full text-left rounded-2xl border p-3.5 transition-all space-y-1.5 ${
          selected
            ? "border-[#1E3A5F] bg-[#EFF5FB] ring-2 ring-[#CEA369]/60 shadow-xs"
            : isRecommended
            ? "border-amber-300 bg-amber-50/40 hover:border-amber-500"
            : "border-border bg-white hover:border-[#1E3A5F]/40"
        }`}
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-[#1E3A5F] text-white">
              #{item.id}
            </span>
            <Badge
              variant="outline"
              className={`text-[10px] font-bold ${
                isActive
                  ? "bg-amber-50 text-amber-800 border-amber-300"
                  : "bg-purple-50 text-purple-900 border-purple-300"
              }`}
            >
              {isActive ? "U radu" : "Zaprimljeno"}
            </Badge>
            {item.matchReason && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                <Sparkles className="h-2.5 w-2.5" /> {item.matchReason}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>FIFO datum: <strong className="text-foreground">{formatDateDMY(item.inquiry_date)}</strong></span>
            {selected && <CheckCircle2 className="h-4 w-4 text-[#1E3A5F] shrink-0" />}
          </div>
        </div>

        <p className="font-serif text-sm font-bold text-primary line-clamp-1">
          {item.subject}
        </p>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600">
          <span>
            Podnositelj: <strong className="text-slate-900">{item.requester_name}</strong>
            {item.requester_email ? ` (${item.requester_email})` : ""}
          </span>
          {item.assigned_to_name ? (
            <span className="inline-flex items-center gap-1 text-amber-900 font-semibold">
              <UserCheck className="h-3 w-3" /> {item.assigned_to_name}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-purple-800">
              <Inbox className="h-3 w-3" /> Čeka dodjelu
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Mail className="h-3 w-3" /> {item.source_count} e-mail(a)
          </span>
          <span className="inline-flex items-center gap-1">
            <Paperclip className="h-3 w-3" /> {item.attachments_count} priloga
          </span>
        </div>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-0 sm:p-4 bg-black/65 backdrop-blur-xs animate-in fade-in">
      <div className="bg-background border border-border rounded-none sm:rounded-3xl shadow-2xl max-w-2xl w-full h-[100dvh] sm:h-auto sm:max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-[#1E3A5F] border-b-2 border-[#D97706] text-white flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <GitMerge className="h-4 w-4 text-[#D97706] shrink-0" />
              <h3 className="font-serif text-lg font-bold truncate">
                Grupiranje e-maila u istraživački predmet
              </h3>
            </div>
            <p className="text-xs text-slate-200 mt-0.5 truncate">
              Poruka: „{emailSubject || "Rodoslovni upit"}” • {senderName}
              {senderEmail ? ` (${senderEmail})` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Zatvori prozor"
            className="p-1.5 rounded-full hover:bg-white/10 text-white/80 shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {matchingClosed.length > 0 && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50/80 p-3.5 text-xs text-amber-950 flex items-start gap-2.5">
              <Lock className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">
                  Ova osoba ima {matchingClosed.length === 1 ? "raniji trajno zatvoreni predmet" : "ranije trajno zatvorene predmete"}:
                </p>
                <p className="text-amber-900/90 leading-relaxed">
                  {matchingClosed
                    .map((c) => `#${c.id} „${c.subject}” (${formatDateDMY(c.inquiry_date)})`)
                    .join("; ")}
                  . U trajno zatvoreni predmet nije moguće dodavati dopune — ako nema otvorenog predmeta, otvorite novi predmet.
                </p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              Provjera postojećih otvorenih predmeta u bazi...
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-[#CEA369]/40 bg-[#FEFCE8]/70 px-4 py-3 text-xs text-[#7C2D12] flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-[#D97706] shrink-0 mt-0.5" />
                <span>
                  Kada pridružite poruku postojećem predmetu, <strong>čuva se izvorni FIFO datum zaprimanja</strong>, sav tekst poruke dodaje se kronološki, a novi privitci spremaju se bez gubitka i bez duplikata.
                </span>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Pretraži sve otvorene predmete po broju (#ID), imenu, e-mailu ili temi..."
                  className="pl-9 h-9 text-xs rounded-full bg-white"
                />
              </div>

              {filteredMatching.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                    Preporučeno — pronađeni otvoreni predmeti istog podnositelja ({filteredMatching.length})
                  </h4>
                  <div className="space-y-2">
                    {filteredMatching.map((item) => renderCandidateRow(item, true))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {filteredMatching.length > 0
                    ? `Ostali otvoreni predmeti (${filteredOther.length})`
                    : `Svi otvoreni predmeti (${filteredOther.length})`}
                </h4>
                {filteredOther.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-4 text-center border border-dashed border-border rounded-xl">
                    Nema drugih otvorenih predmeta koji odgovaraju pretrazi.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {filteredOther.map((item) => renderCandidateRow(item, false))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <ModalActionFooter
          left={
            <Button
              type="button"
              variant="outline"
              disabled={saving || loading}
              onClick={onCreateNew}
              className="rounded-full h-10 px-4 text-xs font-semibold border-2 border-[#1E3A5F]/30 text-[#1E3A5F] hover:bg-slate-100 gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Otvori kao novi predmet
            </Button>
          }
          right={
            <>
              <CloseActionButton label="Odustani" onClick={onClose} disabled={saving} />
              <SaveActionButton
                label="Pridruži odabranom predmetu"
                loading={saving}
                disabled={loading || !selectedInquiryId}
                onClick={() => {
                  if (selectedInquiryId) onAttachToExisting(selectedInquiryId)
                }}
              />
            </>
          }
        />
      </div>
    </div>
  )
}
