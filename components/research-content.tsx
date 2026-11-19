"use client"

import { useEffect, useRef } from "react"
import { DesktopHeaderNav } from "@/components/desktop-header-nav"
import { ResearchInquiriesTab } from "@/components/research-inquiries-tab"
import { useAuth } from "@/contexts/auth-context"
import { useActivityLog } from "@/contexts/activity-log-context"

export function ResearchContent() {
  const { user } = useAuth()
  const { addLog } = useActivityLog()
  const hasLoggedRef = useRef(false)

  useEffect(() => {
    if (user && !hasLoggedRef.current) {
      hasLoggedRef.current = true
      addLog({
        userId: user.id.toString(),
        userName: user.name,
        userRole: user.role,
        action: "Pregled istraživanja",
        details: `Korisnik ${user.name} je pregledao modul Istraživanja`,
      })
    }
  }, [user, addLog])

  return (
    <main className="flex-1 min-w-0 overflow-auto">
      <DesktopHeaderNav activeItem="research" showBar />
      <div className="p-4 md:p-8">
        <ResearchInquiriesTab />
      </div>
    </main>
  )
}
