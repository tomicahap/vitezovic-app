"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { Wrench, LogOut, RefreshCw, ShieldAlert } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { useSettings } from "@/contexts/settings-context"
import { PasswordChangeOverlay } from "./password-change-overlay"
import { AppFooter } from "./app-sidebar"
import { BootSplash } from "./boot-splash"
import { LoginForm } from "./login-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading, logout } = useAuth()
  const { settings, isSettingsLoaded, setMaintenanceMode, refreshSettings } = useSettings()
  const pathname = usePathname()
  const [disablingMaintenance, setDisablingMaintenance] = useState(false)
  const [checkingStatus, setCheckingStatus] = useState(false)

  // Periodička sinkronizacija postavki kako bi se već prijavljeni ne-administratori
  // odmah blokirali čim administrator uključi način održavanja (i otključali kad ga ugasi)
  useEffect(() => {
    const interval = setInterval(() => {
      refreshSettings()
    }, 25000)

    const onFocusOrVisible = () => {
      if (document.visibilityState === "visible") {
        refreshSettings()
      }
    }

    window.addEventListener("focus", onFocusOrVisible)
    document.addEventListener("visibilitychange", onFocusOrVisible)

    return () => {
      clearInterval(interval)
      window.removeEventListener("focus", onFocusOrVisible)
      document.removeEventListener("visibilitychange", onFocusOrVisible)
    }
  }, [refreshSettings])

  if (isLoading || (!isSettingsLoaded && (isAuthenticated || pathname?.startsWith("/dopuna-podataka")))) {
    return <BootSplash logoUrl={settings?.logoUrl} />
  }

  const isAdmin = isAuthenticated && user?.role === "admin"

  if (settings.maintenanceMode && !isAdmin) {
    // Neprijavljeni korisnici na standardnim rutama vide ekran za prijavu (gdje je istaknuta
    // obavijest o ažuriranju i omogućen isključivo ulaz administratoru)
    if (!isAuthenticated && !pathname?.startsWith("/dopuna-podataka")) {
      return <LoginForm />
    }

    // Prijavljeni korisnici koji nisu administrator ili posjetitelji javnih poveznica vide blokadu sustava
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-background to-slate-100 p-4">
        <Card className="w-full max-w-lg border-2 border-amber-300 shadow-xl">
          <CardHeader className="text-center space-y-4 pb-4">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 border-2 border-amber-300 text-amber-700 shadow-inner">
              {settings.logoUrl ? (
                <img
                  src={settings.logoUrl}
                  alt="Logo"
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                <Wrench className="h-10 w-10" />
              )}
            </div>
            <div className="mx-auto inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/40 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-800">
              <ShieldAlert className="h-3.5 w-3.5" />
              Održavanje sustava u tijeku
            </div>
            <CardTitle className="font-serif text-2xl sm:text-3xl text-foreground">
              Sustav se trenutno ažurira
            </CardTitle>
            <CardDescription className="text-base text-foreground/90 font-medium leading-relaxed">
              Sustav se trenutno ažurira i nije mu moguće pristupiti. Kontaktirajte administratora.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            {isAuthenticated && user && (
              <div className="rounded-lg bg-muted/70 border border-border px-4 py-3 text-xs text-muted-foreground text-center">
                Trenutno ste prijavljeni kao <span className="font-semibold text-foreground">{user.name}</span> ({user.email}).
                Za nastavak rada potrebno je pričekati završetak ažuriranja ili se prijaviti kao administrator.
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              {isAuthenticated ? (
                <Button
                  type="button"
                  onClick={logout}
                  className="flex-1 gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Odjava / Prijava za administratora
                </Button>
              ) : (
                <Link href="/" className="flex-1">
                  <Button type="button" className="w-full gap-2">
                    Prijava za administratora
                  </Button>
                </Link>
              )}

              <Button
                type="button"
                variant="outline"
                disabled={checkingStatus}
                onClick={async () => {
                  setCheckingStatus(true)
                  try {
                    await refreshSettings()
                  } finally {
                    setCheckingStatus(false)
                  }
                }}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${checkingStatus ? "animate-spin" : ""}`} />
                Provjeri ponovo
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // If user is authenticated and has a temporary password, 
  // ONLY render the password change screen.
  if (isAuthenticated && user?.isTempPassword) {
    return <PasswordChangeOverlay />
  }

  return (
    <div className="flex min-h-screen flex-col">
      {settings.maintenanceMode && isAdmin && (
        <div className="sticky top-0 z-50 border-b border-amber-400 bg-amber-500/95 backdrop-blur-sm text-amber-950 px-4 py-2 shadow-sm">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 text-xs sm:text-sm font-medium">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 shrink-0" />
              <span>
                <strong>Način održavanja je UKLJUČEN:</strong> aplikaciji trenutno nitko osim administratora ne može pristupiti.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/settings">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 bg-white/85 hover:bg-white border-amber-800/30 text-amber-950 text-xs"
                >
                  Postavke
                </Button>
              </Link>
              <Button
                size="sm"
                variant="default"
                disabled={disablingMaintenance}
                onClick={async () => {
                  setDisablingMaintenance(true)
                  try {
                    await setMaintenanceMode(false)
                  } finally {
                    setDisablingMaintenance(false)
                  }
                }}
                className="h-7 bg-amber-950 hover:bg-amber-900 text-white text-xs"
              >
                {disablingMaintenance ? "Isključivanje..." : "Isključi način održavanja"}
              </Button>
            </div>
          </div>
        </div>
      )}
      <div className="flex-1 flex flex-col pb-28 md:pb-12">{children}</div>
      {isAuthenticated && <AppFooter />}
    </div>
  )
}
