"use client"

import React from "react"
import { cn } from "@/lib/utils"
import { 
  LayoutDashboard, 
  Users, 
  Contact,
  Calendar, 
  FolderKanban, 
  Archive, 
  Cloud,
  LogOut,
  Settings,
  Activity,
  FileBarChart,
  BookOpen,
  Mic,
  Library,
  Mail,
  Link as LinkIcon,
  StickyNote,
  HelpCircle,
  Menu,
  ZoomIn,
  ZoomOut,
  Sparkles,
  History,
  Info
} from "lucide-react"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { useSettings } from "@/contexts/settings-context"
import { getInquiryPermissions, getFunctionsPermissions } from "@/lib/inquiry-permissions"

interface SidebarProps {
  activeItem?: string
}

const baseNavItems = [
  { id: "dashboard", label: "NADZORNA PLOČA", icon: LayoutDashboard, href: "/" },
  { id: "personal", label: "MOJ KUTAK", icon: StickyNote, href: "/personal" },
  { id: "members", label: "ČLANOVI", icon: Users, href: "/members" },
  { id: "contacts", label: "ADRESAR", icon: Contact, href: "/contacts" },
  { id: "meetings", label: "SJEDNICE I GLASOVANJE", icon: Calendar, href: "/meetings" },
  { id: "lectures", label: "PREDAVANJA / DRUŽENJA", icon: Mic, href: "/lectures" },
  { id: "library", label: "KNJIŽNICA", icon: Library, href: "/library" },
  { id: "projects", label: "PROJEKTI", icon: FolderKanban, href: "/projects" },
  { id: "archive", label: "ARHIV", icon: Archive, href: "/archive" },
  { id: "gmail", label: "INBOX", icon: Mail, href: "/gmail" },
  { id: "links", label: "LINKOVI", icon: LinkIcon, href: "/links" },
  { id: "drive", label: "GOOGLE DRIVE", icon: Cloud, href: "/drive" },
]

// Kratki nazivi za donju mobilnu traku
const bottomTabLabels: Record<string, string> = {
  dashboard: "Početna",
  members: "Članovi",
  meetings: "Sjednice",
  personal: "Moj kutak",
}

const ZOOM_KEY = "zoom-a11y"

/** Stanje povećanog prikaza – sinkronizirano s <html> klasom i localStorageom. */
function useA11yZoom() {
  const [zoomed, setZoomed] = React.useState(false)

  React.useEffect(() => {
    setZoomed(document.documentElement.classList.contains(ZOOM_KEY))
  }, [])

  const toggle = React.useCallback(() => {
    const next = !document.documentElement.classList.contains(ZOOM_KEY)
    document.documentElement.classList.toggle(ZOOM_KEY, next)
    try { localStorage.setItem(ZOOM_KEY, next ? "1" : "0") } catch {}
    setZoomed(next)
  }, [])

  return { zoomed, toggle }
}

