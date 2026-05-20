import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { LibraryContent } from "@/components/library-content"
import { ProtectedRoute } from "@/components/protected-route"

export default function LibraryPage() {
  return (
    <ProtectedRoute permission="library">
      <div className="flex flex-col md:flex-row min-h-screen bg-background">
        <AppSidebar activeItem="library" />
        <LibraryContent />
      </div>
    </ProtectedRoute>
  )
}
