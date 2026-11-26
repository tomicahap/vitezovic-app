"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { AlertCircle, ArrowRight, Loader2, ShieldCheck } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { useSettings } from "@/contexts/settings-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function InviteActivationPage() {
  const params = useParams<{ token: string }>()
  const router = useRouter()
  const { loginWithInviteToken } = useAuth()
  const { settings } = useSettings()

  const token = typeof params?.token === "string" ? params.token : ""
  const attemptedTokenRef = useRef<string | null>(null)

  const [status, setStatus] = useState<"loading" | "error">("loading")
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    if (!token) {
      setStatus("error")
      setErrorMessage("Poveznica za aktivaciju je nepotpuna.")
      return
    }
    if (attemptedTokenRef.current === token) return
    attemptedTokenRef.current = token

    let cancelled = false
    setStatus("loading")
    setErrorMessage("")

    loginWithInviteToken(token).then((res) => {
      if (cancelled) return
      if (res.ok) {
        router.replace(res.role === "external" ? "/research" : "/")
      } else {
        setStatus("error")
        setErrorMessage(
          res.error || "Poveznica za aktivaciju nije valjana ili je već iskorištena."
        )
      }
    })

    return () => {
      cancelled = true
    }
  }, [token, loginWithInviteToken, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F2EFE9] p-4">
      <Card className="w-full max-w-md border-2 border-[#1E3A5F]/20 bg-white shadow-2xl rounded-3xl overflow-hidden">
        <div className="h-1.5 w-full bg-gradient-to-r from-[#1E3A5F] via-[#CEA369] to-[#1E3A5F]" />
        <CardHeader className="text-center pb-3">
          <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center">
            {settings?.logoUrl ? (
              <img
                src={settings.logoUrl}
                alt="Grb HRD"
                className="h-20 w-20 rounded-full object-cover border-2 border-[#CEA369]/70 shadow-sm"
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-[#1E3A5F] text-[#CEA369] flex items-center justify-center border-2 border-[#CEA369]">
                <ShieldCheck className="h-8 w-8" />
              </div>
            )}
          </div>
          <div className="mx-auto mb-1 inline-flex items-center rounded-full bg-[#1E3A5F] px-3 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#F2EFE9] border border-[#CEA369]/70">
            Sustav „Rodoslovac”
          </div>
          <CardTitle className="font-serif text-2xl text-[#1B2B36]">
            {status === "loading" ? "Automatska prijava u tijeku" : "Aktivacija nije uspjela"}
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Hrvatsko rodoslovno društvo „Pavao Ritter Vitezović”
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-2 pb-7 px-6">
          {status === "loading" ? (
            <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
              <Loader2 className="h-9 w-9 animate-spin text-[#1E3A5F]" />
              <p className="text-sm font-medium text-[#1B2B36]">
                Provjeravamo Vašu pozivnicu i otvaramo zaslon za postavljanje nove lozinke…
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-2xl border border-red-200 bg-red-50/90 p-4 flex items-start gap-3 text-left">
                <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-red-900">Nije moguće aktivirati pozivnicu</p>
                  <p className="text-xs text-red-800 leading-relaxed">{errorMessage}</p>
                </div>
              </div>

              <Link href="/" className="block">
                <Button className="w-full h-11 rounded-full bg-[#1E3A5F] hover:bg-[#264E82] text-[#F2EFE9] border-2 border-[#CEA369] font-bold gap-2">
                  <span>Prijavi se u Rodoslovac</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
