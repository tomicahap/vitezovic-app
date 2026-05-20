import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { GmailContent } from "@/components/gmail-content"
import { ProtectedRoute } from "@/components/protected-route"

export default function GmailPage() {
  return (
    <ProtectedRoute permission="gmail">
      <div className="flex flex-col md:flex-row min-h-screen bg-background">
        <AppSidebar activeItem="gmail" />
        <GmailContent />
      </div>
    </ProtectedRoute>
  )
}
