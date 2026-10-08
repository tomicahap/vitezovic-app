import { AppSidebar } from '@/components/app-sidebar'
import { ChronicleContent } from '@/components/chronicle-content'
import { ProtectedRoute } from '@/components/protected-route'

export default function ChroniclePage() {
  return (
    <ProtectedRoute permission="chronicle">
      <div className="flex flex-col md:flex-row min-h-screen bg-background">
        <AppSidebar activeItem="chronicle" />
        <main className="flex-1 min-w-0">
          <ChronicleContent />
        </main>
      </div>
    </ProtectedRoute>
  )
}
