"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  FlaskConical,
  KeyRound,
  Loader2,
  Mail,
  Phone,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserPlus,
  UserX,
  X,
} from "lucide-react"
import { confirmAction } from "@/components/ui/confirm-dialog"
import { useAuth } from "@/contexts/auth-context"
import { useSettings } from "@/contexts/settings-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
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
import { formatDateTimeDMY } from "@/lib/utils"
import { buildHrdMasterEmail, DEFAULT_HRD_EMAIL_PALETTE, escapeHtml } from "@/lib/hrd-email-system"

export interface ExternalResearchUser {
  id: number
  name: string
  email: string
  phone?: string
  organization?: string
  notes?: string
  isExternal: true
  isActive: boolean
  isTempPassword?: boolean
  invitationSent?: boolean
  invitationSentAt?: string | null
  lastLoginAt?: string | null
  hasPassword?: boolean
  assignedInquiriesCount?: number
  assignedActiveInquiriesCount?: number
  accessRights?: Record<string, { view: boolean; edit: boolean }>
}

const INQUIRY_STAGE_ITEMS = [
  {
    key: "research_inquiries_zaprimljeno",
    title: "1. Zaprimljeno (Nedodijeljeno)",
    desc: "Novi pristigli upiti koji još čekaju dodjelu istraživaču.",
  },
  {
    key: "research_inquiries_uradu",
    title: "2. U radu (Dodijeljeno)",
    desc: "Aktivna istraživanja u tijeku (uključujući tuđe dodijeljene predmete ako je uključeno).",
  },
  {
    key: "research_inquiries_zavrseno",
    title: "3. Završeno / Zaključeno",
    desc: "Pregled arhive završenih predmeta i njihovih rezultata.",
  },
] as const

