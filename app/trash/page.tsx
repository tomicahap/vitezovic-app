import { AppSidebar } from "@/components/app-sidebar"
import { TrashContent } from "@/components/trash-content"
import { ProtectedRoute } from "@/components/protected-route"

export default function TrashPage() {
  return (
    <ProtectedRoute requiredRole="admin">
      <div className="flex flex-col md:flex-row min-h-screen bg-background">
        <AppSidebar activeItem="trash" />
        <TrashContent />
      </div>
    </ProtectedRoute>
  )
}
