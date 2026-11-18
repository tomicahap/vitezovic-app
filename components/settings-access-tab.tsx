"use client"

import * as React from "react"
import Link from "next/link"
import { Search, ShieldCheck, KeyRound, Save, CheckCircle2, UserCog } from "lucide-react"
import { useMembers, type Member, type AccessCategory, type MemberAccessRight } from "@/contexts/members-context"
import { getUserAccessRights, MEMBER_ACTION_PERMISSIONS_LIST, type MemberActionPermissionKey } from "@/lib/inquiry-permissions"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"

const MODULE_ACCESS_CATEGORIES: Array<{ key: AccessCategory; label: string }> = [
  { key: "members", label: "Članovi" },
  { key: "functions", label: "Funkcije u društvu" },
  { key: "meetings", label: "Sjednice" },
  { key: "projects", label: "Projekti" },
  { key: "finances", label: "Financije" },
  { key: "archive", label: "Arhiv" },
  { key: "drive", label: "Google Drive" },
  { key: "logs", label: "Logovi" },
  { key: "reports", label: "Izvješća" },
  { key: "contacts", label: "Adresar" },
  { key: "library", label: "Knjižnica" },
  { key: "lectures", label: "Predavanja / druženja" },
  { key: "links", label: "Linkovi" },
  { key: "gmail", label: "Inbox (Gmail)" },
  { key: "chronicle", label: "Ljetopis" },
  { key: "polls", label: "Glasovanja" },
  { key: "notifications", label: "Obavijesti (Email)" },
  { key: "research_inquiries_zaprimljeno", label: "Upiti: Zaprimljeno" },
  { key: "research_inquiries_uradu", label: "Upiti: U radu" },
  { key: "research_inquiries_zavrseno", label: "Upiti: Završeno" },
]

interface SettingsAccessTabProps {
  onNotify: (msg: string) => void
}

