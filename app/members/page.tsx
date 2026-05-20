import { Suspense } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { MembersContent } from "@/components/members-content"
import { ProtectedRoute } from "@/components/protected-route"

export default function MembersPage() {
  return (
    <ProtectedRoute permission="members">
      <div className="flex flex-col md:flex-row min-h-screen bg-background">
        <AppSidebar activeItem="members" />
        <Suspense fallback={<div className="flex-1 flex items-center justify-center">UÄitavanje Älanova...</div>}>
          <MembersContent />
        </Suspense>
      </div>
    </ProtectedRoute>
  )
}
