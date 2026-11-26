"use client"

import * as React from "react"
import { useAuth } from "@/contexts/auth-context"
import { useSettings } from "@/contexts/settings-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CloseActionButton, SaveActionButton } from "@/components/ui/action-bar"
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  LogOut,
  ShieldCheck,
  UserCheck,
} from "lucide-react"

export function PasswordChangeOverlay() {
  const { user, updatePassword, logout } = useAuth()
  const { settings } = useSettings()

  const [newPassword, setNewPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [showNewPassword, setShowNewPassword] = React.useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false)
  const [copiedUsername, setCopiedUsername] = React.useState(false)
  const [error, setError] = React.useState("")
  const [isSuccess, setIsSuccess] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  // Prikazati isključivo ako je korisnik prijavljen i treba postaviti novu lozinku
  if (!user || !user.isTempPassword) return null

  const handleCopyUsername = async () => {
    if (!user.email) return
    try {
      await navigator.clipboard.writeText(user.email)
      setCopiedUsername(true)
      setTimeout(() => setCopiedUsername(false), 2000)
    } catch {}
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (newPassword.length < 6) {
      setError("Nova lozinka mora imati najmanje 6 znakova.")
      return
    }

    if (newPassword !== confirmPassword) {
      setError("Lozinke se ne podudaraju. Provjerite oba polja.")
      return
    }

    setIsSubmitting(true)
    try {
      const success = await updatePassword("", newPassword)
      if (success) {
        setIsSuccess(true)
      } else {
        setError(
          "Spremanje nove lozinke nije uspjelo. Pokušajte osvježiti stranicu ili ponovno otvoriti poveznicu iz e-maila."
        )
      }
    } catch {
      setError("Došlo je do pogreške. Pokušajte ponovno.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#F2EFE9] p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-3xl border-2 border-[#1E3A5F]/20 bg-white shadow-2xl overflow-hidden my-auto">
        {/* Institucionalno zaglavlje */}
        <div className="bg-gradient-to-r from-[#1E3A5F] to-[#264E82] border-b-2 border-[#CEA369] px-6 py-5 text-white text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1B2B36] border border-[#CEA369]/80 shadow-sm overflow-hidden">
            {settings?.logoUrl ? (
              <img
                src={settings.logoUrl}
                alt="Grb HRD"
                className="h-14 w-14 object-cover"
              />
            ) : (
              <KeyRound className="h-7 w-7 text-[#CEA369]" />
            )}
          </div>
          <span className="inline-flex items-center rounded-full bg-[#CEA369]/20 border border-[#CEA369]/60 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#F3D19C]">
            Dobrodošli u Rodoslovac
          </span>
          <h2 className="mt-2 font-serif text-xl sm:text-2xl font-bold text-white">
            {isSuccess ? "Lozinka je postavljena!" : "Postavite svoju novu lozinku"}
          </h2>
          <p className="mt-1 text-xs text-slate-200">
            {isSuccess
              ? "Vaš korisnički račun u sustavu Hrvatskog rodoslovnog društva je spreman za rad."
              : `Prijavljeni ste kao ${user.name}. Za nastavak rada postavite svoju osobnu lozinku.`}
          </p>
        </div>

        <div className="p-6 space-y-5">
          {/* Jasno i nedvosmisleno istaknuto korisničko ime (Username) */}
          <div className="rounded-2xl border-2 border-[#CEA369] bg-[#FEFCE8] p-4 space-y-2 shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#7C2D12]">
                <UserCheck className="h-4 w-4 text-[#D97706]" />
                Vaše korisničko ime za prijavu (Username)
              </span>
              <button
                type="button"
                onClick={handleCopyUsername}
                className="inline-flex items-center gap-1 rounded-full border border-[#CEA369] bg-white px-2.5 py-0.5 text-[11px] font-bold text-[#1E3A5F] hover:bg-[#EFF5FB] transition-colors"
              >
                {copiedUsername ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-600" /> Kopirano
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" /> Kopiraj
                  </>
                )}
              </button>
            </div>

            <div className="rounded-xl border border-[#1E3A5F]/20 bg-white px-3.5 py-2.5 font-mono text-sm sm:text-base font-bold text-[#1E3A5F] break-all select-all">
              {user.email}
            </div>

            <p className="text-[11px] text-[#7C2D12]/90 leading-relaxed">
              Zapamtite ovo korisničko ime — nakon postavljanja lozinke, u Rodoslovac se ubuduće prijavljujete upravo ovim korisničkim imenom i svojom novom lozinkom.
            </p>
          </div>

          {isSuccess ? (
            <div className="space-y-4 text-center py-2">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <p className="font-serif text-lg font-bold text-[#1B2B36]">
                  Nova lozinka je uspješno spremljena!
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Od sada se prijavljujete korisničkim imenom{" "}
                  <strong className="font-mono text-[#1E3A5F]">{user.email}</strong> i novom lozinkom koju ste upravo postavili.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                <Button
                  type="button"
                  onClick={() => window.location.replace("/")}
                  className="flex-1 h-11 rounded-full bg-[#1E3A5F] hover:bg-[#264E82] text-[#F2EFE9] border-2 border-[#CEA369] font-bold gap-2 shadow-md"
                >
                  <span>Uđi u Rodoslovac</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <CloseActionButton
                  label="Idi na prijavu"
                  showIcon={false}
                  onClick={logout}
                  className="h-11 rounded-full"
                />
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label
                  htmlFor="new-password"
                  className="text-xs uppercase tracking-wider font-bold text-[#1B2B36]"
                >
                  Nova lozinka
                </Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNewPassword ? "text" : "password"}
                    required
                    autoFocus
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Unesite novu lozinku (najmanje 6 znakova)"
                    className="h-11 rounded-xl pr-10 border-[#E8E4DE] bg-[#FBF9F6] focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((v) => !v)}
                    aria-label={showNewPassword ? "Sakrij lozinku" : "Prikaži lozinku"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="confirm-password"
                  className="text-xs uppercase tracking-wider font-bold text-[#1B2B36]"
                >
                  Potvrdite novu lozinku
                </Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ponovite novu lozinku"
                    className="h-11 rounded-xl pr-10 border-[#E8E4DE] bg-[#FBF9F6] focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    aria-label={showConfirmPassword ? "Sakrij potvrdu lozinke" : "Prikaži potvrdu lozinke"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700">
                  {error}
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-3 border-t border-[#E8E4DE]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={logout}
                  className="rounded-full h-10 px-4 border-2 border-slate-300 bg-white text-slate-700 hover:bg-slate-100 gap-1.5 font-semibold"
                >
                  <LogOut className="h-3.5 w-3.5" /> Odjava
                </Button>

                <SaveActionButton
                  type="submit"
                  label="Spremi novu lozinku"
                  loadingLabel="Spremanje..."
                  loading={isSubmitting}
                  className="sm:flex-1 justify-center"
                />
              </div>

              <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground pt-1">
                <ShieldCheck className="h-3.5 w-3.5 text-[#CEA369]" />
                Ne trebate unositi staru ni privremenu lozinku.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
