"use client"

import * as React from "react"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Lock, ShieldAlert, CheckCircle2 } from "lucide-react"

export function PasswordChangeOverlay() {
  const { user, updatePassword, logout } = useAuth()
  const [currentPassword, setCurrentPassword] = React.useState("")
  const [newPassword, setNewPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [error, setError] = React.useState("")
  const [isSuccess, setIsSuccess] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  // Only show if user is logged in AND has a temporary password
  if (!user || !user.isTempPassword) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (newPassword !== confirmPassword) {
      setError("Lozinke se ne podudaraju")
      return
    }

    if (newPassword.length < 6) {
      setError("Nova lozinka mora imati barem 6 znakova")
      return
    }

    setIsSubmitting(true)
    try {
      const success = await updatePassword(currentPassword, newPassword)
      if (success) {
        setIsSuccess(true)
        // Refresh page after a delay to clear the overlay
        setTimeout(() => {
          window.location.reload()
        }, 2000)
      } else {
        setError("Trenutna lozinka nije ispravna")
      }
    } catch (err) {
      setError("Došlo je do pogreške. Pokušajte ponovno.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold">Obavezna promjena lozinke</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Prijavljeni ste s privremenom lozinkom. Molimo postavite novu sigurnu lozinku za nastavak rada.
          </p>
        </div>

        {isSuccess ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <CheckCircle2 className="mb-3 h-12 w-12 text-green-500" />
            <p className="font-bold text-green-600 font-serif">Lozinka uspješno promijenjena!</p>
            <p className="mt-1 text-sm text-muted-foreground">Osvježavanje... ⟳</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="current" className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Privremena lozinka</Label>
              <Input
                id="current"
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Unesite lozinku iz emaila"
                className="h-11 rounded-xl"
              />
            </div>
            
            <Separator className="my-2" />

            <div className="space-y-1.5">
              <Label htmlFor="new" className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Nova lozinka</Label>
              <Input
                id="new"
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimalno 6 znakova"
                className="h-11 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm" className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Potvrdite novu lozinku</Label>
              <Input
                id="confirm"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ponovite lozinku"
                className="h-11 rounded-xl"
              />
            </div>

            {error && (
              <p className="text-sm font-medium text-red-500">{error}</p>
            )}

            <div className="flex flex-col gap-3 pt-4">
              <Button type="submit" className="h-11 rounded-xl gap-2 font-bold" disabled={isSubmitting}>
                <Lock className="h-4 w-4" />
                {isSubmitting ? "Spremanje..." : "POSTAVI NOVU LOZINKU"}
              </Button>
              <Button type="button" variant="ghost" onClick={logout} className="text-muted-foreground">
                Odjava
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
