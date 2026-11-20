"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ShieldCheck, Wrench } from "lucide-react"
import {
  APP_MODULE_GROUPS,
  APP_MODULE_PERMISSIONS_LIST,
  MEMBER_ACTION_PERMISSIONS_LIST,
  getEffectiveModuleRight,
  type AppModulePermissionKey,
  type MemberActionPermissionKey,
} from "@/lib/inquiry-permissions"

interface ModuleAccessCardsSectionProps {
  rights: Record<string, any> | undefined
  onChangeModuleRight: (key: AppModulePermissionKey, field: "view" | "edit", value: boolean) => void
  onSetAllModules: (mode: "none" | "view" | "edit") => void
  disabled?: boolean
  title?: string
  subtitle?: string
}

export function ModuleAccessCardsSection({
  rights,
  onChangeModuleRight,
  onSetAllModules,
  disabled = false,
  title = "Pristup modulima sustava",
  subtitle = "Pojedinačno odredite kojim dijelovima aplikacije ovaj korisnik smije pristupiti (Pogled i/ili Uređivanje). Administrator uvijek ima puna prava na sve.",
}: ModuleAccessCardsSectionProps) {
  const activeCount = React.useMemo(
    () =>
      APP_MODULE_PERMISSIONS_LIST.filter((item) => {
        const eff = getEffectiveModuleRight(rights, item.key)
        return eff.view || eff.edit
      }).length,
    [rights]
  )

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-[#FBF9F6] p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#1B2B36] flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-[#1B2B36]" />
              {title}
            </h4>
            <Badge variant="outline" className="text-[10px] font-mono bg-white border-slate-300 text-[#1B2B36]">
              {activeCount} / {APP_MODULE_PERMISSIONS_LIST.length} aktivno
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-[11px] bg-white text-indigo-700 hover:text-indigo-800"
            disabled={disabled}
            onClick={() => onSetAllModules("view")}
          >
            Samo pogled
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-[11px] bg-white text-emerald-700 hover:text-emerald-800"
            disabled={disabled}
            onClick={() => onSetAllModules("edit")}
          >
            Odobri sve
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-[11px] bg-white text-red-700 hover:text-red-800"
            disabled={disabled}
            onClick={() => onSetAllModules("none")}
          >
            Zabrani sve
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {APP_MODULE_GROUPS.map((group) => {
          const items = APP_MODULE_PERMISSIONS_LIST.filter((m) => m.group === group.id)
          if (items.length === 0) return null
          const groupActive = items.filter((m) => {
            const eff = getEffectiveModuleRight(rights, m.key)
            return eff.view || eff.edit
          }).length

          return (
            <div key={group.id} className="space-y-2">
              <div className="flex items-center justify-between border-b border-border/70 pb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  {group.title}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {groupActive} / {items.length}
                </span>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {items.map((item) => {
                  const eff = getEffectiveModuleRight(rights, item.key)
                  const cardTone = eff.edit
                    ? "border-emerald-300 bg-emerald-50/75"
                    : eff.view
                    ? "border-indigo-200 bg-indigo-50/60"
                    : "border-border bg-background hover:bg-muted/30"

                  return (
                    <div
                      key={item.key}
                      className={`flex flex-col justify-between gap-2 rounded-lg border p-2.5 transition-colors ${cardTone}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-foreground block leading-snug">
                            {item.label}
                          </span>
                          <span className="text-[11px] text-muted-foreground leading-tight block mt-0.5">
                            {item.description}
                          </span>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                            eff.edit
                              ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                              : eff.view
                              ? "bg-indigo-100 text-indigo-800 border-indigo-200"
                              : "bg-muted text-muted-foreground border-border"
                          }`}
                        >
                          {eff.edit ? "Uređivanje" : eff.view ? "Pogled" : "Isključeno"}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 pt-1.5 border-t border-border/50">
                        <label
                          className={`inline-flex items-center gap-1.5 text-[11px] font-semibold select-none ${
                            disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={eff.view}
                            onChange={(e) => onChangeModuleRight(item.key, "view", e.target.checked)}
                            disabled={disabled}
                            className="h-4 w-4 accent-indigo-600 shrink-0"
                          />
                          <span>Pogled</span>
                        </label>

                        <label
                          className={`inline-flex items-center gap-1.5 text-[11px] font-semibold select-none ${
                            disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={eff.edit}
                            onChange={(e) => onChangeModuleRight(item.key, "edit", e.target.checked)}
                            disabled={disabled}
                            className="h-4 w-4 accent-emerald-600 shrink-0"
                          />
                          <span>Uređivanje</span>
                        </label>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface MemberActionsCardsSectionProps {
  rights: Record<string, any> | undefined
  onToggleAction: (key: MemberActionPermissionKey, enabled: boolean) => void
  onSetAllActions: (enabled: boolean) => void
  disabled?: boolean
  title?: string
  subtitle?: string
}

export function MemberActionsCardsSection({
  rights,
  onToggleAction,
  onSetAllActions,
  disabled = false,
  title = "Ovlasti za alate i akcije (Članovi i tijela)",
  subtitle = "Pojedinačno odobrite svaku posebnu funkciju ili slanje obavijesti koje ovaj korisnik smije izvršavati (Administrator uvijek ima potpuna prava na sve).",
}: MemberActionsCardsSectionProps) {
  const safeRights = rights || {}
  const activeCount = React.useMemo(
    () =>
      MEMBER_ACTION_PERMISSIONS_LIST.filter((item) => {
        const entry = safeRights[item.key]
        return entry === true || Boolean(entry?.edit === true || entry?.view === true)
      }).length,
    [safeRights]
  )

  return (
    <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/40 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
              <Wrench className="h-3.5 w-3.5 text-amber-800" />
              {title}
            </h4>
            <Badge variant="outline" className="text-[10px] font-mono bg-white border-amber-300 text-amber-950">
              {activeCount} / {MEMBER_ACTION_PERMISSIONS_LIST.length} aktivno
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-[11px] bg-white"
            disabled={disabled}
            onClick={() => onSetAllActions(true)}
          >
            Odobri sve
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-[11px] bg-white text-red-700 hover:text-red-800"
            disabled={disabled}
            onClick={() => onSetAllActions(false)}
          >
            Zabrani sve
          </Button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {MEMBER_ACTION_PERMISSIONS_LIST.map((item) => {
          const entry = safeRights[item.key]
          const enabled = entry === true || Boolean(entry?.edit === true || entry?.view === true)
          return (
            <label
              key={item.key}
              className={`flex items-start gap-2.5 rounded-lg border p-2.5 transition-colors ${
                disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
              } ${
                enabled
                  ? "border-emerald-300 bg-emerald-50/75"
                  : "border-border bg-background hover:bg-muted/40"
              }`}
            >
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => onToggleAction(item.key, e.target.checked)}
                disabled={disabled}
                className="mt-0.5 h-4 w-4 accent-emerald-600 shrink-0"
              />
              <div className="min-w-0">
                <span className="text-xs font-semibold text-foreground block leading-snug">
                  {item.label}
                </span>
                <span className="text-[11px] text-muted-foreground leading-tight block mt-0.5">
                  {item.description}
                </span>
              </div>
            </label>
          )
        })}
      </div>
    </div>
  )
}