export function ExternalUsersManager({
  onNotify,
  onCountChange,
}: {
  onNotify?: (msg: string) => void
  onCountChange?: (activeCount: number) => void
}) {
  const { user } = useAuth()
  const { settings } = useSettings()

  const [users, setUsers] = React.useState<ExternalResearchUser[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState("")

  // Add / Edit modal state
  const [editorOpen, setEditorOpen] = React.useState(false)
  const [editingUser, setEditingUser] = React.useState<ExternalResearchUser | null>(null)
  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [organization, setOrganization] = React.useState("")
  const [notes, setNotes] = React.useState("")
  const [isActive, setIsActive] = React.useState(true)
  const [accessMode, setAccessMode] = React.useState<"assigned_only" | "custom">("assigned_only")
  const [draftRights, setDraftRights] = React.useState<Record<string, { view: boolean; edit: boolean }>>({})
  const [sendInviteNow, setSendInviteNow] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [formError, setFormError] = React.useState("")

  // Invitation modal state
  const [inviteUser, setInviteUser] = React.useState<ExternalResearchUser | null>(null)
  const [inviteSubject, setInviteSubject] = React.useState(
    "Pozivnica za suradnju u modulu Istraživanja — Rodoslovac (HRD)"
  )
  const [inviteBody, setInviteBody] = React.useState(
    "Pozivamo Vas da aktivirate svoj pristup modulu „Istraživanja” u informacijskom sustavu Hrvatskog rodoslovnog društva „Pavao Ritter Vitezović” (Rodoslovac) kao vanjski suradnik (bez učlanjenja u Društvo).\n\nKlikom na poveznicu ispod automatski ćete biti prijavljeni u sustav i odmah ćete postaviti svoju osobnu lozinku. Nakon postavljanja lozinke imat ćete izravan pristup dodijeljenim i odobrenim istraživačkim predmetima."
  )
  const [testEmail, setTestEmail] = React.useState("")
  const [sendingInvite, setSendingInvite] = React.useState(false)
  const [sendingTest, setSendingTest] = React.useState(false)
  const [inviteStatus, setInviteStatus] = React.useState<{ type: "idle" | "success" | "error"; text?: string }>({
    type: "idle",
  })

  const getAuthHeaders = (): Record<string, string> => {
    if (!user) return {}
    return {
      "x-user-id": String(user.id ?? ""),
      "x-user-role": String(user.role ?? ""),
      "x-user-email": String(user.email ?? ""),
    }
  }

  const fetchExternalUsers = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/external-users", {
        cache: "no-store",
        headers: getAuthHeaders(),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && Array.isArray(data.externalUsers)) {
        setUsers(data.externalUsers)
        onCountChange?.(data.externalUsers.filter((u: ExternalResearchUser) => u.isActive).length)
      }
    } catch (e) {
      console.error("Failed to fetch external users:", e)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  React.useEffect(() => {
    if (user?.role === "admin") {
      fetchExternalUsers()
    }
  }, [user?.id, user?.role, fetchExternalUsers])

  const filteredUsers = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return users
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.organization || "").toLowerCase().includes(q) ||
        (u.phone || "").toLowerCase().includes(q)
    )
  }, [users, search])

  const openCreateModal = () => {
    setEditingUser(null)
    setName("")
    setEmail("")
    setPhone("")
    setOrganization("")
    setNotes("")
    setIsActive(true)
    setAccessMode("assigned_only")
    setDraftRights({})
    setSendInviteNow(true)
    setFormError("")
    setEditorOpen(true)
  }

  const openEditModal = (u: ExternalResearchUser) => {
    const rights = u.accessRights || {}
    const hasStageRights = INQUIRY_STAGE_ITEMS.some(
      (st) => rights[st.key]?.view || rights[st.key]?.edit
    )
    setEditingUser(u)
    setName(u.name)
    setEmail(u.email)
    setPhone(u.phone || "")
    setOrganization(u.organization || "")
    setNotes(u.notes || "")
    setIsActive(Boolean(u.isActive))
    setAccessMode(hasStageRights ? "custom" : "assigned_only")
    setDraftRights({ ...rights })
    setSendInviteNow(false)
    setFormError("")
    setEditorOpen(true)
  }

  const openInviteModal = (u: ExternalResearchUser) => {
    setInviteUser(u)
    setTestEmail(user?.email || settings?.smtpFrom || "")
    setInviteStatus({ type: "idle" })
  }

  const toggleStageRight = (key: string, field: "view" | "edit", val: boolean) => {
    setDraftRights((prev) => {
      const cur = prev[key] || { view: false, edit: false }
      return {
        ...prev,
        [key]: {
          ...cur,
          [field]: val,
          ...(field === "edit" && val ? { view: true } : {}),
          ...(field === "view" && !val ? { edit: false } : {}),
        },
      }
    })
  }

  const handleSaveUser = async () => {
    if (!name.trim() || !email.trim() || !email.includes("@")) {
      setFormError("Unesite ime i prezime te valjanu e-mail adresu.")
      return
    }
    setSaving(true)
    setFormError("")

    const payloadRights = accessMode === "assigned_only" ? {} : draftRights

    try {
      if (editingUser) {
        const res = await fetch("/api/admin/external-users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({
            id: editingUser.id,
            name: name.trim(),
            email: email.trim(),
            phone: phone.trim(),
            organization: organization.trim(),
            notes: notes.trim(),
            isActive,
            accessRights: payloadRights,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || data.error) {
          throw new Error(data.error || "Spremanje izmjena nije uspjelo.")
        }
        toast.success(`Podaci i ovlasti za vanjskog suradnika ${name.trim()} su spremljeni.`)
        onNotify?.(`✓ Ažuriran vanjski suradnik ${name.trim()}.`)
        setEditorOpen(false)
        await fetchExternalUsers()
      } else {
        const res = await fetch("/api/admin/external-users", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim(),
            phone: phone.trim(),
            organization: organization.trim(),
            notes: notes.trim(),
            isActive,
            accessRights: payloadRights,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || data.error) {
          throw new Error(data.error || "Dodavanje vanjskog suradnika nije uspjelo.")
        }

        const created: ExternalResearchUser = data.externalUser
        if (sendInviteNow && created?.id && isActive) {
          const invRes = await fetch("/api/admin/external-users/invite", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
            body: JSON.stringify({
              externalUserId: created.id,
              subject: inviteSubject,
              customBody: inviteBody,
              testOnly: false,
            }),
          })
          const invData = await invRes.json().catch(() => ({}))
          if (invRes.ok && invData.success) {
            toast.success(`Vanjski suradnik ${created.name} je dodan i pozivnica je poslana!`)
          } else {
            toast.warning(
              `Vanjski suradnik ${created.name} je dodan, ali slanje pozivnice nije uspjelo: ${
                invData.error || "provjerite e-mail postavke"
              }`
            )
          }
        } else {
          toast.success(`Vanjski suradnik ${created.name} je uspješno dodan.`)
        }
        onNotify?.(`✓ Dodan vanjski suradnik ${created.name} (nije član Društva).`)
        setEditorOpen(false)
        await fetchExternalUsers()
      }
    } catch (e: any) {
      setFormError(e?.message || "Greška pri spremanju.")
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (u: ExternalResearchUser) => {
    try {
      const res = await fetch("/api/admin/external-users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ id: u.id, isActive: !u.isActive }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) {
        throw new Error(data.error || "Promjena statusa nije uspjela.")
      }
      toast.success(
        u.isActive
          ? `Pristup za ${u.name} je deaktiviran.`
          : `Pristup za ${u.name} je ponovno aktiviran.`
      )
      await fetchExternalUsers()
    } catch (e: any) {
      toast.error(e?.message || "Greška pri promjeni statusa.")
    }
  }

  const handleDeleteUser = async (u: ExternalResearchUser) => {
    const ok = await confirmAction(
      `Želite li ukloniti vanjskog suradnika „${u.name}” (${u.email})? Zapis će biti premješten u Smeće odakle ga po potrebi možete vratiti.`
    )
    if (!ok) return
    try {
      const res = await fetch(`/api/admin/external-users?id=${u.id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) {
        throw new Error(data.error || "Brisanje nije uspjelo.")
      }
      toast.success(`Vanjski suradnik ${u.name} premješten je u Smeće.`)
      onNotify?.(`✓ Vanjski suradnik ${u.name} premješten u Smeće.`)
      await fetchExternalUsers()
    } catch (e: any) {
      toast.error(e?.message || "Greška pri brisanju.")
    }
  }

  const invitePreviewHtml = React.useMemo(() => {
    if (!inviteUser) return ""
    const origin =
      typeof window !== "undefined" ? window.location.origin : "https://rodoslovlje.hr"
    const sampleUrl = `${origin}/pozivnica/test-pregled`
    const infoBoxHtml = `
      <div style="margin-bottom: 8px;"><strong>Vrsta pristupa:</strong> Vanjski suradnik — modul <strong>Istraživanja</strong></div>
      <div style="margin-bottom: 8px;"><strong>Korisničko ime (Username / E-pošta):</strong><br/><code style="background: #FFFFFF; padding: 3px 8px; border: 1px solid #E2E8F0; color: #1E3A5F; font-weight: bold; display: inline-block; margin-top: 2px;">${escapeHtml(inviteUser.email)}</code></div>
      <div style="margin-bottom: 8px;"><strong>Izravna poveznica za aktivaciju i postavljanje lozinke:</strong><br/><a href="${escapeHtml(sampleUrl)}" style="color: #1F77C5; font-weight: bold;">${escapeHtml(sampleUrl)}</a></div>
    `
    return buildHrdMasterEmail({
      templateType: "poslovna_korespondencija",
      title: inviteSubject,
      greeting: `Poštovani/a ${inviteUser.name},`,
      bodyTextOrHtml: inviteBody,
      infoBoxTitle: "Pristupni podaci za vanjskog suradnika",
      infoBoxHtml,
      ctaText: "Aktiviraj pristup i postavi lozinku",
      ctaUrl: sampleUrl,
      closingText: "Zahvaljujemo na suradnji u istraživanjima,",
      settings,
      sender: user
        ? {
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
            userRole: user.role,
            userFunction: "Administrator",
          }
        : undefined,
      forBrowserPreview: true,
    }).html
  }, [inviteUser, inviteSubject, inviteBody, settings, user])

  const handleSendInvite = async (testOnly: boolean) => {
    if (!inviteUser) return
    if (testOnly) setSendingTest(true)
    else setSendingInvite(true)
    setInviteStatus({ type: "idle" })
    try {
      const res = await fetch("/api/admin/external-users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          externalUserId: inviteUser.id,
          subject: inviteSubject,
          customBody: inviteBody,
          testOnly,
          testEmail,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Slanje pozivnice nije uspjelo.")
      }
      if (testOnly) {
        setInviteStatus({ type: "success", text: data.message })
      } else {
        toast.success(data.message || `Pozivnica je poslana na ${inviteUser.email}.`)
        onNotify?.(`✓ Pozivnica za Istraživanja poslana vanjskom suradniku ${inviteUser.name}.`)
        setInviteUser(null)
        await fetchExternalUsers()
      }
    } catch (e: any) {
      setInviteStatus({ type: "error", text: e?.message || "Greška pri slanju pozivnice." })
    } finally {
      setSendingInvite(false)
      setSendingTest(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-purple-700" />
                Vanjski suradnici za Istraživanja (nisu članovi Društva)
              </CardTitle>
              <CardDescription className="mt-1">
                Ovdje možete dodati vanjske istraživače i suradnike koji nisu na popisu članova Društva. Oni dobivaju pristup isključivo modulu{" "}
                <strong>Istraživanja</strong> (svi ostali moduli i popis članova za njih su skriveni i zaključani) te se mogu birati kao odgovorni istraživači na predmetima.
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-60">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Pretraži vanjsku osobu..."
                  className="pl-8 h-9 text-xs"
                />
              </div>
              <Button
                type="button"
                onClick={openCreateModal}
                className="rounded-full h-9 px-4 bg-[#1E3A5F] hover:bg-[#162D4A] text-white border border-[#CEA369] font-bold text-xs gap-1.5 shadow-sm"
              >
                <Plus className="h-3.5 w-3.5 text-[#CEA369]" />
                Dodaj vanjskog suradnika
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
                    <th className="p-4 text-left font-bold uppercase text-[10px] tracking-wider">
                      Osoba (Nije član)
                    </th>
                    <th className="p-4 text-left font-bold uppercase text-[10px] tracking-wider">
                      Status i prijava
                    </th>
                    <th className="p-4 text-left font-bold uppercase text-[10px] tracking-wider">
                      Ovlasti u modulu Istraživanja
                    </th>
                    <th className="p-4 text-center font-bold uppercase text-[10px] tracking-wider">
                      Dodijeljeni predmeti
                    </th>
                    <th className="p-4 text-center font-bold uppercase text-[10px] tracking-wider">
                      Akcije
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground text-xs">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                        Učitavanje vanjskih suradnika…
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground text-xs italic">
                        {search
                          ? "Nema vanjskih suradnika koji odgovaraju pretrazi."
                          : "Još nema dodanih vanjskih suradnika. Kliknite „Dodaj vanjskog suradnika” za kreiranje prvog pristupa."}
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const rights = u.accessRights || {}
                      const stageBadges = INQUIRY_STAGE_ITEMS.filter(
                        (st) => rights[st.key]?.view || rights[st.key]?.edit
                      )

                      return (
                        <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                          <td className="p-4">
                            <div className="flex items-start gap-3">
                              <div className="h-9 w-9 rounded-full bg-purple-100 border border-purple-300 text-purple-900 font-bold text-xs flex items-center justify-center shrink-0">
                                {u.name
                                  .split(/\s+/)
                                  .map((p) => p[0])
                                  .join("")
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </div>
                              <div className="min-w-0 space-y-0.5">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-bold text-slate-900 text-sm">{u.name}</span>
                                  <Badge className="bg-purple-100 text-purple-900 border border-purple-300 text-[10px] font-bold">
                                    Nije član
                                  </Badge>
                                </div>
                                <div className="text-xs text-muted-foreground font-mono">
                                  {u.email}
                                </div>
                                {(u.organization || u.phone) && (
                                  <div className="text-[11px] text-slate-600 flex flex-wrap gap-x-3">
                                    {u.organization && (
                                      <span className="inline-flex items-center gap-1">
                                        <Building2 className="h-3 w-3 text-muted-foreground" />
                                        {u.organization}
                                      </span>
                                    )}
                                    {u.phone && (
                                      <span className="inline-flex items-center gap-1">
                                        <Phone className="h-3 w-3 text-muted-foreground" />
                                        {u.phone}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="p-4 text-xs space-y-1">
                            <div>
                              {u.isActive ? (
                                <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px]">
                                  Aktivan pristup
                                </Badge>
                              ) : (
                                <Badge className="bg-red-100 text-red-800 border border-red-300 text-[10px]">
                                  Deaktiviran
                                </Badge>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {u.lastLoginAt
                                ? `Zadnja prijava: ${formatDateTimeDMY(u.lastLoginAt)}`
                                : u.invitationSentAt
                                ? `Pozivnica: ${formatDateTimeDMY(u.invitationSentAt)}`
                                : "Pozivnica još nije poslana"}
                            </div>
                          </td>

                          <td className="p-4">
                            <div className="flex flex-wrap gap-1 max-w-sm">
                              <span className="inline-flex items-center rounded-md bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-600/20 px-1.5 py-0.5 text-[10px] font-bold">
                                Svoji dodijeljeni predmeti (P/U)
                              </span>
                              {stageBadges.map((st) => {
                                const r = rights[st.key]
                                return (
                                  <span
                                    key={st.key}
                                    className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold ring-1 ring-inset ${
                                      r?.edit
                                        ? "bg-amber-50 text-amber-900 ring-amber-600/20"
                                        : "bg-indigo-50 text-indigo-800 ring-indigo-600/20"
                                    }`}
                                  >
                                    {st.title.split(" ")[1]} {r?.edit ? "(P/U)" : "(P)"}
                                  </span>
                                )
                              })}
                            </div>
                          </td>

                          <td className="p-4 text-center">
                            <div className="inline-flex flex-col items-center">
                              <span className="font-serif text-base font-bold text-[#1E3A5F]">
                                {u.assignedInquiriesCount || 0}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                aktivnih: {u.assignedActiveInquiriesCount || 0}
                              </span>
                            </div>
                          </td>

                          <td className="p-4">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => openEditModal(u)}
                                className="rounded-full h-8 px-3 text-xs font-semibold gap-1"
                              >
                                <KeyRound className="h-3 w-3" /> Uredi
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={!u.isActive}
                                onClick={() => openInviteModal(u)}
                                className="rounded-full h-8 px-3 text-xs font-semibold border-[#D97706] text-[#1E3A5F] hover:bg-[#FEFCE8] gap-1"
                              >
                                <Mail className="h-3 w-3 text-[#D97706]" /> Pozivnica
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => handleToggleActive(u)}
                                title={u.isActive ? "Deaktiviraj pristup" : "Aktiviraj pristup"}
                                className={`h-8 w-8 p-0 rounded-full ${
                                  u.isActive
                                    ? "text-amber-700 hover:bg-amber-50"
                                    : "text-emerald-700 hover:bg-emerald-50"
                                }`}
                              >
                                {u.isActive ? (
                                  <UserX className="h-3.5 w-3.5" />
                                ) : (
                                  <UserCheck className="h-3.5 w-3.5" />
                                )}
                              </Button>
                              <DeleteActionButton
                                label=""
                                size="sm"
                                onClick={() => handleDeleteUser(u)}
                                title="Premjesti u Smeće"
                                className="h-8 w-8 p-0 justify-center"
                              />
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal za dodavanje / uređivanje vanjskog suradnika */}
      <Dialog open={editorOpen} onOpenChange={(v) => !saving && setEditorOpen(v)}>
        <DialogContent className="sm:max-w-2xl max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-3xl">
          <DialogHeader className="px-6 py-4 bg-[#1E3A5F] border-b-2 border-[#D97706] text-white shrink-0">
            <DialogTitle className="font-serif text-lg font-bold text-white flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-[#CEA369]" />
              {editingUser
                ? `Uredi vanjskog suradnika — ${editingUser.name}`
                : "Dodaj vanjsku osobu (nije član Društva) za Istraživanja"}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#F8FAFC]/90">
              Osoba dobiva pristup isključivo modulu Istraživanja bez dodavanja na popis članova Društva.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold">Ime i prezime *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="npr. Ivan Horvat"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold">E-mail adresa (za prijavu) *</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ivan.horvat@ustanova.hr"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Telefon</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+385 9x xxx xxxx"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Ustanova / Suradnja</Label>
                <Input
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="npr. Državni arhiv / vanjski rodoslovac"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Interna napomena</Label>
              <Textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Područje suradnje ili dodatna napomena…"
              />
            </div>

            {/* Opseg pristupa Istraživanjima */}
            <div className="rounded-2xl border border-border bg-[#FBF9F6] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#1E3A5F] flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-[#D97706]" />
                  Razina pristupa u modulu Istraživanja
                </span>
                <Badge variant="outline" className="text-[10px]">
                  Ostali moduli uvijek zaključani
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setAccessMode("assigned_only")}
                  className={`rounded-xl border-2 p-3 text-left transition-all ${
                    accessMode === "assigned_only"
                      ? "border-[#1E3A5F] bg-white shadow-xs"
                      : "border-border bg-white/60 hover:border-[#1E3A5F]/40"
                  }`}
                >
                  <div className="text-xs font-bold text-[#1E3A5F]">
                    Samo dodijeljeni predmeti (Preporučeno)
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                    Osoba vidi i uređuje isključivo predmete istraživanja koji su joj osobno dodijeljeni.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setAccessMode("custom")}
                  className={`rounded-xl border-2 p-3 text-left transition-all ${
                    accessMode === "custom"
                      ? "border-[#1E3A5F] bg-white shadow-xs"
                      : "border-border bg-white/60 hover:border-[#1E3A5F]/40"
                  }`}
                >
                  <div className="text-xs font-bold text-[#1E3A5F]">
                    Prošireni pristup po fazama
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                    Odobrite dodatni pregled ili uređivanje faza (Zaprimljeno, U radu, Završeno).
                  </p>
                </button>
              </div>

              {accessMode === "custom" && (
                <div className="space-y-2 pt-2 border-t border-border">
                  {INQUIRY_STAGE_ITEMS.map((st) => {
                    const right = draftRights[st.key] || { view: false, edit: false }
                    return (
                      <div
                        key={st.key}
                        className="rounded-xl border border-border bg-white px-3 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-900">{st.title}</div>
                          <div className="text-[11px] text-muted-foreground">{st.desc}</div>
                        </div>
                        <div className="flex items-center gap-4 shrink-0 text-xs font-semibold">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <Checkbox
                              checked={Boolean(right.view)}
                              onCheckedChange={(v) => toggleStageRight(st.key, "view", v === true)}
                            />
                            Pregled
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <Checkbox
                              checked={Boolean(right.edit)}
                              onCheckedChange={(v) => toggleStageRight(st.key, "edit", v === true)}
                            />
                            Uređivanje
                          </label>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border bg-white px-4 py-3">
              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <Checkbox
                  checked={isActive}
                  onCheckedChange={(v) => setIsActive(v === true)}
                />
                Korisnički račun je aktivan (dozvoljena prijava u Rodoslovac)
              </label>

              {!editingUser && (
                <label className="flex items-center gap-2 text-xs font-semibold text-[#1E3A5F] cursor-pointer">
                  <Checkbox
                    checked={sendInviteNow}
                    onCheckedChange={(v) => setSendInviteNow(v === true)}
                  />
                  Odmah pošalji e-mail pozivnicu s aktivacijom
                </label>
              )}
            </div>

            {formError && (
              <div className="rounded-xl border border-red-300 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-800 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}
          </div>

          <ModalActionFooter
            left={
              <span className="text-[11px] text-muted-foreground">
                Vanjski suradnik nikada se ne upisuje u Registar članova.
              </span>
            }
            right={
              <>
                <CloseActionButton
                  label="Odustani"
                  onClick={() => !saving && setEditorOpen(false)}
                  disabled={saving}
                />
                <SaveActionButton
                  label={editingUser ? "Spremi izmjene" : "Dodaj vanjskog suradnika"}
                  loading={saving}
                  onClick={handleSaveUser}
                />
              </>
            }
          />
        </DialogContent>
      </Dialog>

      {/* Modal za slanje / testiranje pozivnice vanjskom suradniku */}
      <Dialog open={Boolean(inviteUser)} onOpenChange={(v) => !v && !sendingInvite && setInviteUser(null)}>
        <DialogContent className="w-[96vw] sm:max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-3xl">
          <DialogHeader
            style={{
              backgroundColor: DEFAULT_HRD_EMAIL_PALETTE.navyBlue,
              borderBottom: `3px solid ${DEFAULT_HRD_EMAIL_PALETTE.goldOrange}`,
            }}
            className="text-white px-6 py-4 shrink-0"
          >
            <DialogTitle className="font-serif text-lg font-bold text-white flex items-center gap-2">
              <Mail className="h-5 w-5 text-[#FEFCE8]" />
              Pozivnica vanjskom suradniku — {inviteUser?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#F8FAFC]/90">
              Aktivacijska poveznica za modul Istraživanja ({inviteUser?.email})
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold">Predmet e-maila</Label>
                  <Input
                    value={inviteSubject}
                    onChange={(e) => setInviteSubject(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold">Tekst poruke</Label>
                  <Textarea
                    rows={7}
                    value={inviteBody}
                    onChange={(e) => setInviteBody(e.target.value)}
                  />
                </div>
                <div className="rounded-xl border border-[#1E3A5F]/20 bg-[#EFF5FB]/60 p-3 flex items-center gap-2">
                  <FlaskConical className="h-4 w-4 text-[#D97706] shrink-0" />
                  <Input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="Testna e-mail adresa..."
                    className="h-8 text-xs bg-white"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={sendingTest || sendingInvite}
                    onClick={() => handleSendInvite(true)}
                    className="shrink-0 h-8 text-xs border-[#D97706] text-[#1E3A5F]"
                  >
                    {sendingTest ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Pošalji [TEST]"}
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground">
                  Pregled službenog HRD e-maila
                </Label>
                <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-2 max-h-[380px] overflow-y-auto">
                  <div dangerouslySetInnerHTML={{ __html: invitePreviewHtml }} />
                </div>
              </div>
            </div>

            {inviteStatus.type !== "idle" && (
              <div
                className={`rounded-xl border px-4 py-2.5 text-xs font-semibold flex items-center gap-2 ${
                  inviteStatus.type === "success"
                    ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                    : "border-red-300 bg-red-50 text-red-800"
                }`}
              >
                {inviteStatus.type === "success" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0" />
                )}
                <span>{inviteStatus.text}</span>
              </div>
            )}
          </div>

          <ModalActionFooter
            left={
              <span className="text-[11px] text-muted-foreground">
                Primatelj nakon klika postavlja svoju osobnu lozinku.
              </span>
            }
            right={
              <>
                <CloseActionButton
                  label="Odustani"
                  onClick={() => !sendingInvite && setInviteUser(null)}
                  disabled={sendingInvite}
                />
                <Button
                  type="button"
                  disabled={sendingInvite || sendingTest}
                  onClick={() => handleSendInvite(false)}
                  className="rounded-full min-h-10 px-6 bg-[#1E3A5F] hover:bg-[#162D4A] text-white border border-[#D97706] font-bold gap-2"
                >
                  {sendingInvite ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Slanje…
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 text-[#D97706]" />
                      Pošalji pozivnicu
                    </>
                  )}
                </Button>
              </>
            }
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
