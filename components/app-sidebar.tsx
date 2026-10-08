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
  BookOpen,
  Mic,
  Library,
  Mail,
  Link as LinkIcon,
  StickyNote,
  HelpCircle,
  Menu,
  ZoomIn,
  ZoomOut
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import Link from "next/link"
import { useAuth } from "@/contexts/auth-context"
import { useSettings } from "@/contexts/settings-context"

interface SidebarProps {
  activeItem?: string
}

const baseNavItems = [
  { id: "dashboard", label: "NADZORNA PLOČA", icon: LayoutDashboard, href: "/" },
  { id: "personal", label: "MOJ KUTAK", icon: StickyNote, href: "/personal" },
  { id: "members", label: "ČLANOVI", icon: Users, href: "/members" },
  { id: "contacts", label: "ADRESAR", icon: Contact, href: "/contacts" },
  { id: "meetings", label: "SJEDNICE I GLASOVANJE", icon: Calendar, href: "/meetings" },
  { id: "lectures", label: "PREDAVANJA", icon: Mic, href: "/lectures" },
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

export function AppSidebar({ activeItem = "dashboard" }: SidebarProps) {
  const { user, logout } = useAuth()
  const { settings } = useSettings()
  const { zoomed, toggle: toggleZoom } = useA11yZoom()
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)

  const navItems = React.useMemo(() => [
    ...baseNavItems.filter(item => {
      // Admin has full access
      if (user?.role === 'admin') return true
      
      // Dashboard, Personal and Meetings are visible for logged in users
      if (item.id === 'dashboard' || item.id === 'personal' || item.id === 'meetings') return true
      
      // Check specific access rights
      const rights = (user?.accessRights as any)?.[item.id]
      return rights?.view === true
    }),
    ...(user?.role === 'admin'
      ? [
          { id: "settings", label: "POSTAVKE", icon: Settings, href: "/settings" },
        ]
      : []),
    ...((user && ['admin', 'moderator'].includes(user.role))
      ? [
          { id: 'logs', icon: Activity, label: 'LOGOVI', href: '/logs' },
          { id: "chronicle", label: "LJETOPIS DRUŠTVA", icon: BookOpen, href: "/chronicle" },
        ].filter(item => {
          if (user.role === 'admin') return true
          const rights = (user.accessRights as any)?.[item.id]
          return rights?.view === true
        })
      : []),
  ], [user])

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

  const sidebarContent = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="p-6">
        <div className="flex flex-col items-center text-center gap-3">
          {settings.logoUrl ? (
            <img src={settings.logoUrl} alt="Logo društva" className="h-[72px] w-[72px] rounded-full object-cover border-2 border-border shadow-sm" />
          ) : (
            <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-2 border-border bg-background text-2xl font-bold shadow-sm">
              A
            </div>
          )}
          <div>
            <h1 className="font-serif text-[15px] font-bold leading-tight uppercase tracking-tight">Administracija društva</h1>
            <p className="text-[11px] text-muted-foreground leading-tight mt-1 font-medium">HRD Pavao Ritter Vitezović</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 flex flex-col overflow-y-auto">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeItem === item.id
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-3 md:py-2.5 text-sm md:text-xs font-medium transition-colors",
                    isActive 
                      ? "bg-secondary text-foreground" 
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
        
        {user && (
          <div className="mt-auto pt-6">
            <Link
              href="/manual"
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-3 md:py-2.5 text-sm md:text-xs font-bold transition-colors",
                activeItem === 'manual' 
                  ? "bg-blue-100 text-blue-900 border border-blue-200" 
                  : "bg-blue-50/60 text-blue-700 hover:bg-blue-100/80 hover:text-blue-800 border border-blue-100"
              )}
            >
              <HelpCircle className="h-5 w-5 md:h-4 md:w-4 shadow-sm shrink-0" />
              KORISNIČKI PRIRUČNIK
            </Link>
          </div>
        )}
      </nav>

      <div className="border-t border-border p-3 space-y-2">
        <button
          type="button"
          onClick={toggleZoom}
          aria-pressed={zoomed}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-lg px-3 py-3 md:py-2.5 text-sm md:text-xs font-bold text-white shadow-sm transition-colors",
            zoomed ? "bg-blue-800 hover:bg-blue-900" : "bg-blue-600 hover:bg-blue-700"
          )}
          title="Povećaj ili smanji prikaz (za slabovidne)"
        >
          <ZoomIcon className="h-5 w-5 md:h-4 md:w-4 shrink-0" />
          {zoomLabel}
        </button>
        <button 
          type="button"
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-3 md:py-2.5 text-sm md:text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
        >
          <LogOut className="h-5 w-5 md:h-4 md:w-4 shrink-0" />
          ODJAVA
        </button>
      </div>

      {/* User Profile */}
      <div className="border-t border-border p-4">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-9 w-9 bg-accent shrink-0">
            <AvatarImage src={user?.avatar} alt={user?.name} />
            <AvatarFallback className="bg-accent text-accent-foreground text-xs">
              {user?.name?.split(' ').map(n => n[0]).join('') || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">
              {user?.role === 'admin' ? 'Administrator' : user?.role === 'moderator' ? 'Moderator' : 'Član'}
            </p>
          </div>
        </div>
        <div className="flex justify-between items-center text-[9px] text-muted-foreground/50 font-mono border-t border-border/40 pt-2 select-none">
          <span>HRD-CMS</span>
          <span>v1.3.0</span>
        </div>
        <div className="text-[9px] text-muted-foreground/40 text-center mt-2 select-none">
          © {new Date().getFullYear()} HRD Pavao Ritter Vitezović
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* ── Mobilna gornja traka ── */}
      <header
        className="md:hidden sticky top-0 z-40 flex w-full shrink-0 items-center justify-between gap-2 border-b border-border bg-background/95 px-4 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-background/80"
        style={{ paddingTop: "max(0.625rem, env(safe-area-inset-top))" }}
      >
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          {settings.logoUrl ? (
            <img src={settings.logoUrl} alt="Logo" className="h-9 w-9 shrink-0 rounded-full object-cover border border-border" />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background text-sm font-bold">
              A
            </div>
          )}
          <span className="truncate font-serif text-base font-bold tracking-tight uppercase">HRD Vitezović</span>
        </Link>
        <button
          type="button"
          onClick={toggleZoom}
          aria-pressed={zoomed}
          className={cn(
            "flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-bold text-white shadow-sm transition-colors",
            zoomed ? "bg-blue-800" : "bg-blue-600"
          )}
          title="Povećaj ili smanji prikaz (za slabovidne)"
        >
          <ZoomIcon className="h-5 w-5" />
          <span>{zoomed ? "A−" : "A+"}</span>
          <span className="sr-only">{zoomLabel}</span>
        </button>
      </header>

      {/* ── Mobilna donja navigacija (kao u nativnim aplikacijama) ── */}
      <nav
        className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85"
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
      <aside className="hidden md:flex h-screen w-[220px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar sticky top-0">
        {sidebarContent}
      </aside>
    </>
  )
}
