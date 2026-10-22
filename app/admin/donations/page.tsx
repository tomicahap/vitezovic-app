import { Suspense } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { DonationsContent } from "@/components/donations-content"
import { ProtectedRoute } from "@/components/protected-route"

export default function DonationsPage() {
  return (
    <ProtectedRoute requiredRole="admin">
      <div className="flex flex-col md:flex-row min-h-screen bg-background">
        <AppSidebar activeItem="donations" />
        <Suspense fallback={<div className="flex-1 flex items-center justify-center p-8">Učitavanje modula za donacije...</div>}>
          <DonationsContent />
        </Suspense>
      </div>
    </ProtectedRoute>
  )
}
