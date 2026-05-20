"use client"

import { useAuth } from "@/contexts/auth-context"
import { PasswordChangeOverlay } from "./password-change-overlay"

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth()

  if (isLoading) return <>{children}</>

  // If user is authenticated and has a temporary password, 
  // ONLY render the password change screen.
  if (isAuthenticated && user?.isTempPassword) {
    return <PasswordChangeOverlay />
  }

  return <>{children}</>
}
