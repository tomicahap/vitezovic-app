"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useActivityLog } from './activity-log-context'
import { getUserAccessRights } from '@/lib/inquiry-permissions'
import type { AccessCategory, MemberAccessRight } from './members-context'

export interface User {
  id: number
  name: string
  email: string
  role: 'admin' | 'moderator' | 'member'
  avatar?: string
  isTempPassword?: boolean
  accessRights?: Record<AccessCategory, MemberAccessRight>
  hasAssignedInquiries?: boolean
  assignedInquiriesCount?: number
  assignedActiveInquiriesCount?: number
}

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<boolean>
  loginWithInviteToken: (token: string) => Promise<{ ok: boolean; error?: string; code?: string }>
  logout: () => void
  updatePassword: (
    currentPassword: string,
    newPassword: string,
    options?: { deferStateClear?: boolean }
  ) => Promise<boolean>
  completeTempPasswordSetup: () => void
  updateUserName: (name: string) => void
  isAuthenticated: boolean
  isLoading: boolean
  loginError: string | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function syncAuthCookies(u: User | null) {
  if (typeof document === 'undefined') return
  if (!u) {
    const clear = 'path=/; SameSite=Lax; max-age=0'
    document.cookie = `hrd_uid=; ${clear}`
    document.cookie = `hrd_uname=; ${clear}`
    document.cookie = `hrd_urole=; ${clear}`
    document.cookie = `hrd_uemail=; ${clear}`
    return
  }
  const opts = 'path=/; SameSite=Lax; max-age=2592000'
  document.cookie = `hrd_uid=${encodeURIComponent(String(u.id))}; ${opts}`
  document.cookie = `hrd_uname=${encodeURIComponent(u.name || '')}; ${opts}`
  document.cookie = `hrd_urole=${encodeURIComponent(u.role || 'member')}; ${opts}`
  document.cookie = `hrd_uemail=${encodeURIComponent(u.email || '')}; ${opts}`
}

