import { AppSidebar } from "@/components/app-sidebar"
import { ProjectsContent } from "@/components/projects-content"
import { ProtectedRoute } from "@/components/protected-route"

export default function ProjectsPage() {
  return (
    <ProtectedRoute permission="projects">
      <div className="flex flex-col md:flex-row min-h-screen bg-background">
        <AppSidebar activeItem="projects" />
        <ProjectsContent />
      </div>
    </ProtectedRoute>
  )
}