export function AppFooter() {
  const pathname = usePathname()

  return (
    <footer className="print:hidden w-full border-t border-border bg-sidebar text-sidebar-foreground px-4 md:px-8 py-3 pb-20 md:pb-3 text-xs">
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 w-full">
        {/* Informative Footer Links */}
        <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-5 gap-y-1.5 text-[11px]">
          <Link
            href="/manual"
            className={cn(
              "inline-flex items-center gap-1.5 rounded px-2 py-1 transition-colors",
              pathname === "/manual"
                ? "bg-blue-500/15 text-blue-600 font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
            )}
          >
            <HelpCircle className="h-3.5 w-3.5 shrink-0 text-blue-500" />
            <span>Korisnički priručnik</span>
          </Link>

          <Link
            href="/changelog"
            className={cn(
              "inline-flex items-center gap-1.5 rounded px-2 py-1 transition-colors",
              pathname === "/changelog"
                ? "bg-amber-500/15 text-amber-700 font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
            )}
          >
            <History className="h-3.5 w-3.5 shrink-0 text-[#CEA369]" />
            <span>Popis promjena (Changelog)</span>
          </Link>

          <div
            className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-[11px] text-muted-foreground/80 select-none"
            title="Sve SQLite baze sustava pohranjuju se u /var/data/prv_data/db/"
          >
            <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
            <span>Pohrana: /var/data/prv_data/db/</span>
          </div>
        </div>

        {/* Version Badge & Copyright */}
        <div className="flex flex-wrap items-center justify-center md:justify-end gap-3 select-none">
          <div className="inline-flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground/80 font-mono font-bold tracking-wider">RODOSLOVAC</span>
            <Link
              href="/changelog"
              title="Kliknite za pregled svih promjena u verzijama (Changelog)"
              className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-xs font-mono font-bold text-[#b58442] dark:text-[#CEA369] hover:bg-amber-500/20 hover:underline transition-colors"
            >
              v11.11.2026
            </Link>
          </div>
          <span className="hidden sm:inline text-border">•</span>
          <span className="text-[11px] text-muted-foreground/70">
            © {new Date().getFullYear()} HRD Pavao Ritter Vitezović
          </span>
        </div>
      </div>
    </footer>
  )
}

export function AppSidebar({ activeItem = "dashboard" }: SidebarProps) {
  const { user, logout } = useAuth()
  const { settings } = useSettings()
  const { zoomed, toggle: toggleZoom } = useA11yZoom()
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)

  const navItems = React.useMemo(() => {
    const inqPerms = getInquiryPermissions(user)
    const fnPerms = getFunctionsPermissions(user)

    return [
      ...baseNavItems.filter(item => {
        // Admin has full access
        if (user?.role === 'admin') return true
        
        // Dashboard, Personal and Meetings are visible for logged in users
        if (item.id === 'dashboard' || item.id === 'personal' || item.id === 'meetings') return true

        // Projekti su vidljivi i ako član ima pravo na bilo koju od 3 razine Upita i istraživanja
        if (item.id === 'projects') {
          const rights = (user?.accessRights as any)?.projects
          return Boolean(rights?.view || rights?.edit || inqPerms.canViewAny)
        }

        // Članovi su vidljivi i ako član ima uključen pregled Funkcija u društvu
        if (item.id === 'members') {
          const rights = (user?.accessRights as any)?.members
          return Boolean(rights?.view || rights?.edit || fnPerms.view)
        }
        
        // Check specific access rights
        const rights = (user?.accessRights as any)?.[item.id]
        return rights?.view === true || rights?.edit === true
      }).map(item => {
        if (user?.role !== 'admin' && item.id === 'projects') {
          const rights = (user?.accessRights as any)?.projects
          if (!rights?.view && !rights?.edit && inqPerms.canViewAny) {
            return { ...item, label: "UPITI I ISTRAŽIVANJA", href: "/projects?tab=inquiries" }
          }
        }
        if (user?.role !== 'admin' && item.id === 'members') {
          const rights = (user?.accessRights as any)?.members
          if (!rights?.view && !rights?.edit && fnPerms.view) {
            return { ...item, label: "FUNKCIJE U DRUŠTVU", href: "/members?tab=organization" }
          }
        }
        return item
      }),
      ...(user?.role === 'admin'
        ? [
            { id: "donations", label: "DONACIJE & KAMPANJE", icon: Sparkles, href: "/admin/donations" },
            { id: "settings", label: "POSTAVKE", icon: Settings, href: "/settings" },
          ]
        : []),
      ...((user && ['admin', 'moderator'].includes(user.role))
        ? [
            { id: 'reports', icon: FileBarChart, label: 'IZVJEŠĆA', href: '/reports' },
            { id: 'logs', icon: Activity, label: 'LOGOVI', href: '/logs' },
            { id: "chronicle", label: "LJETOPIS DRUŠTVA", icon: BookOpen, href: "/chronicle" },
          ].filter(item => {
            if (user.role === 'admin') return true
            const rights = (user.accessRights as any)?.[item.id]
            return rights?.view === true || rights?.edit === true
          })
        : []),
    ]
  }, [user])

  // Donja traka: do 4 najvažnija odjeljka kojima korisnik ima pristup + "Više"
  const bottomTabs = React.useMemo(
    () => ["dashboard", "members", "meetings", "personal"]
      .map(id => navItems.find(i => i.id === id))
      .filter(Boolean)
      .slice(0, 4) as typeof navItems,
    [navItems]
  )
  const activeInBottomTabs = bottomTabs.some(t => t.id === activeItem)

  const zoomLabel = zoomed ? "SMANJI PRIKAZ" : "POVEĆAJ PRIKAZ"
  const ZoomIcon = zoomed ? ZoomOut : ZoomIn

  const roleLabel =
    user?.role === 'admin' ? 'Administrator' : user?.role === 'moderator' ? 'Moderator' : 'Član'

  const sidebarContent = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="p-5 pb-3">
        <div className="flex flex-col items-center text-center gap-2.5">
          {settings.logoUrl ? (
            <img src={settings.logoUrl} alt="Logo društva" className="h-[64px] w-[64px] rounded-full object-cover border-2 border-border shadow-sm" />
          ) : (
            <div className="flex h-[64px] w-[64px] items-center justify-center rounded-full border-2 border-border bg-background text-2xl font-bold shadow-sm">
              A
            </div>
          )}
          <div>
            <div className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#b58442] dark:text-[#CEA369] mb-1">
              Rodoslovac
            </div>
            <h1 className="font-serif text-[14px] font-bold leading-tight uppercase tracking-tight">Administracija društva</h1>
            <p className="text-[11px] text-muted-foreground leading-tight mt-0.5 font-medium">HRD Pavao Ritter Vitezović</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-1 flex flex-col overflow-y-auto">
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeItem === item.id
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 md:py-2 text-sm md:text-xs font-medium transition-colors",
                    isActive 
                      ? "bg-secondary text-foreground font-semibold" 
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  )}
                >
                  <Icon className="h-5 w-5 md:h-4 md:w-4 shrink-0" />
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="border-t border-border p-3">
        <button
          type="button"
          onClick={toggleZoom}
          aria-pressed={zoomed}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 md:py-2 text-sm md:text-xs font-bold text-white shadow-sm transition-colors",
            zoomed ? "bg-blue-800 hover:bg-blue-900" : "bg-blue-600 hover:bg-blue-700"
          )}
          title="Povećaj ili smanji prikaz (za slabovidne)"
        >
          <ZoomIcon className="h-5 w-5 md:h-4 md:w-4 shrink-0" />
          {zoomLabel}
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* ── Mobilna gornja traka ── */}
      <header
        className="print:hidden md:hidden sticky top-0 z-40 flex w-full shrink-0 items-center justify-between gap-2 border-b border-border bg-background/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80"
        style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
      >
        <Link href="/" className="flex min-w-0 items-center gap-2">
          {settings.logoUrl ? (
            <img src={settings.logoUrl} alt="Logo" className="h-8 w-8 shrink-0 rounded-full object-cover border border-border" />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-background text-xs font-bold">
              A
            </div>
          )}
          <span className="truncate font-serif text-sm font-bold tracking-tight uppercase">Rodoslovac</span>
        </Link>

        <div className="flex items-center gap-2 shrink-0">
          {user && (
            <div className="flex items-center gap-1.5 pr-1">
              <div className="text-right leading-tight max-w-[110px]">
                <p className="text-[11px] font-bold truncate">{user.name}</p>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground truncate">{roleLabel}</p>
              </div>
              <button
                type="button"
                onClick={logout}
                title="Odjava iz sustava"
                aria-label="Odjava iz sustava"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-red-200 bg-red-50/80 text-red-600 hover:bg-red-600 hover:text-white transition-colors shrink-0"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={toggleZoom}
            aria-pressed={zoomed}
            className={cn(
              "flex h-8 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-bold text-white shadow-sm transition-colors",
              zoomed ? "bg-blue-800" : "bg-blue-600"
            )}
            title="Povećaj ili smanji prikaz (za slabovidne)"
          >
            <ZoomIcon className="h-4 w-4" />
            <span>{zoomed ? "A−" : "A+"}</span>
            <span className="sr-only">{zoomLabel}</span>
          </button>
        </div>
      </header>

      {/* ── Mobilna donja navigacija (kao u nativnim aplikacijama) ── */}
      <nav
        className="print:hidden md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Glavna navigacija"
      >
        <ul className="flex h-16 items-stretch">
          {bottomTabs.map(item => {
            const Icon = item.icon
            const isActive = activeItem === item.id
            return (
              <li key={item.id} className="flex-1">
                <Link
                  href={item.href}
                  className={cn(
                    "flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                    isActive ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  <span className={cn("flex h-7 w-12 items-center justify-center rounded-full transition-colors", isActive && "bg-accent/30")}>
                    <Icon className="h-5 w-5" />
                  </span>
                  {bottomTabLabels[item.id] ?? item.label}
                </Link>
              </li>
            )
          })}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className={cn(
                "flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                !activeInBottomTabs ? "text-foreground" : "text-muted-foreground"
              )}
            >
              <span className={cn("flex h-7 w-12 items-center justify-center rounded-full transition-colors", !activeInBottomTabs && "bg-accent/30")}>
                <Menu className="h-5 w-5" />
              </span>
              Više
            </button>
          </li>
        </ul>
      </nav>

      {/* Mobilni izbornik "Više" */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="p-0 w-[85vw] max-w-[320px] border-r-0">
          <SheetTitle className="sr-only">Izbornik</SheetTitle>
          {sidebarContent}
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar */}
      <aside className="print:hidden hidden md:flex h-screen w-[220px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar sticky top-0">
        {sidebarContent}
      </aside>
    </>
  )
}
