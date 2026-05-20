import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { LecturesContent } from "@/components/lectures-content"
import { ProtectedRoute } from "@/components/protected-route"

export default function LecturesPage() {
  return (
    <ProtectedRoute permission="lectures">
      <div className="flex flex-col md:flex-row min-h-screen bg-background">
        <AppSidebar activeItem="lectures" />
        <LecturesContent />
      </div>
    </ProtectedRoute>
  )
}
