"use client"

import { useAuth } from "@/contexts/auth-context"
import { useSettings } from "@/contexts/settings-context"
import { LoginForm } from "@/components/login-form"
import { BootSplash } from "@/components/boot-splash"
import type { AccessCategory } from "@/contexts/members-context"

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: 'admin' | 'moderator' | 'member'
  permission?: AccessCategory
}

export function ProtectedRoute({ children, requiredRole, permission }: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth()
  const { settings } = useSettings()

  if (isLoading) {
    return <BootSplash logoUrl={settings?.logoUrl} />
  }

  if (!isAuthenticated) {
    return <LoginForm />
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