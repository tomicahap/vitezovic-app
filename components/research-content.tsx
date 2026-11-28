"use client"

import { useEffect, useMemo, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { DesktopHeaderNav } from "@/components/desktop-header-nav"
import { ResearchInquiriesTab } from "@/components/research-inquiries-tab"
import { useAuth } from "@/contexts/auth-context"
import { useActivityLog } from "@/contexts/activity-log-context"

export function ResearchContent() {
  const { user } = useAuth()
  const { addLog } = useActivityLog()
  const router = useRouter()
  const searchParams = useSearchParams()
  const hasLoggedRef = useRef(false)

  const rawInquiryId = searchParams?.get("inquiryId")
  const initialInquiryId = useMemo(() => {
    if (!rawInquiryId) return null
    const parsed = Number(rawInquiryId)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null
  }, [rawInquiryId])

  const openedFromGmail = searchParams?.get("from") === "gmail"
  const justCreatedFromGmail = searchParams?.get("created") === "1"
  const justAttachedFromGmail = searchParams?.get("attached") === "1"
  const attachedMessageId = searchParams?.get("msgId") || null
  const initialViewTab =
    searchParams?.get("tab") === "satisfaction" ? "satisfaction" : "inquiries"

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
        <ResearchInquiriesTab
          initialInquiryId={initialInquiryId}
          initialViewTab={initialViewTab}
          openedFromGmail={openedFromGmail}
          justCreatedFromGmail={justCreatedFromGmail}
          justAttachedFromGmail={justAttachedFromGmail}
          attachedMessageId={attachedMessageId}
          onClearInitialInquiry={() => router.replace("/research", { scroll: false })}
        />
      </div>
    </main>
  )
}
