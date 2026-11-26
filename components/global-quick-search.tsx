"use client"

import React, { useState, useEffect, useMemo, useDeferredValue } from "react"
import { useRouter } from "next/navigation"
import {
  Search,
  Users,
  Calendar,
  Mic,
  Library,
  FolderKanban,
  FileSearch,
  LayoutDashboard,
  StickyNote,
  Contact,
  Archive,
  Mail,
  Link as LinkIcon,
  Cloud,
  Sparkles,
  FileBarChart,
  Activity,
  BookOpen,
  Trash2,
  Settings,
  ArrowRight,
  X,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/contexts/auth-context"
import { useMembers } from "@/contexts/members-context"
import { useMeetings } from "@/contexts/meetings-context"
import { useLectures } from "@/contexts/lectures-context"
import { useLibrary } from "@/contexts/library-context"
import { useProjects } from "@/contexts/projects-context"
import { getInquiryPermissions, getFunctionsPermissions, getUserAccessRights } from "@/lib/inquiry-permissions"
import { formatDateDMY, cn } from "@/lib/utils"

interface SearchEntry {
  id: string
  category: "Moduli" | "Članovi" | "Sjednice" | "Predavanja" | "Knjižnica" | "Projekti"
  title: string
  subtitle?: string
  badge?: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

const MODULE_ITEMS: Array<{
  id: string
  label: string
  href: string
  keywords: string
  icon: React.ComponentType<{ className?: string }>
  adminOnly?: boolean
  modOrAdmin?: boolean
}> = [
  { id: "dashboard", label: "Nadzorna ploča", href: "/", keywords: "početna pregled statistika rođendani", icon: LayoutDashboard },
  { id: "personal", label: "Moj kutak", href: "/personal", keywords: "bilješke todo zadaci osobno", icon: StickyNote },
  { id: "members", label: "Članovi (Registar i funkcije)", href: "/members", keywords: "imenik registar članarina uplate odbor funkcije", icon: Users },
  { id: "contacts", label: "Adresar", href: "/contacts", keywords: "kontakti ustanove partneri telefoni", icon: Contact },
  { id: "meetings", label: "Sjednice i glasovanje", href: "/meetings", keywords: "zapisnici dnevni red ankete", icon: Calendar },
  { id: "lectures", label: "Predavanja i druženja", href: "/lectures", keywords: "događaji gosti radionice", icon: Mic },
  { id: "library", label: "Knjižnica", href: "/library", keywords: "knjige časopisi posudba katalog", icon: Library },
  { id: "projects", label: "Projekti", href: "/projects", keywords: "projekti ciljevi tim doprinositelji", icon: FolderKanban },
  { id: "research", label: "Istraživanja", href: "/research", keywords: "upiti istraživanja rodoslovni građani", icon: FileSearch },
  { id: "archive", label: "Arhiv", href: "/archive", keywords: "dokumenti arhiva građa kontakti članovi preuzimanje", icon: Archive },
  { id: "gmail", label: "Inbox (E-pošta)", href: "/gmail", keywords: "gmail email pošta poruke", icon: Mail },
  { id: "links", label: "Korisni linkovi", href: "/links", keywords: "poveznice linkovi web", icon: LinkIcon },
  { id: "drive", label: "Google Drive", href: "/drive", keywords: "datoteke oblak pohrana", icon: Cloud },
  { id: "donations", label: "Donacije i kampanje", href: "/admin/donations", keywords: "donacije uplatnice mailcrawl ai", icon: Sparkles, adminOnly: true },
  { id: "reports", label: "Izvješća", href: "/reports", keywords: "statistika pdf godišnja izvješća", icon: FileBarChart },
  { id: "logs", label: "Dnevnik rada (Logovi)", href: "/logs", keywords: "aktivnosti evidencija prijave", icon: Activity },
  { id: "chronicle", label: "Ljetopis društva", href: "/chronicle", keywords: "povijest događaji kronika", icon: BookOpen },
  { id: "trash", label: "Smeće (Povrat obrisanog)", href: "/trash", keywords: "smeće kanta undelete povrat obrisano", icon: Trash2, adminOnly: true },
  { id: "settings", label: "Postavke sustava", href: "/settings", keywords: "administracija korisnici prava e-mail backup trezor", icon: Settings, adminOnly: true },
]

interface GlobalQuickSearchProps {
  variant?: "bar" | "compact" | "icon"
  className?: string
}

export function GlobalQuickSearch({ variant = "bar", className }: GlobalQuickSearchProps) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Brza pretraga (Ctrl+K)"
          aria-label="Brza pretraga"
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-secondary/70 text-foreground hover:bg-secondary transition-colors shrink-0",
            className
          )}
        >
          <Search className="h-4 w-4" />
        </button>
      ) : variant === "compact" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Brza pretraga bilo čega u sustavu (Ctrl+K)"
          className={cn(
            "inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 hover:bg-secondary px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0",
            className
          )}
        >
          <Search className="h-3.5 w-3.5 text-primary" />
          <span>Brza pretraga…</span>
          <kbd className="hidden lg:inline-flex items-center rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            Ctrl+K
          </kbd>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Pretraži članove, sjednice, knjige, module (Ctrl+K)"
          className={cn(
            "flex items-center justify-between gap-3 w-full max-w-[360px] rounded-lg border border-border bg-secondary/50 hover:bg-secondary/80 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors",
            className
          )}
        >
          <span className="flex items-center gap-2 truncate">
            <Search className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="truncate">Pronađi člana, sjednicu, knjigu, modul…</span>
          </span>
          <kbd className="hidden xl:inline-flex items-center rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground shrink-0">
            Ctrl+K
          </kbd>
        </button>
      )}

      {open && <GlobalQuickSearchDialog open={open} onOpenChange={setOpen} />}
    </>
  )
}

function GlobalQuickSearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (next: boolean) => void
}) {
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const deferredQuery = useDeferredValue(query)

  const router = useRouter()
  const { user } = useAuth()
  const { members } = useMembers()
  const { meetings, ensureLoaded: ensureMeetingsLoaded } = useMeetings()
  const { lectures, ensureLoaded: ensureLecturesLoaded } = useLectures()
  const { books, journals, ensureLoaded: ensureLibraryLoaded } = useLibrary()
  const { projects, ensureLoaded: ensureProjectsLoaded } = useProjects()

  const permissions = useMemo(() => {
    const ar = getUserAccessRights(user)
    const inq = getInquiryPermissions(user)
    const fn = getFunctionsPermissions(user)
    const isAdmin = user?.role === "admin"
    const isMod = user?.role === "moderator"
    const isExternal = user?.role === "external"

    if (isExternal) {
      return {
        canViewMembers: false,
        canViewLibrary: false,
        canViewLectures: false,
        canViewProjects: false,
        canViewResearch: true,
        allowedModules: MODULE_ITEMS.filter((item) => item.id === "research"),
      }
    }

    const canViewMembers = isAdmin || isMod || ar.members?.view === true || ar.members?.edit === true
    const canViewLibrary = isAdmin || isMod || ar.library?.view === true || ar.library?.edit === true
    const canViewLectures = isAdmin || isMod || ar.lectures?.view === true || ar.lectures?.edit === true
    const canViewProjects = isAdmin || isMod || ar.projects?.view === true || ar.projects?.edit === true
    const canViewResearch = isAdmin || inq.canViewAny

    const allowedModules = MODULE_ITEMS.filter((item) => {
      if (isAdmin) return true
      if (item.adminOnly) return false
      if (item.modOrAdmin && !isMod) return false
      if (item.id === "dashboard" || item.id === "personal" || item.id === "meetings") return true
      if (item.id === "members") return Boolean(canViewMembers || fn.view)
      if (item.id === "projects") return canViewProjects
      if (item.id === "research") return canViewResearch
      if (item.id === "reports" || item.id === "logs" || item.id === "chronicle") {
        const right = ar[item.id]
        return right?.view === true || right?.edit === true
      }
      if (isMod) return true
      const right = ar[item.id]
      return right?.view === true || right?.edit === true
    })

    return {
      canViewMembers,
      canViewLibrary,
      canViewLectures,
      canViewProjects,
      canViewResearch,
      allowedModules,
    }
  }, [user])

  useEffect(() => {
    if (!open || !user) return
    if (user.role !== "external") {
      ensureMeetingsLoaded()
    }
    if (permissions.canViewLectures) ensureLecturesLoaded()
    if (permissions.canViewLibrary) ensureLibraryLoaded()
    if (permissions.canViewProjects) ensureProjectsLoaded()
  }, [
    open,
    user,
    permissions.canViewLectures,
    permissions.canViewLibrary,
    permissions.canViewProjects,
    ensureMeetingsLoaded,
    ensureLecturesLoaded,
    ensureLibraryLoaded,
    ensureProjectsLoaded,
  ])

  useEffect(() => {
    if (!open) {
      setQuery("")
      setActiveIndex(0)
    }
  }, [open])

  const results = useMemo<SearchEntry[]>(() => {
    const q = deferredQuery.trim().toLowerCase()

    if (!q) {
      return permissions.allowedModules.slice(0, 8).map((mod) => ({
        id: `mod-${mod.id}`,
        category: "Moduli",
        title: mod.label,
        subtitle: "Brzi skok na modul",
        href: mod.href,
        icon: mod.icon,
      }))
    }

    const list: SearchEntry[] = []

    // 1. Moduli
    for (const mod of permissions.allowedModules) {
      if (
        mod.label.toLowerCase().includes(q) ||
        mod.keywords.toLowerCase().includes(q)
      ) {
        list.push({
          id: `mod-${mod.id}`,
          category: "Moduli",
          title: mod.label,
          subtitle: mod.href,
          href: mod.href,
          icon: mod.icon,
        })
      }
      if (list.length >= 5) break
    }

    // 2. Članovi
    if (permissions.canViewMembers) {
      let count = 0
      for (const m of members) {
        if (!m) continue
        const hay = [
          m.name,
          m.maidenName,
          m.email,
          m.phone,
          m.registryNumber,
          m.membershipNumber,
          m.oib,
          m.address,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
        if (hay.includes(q)) {
          list.push({
            id: `member-${m.id}`,
            category: "Članovi",
            title: m.name,
            subtitle: [
              m.registryNumber ? `Matica: ${m.registryNumber}` : null,
              m.membershipNumber ? `Prijavnica: ${m.membershipNumber}` : null,
              m.email || m.phone || null,
            ]
              .filter(Boolean)
              .join(" · "),
            badge: m.deceased ? "Preminuo/la" : m.expelled ? "Ispisan/a" : m.status === "active" ? "Aktivan" : "Neaktivan",
            href: `/members/${m.id}`,
            icon: Users,
          })
          count++
          if (count >= 8) break
        }
      }
    }

    // 3. Sjednice
    let meetingCount = 0
    for (const mt of meetings) {
      const hay = `${mt.title || ""} ${mt.location || ""} ${formatDateDMY(mt.date, "")}`.toLowerCase()
      if (hay.includes(q)) {
        list.push({
          id: `meeting-${mt.id}`,
          category: "Sjednice",
          title: mt.title,
          subtitle: [formatDateDMY(mt.date, ""), mt.location].filter(Boolean).join(" · "),
          href: "/meetings",
          icon: Calendar,
        })
        meetingCount++
        if (meetingCount >= 4) break
      }
    }

    // 4. Predavanja
    if (permissions.canViewLectures) {
      let lectureCount = 0
      for (const lec of lectures) {
        const hay = `${lec.title || ""} ${lec.host || ""} ${lec.city || ""} ${formatDateDMY(lec.date, "")}`.toLowerCase()
        if (hay.includes(q)) {
          list.push({
            id: `lecture-${lec.id}`,
            category: "Predavanja",
            title: lec.title,
            subtitle: [formatDateDMY(lec.date, ""), lec.host, lec.city].filter(Boolean).join(" · "),
            href: "/lectures",
            icon: Mic,
          })
          lectureCount++
          if (lectureCount >= 4) break
        }
      }
    }

    // 5. Knjižnica
    if (permissions.canViewLibrary) {
      let libCount = 0
      for (const b of books) {
        const hay = `${b.naslov || ""} ${b.autor || ""} ${b.isbn || ""} ${b.izdavac || ""}`.toLowerCase()
        if (hay.includes(q)) {
          list.push({
            id: `book-${b.id}`,
            category: "Knjižnica",
            title: b.naslov,
            subtitle: [b.autor, b.godina, b.isbn ? `ISBN: ${b.isbn}` : null].filter(Boolean).join(" · "),
            badge: "Knjiga",
            href: "/library",
            icon: Library,
          })
          libCount++
          if (libCount >= 4) break
        }
      }
      if (libCount < 4) {
        for (const j of journals) {
          const hay = `${j.naslov || ""} ${j.izdavac || ""} ${j.issn || ""}`.toLowerCase()
          if (hay.includes(q)) {
            list.push({
              id: `journal-${j.id}`,
              category: "Knjižnica",
              title: j.naslov,
              subtitle: [j.svesci, j.izdavac].filter(Boolean).join(" · "),
              badge: "Časopis",
              href: "/library",
              icon: Library,
            })
            libCount++
            if (libCount >= 4) break
          }
        }
      }
    }

    // 6. Projekti
    if (permissions.canViewProjects) {
      let projCount = 0
      for (const p of projects) {
        const hay = `${p.title || ""} ${p.description || ""} ${p.lead_member_name || ""}`.toLowerCase()
        if (hay.includes(q)) {
          list.push({
            id: `project-${p.id}`,
            category: "Projekti",
            title: p.title,
            subtitle: p.lead_member_name ? `Voditelj: ${p.lead_member_name}` : `${p.progress || 0}% dovršeno`,
            href: "/projects",
            icon: FolderKanban,
          })
          projCount++
          if (projCount >= 4) break
        }
      }
    }

    return list
  }, [deferredQuery, permissions, members, meetings, lectures, books, journals, projects])

  useEffect(() => {
    setActiveIndex(0)
  }, [results.length, deferredQuery])

  const navigateTo = (href: string) => {
    onOpenChange(false)
    router.push(href)
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((prev) => (prev + 1) % results.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((prev) => (prev - 1 + results.length) % results.length)
    } else if (e.key === "Enter") {
      e.preventDefault()
      const target = results[activeIndex] || results[0]
      if (target) navigateTo(target.href)
    }
  }

  return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Brza pretraga sustava</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2 border-b border-border px-4 py-3 bg-muted/30">
            <Search className="h-4 w-4 text-primary shrink-0" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Upišite ime člana, broj matice, naslov knjige, sjednicu ili naziv modula..."
              className="border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 h-8 text-sm"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                aria-label="Očisti pretragu"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-2">
            {results.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Nema rezultata za „{query}”.
              </div>
            ) : (
              <div className="space-y-1">
                {!deferredQuery.trim() && (
                  <p className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Brzi skok na module
                  </p>
                )}
                {results.map((item, idx) => {
                  const Icon = item.icon
                  const isSelected = idx === activeIndex
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => navigateTo(item.href)}
                      className={cn(
                        "w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                        isSelected ? "bg-primary/10 text-foreground" : "hover:bg-secondary/60"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-primary">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold truncate">{item.title}</span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal text-muted-foreground">
                              {item.category}
                            </Badge>
                            {item.badge && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                {item.badge}
                              </Badge>
                            )}
                          </div>
                          {item.subtitle && (
                            <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                          )}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-border bg-muted/20 px-4 py-2 text-[11px] text-muted-foreground">
            <span>Tipke ↑ ↓ za odabir · Enter za otvaranje</span>
            <span>ESC za zatvaranje</span>
          </div>
        </DialogContent>
      </Dialog>
  )
}
