"use client"

import { useAuth } from "@/contexts/auth-context"
import { PasswordChangeOverlay } from "./password-change-overlay"
import { AppFooter } from "./app-sidebar"

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth()

  if (isLoading) return <>{children}</>

  // If user is authenticated and has a temporary password, 
  // ONLY render the password change screen.
  if (isAuthenticated && user?.isTempPassword) {
    return <PasswordChangeOverlay />
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex-1 flex flex-col pb-28 md:pb-12">{children}</div>
      {isAuthenticated && <AppFooter />}
    </div>
  )
}
