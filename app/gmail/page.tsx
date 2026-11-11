import { DesktopHeaderNav } from "@/components/desktop-header-nav"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { GmailContent } from "@/components/gmail-content"
import { ProtectedRoute } from "@/components/protected-route"

export default function GmailPage() {
  return (
    <ProtectedRoute permission="gmail">
      <div className="flex flex-col md:flex-row min-h-screen bg-background">
        <AppSidebar activeItem="gmail" />
        <div className="flex-1 min-w-0">
          <DesktopHeaderNav activeItem="gmail" showBar />
          <GmailContent />
        </div>
      </div>
    </ProtectedRoute>
  )
}