// Mock users database - in real app this would be in a backend
const mockUsers: (User & { password: string })[] = [
  {
    id: 1,
    name: "Administrator",
    email: "admin",
    password: "admin",
    role: "admin",
    avatar: "/placeholder.svg"
  },
  {
    id: 2,
    name: "Dr. Arthur Vance",
    email: "arthur.vance@archive.org",
    password: "password123",
    role: "moderator",
    avatar: "/placeholder.svg"
  },
  {
    id: 3,
    name: "Eleanor Lynde",
    email: "e.lynde@archive.org",
    password: "password123",
    role: "member",
    avatar: "/placeholder.svg"
  }
]

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loginError, setLoginError] = useState<string | null>(null)
  const { addLog } = useActivityLog()
  const router = useRouter()

  useEffect(() => {
    // Check for stored auth on mount
    const storedUser = localStorage.getItem('auth_user')
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser)
        setUser(parsedUser)
        syncAuthCookies(parsedUser)
        // Sinkroniziraj profil, ulogu i accessRights preko laganog /api/auth/me endpointa (~300 B)
        fetch('/api/auth/me', {
          cache: 'no-store',
          headers: {
            'x-user-id': String(parsedUser.id ?? ''),
            'x-user-role': String(parsedUser.role ?? ''),
            'x-user-email': String(parsedUser.email ?? ''),
          },
        })
          .then(res => (res.ok ? res.json() : null))
          .then(payload => {
            if (!payload) return
            if (payload.authenticated === false) {
              setUser(null)
              syncAuthCookies(null)
              localStorage.removeItem('auth_user')
              window.dispatchEvent(new Event('hrd-auth-changed'))
              return
            }
            if (payload.authenticated && payload.user) {
              const fresh = payload.user
              const parsedRights = getUserAccessRights(fresh)
              const updated = {
                ...parsedUser,
                id: fresh.id ?? parsedUser.id,
                name: fresh.name || parsedUser.name,
                email: fresh.email || parsedUser.email,
                role: fresh.role || parsedUser.role,
                avatar: fresh.avatar || parsedUser.avatar,
                isTempPassword: typeof fresh.isTempPassword === 'boolean' ? fresh.isTempPassword : parsedUser.isTempPassword,
                accessRights: Object.keys(parsedRights).length > 0 ? (parsedRights as any) : null,
                hasAssignedInquiries: Boolean(fresh.hasAssignedInquiries),
                assignedInquiriesCount: typeof fresh.assignedInquiriesCount === 'number' ? fresh.assignedInquiriesCount : 0,
                assignedActiveInquiriesCount: typeof fresh.assignedActiveInquiriesCount === 'number' ? fresh.assignedActiveInquiriesCount : 0,
              }
              if (JSON.stringify(updated) !== JSON.stringify(parsedUser)) {
                setUser(updated)
                syncAuthCookies(updated)
                localStorage.setItem('auth_user', JSON.stringify(updated))
              }
            }
          })
          .catch(() => {})
      } catch (error) {
        localStorage.removeItem('auth_user')
        syncAuthCookies(null)
      }
    }
    setIsLoading(false)
  }, [])

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true)
    setLoginError(null)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      if (response.ok) {
        const userData = await response.json()
        const parsedRights = getUserAccessRights(userData)
        const sanitizedUser = {
          ...userData,
          accessRights: Object.keys(parsedRights).length > 0 ? (parsedRights as any) : null,
        }
        setUser(sanitizedUser)
        syncAuthCookies(sanitizedUser)
        localStorage.setItem('auth_user', JSON.stringify(sanitizedUser))
        window.dispatchEvent(new Event('hrd-auth-changed'))
        try {
          sessionStorage.removeItem(`shown_login_summary_${userData.id}`)
        } catch {}
        
        // Log successful login
        addLog({
          userId: userData.id.toString(),
          userName: userData.name,
          userRole: userData.role,
          action: 'Prijava u sustav',
          details: `Korisnik ${userData.name} (${userData.email}) se prijavio u sustav`,
        })
        
        setIsLoading(false)
        try {
          router.replace('/')
        } catch {}
        return true
      }

      const errData = await response.json().catch(() => null)
      if (response.status === 503 && errData?.error) {
        setLoginError(errData.error)
      }
    } catch (error) {
      console.error('Login error:', error)
    }

    setIsLoading(false)
    return false
  }

  const loginWithInviteToken = async (
    token: string
  ): Promise<{ ok: boolean; error?: string; code?: string }> => {
    setLoginError(null)
    try {
      const response = await fetch('/api/auth/invite-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const payload = await response.json().catch(() => null)
      if (response.ok && payload && payload.id) {
        const parsedRights = getUserAccessRights(payload)
        const sanitizedUser: User = {
          ...payload,
          isTempPassword: true,
          accessRights: Object.keys(parsedRights).length > 0 ? (parsedRights as any) : null,
        }
        try {
          sessionStorage.setItem('hrd_invite_token', token)
          sessionStorage.removeItem(`shown_login_summary_${sanitizedUser.id}`)
        } catch {}
        syncAuthCookies(sanitizedUser)
        localStorage.setItem('auth_user', JSON.stringify(sanitizedUser))
        try {
          if (typeof window !== 'undefined' && window.location.pathname.startsWith('/pozivnica')) {
            window.history.replaceState({}, '', '/')
          }
          router.replace('/')
        } catch {}
        setUser(sanitizedUser)
        window.dispatchEvent(new Event('hrd-auth-changed'))
        return { ok: true }
      }
      return {
        ok: false,
        error: payload?.error || 'Poveznica za aktivaciju nije valjana ili je istekla.',
        code: payload?.code,
      }
    } catch (error) {
      console.error('Invite token login error:', error)
      return {
        ok: false,
        error: 'Mrežna pogreška pri automatskoj prijavi. Pokušajte ponovno.',
      }
    }
  }

  const logout = () => {
    if (user) {
      // Log logout before clearing user
      addLog({
        userId: user.id.toString(),
        userName: user.name,
        userRole: user.role,
        action: 'Odjava iz sustava',
        details: `Korisnik ${user.name} (${user.email}) se odjavio iz sustava`,
      })
    }
    
    if (user) {
      try {
        sessionStorage.removeItem(`shown_login_summary_${user.id}`)
      } catch {}
    }
    try {
      sessionStorage.removeItem('hrd_invite_token')
    } catch {}
    setUser(null)
    syncAuthCookies(null)
    localStorage.removeItem('auth_user')
    window.dispatchEvent(new Event('hrd-auth-changed'))
    try {
      if (typeof window !== 'undefined' && window.location.pathname.startsWith('/pozivnica')) {
        window.location.replace('/')
      } else {
        router.replace('/')
      }
    } catch {}
  }

  const updatePassword = async (
    currentPassword: string,
    newPassword: string,
    options?: { deferStateClear?: boolean }
  ): Promise<boolean> => {
    if (!user) return false

    let storedInviteToken: string | undefined
    try {
      storedInviteToken = sessionStorage.getItem('hrd_invite_token') || undefined
    } catch {}

    try {
      const response = await fetch('/api/auth/update-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          role: user.role,
          email: user.email,
          currentPassword,
          newPassword,
          inviteToken: storedInviteToken,
          isFirstTimeSetup: Boolean(user.isTempPassword),
        })
      })

      if (response.ok) {
        try {
          sessionStorage.removeItem('hrd_invite_token')
        } catch {}

        const updatedUser = { ...user, isTempPassword: false }
        syncAuthCookies(updatedUser)
        localStorage.setItem('auth_user', JSON.stringify(updatedUser))

        if (!options?.deferStateClear) {
          setUser(updatedUser)
        }

        return true
      }
    } catch (error) {
      console.error('Password update error:', error)
    }

    return false
  }

  const completeTempPasswordSetup = () => {
    setUser(prev => {
      if (!prev) return null
      const updated = { ...prev, isTempPassword: false }
      syncAuthCookies(updated)
      try {
        localStorage.setItem('auth_user', JSON.stringify(updated))
      } catch {}
      return updated
    })
    try {
      if (typeof window !== 'undefined' && window.location.pathname.startsWith('/pozivnica')) {
        window.location.replace('/')
        return
      }
      router.replace('/')
    } catch {}
  }

  const updateUserName = (name: string) => {
    setUser(prev => {
      if (!prev) return null
      const updated = { ...prev, name }
      syncAuthCookies(updated)
      try {
        localStorage.setItem('auth_user', JSON.stringify(updated))
      } catch {}
      return updated
    })
  }

  const value = {
    updateUserName,
    user,
    login,
    loginWithInviteToken,
    logout,
    updatePassword,
    completeTempPasswordSetup,
    isAuthenticated: !!user,
    isLoading,
    loginError
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}