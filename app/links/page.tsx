import { Suspense } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { LinksContent } from "@/components/links-content"
import { ProtectedRoute } from "@/components/protected-route"

export default function LinksPage() {
  return (
    <ProtectedRoute permission="links">
      <div className="flex flex-col md:flex-row min-h-screen bg-background">
        <AppSidebar activeItem="links" />
        <Suspense fallback={<div className="flex-1 flex items-center justify-center">UÄitavanje arhive linkova...</div>}>
          <LinksContent />
        </Suspense>
      </div>
    </ProtectedRoute>
  )
}
