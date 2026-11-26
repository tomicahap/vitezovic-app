"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { useSettings } from "@/contexts/settings-context"
import { LoginForm } from "@/components/login-form"
import { BootSplash } from "@/components/boot-splash"
import { getInquiryPermissions, getFunctionsPermissions, getUserAccessRights } from "@/lib/inquiry-permissions"
import type { AccessCategory } from "@/contexts/members-context"

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: 'admin' | 'moderator' | 'member' | 'external'
  permission?: AccessCategory | 'research'
}

export function ProtectedRoute({ children, requiredRole, permission }: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth()
  const { settings } = useSettings()
  const router = useRouter()

  const isExternalRestricted = Boolean(
    !isLoading && isAuthenticated && user?.role === 'external' && permission !== 'research'
  )

  useEffect(() => {
    if (isExternalRestricted) {
      router.replace('/research')
    }
  }, [isExternalRestricted, router])

  if (isLoading) {
    return <BootSplash logoUrl={settings?.logoUrl} />
  }

  if (!isAuthenticated) {
    return <LoginForm />
  }

  if (isExternalRestricted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#F2EFE9]">
        <div className="text-center space-y-2">
          <p className="font-serif text-lg font-bold text-[#1B2B36]">
            Preusmjeravanje na modul Istraživanja…
          </p>
          <p className="text-xs text-muted-foreground">
            Vanjski suradnici imaju pristup isključivo istraživačkim predmetima.
          </p>
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
    const ar = getUserAccessRights(user)
    let hasAccess = false

    if (permission === 'research') {
      hasAccess = getInquiryPermissions(user).canViewAny
    } else {
      const rights = ar[permission]
      hasAccess = Boolean(user?.role === 'moderator' || rights?.view || rights?.edit)

      // Kompatibilnost starih poveznica (/projects?tab=inquiries -> preusmjerava na /research)
      if (
        !hasAccess &&
        permission === 'projects' &&
        typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).get('tab') === 'inquiries'
      ) {
        hasAccess = getInquiryPermissions(user).canViewAny
      }

      // Stranica Članovi sadrži i pregled "Funkcije u društvu" (Odbor i Povijest funkcija)
      if (!hasAccess && permission === 'members') {
        hasAccess = getFunctionsPermissions(user).view
      }
    }

    const permissionLabel =
      permission === 'research'
        ? 'ISTRAŽIVANJA'
        : permission === 'projects'
        ? 'PROJEKTI'
        : permission

    if (!hasAccess) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Pristup odbijen</h1>
            <p className="text-muted-foreground mb-4">
              Nemate dozvolu za pristup modulu: <span className="font-bold uppercase">{permissionLabel}</span>.
            </p>
          </div>
        </div>
      )
    }
  }

  return <>{children}</>
}
