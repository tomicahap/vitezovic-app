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
  Menu
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import Link from "next/link"
import { useAuth } from "@/contexts/auth-context"
import { useSettings } from "@/contexts/settings-context"
import type { AccessCategory } from "@/contexts/members-context"

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

export function AppSidebar({ activeItem = "dashboard" }: SidebarProps) {
  const { user, logout } = useAuth()
  const { settings } = useSettings()

  const navItems = React.useMemo(() => [
    ...baseNavItems.filter(item => {
      // Admin has full access
      if (user?.role === 'admin') return true
      
      // Dashboard, Personal and Meetings are visible for logged in users
      if (item.id === 'dashboard' || item.id === 'personal' || item.id === 'meetings') return true
      
      // Check specific access rights
      const rights = user?.accessRights?.[item.id as any]
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
          const rights = user.accessRights?.[item.id as any]
          return rights?.view === true
        })
      : []),
  ], [user])
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
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium transition-colors",
                    isActive 
                      ? "bg-secondary text-foreground" 
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
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
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-bold transition-colors",
                activeItem === 'manual' 
                  ? "bg-blue-100 text-blue-900 border border-blue-200" 
                  : "bg-blue-50/60 text-blue-700 hover:bg-blue-100/80 hover:text-blue-800 border border-blue-100"
              )}
            >
              <HelpCircle className="h-4 w-4 shadow-sm shrink-0" />
              KORISNIČKI PRIRUČNIK
            </Link>
          </div>
        )}
      </nav>

      <div className="border-t border-border p-3">
        <button 
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          ODJAVA
        </button>
      </div>

      {/* User Profile */}
      <div className="border-t border-border p-4">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-9 w-9 bg-accent">
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
          <span>v1.2.2</span>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-background sticky top-0 z-50 w-full shrink-0">
        <div className="flex items-center gap-3">
          {settings.logoUrl ? (
            <img src={settings.logoUrl} alt="Logo" className="h-8 w-8 rounded-full object-cover border border-border" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-sm font-bold">
              A
            </div>
          )}
          <span className="font-serif font-bold text-sm tracking-tight uppercase">HRD Vitezović</span>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Otvori izbornik</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-[260px] border-r-0">
            {sidebarContent}
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex h-screen w-[220px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar sticky top-0">
        {sidebarContent}
      </aside>
    </>
  )
}
