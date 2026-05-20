import { ChronicleContent } from '@/components/chronicle-content'
import { ProtectedRoute } from '@/components/protected-route'

export default function ChroniclePage() {
  return (
    <ProtectedRoute permission="chronicle">
      <div className="container mx-auto p-6">
        <ChronicleContent />
      </div>
    </ProtectedRoute>
  )
}
