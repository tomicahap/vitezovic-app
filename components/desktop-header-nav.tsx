"use client"

import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { getInquiryPermissions, getFunctionsPermissions } from "@/lib/inquiry-permissions"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Users,
  Contact,
  Calendar,
  FolderKanban,
  Archive,
  Cloud,
  Settings,
  Activity,
  FileBarChart,
  BookOpen,
  Mic,
  Library,
  Mail,
  Link as LinkIcon,
  StickyNote,
  Sparkles,
  LogOut,
} from "lucide-react"

interface DesktopHeaderNavProps {
  activeItem?: string
  className?: string
  showBar?: boolean
}

interface NavItemConfig {
  id: string
  label: string
  shortLabel: string
  icon: React.ComponentType<{ className?: string }>
  href: string
  adminOnly?: boolean
  modOrAdmin?: boolean
}

const ALL_DESKTOP_ITEMS: NavItemConfig[] = [
  { id: "dashboard", label: "Nadzorna ploča", shortLabel: "Nadzorna", icon: LayoutDashboard, href: "/" },
  { id: "personal", label: "Moj kutak", shortLabel: "Kutak", icon: StickyNote, href: "/personal" },
  { id: "members", label: "Članovi", shortLabel: "Članovi", icon: Users, href: "/members" },
  { id: "contacts", label: "Adresar", shortLabel: "Adresar", icon: Contact, href: "/contacts" },
  { id: "meetings", label: "Sjednice", shortLabel: "Sjednice", icon: Calendar, href: "/meetings" },
  { id: "lectures", label: "Predavanja", shortLabel: "Predavanja", icon: Mic, href: "/lectures" },
  { id: "library", label: "Knjižnica", shortLabel: "Knjižnica", icon: Library, href: "/library" },
  { id: "projects", label: "Projekti", shortLabel: "Projekti", icon: FolderKanban, href: "/projects" },
  { id: "archive", label: "Arhiv", shortLabel: "Arhiv", icon: Archive, href: "/archive" },
  { id: "gmail", label: "INBOX", shortLabel: "Inbox", icon: Mail, href: "/gmail" },
  { id: "links", label: "Linkovi", shortLabel: "Linkovi", icon: LinkIcon, href: "/links" },
  { id: "drive", label: "Google Drive", shortLabel: "Drive", icon: Cloud, href: "/drive" },
  { id: "donations", label: "Donacije", shortLabel: "Donacije", icon: Sparkles, href: "/admin/donations", adminOnly: true },
  { id: "reports", label: "Izvješća", shortLabel: "Izvješća", icon: FileBarChart, href: "/reports", modOrAdmin: true },
  { id: "logs", label: "Dnevnik rada", shortLabel: "Dnevnik", icon: Activity, href: "/logs", modOrAdmin: true },
  { id: "chronicle", label: "Ljetopis", shortLabel: "Ljetopis", icon: BookOpen, href: "/chronicle", modOrAdmin: true },
  { id: "settings", label: "Postavke", shortLabel: "Postavke", icon: Settings, href: "/settings", adminOnly: true },
]

export function HeaderUserLogout({ className }: { className?: string }) {
  const { user, logout } = useAuth()
  if (!user) return null

  const roleLabel =
    user.role === "admin"
      ? "Administrator"
      : user.role === "moderator"
      ? "Moderator"
      : "Član"

  return (
    <div className={cn("flex items-center gap-2.5 pl-3 border-l border-border shrink-0", className)}>
      <div className="text-right leading-tight">
        <p className="text-xs font-bold text-foreground truncate max-w-[160px]">{user.name}</p>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {roleLabel}
        </p>
      </div>
      <button
        type="button"
        onClick={logout}
        title="Odjava iz sustava"
        aria-label="Odjava iz sustava"
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-red-200 bg-red-50/80 text-red-600 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all shadow-2xs shrink-0"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  )
}

export function DesktopHeaderNav({ activeItem, className, showBar = false }: DesktopHeaderNavProps) {
  const { user } = useAuth()
  const pathname = usePathname()

  const visibleItems = React.useMemo(() => {
    const inqPerms = getInquiryPermissions(user)
    const fnPerms = getFunctionsPermissions(user)

    return ALL_DESKTOP_ITEMS.filter((item) => {
      if (user?.role === "admin") return true
      if (item.adminOnly) return false
      if (item.modOrAdmin && !["admin", "moderator"].includes(user?.role || "")) return false

      if (item.id === "dashboard" || item.id === "personal" || item.id === "meetings") return true

      if (item.id === "projects") {
        const rights = (user?.accessRights as any)?.projects
        return Boolean(rights?.view || rights?.edit || inqPerms.canViewAny)
      }

      if (item.id === "members") {
        const rights = (user?.accessRights as any)?.members
        return Boolean(rights?.view || rights?.edit || fnPerms.view)
      }

      const rights = (user?.accessRights as any)?.[item.id]
      return rights?.view === true || rights?.edit === true
    }).map((item) => {
      if (user?.role !== "admin" && item.id === "projects") {
        const rights = (user?.accessRights as any)?.projects
        if (!rights?.view && !rights?.edit && inqPerms.canViewAny) {
          return { ...item, label: "Upiti i istraživanja", shortLabel: "Upiti", href: "/projects?tab=inquiries" }
        }
      }
      if (user?.role !== "admin" && item.id === "members") {
        const rights = (user?.accessRights as any)?.members
        if (!rights?.view && !rights?.edit && fnPerms.view) {
          return { ...item, label: "Funkcije u društvu", shortLabel: "Funkcije", href: "/members?tab=organization" }
        }
      }
      return item
    })
  }, [user])

  const isCurrentActive = (item: NavItemConfig) => {
    if (activeItem) return activeItem === item.id
    if (item.href === "/" && pathname === "/") return true
    if (item.href !== "/" && pathname?.startsWith(item.href)) return true
    return false
  }

  const navContent = (
    <nav
      aria-label="Brza navigacija zaglavlja"
      className={cn(
        "hidden md:flex items-center gap-1 overflow-x-auto py-1 scrollbar-none",
        showBar ? "flex-1 justify-end" : className
      )}
    >
      {visibleItems.map((item) => {
        const Icon = item.icon
        const active = isCurrentActive(item)

        return (
          <Link
            key={item.id}
            href={item.href}
            title={item.label}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all select-none shrink-0",
              active
                ? "bg-primary text-white shadow-xs font-bold ring-1 ring-primary/20"
                : "text-slate-600 hover:text-primary hover:bg-slate-100/90"
            )}
          >
            <Icon className={cn("h-4 w-4 shrink-0", active ? "text-amber-400" : "text-slate-500")} />
            <span className="hidden xl:inline">{item.shortLabel}</span>
          </Link>
        )
      })}
    </nav>
  )

  if (showBar) {
    return (
      <>
        <header
          className={cn(
            "hidden md:flex items-center justify-between gap-4 px-6 py-2 border-b border-border bg-card/95 backdrop-blur-md fixed top-0 left-0 right-0 md:left-[220px] z-40 shadow-xs h-[52px]",
            className
          )}
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>Brza navigacija</span>
          </div>
          {navContent}
          <HeaderUserLogout />
        </header>
        {/* Placeholder spacer kako sadržaj stranice ne bi bio prekriven fiksnim zaglavljem */}
        <div className="hidden md:block h-[52px] w-full shrink-0" aria-hidden="true" />
      </>
    )
  }

  return navContent
}
