import { AppSidebar } from "@/components/app-sidebar"
import { MeetingsContent } from "@/components/meetings-content"
import { ProtectedRoute } from "@/components/protected-route"

export default function MeetingsPage() {
  return (
    <ProtectedRoute permission="meetings">
      <div className="flex flex-col md:flex-row min-h-screen bg-background">
        <AppSidebar activeItem="meetings" />
        <MeetingsContent />
      </div>
    </ProtectedRoute>
  )
}
