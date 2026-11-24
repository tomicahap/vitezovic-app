"use client"

import * as React from "react"
import { CheckCircle2, Loader2, RotateCcw, Save, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Središnji vizualni standard za sve akcijske gumbe u aplikaciji HRD-CMS (AGENTS.md, Sekcija 9):
 * - Redoslijed u podnožju: [lijevo: Obriši/Test] ... [desno: pomoćni -> Odustani/Zatvori -> Spremi -> Zatvori predmet/Završi]
 * - Visoki kontrast, jasni obrubi i zaobljeni oblik (rounded-full) na svim modulima.
 */
export const ACTION_BUTTON_STYLES = {
  save:
    "rounded-full h-10 px-6 font-bold bg-[#1B2B36] hover:bg-[#1B2B36]/90 text-[#F2EFE9] border-2 border-[#CEA369] shadow-md transition-all gap-2 disabled:opacity-55 disabled:cursor-not-allowed",
  saveIdle:
    "rounded-full h-10 px-5 font-semibold bg-[#1B2B36]/10 text-[#1B2B36] border-2 border-[#CEA369]/60 shadow-2xs gap-2 opacity-75 cursor-not-allowed",
  saveSm:
    "rounded-full h-8 px-4 text-xs font-bold bg-[#1B2B36] hover:bg-[#1B2B36]/90 text-[#F2EFE9] border border-[#CEA369] shadow-xs transition-all gap-1.5 disabled:opacity-55 disabled:cursor-not-allowed",
  finish:
    "rounded-full h-10 px-6 font-bold bg-emerald-700 hover:bg-emerald-800 text-white border-2 border-emerald-500/70 ring-2 ring-emerald-500/20 shadow-md transition-all gap-2 disabled:opacity-55 disabled:cursor-not-allowed",
  finishSm:
    "rounded-full h-8 px-4 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white border border-emerald-500/70 shadow-xs transition-all gap-1.5 disabled:opacity-55 disabled:cursor-not-allowed",
  cancel:
    "rounded-full h-10 px-5 font-semibold border-2 border-slate-300 bg-white text-slate-800 hover:bg-slate-100 hover:border-slate-400 hover:text-slate-950 shadow-xs transition-all gap-2",
  cancelSm:
    "rounded-full h-8 px-3.5 text-xs font-semibold border border-slate-300 bg-white text-slate-800 hover:bg-slate-100 hover:border-slate-400 hover:text-slate-950 shadow-2xs transition-all gap-1.5",
  danger:
    "rounded-full h-10 px-4 font-semibold border-2 border-red-300 bg-red-50/75 text-red-700 hover:bg-red-600 hover:text-white hover:border-red-600 shadow-2xs transition-all gap-2",
  dangerSm:
    "rounded-full h-8 px-3 text-xs font-semibold border border-red-300 bg-red-50/75 text-red-700 hover:bg-red-600 hover:text-white hover:border-red-600 shadow-2xs transition-all gap-1.5",
  reopen:
    "rounded-full h-10 px-5 font-semibold border-2 border-amber-400 bg-amber-50 text-amber-950 hover:bg-amber-100 hover:border-amber-500 shadow-xs transition-all gap-2",
  reopenSm:
    "rounded-full h-8 px-3.5 text-xs font-semibold border border-amber-400 bg-amber-50 text-amber-950 hover:bg-amber-100 hover:border-amber-500 shadow-2xs transition-all gap-1.5",
  footerBar:
    "shrink-0 border-t-2 border-border bg-[#FBF9F6] px-5 py-3.5 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5 shadow-[0_-4px_12px_rgba(27,43,54,0.06)]",
  inlineActionBar:
    "flex flex-wrap items-center justify-end gap-2.5 pt-4 mt-4 border-t border-border",
} as const

interface ModalActionFooterProps {
  left?: React.ReactNode
  right?: React.ReactNode
  className?: string
  children?: React.ReactNode
}

/**
 * Standardizirano fiksno podnožje za sve modale i dijaloge.
 */
export function ModalActionFooter({
  left,
  right,
  className,
  children,
}: ModalActionFooterProps) {
  if (children) {
    return <div className={cn(ACTION_BUTTON_STYLES.footerBar, className)}>{children}</div>
  }

  return (
    <div className={cn(ACTION_BUTTON_STYLES.footerBar, className)}>
      <div className="flex flex-wrap items-center gap-2">
        {left ?? <div className="hidden sm:block" />}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2.5">
        {right}
      </div>
    </div>
  )
}

interface ActionButtonProps extends Omit<React.ComponentProps<typeof Button>, "size" | "variant"> {
  label?: string
  loading?: boolean
  loadingLabel?: string
  size?: "default" | "sm"
  isDirty?: boolean
  showIcon?: boolean
}

export function SaveActionButton({
  label = "Spremi promjene",
  loading = false,
  loadingLabel = "Spremanje…",
  size = "default",
  isDirty,
  disabled,
  className,
  children,
  ...props
}: ActionButtonProps) {
  const isIdleDisabled = isDirty === false && Boolean(disabled) && !loading
  const baseCls =
    size === "sm"
      ? ACTION_BUTTON_STYLES.saveSm
      : isIdleDisabled
      ? ACTION_BUTTON_STYLES.saveIdle
      : ACTION_BUTTON_STYLES.save

  return (
    <Button
      type="button"
      disabled={disabled || loading}
      className={cn(baseCls, className)}
      {...props}
    >
      {loading ? (
        <Loader2 className={cn("animate-spin", size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4")} />
      ) : (
        <Save className={cn("text-[#CEA369]", size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4")} />
      )}
      {children ?? (loading ? loadingLabel : label)}
    </Button>
  )
}

export function FinishActionButton({
  label = "Zatvori predmet",
  loading = false,
  loadingLabel = "Zatvaranje…",
  size = "default",
  disabled,
  className,
  children,
  ...props
}: ActionButtonProps) {
  const baseCls = size === "sm" ? ACTION_BUTTON_STYLES.finishSm : ACTION_BUTTON_STYLES.finish
  return (
    <Button
      type="button"
      disabled={disabled || loading}
      className={cn(baseCls, className)}
      {...props}
    >
      {loading ? (
        <Loader2 className={cn("animate-spin", size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4")} />
      ) : (
        <CheckCircle2 className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
      )}
      {children ?? (loading ? loadingLabel : label)}
    </Button>
  )
}

export function CloseActionButton({
  label = "Zatvori",
  size = "default",
  showIcon = true,
  className,
  children,
  ...props
}: ActionButtonProps) {
  const baseCls = size === "sm" ? ACTION_BUTTON_STYLES.cancelSm : ACTION_BUTTON_STYLES.cancel
  return (
    <Button
      type="button"
      variant="outline"
      className={cn(baseCls, className)}
      {...props}
    >
      {showIcon && <X className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />}
      {children ?? label}
    </Button>
  )
}

export function DeleteActionButton({
  label = "Obriši",
  loading = false,
  loadingLabel = "Brisanje…",
  size = "default",
  disabled,
  className,
  children,
  ...props
}: ActionButtonProps) {
  const baseCls = size === "sm" ? ACTION_BUTTON_STYLES.dangerSm : ACTION_BUTTON_STYLES.danger
  return (
    <Button
      type="button"
      variant="outline"
      disabled={disabled || loading}
      className={cn(baseCls, className)}
      {...props}
    >
      {loading ? (
        <Loader2 className={cn("animate-spin", size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4")} />
      ) : (
        <Trash2 className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
      )}
      {children ?? (loading ? loadingLabel : label)}
    </Button>
  )
}

export function ReopenActionButton({
  label = "Ponovno otvori predmet",
  loading = false,
  loadingLabel = "Otvaranje…",
  size = "default",
  disabled,
  className,
  children,
  ...props
}: ActionButtonProps) {
  const baseCls = size === "sm" ? ACTION_BUTTON_STYLES.reopenSm : ACTION_BUTTON_STYLES.reopen
  return (
    <Button
      type="button"
      variant="outline"
      disabled={disabled || loading}
      className={cn(baseCls, className)}
      {...props}
    >
      {loading ? (
        <Loader2 className={cn("animate-spin", size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4")} />
      ) : (
        <RotateCcw className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
      )}
      {children ?? (loading ? loadingLabel : label)}
    </Button>
  )
}
