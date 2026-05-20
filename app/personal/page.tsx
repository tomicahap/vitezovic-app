"use client"

import { PersonalContent } from "@/components/personal-content"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"

export default function PersonalPage() {
  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 w-full min-w-0">
        <PersonalContent />
      </main>
    </div>
  )
}
