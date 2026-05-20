import { AppSidebar } from "@/components/app-sidebar"
import { SettingsContent } from "@/components/settings-content"
import { ProtectedRoute } from "@/components/protected-route"

export default function SettingsPage() {
  return (
    <ProtectedRoute requiredRole="admin">
      <div className="flex flex-col md:flex-row min-h-screen bg-background">
        <AppSidebar activeItem="settings" />
        <SettingsContent />
      </div>
    </ProtectedRoute>
  )
}
