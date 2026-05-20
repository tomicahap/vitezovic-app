import { AppSidebar } from "@/components/app-sidebar"
import { ArchiveContent } from "@/components/archive-content"
import { ProtectedRoute } from "@/components/protected-route"

export default function ArchivePage() {
  return (
    <ProtectedRoute permission="archive">
      <div className="flex flex-col md:flex-row min-h-screen bg-background">
        <AppSidebar activeItem="archive" />
        <ArchiveContent />
      </div>
    </ProtectedRoute>
  )
}
