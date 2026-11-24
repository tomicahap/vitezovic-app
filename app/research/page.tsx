import { Suspense } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { ResearchContent } from "@/components/research-content"
import { ProtectedRoute } from "@/components/protected-route"

export default function ResearchPage() {
  return (
    <ProtectedRoute permission="research">
      <div className="flex flex-col md:flex-row min-h-screen bg-background">
        <AppSidebar activeItem="research" />
        <Suspense fallback={null}>
          <ResearchContent />
        </Suspense>
      </div>
    </ProtectedRoute>
  )
}
