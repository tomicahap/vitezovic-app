import { AppSidebar } from '@/components/app-sidebar'
import { ActivityLogsContent } from '@/components/activity-logs-content'
import { ProtectedRoute } from '@/components/protected-route'

export default function LogsPage() {
  return (
    <ProtectedRoute permission="logs">
      <div className="flex flex-col md:flex-row min-h-screen bg-background">
        <AppSidebar activeItem="logs" />
        <main className="flex-1 min-w-0">
          <ActivityLogsContent />
        </main>
      </div>
    </ProtectedRoute>
  )
}
