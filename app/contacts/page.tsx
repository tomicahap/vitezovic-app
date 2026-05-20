import { Suspense } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { ContactsContent } from "@/components/contacts-content"
import { ProtectedRoute } from "@/components/protected-route"

export default function ContactsPage() {
  return (
    <ProtectedRoute permission="contacts">
      <div className="flex flex-col md:flex-row min-h-screen bg-background">
        <AppSidebar activeItem="contacts" />
        <Suspense fallback={<div className="flex-1 flex items-center justify-center">UÄitavanje adresara...</div>}>
          <ContactsContent />
        </Suspense>
      </div>
    </ProtectedRoute>
  )
}
