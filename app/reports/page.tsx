import { AppSidebar } from "@/components/app-sidebar"
import { ReportsContent } from "@/components/reports-content"
import { ProtectedRoute } from "@/components/protected-route"

export default function ReportsPage() {
  return (
    <ProtectedRoute permission="reports">
      <div className="flex flex-col md:flex-row min-h-screen bg-background">
        <AppSidebar activeItem="reports" />
        <main className="flex-1 min-w-0">
          <ReportsContent />
        </main>
      </div>
    </ProtectedRoute>
  )
}
