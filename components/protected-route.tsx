"use client"

import React, { useEffect, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { LoginForm } from "@/components/login-form"
import { useMembers } from "@/contexts/members-context"
import { useMeetings } from "@/contexts/meetings-context"
import type { AccessCategory } from "@/contexts/members-context"
import { Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: 'admin' | 'moderator' | 'member'
  permission?: AccessCategory
}

export function ProtectedRoute({ children, requiredRole, permission }: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth()
  const { members, isLoading: isMembersLoading, refreshMembers } = useMembers()
  const { isLoading: isMeetingsLoading } = useMeetings()

  const [showWarning, setShowWarning] = useState(false)

  // Aplikacija je spremna tek kad se učitaju i članovi i sjednice, i imamo barem 1 člana
  const isAppLoading = isMembersLoading || isMeetingsLoading || !members || members.length === 0

  // Prikaži napomenu ako učitavanje baze podataka potraje dulje od 5 sekundi
  useEffect(() => {
    let timer: NodeJS.Timeout
    if (isAuthenticated && isAppLoading) {
      timer = setTimeout(() => {
        setShowWarning(true)
      }, 5000)
    } else {
      setShowWarning(false)
    }
    return () => clearTimeout(timer)
  }, [isAuthenticated, isAppLoading])

  // Pozadinsko osvježavanje baze podataka u slučaju da je prazna
  useEffect(() => {
    if (!isAuthenticated || !isAppLoading) return

    const interval = setInterval(async () => {
      console.log("Pozadinsko osvježavanje baze podataka (članovi)...")
      try {
        const updated = await refreshMembers()
        if (updated && updated.length > 0) {
          console.log("Baza podataka uspješno učitana u pozadini!")
        }
      } catch (e) {
        console.error("Greška pri pozadinskom osvježavanju baze:", e)
      }
    }, 3000) // svakih 3 sekunde

    return () => clearInterval(interval)
  }, [isAuthenticated, isAppLoading, refreshMembers])

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50/50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground font-medium">Učitavanje sustava...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginForm />
  }

  // Ako su podaci o sjednici ili članovima još uvijek u fazi učitavanja iz baze podataka
  if (isAppLoading) {
    const isMembersLoaded = !isMembersLoading && members && members.length > 0
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-tr from-slate-50 via-white to-amber-50/20 p-4">
        <div className="max-w-md w-full bg-white rounded-3xl border border-border p-8 shadow-xl shadow-primary/5 text-center relative overflow-hidden">
          {/* Ukrasni pozadinski sjaj */}
          <div className="absolute -top-12 -right-12 w-24 h-24 bg-accent/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-24 h-24 bg-primary/10 rounded-full blur-2xl pointer-events-none" />

          {/* Glavna animirana ikona */}
          <div className="relative mb-6 inline-flex items-center justify-center">
            <div className="absolute inset-0 animate-ping rounded-full bg-accent/20 opacity-75" style={{ animationDuration: '3s' }}></div>
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-accent-foreground shadow-lg shadow-accent/20">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="h-px w-6 bg-accent" />
            <p className="text-[10px] text-accent font-bold uppercase tracking-[0.2em]">Povezivanje s bazom podataka</p>
            <span className="h-px w-6 bg-accent" />
          </div>

          <h2 className="font-serif text-2xl font-bold tracking-tight text-primary mb-3">Učitavanje podataka...</h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            Učitavamo najnovije zapise članstva, sjednica i dokumenata. Molimo pričekajte trenutak dok se baza podataka ne sinkronizira s poslužiteljem.
          </p>

          {/* Koraci učitavanja */}
          <div className="space-y-3 text-left bg-muted/30 p-4 rounded-2xl border border-border/50 mb-6">
            <div className="flex items-center gap-3 text-xs">
              <div className={`h-2 w-2 rounded-full ${isMembersLoaded ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500 animate-pulse'}`} />
              <span className="font-medium text-primary">Registar članova:</span>
              <span className="text-muted-foreground ml-auto">{isMembersLoaded ? 'Učitan' : 'Učitavanje...'}</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className={`h-2 w-2 rounded-full ${!isMeetingsLoading ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500 animate-pulse'}`} />
              <span className="font-medium text-primary">Sjednice i zapisnici:</span>
              <span className="text-muted-foreground ml-auto">{!isMeetingsLoading ? 'Učitani' : 'Učitavanje...'}</span>
            </div>
          </div>

          {/* Upozorenje ako učitavanje potraje dulje */}
          <div className={`transition-all duration-700 ${showWarning ? 'opacity-100 max-h-[300px]' : 'opacity-0 max-h-0 overflow-hidden'}`}>
            <div className="bg-amber-50/50 border border-amber-200/60 rounded-2xl p-4 text-left">
              <div className="flex items-start gap-3">
                <RefreshCw className="h-4 w-4 text-amber-600 mt-0.5 shrink-0 animate-spin" style={{ animationDuration: '6s' }} />
                <div>
                  <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wide">Napomena poslužitelja</h4>
                  <p className="text-xs text-amber-800/90 mt-1 leading-relaxed">
                    Učitavanje baze podataka traje dulje od uobičajenog. Ako se podaci ne učitaju kroz nekoliko minuta, molimo osvježite stranicu.
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => window.location.reload()} 
                    className="mt-3 w-full bg-white border-amber-200 text-amber-900 hover:bg-amber-50 hover:text-amber-950 font-semibold gap-2 rounded-xl h-8 text-xs"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Osvježi stranicu
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (requiredRole && user?.role !== requiredRole && user?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Pristup odbijen</h1>
          <p className="text-muted-foreground mb-4">
            Nemate dozvolu za pristup ovoj stranici.
          </p>
          <p className="text-sm text-muted-foreground">
            Zahtijevana uloga: {requiredRole}
          </p>
        </div>
      </div>
    )
  }

  if (permission && user?.role !== 'admin') {
    const rights = user?.accessRights?.[permission]
    if (!rights?.view) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Pristup odbijen</h1>
            <p className="text-muted-foreground mb-4">
              Nemate dozvolu za pristup modulu: <span className="font-bold uppercase">{permission}</span>.
            </p>
          </div>
        </div>
      )
    }
  }

  return <>{children}</>
}