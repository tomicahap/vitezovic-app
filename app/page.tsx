import { AppSidebar } from "@/components/app-sidebar"
import { DashboardContent } from "@/components/dashboard-content"
import { ProtectedRoute } from "@/components/protected-route"

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <div className="flex flex-col md:flex-row min-h-screen bg-background">
        <AppSidebar activeItem="dashboard" />
        <DashboardContent />
      </div>
    </ProtectedRoute>
  )
}
