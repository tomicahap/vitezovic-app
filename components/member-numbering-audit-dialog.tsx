"use client"

import * as React from "react"
import Link from "next/link"
import { AlertTriangle, CheckCircle2, Hash, Copy, ExternalLink } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { CloseActionButton, ModalActionFooter } from "@/components/ui/action-bar"
import { MemberNumberingAudit } from "@/lib/member-numbering"
import { formatDateDMY } from "@/lib/utils"

interface MemberNumberingAuditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  audit: MemberNumberingAudit
}

export function MemberNumberingAuditDialog({
  open,
  onOpenChange,
  audit,
}: MemberNumberingAuditDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[88vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="border-b border-border bg-[#FBF9F6] px-6 py-4">
          <DialogTitle className="flex items-center gap-2 font-serif text-xl">
            <Hash className="h-5 w-5 text-amber-700 shrink-0" />
            Kontrola unificiranih brojeva upisa i matice
          </DialogTitle>
          <DialogDescription className="text-xs">
            Pregled duplikata, neusklađenih parova (Br. prijavnice ≠ Br. matice), članova bez broja te rupa u sljednosti. Svi budući upisi automatski nastavljaju niz od{" "}
            <strong className="font-mono text-foreground">{audit.nextFormatted}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 text-sm">
          {/* Sažetak */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center">
            <div className="rounded-xl border border-border bg-muted/30 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Sljedeći u nizu
              </div>
              <div className="mt-1 font-mono text-lg font-bold text-primary">
                {audit.nextFormatted}
              </div>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50/60 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-red-700">
                Duplikati
              </div>
              <div className="mt-1 font-mono text-lg font-bold text-red-800">
                {audit.duplicates.length}
              </div>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                Neusklađeni
              </div>
              <div className="mt-1 font-mono text-lg font-bold text-amber-900">
                {audit.mismatches.length}
              </div>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50/60 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-red-700">
                Bez broja
              </div>
              <div className="mt-1 font-mono text-lg font-bold text-red-800">
                {audit.missing.length}
              </div>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 col-span-2 sm:col-span-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                Rupe u nizu
              </div>
              <div className="mt-1 font-mono text-lg font-bold text-amber-900">
                {audit.gaps.length}
              </div>
            </div>
          </div>

          {!audit.hasErrors ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-6 text-center space-y-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto" />
              <p className="font-semibold text-emerald-900">
                Svi redni brojevi upisa i brojevi matice su potpuno usklađeni!
              </p>
              <p className="text-xs text-emerald-800">
                Nema duplikata, neusklađenih parova, članova bez broja niti preskočenih brojeva (001 – {String(audit.maxNumber).padStart(3, "0")}).
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 1. Duplikati */}
              {audit.duplicates.length > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50/40 p-4 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-800">
                    <Copy className="h-4 w-4 text-red-600 shrink-0" />
                    Duplicirani brojevi ({audit.duplicates.length})
                  </div>
                  <div className="space-y-2">
                    {audit.duplicates.map((dup) => (
                      <div
                        key={`dup-${dup.number}`}
                        className="rounded-lg border border-red-200 bg-white p-3 space-y-1.5"
                      >
                        <div className="flex items-center gap-2">
                          <Badge className="bg-red-600 text-white font-mono text-xs">
                            Broj {dup.formatted}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            dijeli {dup.members.length} člana:
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-0.5">
                          {dup.members.map((m) => (
                            <Link
                              key={`dup-m-${m.id}`}
                              href={`/members/${m.id}`}
                              onClick={() => onOpenChange(false)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50/70 px-2.5 py-1 text-xs font-semibold text-red-900 hover:bg-red-100 transition-colors"
                            >
                              <span>{m.name}</span>
                              {m.joinDate && m.joinDate !== "-" && (
                                <span className="text-[10px] font-normal text-red-700">
                                  ({formatDateDMY(m.joinDate, m.joinDate)})
                                </span>
                              )}
                              <ExternalLink className="h-3 w-3 opacity-70" />
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. Članovi bez broja */}
              {audit.missing.length > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50/40 p-4 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-800">
                    <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                    Članovi bez upisanog broja ({audit.missing.length})
                  </div>
                  <div className="space-y-1.5">
                    {audit.missing.map((m) => (
                      <div
                        key={`miss-${m.id}`}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs"
                      >
                        <div>
                          <Link
                            href={`/members/${m.id}`}
                            onClick={() => onOpenChange(false)}
                            className="font-bold text-primary hover:underline inline-flex items-center gap-1"
                          >
                            {m.name}
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                          <span className="text-muted-foreground ml-2">
                            {m.email ? m.email : "bez e-maila"}
                            {m.joinDate && m.joinDate !== "-" ? ` • Upis: ${formatDateDMY(m.joinDate, m.joinDate)}` : ""}
                          </span>
                        </div>
                        <Badge variant="outline" className="text-[10px] border-red-300 text-red-800 bg-red-50">
                          Nema Br. prijavnice ni Br. matice
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Neusklađeni parovi */}
              {audit.mismatches.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-900">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    Neusklađeni ili neispravni brojevi ({audit.mismatches.length})
                  </div>
                  <div className="space-y-1.5">
                    {audit.mismatches.map((m) => (
                      <div
                        key={`mis-${m.id}`}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs"
                      >
                        <div>
                          <Link
                            href={`/members/${m.id}`}
                            onClick={() => onOpenChange(false)}
                            className="font-bold text-primary hover:underline inline-flex items-center gap-1"
                          >
                            {m.name}
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                          <span className="text-muted-foreground ml-2 font-mono">
                            Prijavnica: {m.membershipNumber || "—"} · Matica: {m.registryNumber || "—"}
                          </span>
                        </div>
                        <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-900 bg-amber-50">
                          {m.reason}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. Rupe u sljednosti */}
              {audit.gaps.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-900">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    Preskočeni brojevi u sljednosti od 001 do {String(audit.maxNumber).padStart(3, "0")} ({audit.gaps.length})
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Slobodni brojevi koje možete iskoristiti u kartonu člana pri ispravku duplikata ili članova bez broja:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {audit.gaps.map((g) => (
                      <Badge
                        key={`gap-${g.number}`}
                        variant="outline"
                        className="font-mono text-xs font-bold border-amber-400 bg-white text-amber-900 px-2.5 py-0.5"
                      >
                        {g.formatted}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <ModalActionFooter
          right={<CloseActionButton label="Zatvori" onClick={() => onOpenChange(false)} />}
        />
      </DialogContent>
    </Dialog>
  )
}
