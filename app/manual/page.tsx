import { Suspense } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { ManualContent } from "@/components/manual-content"
import { ProtectedRoute } from "@/components/protected-route"

export default function ManualPage() {
  return (
    <ProtectedRoute>
      <div className="flex flex-col md:flex-row min-h-screen bg-background">
        <AppSidebar activeItem="manual" />
        <Suspense fallback={<div className="flex-1 flex items-center justify-center italic text-muted-foreground">UÄitavanje priruÄnika...</div>}>
          <div className="flex-1 overflow-auto bg-slate-50/30">
            <ManualContent />
          </div>
        </Suspense>
      </div>
    </ProtectedRoute>
  )
}
