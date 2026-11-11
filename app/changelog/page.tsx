import { DesktopHeaderNav } from "@/components/desktop-header-nav"
import { Suspense } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { ChangelogContent } from "@/components/changelog-content"
import { ProtectedRoute } from "@/components/protected-route"

export default function ChangelogPage() {
  return (
    <ProtectedRoute>
      <div className="flex flex-col md:flex-row min-h-screen bg-background">
        <AppSidebar activeItem="changelog" />
        <Suspense fallback={<div className="flex-1 flex items-center justify-center italic text-muted-foreground">Učitavanje popisa promjena...</div>}>
          <div className="flex-1 overflow-auto bg-slate-50/30">
            <DesktopHeaderNav showBar />
            <ChangelogContent />
          </div>
        </Suspense>
      </div>
    </ProtectedRoute>
  )
}
