import { DesktopHeaderNav } from "@/components/desktop-header-nav"
﻿import { AppSidebar } from "@/components/app-sidebar"
import { DriveContent } from "@/components/drive-content"
import { ProtectedRoute } from "@/components/protected-route"

export default function DrivePage() {
  return (
    <ProtectedRoute permission="drive">
      <div className="flex flex-col md:flex-row min-h-screen bg-background">
        <AppSidebar activeItem="google-drive" />
        <div className="flex-1 min-w-0">
          <DesktopHeaderNav activeItem="drive" showBar />
          <DriveContent />
        </div>
      </div>
    </ProtectedRoute>
  )
}
