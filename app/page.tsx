import { Suspense } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { DashboardContent } from "@/components/dashboard-content"
import { ProtectedRoute } from "@/components/protected-route"

export const dynamic = "force-dynamic"

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <div className="flex flex-col md:flex-row min-h-screen bg-background">
        <AppSidebar activeItem="dashboard" />
        <Suspense
          fallback={
            <div className="flex-1 flex items-center justify-center p-8 text-sm text-muted-foreground">
              Učitavanje nadzorne ploče...
            </div>
          }
        >
          <DashboardContent />
        </Suspense>
      </div>
    </ProtectedRoute>
  )
}
