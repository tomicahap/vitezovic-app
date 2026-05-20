"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useActivityLog } from './activity-log-context'
import type { AccessCategory, MemberAccessRight } from './members-context'

export interface User {
  id: number
  name: string
  email: string
  role: 'admin' | 'moderator' | 'member'
  avatar?: string
  isTempPassword?: boolean
  accessRights?: Record<AccessCategory, MemberAccessRight>
}

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
  updatePassword: (currentPassword: string, newPassword: string) => Promise<boolean>
  isAuthenticated: boolean
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

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
  const { addLog } = useActivityLog()

  useEffect(() => {
    // Check for stored auth on mount
    const storedUser = localStorage.getItem('auth_user')
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser)
        setUser(parsedUser)
      } catch (error) {
        localStorage.removeItem('auth_user')
      }
    }
    setIsLoading(false)
  }, [])

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      if (response.ok) {
        const userData = await response.json()
        setUser(userData)
        localStorage.setItem('auth_user', JSON.stringify(userData))
        
        // Log successful login
        addLog({
          userId: userData.id.toString(),
          userName: userData.name,
          userRole: userData.role,
          action: 'Prijava u sustav',
          details: `Korisnik ${userData.name} (${userData.email}) se prijavio u sustav`,
        })
        
        setIsLoading(false)
        return true
      }
    } catch (error) {
      console.error('Login error:', error)
    }

    setIsLoading(false)
    return false
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
    
    setUser(null)
    localStorage.removeItem('auth_user')
  }

  const updatePassword = async (currentPassword: string, newPassword: string): Promise<boolean> => {
    if (!user) return false

    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/update-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, currentPassword, newPassword })
      })

      if (response.ok) {
        // Log password change
        addLog({
          userId: user.id.toString(),
          userName: user.name,
          userRole: user.role,
          action: 'Promjena lozinke',
          details: `Korisnik ${user.name} je promijenio lozinku`,
        })
        
        // Update local user state
        const updatedUser = { ...user, isTempPassword: false }
        setUser(updatedUser)
        localStorage.setItem('auth_user', JSON.stringify(updatedUser))

        setIsLoading(false)
        return true
      }
    } catch (error) {
      console.error('Password update error:', error)
    }

    setIsLoading(false)
    return false
  }

  const value = {
    user,
    login,
    logout,
    updatePassword,
    isAuthenticated: !!user,
    isLoading
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