export function SettingsAccessTab({ onNotify }: SettingsAccessTabProps) {
  const { members, updateMember } = useMembers()
  const [search, setSearch] = React.useState("")
  const [showAllMembers, setShowAllMembers] = React.useState(false)
  const [editingMember, setEditingMember] = React.useState<Member | null>(null)
  const [draftRole, setDraftRole] = React.useState<"member" | "moderator">("member")
  const [draftRights, setDraftRights] = React.useState<Record<string, MemberAccessRight>>({})
  const [saving, setSaving] = React.useState(false)

  const filteredMembers = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    return members.filter((m) => {
      if (!showAllMembers && !q) {
        const hasAccess = Boolean(m.password || m.role === "admin" || m.role === "moderator" || m.invitationSent)
        if (!hasAccess) return false
      }
      if (!q) return true
      return (
        (m.name || "").toLowerCase().includes(q) ||
        (m.email || "").toLowerCase().includes(q) ||
        (m.registryNumber || "").toLowerCase().includes(q)
      )
    })
  }, [members, search, showAllMembers])

  const openEditPermissions = (m: Member) => {
    setEditingMember(m)
    setDraftRole(m.role === "moderator" ? "moderator" : "member")
    setDraftRights({ ...getUserAccessRights(m) })
  }

  const toggleModuleRight = (category: AccessCategory, field: keyof MemberAccessRight, value: boolean) => {
    setDraftRights((prev) => {
      const def = category === "functions" ? { view: true, edit: false } : { view: false, edit: false }
      const existing = prev[category] ?? def
      return {
        ...prev,
        [category]: {
          ...existing,
          [field]: value,
          ...(field === "edit" && value ? { view: true } : {}),
          ...(field === "view" && !value ? { edit: false } : {}),
        },
      }
    })
  }

  const toggleMemberActionRight = (key: MemberActionPermissionKey, enabled: boolean) => {
    setDraftRights((prev) => ({
      ...prev,
      [key]: { view: enabled, edit: enabled },
    }))
  }

  const setAllMemberActionRights = (enabled: boolean) => {
    setDraftRights((prev) => {
      const next = { ...prev }
      for (const item of MEMBER_ACTION_PERMISSIONS_LIST) {
        next[item.key] = { view: enabled, edit: enabled }
      }
      return next
    })
  }

  const savePermissionsModal = async () => {
    if (!editingMember) return
    setSaving(true)
    try {
      await updateMember(editingMember.id, {
        role: editingMember.role === "admin" ? "admin" : draftRole,
        accessRights: draftRights as any,
        access_rights: draftRights as any,
      } as any)
      onNotify(`✓ Prava pristupa i ovlasti za člana ${editingMember.name} su spremljene.`)
      setEditingMember(null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" /> Prava pristupa aplikaciji i ovlasti nad članovima
              </CardTitle>
              <CardDescription className="mt-1">
                Centralno upravljajte pristupom modulima, Gmail INBOX ulogama te pojedinačnim ovlastima nad alatima za članove. Administrator uvijek ima potpuna prava na sve.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Pretraži člana..."
                  className="pl-8 h-8 text-xs"
                />
              </div>
              <Button
                type="button"
                variant={showAllMembers ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs"
                onClick={() => setShowAllMembers((v) => !v)}
              >
                {showAllMembers ? "Prikazani svi članovi" : "Prikaži i članove bez lozinke"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-border overflow-hidden bg-background shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="p-4 text-left font-bold uppercase text-[10px] tracking-wider">Korisnik</th>
                    <th className="p-4 text-left font-bold uppercase text-[10px] tracking-wider">Uloga</th>
                    <th className="p-4 text-left font-bold uppercase text-[10px] tracking-wider">INBOX (Gmail)</th>
                    <th className="p-4 text-left font-bold uppercase text-[10px] tracking-wider">Moduli i ovlasti nad članovima</th>
                    <th className="p-4 text-center font-bold uppercase text-[10px] tracking-wider">Akcije</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredMembers.map((member) => {
                    const memberAr = getUserAccessRights(member)
                    const grantedActions = MEMBER_ACTION_PERMISSIONS_LIST.filter((a) => {
                      const entry = memberAr[a.key]
                      return entry === true || entry?.view === true || entry?.edit === true
                    })

                    return (
                      <tr key={member.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={member.avatar} alt={member.name} />
                              <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                                {member.initials || member.name.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <Link
                                href={`/members/${member.id}`}
                                className="font-bold text-slate-800 hover:text-accent transition-colors block text-sm"
                              >
                                {member.name}
                              </Link>
                              <span className="text-xs text-muted-foreground block">{member.email || "—"}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 font-medium">
                          {member.role === "admin" ? (
                            <Badge className="bg-red-50 text-red-700 border-red-200">Administrator</Badge>
                          ) : member.role === "moderator" ? (
                            <Badge className="bg-blue-50 text-blue-700 border-blue-200">Moderator</Badge>
                          ) : (
                            <Badge variant="outline">Član</Badge>
                          )}
                        </td>
                        <td className="p-4">
                          {member.role === "admin" ? (
                            <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                              Čitanje i slanje (Admin)
                            </span>
                          ) : (
                            <select
                              value={
                                member.accessRights?.gmail?.edit
                                  ? "send"
                                  : member.accessRights?.gmail?.view
                                  ? "read"
                                  : "none"
                              }
                              onChange={async (e) => {
                                const val = e.target.value
                                const nextGmailRight =
                                  val === "send"
                                    ? { view: true, edit: true }
                                    : val === "read"
                                    ? { view: true, edit: false }
                                    : { view: false, edit: false }
                                const updatedRights = {
                                  ...(member.accessRights || {}),
                                  gmail: nextGmailRight,
                                } as any
                                await updateMember(member.id, { accessRights: updatedRights })
                                onNotify(
                                  `✓ Ažurirana Gmail INBOX ovlast za člana ${member.name}: ${
                                    val === "send"
                                      ? "Čitanje i slanje"
                                      : val === "read"
                                      ? "Samo čitanje"
                                      : "Bez pristupa"
                                  }`
                                )
                              }}
                              className="rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
                            >
                              <option value="none">Bez pristupa</option>
                              <option value="read">Samo čitanje</option>
                              <option value="send">Čitanje i slanje</option>
                            </select>
                          )}
                        </td>
                        <td className="p-4">
                          {member.role === "admin" ? (
                            <span className="text-xs text-muted-foreground font-medium">
                              Puni pristup svim modulima i svim alatima nad članovima
                            </span>
                          ) : (
                            <div className="space-y-1.5 max-w-lg">
                              <div className="flex flex-wrap gap-1">
                                {MODULE_ACCESS_CATEGORIES.map(({ key, label }) => {
                                  const rights = memberAr[key] ?? { view: false, edit: false }
                                  if (!rights.view && !rights.edit) return null
                                  return (
                                    <span
                                      key={key}
                                      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold ring-1 ring-inset ${
                                        rights.edit
                                          ? "bg-emerald-50 text-emerald-700 ring-emerald-600/15"
                                          : "bg-indigo-50 text-indigo-700 ring-indigo-600/15"
                                      }`}
                                    >
                                      {label}
                                      {rights.edit ? " (P/U)" : " (P)"}
                                    </span>
                                  )
                                })}
                              </div>
                              {grantedActions.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {grantedActions.map((act) => (
                                    <span
                                      key={act.key}
                                      className="inline-flex items-center rounded-md bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-500/30 px-1.5 py-0.5 text-[10px] font-semibold"
                                    >
                                      Alat: {act.label}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {grantedActions.length === 0 &&
                                !MODULE_ACCESS_CATEGORIES.some(({ key }) => memberAr[key]?.view || memberAr[key]?.edit) && (
                                  <span className="text-xs text-muted-foreground/60 italic">Nema dodijeljenih dozvola</span>
                                )}
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {member.role !== "admin" && (
                              <Button
                                type="button"
                                size="sm"
                                className="rounded-full px-3 text-xs font-semibold gap-1"
                                onClick={() => openEditPermissions(member)}
                              >
                                <UserCog className="h-3.5 w-3.5" /> Ovlasti
                              </Button>
                            )}
                            <Link href={`/members/${member.id}`}>
                              <Button
                                variant="outline"
                                size="sm"
                                className="rounded-full px-3 text-xs font-semibold"
                              >
                                Karton
                              </Button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {filteredMembers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground italic">
                        Nema pronađenih članova za zadani filtar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal za izravno uređivanje svih modula i 9 ovlasti nad članovima */}
      <Dialog open={!!editingMember} onOpenChange={(open) => !open && setEditingMember(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              Upravljanje pravima i ovlastima — {editingMember?.name}
            </DialogTitle>
            <DialogDescription>
              Pojedinačno odredite pristup modulima sustava te posebne alate i akcije nad članovima.
            </DialogDescription>
          </DialogHeader>

          {editingMember && (
            <div className="space-y-5 py-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 p-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Uloga u sustavu</p>
                  <p className="text-xs text-muted-foreground">Moderator automatski ima šire ovlasti nad sadržajem, dok običan Član koristi isključivo dolje odobrena prava.</p>
                </div>
                <select
                  value={draftRole}
                  onChange={(e) => setDraftRole(e.target.value as "member" | "moderator")}
                  className="h-9 rounded-lg border border-border bg-background px-3 text-xs font-semibold shrink-0"
                >
                  <option value="member">Član</option>
                  <option value="moderator">Moderator</option>
                </select>
              </div>

              {/* 9 pojedinačnih alata kod Članova */}
              <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/40 p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-950">
                      Ovlasti za alate i akcije u modulu Članovi
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Pojedinačno odobrite svaku funkciju koju ovaj član smije koristiti (Administrator uvijek ima puna prava na sve).
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button type="button" size="sm" variant="outline" className="h-7 text-[11px] bg-white" onClick={() => setAllMemberActionRights(true)}>
                      Odobri sve
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] bg-white text-red-700 hover:text-red-800"
                      onClick={() => setAllMemberActionRights(false)}
                    >
                      Zabrani sve
                    </Button>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {MEMBER_ACTION_PERMISSIONS_LIST.map((item) => {
                    const entry = draftRights[item.key] as any
                    const enabled = entry === true || Boolean(entry?.view || entry?.edit)
                    return (
                      <label
                        key={item.key}
                        className={`flex items-start gap-2.5 rounded-lg border p-2.5 cursor-pointer transition-colors ${
                          enabled ? "border-emerald-300 bg-emerald-50/80" : "border-border bg-background hover:bg-muted/40"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={(e) => toggleMemberActionRight(item.key, e.target.checked)}
                          className="mt-0.5 h-4 w-4 accent-emerald-600 shrink-0"
                        />
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-foreground block">{item.label}</span>
                          <span className="text-[11px] text-muted-foreground leading-tight block">{item.description}</span>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>

              <Separator />

              {/* Prava pristupa po modulima */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Pristup modulima sustava
                </h4>
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="grid grid-cols-[1.8fr_1fr_1fr] bg-muted px-4 py-2 text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                    <span>Modul</span>
                    <span className="text-center">Pogled</span>
                    <span className="text-center">Uređivanje</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {MODULE_ACCESS_CATEGORIES.map(({ key, label }) => {
                      const def = key === "functions" ? { view: true, edit: false } : { view: false, edit: false }
                      const rights = draftRights[key] ?? def
                      return (
                        <div key={key} className="grid grid-cols-[1.8fr_1fr_1fr] border-t border-border px-4 py-2 text-xs bg-background">
                          <span className="flex items-center font-medium">{label}</span>
                          <label className="flex items-center justify-center">
                            <input
                              type="checkbox"
                              checked={Boolean(rights.view)}
                              onChange={(e) => toggleModuleRight(key, "view", e.target.checked)}
                              className="h-4 w-4 accent-primary"
                            />
                          </label>
                          <label className="flex items-center justify-center">
                            <input
                              type="checkbox"
                              checked={Boolean(rights.edit)}
                              onChange={(e) => toggleModuleRight(key, "edit", e.target.checked)}
                              className="h-4 w-4 accent-primary"
                            />
                          </label>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setEditingMember(null)}>
              Odustani
            </Button>
            <Button type="button" onClick={savePermissionsModal} disabled={saving} className="gap-1.5">
              {saving ? <CheckCircle2 className="h-4 w-4 animate-pulse" /> : <Save className="h-4 w-4" />}
              {saving ? "Spremanje..." : "Spremi sve ovlasti"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
