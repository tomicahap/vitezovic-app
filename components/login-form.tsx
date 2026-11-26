"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Lock, Mail, User, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuth } from "@/contexts/auth-context"
import { useSettings } from "@/contexts/settings-context"

const loginSchema = z.object({
  email: z.string().min(1, "Email je obavezan"),
  password: z.string().min(1, "Lozinka je obavezna"),
})

type LoginFormData = z.infer<typeof loginSchema>

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [forgotMode, setForgotMode] = useState(false)
  const [forgotEmail, setForgotEmail] = useState("")
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotError, setForgotError] = useState("")
  const [forgotSuccess, setForgotSuccess] = useState("")

  const { login, isLoading, loginError } = useAuth()
  const { settings } = useSettings()
  const router = useRouter()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    setError("")
    const success = await login(data.email, data.password)
    if (success) {
      router.replace("/")
    } else {
      setError("Neispravni podaci za prijavu")
    }
  }

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setForgotError("")
    setForgotSuccess("")
    const trimmed = forgotEmail.trim()
    if (!trimmed || !trimmed.includes("@")) {
      setForgotError("Unesite valjanu e-mail adresu.")
      return
    }

    setForgotLoading(true)
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        setForgotError(payload?.error || "Slanje poveznice nije uspjelo.")
      } else {
        setForgotSuccess(
          payload?.message ||
            "Ako je upisana e-mail adresa registrirana u sustavu, poslana joj je poveznica za postavljanje nove lozinke."
        )
      }
    } catch {
      setForgotError("Greška u komunikaciji s poslužiteljem.")
    } finally {
      setForgotLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center">
            {settings.logoUrl ? (
              <img
                src={settings.logoUrl}
                alt="Logo"
                className="h-20 w-20 rounded-full object-cover border-2 border-primary/20 shadow-sm"
              />
            ) : (
              <img
                src="/icon.svg"
                alt="Logo"
                className="h-20 w-20"
              />
            )}
          </div>
          <div className="mx-auto mb-1.5 inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-0.5 text-[11px] font-bold uppercase tracking-[0.2em] text-[#b58442]">
            Sustav „Rodoslovac”
          </div>
          <CardTitle className="font-serif text-2xl leading-tight">
            Rodoslovno društvo<br />Pavao Ritter Vitezović
          </CardTitle>
          <CardDescription>
            {forgotMode
              ? "Samostalno postavljanje nove lozinke putem e-pošte"
              : "Prijavite se u sustav Rodoslovac — administrativni portal društva"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {settings.maintenanceMode && (
            <div className="mb-4 rounded-xl border-2 border-amber-400 bg-amber-50 p-4 text-amber-950 shadow-sm">
              <div className="flex items-start gap-3">
                <Wrench className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
                <div className="space-y-1 text-sm">
                  <p className="font-bold text-amber-950 leading-snug">
                    Sustav se trenutno ažurira i nije mu moguće pristupiti. Kontaktirajte administratora.
                  </p>
                  <p className="text-xs text-amber-800">
                    Prijava je trenutno dopuštena isključivo administratoru sustava.
                  </p>
                </div>
              </div>
            </div>
          )}

          {forgotMode ? (
            <form onSubmit={handleForgotSubmit} className="space-y-4">
              {forgotError && (
                <Alert variant="destructive">
                  <AlertDescription>{forgotError}</AlertDescription>
                </Alert>
              )}

              {forgotSuccess ? (
                <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-xs text-emerald-950 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-emerald-800">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    Zahtjev je obrađen
                  </div>
                  <p className="leading-relaxed">{forgotSuccess}</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Upišite e-mail adresu svog članskog računa i poslat ćemo Vam jednokratnu poveznicu s kojom ćete automatski ući i postaviti novu lozinku.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="forgot-email">Vaša e-mail adresa</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="forgot-email"
                        type="email"
                        required
                        autoFocus
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="ime.prezime@domena.hr"
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full gap-2" disabled={forgotLoading}>
                    <KeyRound className="h-4 w-4" />
                    {forgotLoading ? "Slanje poveznice..." : "Pošalji poveznicu za novu lozinku"}
                  </Button>
                </>
              )}

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setForgotMode(false)
                  setForgotError("")
                  setForgotSuccess("")
                }}
                className="w-full gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Natrag na prijavu
              </Button>
            </form>
          ) : (
            <>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {(loginError || error) && (
                  <Alert variant="destructive">
                    <AlertDescription>{loginError || error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Korisničko ime ili Email</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="text"
                      placeholder="Unesite korisničko ime ili email"
                      className="pl-10"
                      {...register("email")}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-sm text-red-600">{errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Lozinka</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Unesite lozinku"
                      className="pl-10 pr-10"
                      {...register("password")}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-sm text-red-600">{errors.password.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? "Prijava..." : "Prijavi se"}
                </Button>
              </form>

              <div className="mt-5 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setForgotMode(true)
                    setError("")
                  }}
                  className="text-xs font-semibold text-[#1E3A5F] hover:text-[#1F77C5] hover:underline transition-colors"
                >
                  Zaboravili ste lozinku? Postavite novu putem e-pošte
                </button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
