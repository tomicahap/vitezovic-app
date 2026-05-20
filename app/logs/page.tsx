import { ActivityLogsContent } from '@/components/activity-logs-content'
import { ProtectedRoute } from '@/components/protected-route'

export default function LogsPage() {
  return (
    <ProtectedRoute permission="logs">
      <div className="container mx-auto p-6">
        <ActivityLogsContent />
      </div>
    </ProtectedRoute>
  )
}
