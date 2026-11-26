"use client"

import * as React from "react"
import { AlertTriangle, ShieldCheck } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  CloseActionButton,
  DeleteActionButton,
  ModalActionFooter,
  SaveActionButton,
} from "@/components/ui/action-bar"

export interface ConfirmActionOptions {
  title?: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: "danger" | "default"
}

interface PendingConfirmRequest {
  options: Required<ConfirmActionOptions>
  resolve: (confirmed: boolean) => void
}

type ConfirmListener = (req: PendingConfirmRequest) => void

const listeners = new Set<ConfirmListener>()
const queue: PendingConfirmRequest[] = []

function normalizeOptions(input: string | ConfirmActionOptions): Required<ConfirmActionOptions> {
  if (typeof input === "string") {
    const looksDestructive = /obris|uklon|izbris|poništ|odustan|trajno|očisti|isprazni|odjavi|zaustav/i.test(
      input
    )
    return {
      title: "Potvrda radnje",
      description: input,
      confirmLabel: looksDestructive ? "Potvrdi i nastavi" : "Potvrdi",
      cancelLabel: "Odustani",
      variant: looksDestructive ? "danger" : "default",
    }
  }
  return {
    title: input.title || "Potvrda radnje",
    description: input.description,
    confirmLabel: input.confirmLabel || "Potvrdi",
    cancelLabel: input.cancelLabel || "Odustani",
    variant: input.variant || "default",
  }
}

export function confirmAction(input: string | ConfirmActionOptions): Promise<boolean> {
  const options = normalizeOptions(input)
  return new Promise<boolean>((resolve) => {
    const req: PendingConfirmRequest = { options, resolve }
    if (listeners.size > 0) {
      listeners.forEach((listener) => listener(req))
    } else {
      queue.push(req)
    }
  })
}

export function GlobalConfirmDialog() {
  const [active, setActive] = React.useState<PendingConfirmRequest | null>(null)

  React.useEffect(() => {
    const listener: ConfirmListener = (req) => {
      setActive((prev) => {
        if (prev) {
          queue.push(req)
          return prev
        }
        return req
      })
    }
    listeners.add(listener)
    if (queue.length > 0) {
      const next = queue.shift()!
      setActive(next)
    }
    return () => {
      listeners.delete(listener)
    }
  }, [])

  const closeWith = React.useCallback((result: boolean) => {
    setActive((current) => {
      if (current) {
        current.resolve(result)
      }
      return queue.length > 0 ? queue.shift()! : null
    })
  }, [])

  const isDanger = active?.options.variant === "danger"

  return (
    <Dialog
      open={Boolean(active)}
      onOpenChange={(open) => {
        if (!open) closeWith(false)
      }}
    >
      <DialogContent className="sm:max-w-md p-0 overflow-hidden rounded-2xl border-2 border-[#1E3A5F]/20 shadow-2xl">
        <DialogHeader className="bg-gradient-to-r from-[#1E3A5F] to-[#264E82] border-b-2 border-[#CEA369] px-6 py-4 text-white text-left">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1B2B36] border border-[#CEA369]/70 text-[#CEA369]">
              {isDanger ? <AlertTriangle className="h-5 w-5 text-amber-400" /> : <ShieldCheck className="h-5 w-5" />}
            </div>
            <div>
              <DialogTitle className="font-serif text-base font-bold text-white">
                {active?.options.title || "Potvrda radnje"}
              </DialogTitle>
              <DialogDescription className="text-[11px] text-slate-200">
                Sustav „Rodoslovac” — provjera prije izvršenja
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 text-sm text-[#1B2B36] leading-relaxed whitespace-pre-line">
          {active?.options.description}
        </div>

        <ModalActionFooter
          right={
            <>
              <CloseActionButton
                label={active?.options.cancelLabel || "Odustani"}
                onClick={() => closeWith(false)}
              />
              {isDanger ? (
                <DeleteActionButton
                  label={active?.options.confirmLabel || "Potvrdi"}
                  onClick={() => closeWith(true)}
                />
              ) : (
                <SaveActionButton
                  label={active?.options.confirmLabel || "Potvrdi"}
                  onClick={() => closeWith(true)}
                />
              )}
            </>
          }
        />
      </DialogContent>
    </Dialog>
  )
}
