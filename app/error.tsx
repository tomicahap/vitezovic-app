"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertCircle, RefreshCw, Home } from "lucide-react"

export default function GlobalErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Greška pri učitavanju stranice:", error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-6 shadow-lg text-center space-y-4">
        <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
          <AlertCircle className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h2 className="font-serif text-xl font-bold text-foreground">
            Došlo je do poteškoće pri učitavanju
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Sustav nije uspio prikazati stranicu. Pokušajte ponovno ili osvježite stranicu u pregledniku.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
          <Button
            onClick={() => reset()}
            size="sm"
            className="rounded-full gap-1.5 font-bold text-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Pokušaj ponovno
          </Button>
          <Button
            onClick={() => {
              window.location.href = "/members"
            }}
            variant="outline"
            size="sm"
            className="rounded-full gap-1.5 font-bold text-xs"
          >
            <Home className="h-3.5 w-3.5" /> Idi na Članove
          </Button>
        </div>
      </div>
    </div>
  )
}
