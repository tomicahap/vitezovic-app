"use client"

import React, { useRef, useState } from "react"
import { FileText, Printer, Download, ExternalLink, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface EventPdfPreviewDialogProps {
  type: "meeting" | "lecture"
  id: number
  title: string
  onClose: () => void
}

export function EventPdfPreviewDialog({ type, id, title, onClose }: EventPdfPreviewDialogProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [loading, setLoading] = useState(true)
  const [cacheBuster] = useState(() => Date.now())

  const pdfInlineUrl = `/api/events/pdf?type=${type}&id=${id}&t=${cacheBuster}`
  const pdfDownloadUrl = `/api/events/pdf?type=${type}&id=${id}&download=1&t=${cacheBuster}`

  const handlePrint = () => {
    try {
      const win = iframeRef.current?.contentWindow
      if (win) {
        win.focus()
        win.print()
        return
      }
    } catch {}
    window.open(pdfInlineUrl, "_blank")
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 backdrop-blur-sm p-2 sm:p-4 md:p-6 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-[#1B2B36] px-4 py-3.5 text-white sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white shadow-sm">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-[#CEA369] text-[#1B2B36] hover:bg-[#CEA369] font-bold text-[10px] px-2 py-0">
                  A4 FORMAT S MARGINAMA
                </Badge>
                <span className="text-[11px] text-slate-300 font-mono">
                  {type === "meeting" ? `Sjednica #${id}` : `Predavanje / druženje #${id}`}
                </span>
              </div>
              <h3 className="truncate font-serif text-base sm:text-lg font-bold text-white mt-0.5">
                {title}
              </h3>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handlePrint}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
            >
              <Printer className="h-4 w-4" />
              Ispiši (Print A4)
            </Button>
            <a
              href={pdfDownloadUrl}
              download
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-rose-600 px-3 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Preuzmi PDF
            </a>
            <a
              href={pdfInlineUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/25 bg-white/10 px-3 text-xs font-medium text-white hover:bg-white/20 transition-colors"
              title="Otvori PDF u novoj kartici preglednika"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Nova kartica</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              className="ml-1 rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
              title="Zatvori pregled"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* PDF Viewer body */}
        <div className="relative flex-1 bg-slate-800/90 p-2 sm:p-4">
          {loading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-900/60 text-white">
              <Loader2 className="h-8 w-8 animate-spin text-[#CEA369] mb-2" />
              <p className="text-sm font-medium">Generiranje A4 PDF izvještaja sa svim podacima...</p>
            </div>
          )}
          <iframe
            ref={iframeRef}
            src={pdfInlineUrl}
            onLoad={() => setLoading(false)}
            title={`PDF izvještaj - ${title}`}
            className="h-full w-full rounded-lg border border-slate-700 bg-white shadow-inner"
          />
        </div>
      </div>
    </div>
  )
}
