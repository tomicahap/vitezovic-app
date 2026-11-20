"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DateOrYearInput } from "@/components/ui/date-or-year-input"
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileDown,
  Loader2,
  Lock,
  Send,
  ShieldAlert,
  ShieldCheck,
  User,
} from "lucide-react"
import { formatDateTimeDMY } from "@/lib/utils"

interface PublicMemberProfile {
  id: number
  firstName: string
  lastName: string
  name: string
  maidenName: string
  oib: string
  birthDate: string
  birthPlace: string
  birthCountry: string
  email: string
  phone: string
  landlinePhone: string
  address: string
  occupation: string
  workExperience: string
  hobbiesSkills: string
  foreignLanguages: string
  researchAreas: string[]
  joinDate: string
  lastMissingDataEmailAt?: string | null
  dataFormViewedAt?: string | null
  dataFormSubmittedAt?: string | null
  dataFormUpdatedFields?: string[]
}

// Sprječava dvostruko slanje GET zahtjeva unutar iste sesije (npr. React Strict Mode),
// dok svako pravo osvježavanje stranice ili novi tab stvara novi zahtjev i biva odbijeno na poslužitelju.
const initialTokenRequests = new Map<
  string,
  Promise<{ ok: boolean; status: number; data: any }>
>()

function fetchInitialFormOnce(token: string) {
  let promise = initialTokenRequests.get(token)
  if (!promise) {
    promise = fetch(`/api/public/member-data/${encodeURIComponent(token)}`, {
      cache: "no-store",
    }).then(async (res) => {
      const data = await res.json().catch(() => ({}))
      return { ok: res.ok, status: res.status, data }
    })
    initialTokenRequests.set(token, promise)
  }
  return promise
}

export default function PublicMemberDataPage() {
  const params = useParams()
  const token = String(params?.token || "")

  const [loading, setLoading] = React.useState(true)
  const [errorMsg, setErrorMsg] = React.useState("")
  const [profile, setProfile] = React.useState<PublicMemberProfile | null>(null)
  const [researchInput, setResearchInput] = React.useState("")
  const [missingKeys, setMissingKeys] = React.useState<Set<string>>(new Set())
  const [missingLabels, setMissingLabels] = React.useState<string[]>([])
  const [singleUse, setSingleUse] = React.useState(false)
  const [submitNonce, setSubmitNonce] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [submitSuccess, setSubmitSuccess] = React.useState<{
    submittedAt: string
    updatedFields: string[]
    pdfBase64?: string | null
    pdfFilename?: string | null
  } | null>(null)

  React.useEffect(() => {
    if (!token) return
    let cancelled = false
    setLoading(true)
    fetchInitialFormOnce(token)
      .then(({ ok, data }) => {
        if (cancelled) return
        if (!ok) {
          throw new Error(data?.error || "Neispravan ili istekao obrazac.")
        }
        setProfile(data.member)
        setResearchInput((data.member?.researchAreas || []).join(", "))
        const keys = new Set<string>((data.missingFields || []).map((f: any) => f.key))
        setMissingKeys(keys)
        setMissingLabels((data.missingFields || []).map((f: any) => f.label))
        setSingleUse(Boolean(data.singleUse))
        setSubmitNonce(data.submitNonce || null)
      })
      .catch((err) => {
        if (cancelled) return
        setErrorMsg(err.message || "Pogreška prilikom učitavanja obrasca.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  React.useEffect(() => {
    if (!singleUse || !profile || submitSuccess) return
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [singleUse, profile, submitSuccess])

  const handleDownloadUpdatedPdf = React.useCallback(() => {
    if (!submitSuccess?.pdfBase64) return
    try {
      const binary = window.atob(submitSuccess.pdfBase64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
      }
      const blob = new Blob([bytes], { type: "application/pdf" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = submitSuccess.pdfFilename || "Evidencijski_list.pdf"
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      console.error("Failed to download PDF:", err)
    }
  }, [submitSuccess])

  const handleChange = (field: keyof PublicMemberProfile, value: string) => {
    setProfile((prev) => (prev ? { ...prev, [field]: value } : null))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile || submitSuccess) return

    setSubmitting(true)
    setErrorMsg("")

    try {
      const res = await fetch(`/api/public/member-data/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...profile,
          researchAreas: researchInput,
          submitNonce,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Spremanje nije uspjelo.")
      }
      setProfile(data.member)
      setResearchInput((data.member?.researchAreas || []).join(", "))
      setMissingKeys(new Set((data.missingFields || []).map((f: any) => f.key)))
      setMissingLabels((data.missingFields || []).map((f: any) => f.label))
      setSubmitNonce(null)
      setSubmitSuccess({
        submittedAt: data.submittedAt,
        updatedFields: data.updatedFields || [],
        pdfBase64: data.pdfBase64 || null,
        pdfFilename: data.pdfFilename || null,
      })
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch (err: any) {
      setErrorMsg(err.message || "Pogreška pri predaji obrasca.")
    } finally {
      setSubmitting(false)
    }
  }

  const fieldHighlight = (key: string) =>
    missingKeys.has(key)
      ? "border-red-300 bg-red-50/40 focus-visible:ring-red-400"
      : ""

  const MissingTag = ({ fieldKey }: { fieldKey: string }) =>
    missingKeys.has(fieldKey) ? (
      <span className="ml-1.5 inline-flex items-center rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
        Nedostaje
      </span>
    ) : null

  const activePdfUrl = submitNonce
    ? `/api/public/member-data/${encodeURIComponent(token)}/pdf?nonce=${encodeURIComponent(submitNonce)}`
    : `/api/public/member-data/${encodeURIComponent(token)}/pdf`

  return (
    <div className="min-h-screen bg-[#F2EFE9] py-6 px-4 sm:px-6">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Zaglavlje Društva */}
        <div className="rounded-2xl bg-[#1B2B36] text-white p-6 sm:p-8 border-b-4 border-[#CEA369] shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-widest text-[#CEA369]">
                Hrvatsko rodoslovno društvo „Pavao Ritter Vitezović”
              </p>
              <h1 className="font-serif text-2xl sm:text-3xl font-bold text-white">
                Osobni obrazac za dopunu podataka člana
              </h1>
              {profile && (
                <p className="text-sm text-slate-300 flex items-center gap-2 pt-1">
                  <User className="h-4 w-4 text-[#CEA369]" />
                  Član: <strong className="text-white">{profile.name}</strong>
                </p>
              )}
            </div>
            {profile && !submitSuccess && (
              <a
                href={activePdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0"
              >
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2 bg-white/10 border-[#CEA369]/50 text-white hover:bg-white/20 hover:text-white"
                >
                  <FileDown className="h-4 w-4 text-[#CEA369]" />
                  Preuzmi moj PDF karton
                </Button>
              </a>
            )}
          </div>
        </div>

        {loading && (
          <div className="rounded-2xl border border-border bg-white p-12 text-center shadow-sm">
            <Loader2 className="h-8 w-8 animate-spin text-[#1B2B36] mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Učitavanje vaših podataka...</p>
          </div>
        )}

        {!loading && errorMsg && !profile && (
          <div className="rounded-2xl border-2 border-red-200 bg-white p-8 text-center shadow-sm space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-700">
              <Lock className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-bold text-red-900">
              Pristup obrascu nije dopušten
            </h2>
            <p className="text-sm text-red-800 max-w-xl mx-auto leading-relaxed">
              {errorMsg}
            </p>
            <p className="text-xs text-muted-foreground pt-1">
              Iz sigurnosnih razloga svaka poveznica vrijedi za jedan pristup i trajno se poništava nakon upotrebe ili predaje podataka.
            </p>
          </div>
        )}

        {!loading && profile && submitSuccess && (
          <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-6 sm:p-8 shadow-sm space-y-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-7 w-7 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-2">
                <h2 className="text-lg font-bold text-emerald-950">
                  Hvala! Vaši podaci su uspješno spremljeni i upisani u bazu društva.
                </h2>
                <p className="text-xs text-emerald-800 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Evidentirano vrijeme predaje: {formatDateTimeDMY(submitSuccess.submittedAt)}
                </p>
                {submitSuccess.updatedFields.length > 0 && (
                  <p className="text-xs text-emerald-900 pt-1">
                    <strong>Dopunjena / ažurirana polja:</strong>{" "}
                    {submitSuccess.updatedFields.join(", ")}
                  </p>
                )}
                <div className="rounded-xl border border-emerald-200 bg-white/80 p-3 text-xs text-emerald-950 flex items-start gap-2">
                  <Lock className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
                  <span>
                    Vaša jednokratna poveznica sada je <strong>trajno poništena</strong>. Ponovni pristup obrascu i daljnje izmjene putem ove poveznice više nisu moguće.
                  </span>
                </div>
                {submitSuccess.pdfBase64 && (
                  <div className="pt-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleDownloadUpdatedPdf}
                      className="gap-1.5 bg-white border-emerald-300 text-emerald-900 hover:bg-emerald-100"
                    >
                      <FileDown className="h-3.5 w-3.5" />
                      Preuzmi ažurirani PDF evidencijski list
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {!loading && profile && !submitSuccess && (
          <form onSubmit={handleSubmit} className="space-y-6">
            {singleUse && (
              <div className="rounded-2xl border-2 border-red-300 bg-red-50/90 p-4 sm:p-5 shadow-xs flex items-start gap-3">
                <ShieldAlert className="h-5 w-5 text-red-700 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs sm:text-sm text-red-950">
                  <p className="font-bold">
                    Važna napomena — jednokratni pristup (1 ulaz)
                  </p>
                  <p className="text-red-900 leading-relaxed">
                    Ova osobna poveznica ograničena je na <strong>samo jedan pristup</strong>. Nemojte osvježavati ni zatvarati ovu stranicu prije nego kliknete gumb <strong>„Spremi i predaj podatke”</strong> na dnu obrasca — svaki sljedeći pristup nije dopušten, a nakon predaje poveznica se trajno poništava.
                  </p>
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                {errorMsg}
              </div>
            )}

            {/* Sažetak polja koja nedostaju */}
            {missingLabels.length > 0 ? (
              <div className="rounded-2xl border border-amber-300 bg-amber-50/90 p-5 shadow-xs space-y-2">
                <p className="text-sm font-bold text-amber-950">
                  Polja koja nam trenutno nedostaju za Vaš karton ({missingLabels.length}):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {missingLabels.map((lbl) => (
                    <Badge key={lbl} className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100 text-xs">
                      {lbl}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-amber-900/90 pt-1">
                  Polja označena crvenim okvirom i oznakom „Nedostaje” trenutno su prazna. Ispod možete provjeriti i po potrebi ispraviti i sve ostale upisane podatke.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs text-emerald-900 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                Sva tražena polja su popunjena! Ako želite, možete pregledati podatke ispod, eventualno ih ispraviti i jednokratno potvrditi predaju.
              </div>
            )}

            {/* 1. Osobni podaci i rođenje */}
            <div className="rounded-2xl border border-border bg-white p-5 sm:p-6 shadow-sm space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground border-b border-border pb-2">
                1. Osobni podaci i rođenje
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Ime</Label>
                  <Input value={profile.firstName} onChange={(e) => handleChange("firstName", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Prezime</Label>
                  <Input value={profile.lastName} onChange={(e) => handleChange("lastName", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Djevojačko prezime <MissingTag fieldKey="maidenName" />
                  </Label>
                  <Input
                    value={profile.maidenName}
                    onChange={(e) => handleChange("maidenName", e.target.value)}
                    placeholder="Ako je primjenjivo"
                    className={fieldHighlight("maidenName")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    OIB <MissingTag fieldKey="oib" />
                  </Label>
                  <Input
                    value={profile.oib}
                    onChange={(e) => handleChange("oib", e.target.value)}
                    placeholder="11 znamenki"
                    maxLength={11}
                    className={fieldHighlight("oib")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Datum rođenja (DD/MM/YYYY) <MissingTag fieldKey="birthDate" />
                  </Label>
                  <DateOrYearInput
                    value={profile.birthDate}
                    onChange={(val) => handleChange("birthDate", val)}
                    placeholder="DD/MM/YYYY"
                    inputClassName={fieldHighlight("birthDate")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Mjesto rođenja <MissingTag fieldKey="birthPlace" />
                  </Label>
                  <Input
                    value={profile.birthPlace}
                    onChange={(e) => handleChange("birthPlace", e.target.value)}
                    placeholder="Grad / naselje"
                    className={fieldHighlight("birthPlace")}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                  <Label className="text-xs">
                    Zemlja rođenja <MissingTag fieldKey="birthCountry" />
                  </Label>
                  <Input
                    value={profile.birthCountry}
                    onChange={(e) => handleChange("birthCountry", e.target.value)}
                    placeholder="Npr. Hrvatska"
                    className={fieldHighlight("birthCountry")}
                  />
                </div>
              </div>
            </div>

            {/* 2. Kontakt i prebivalište */}
            <div className="rounded-2xl border border-border bg-white p-5 sm:p-6 shadow-sm space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground border-b border-border pb-2">
                2. Kontakt i prebivalište
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Email adresa</Label>
                  <Input
                    type="email"
                    value={profile.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Mobitel <MissingTag fieldKey="phone" />
                  </Label>
                  <Input
                    value={profile.phone}
                    onChange={(e) => handleChange("phone", e.target.value)}
                    placeholder="Npr. 091 123 4567"
                    className={fieldHighlight("phone")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Telefon (fiksni) <MissingTag fieldKey="landlinePhone" />
                  </Label>
                  <Input
                    value={profile.landlinePhone}
                    onChange={(e) => handleChange("landlinePhone", e.target.value)}
                    placeholder="Npr. 01 123 4567"
                    className={fieldHighlight("landlinePhone")}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                  <Label className="text-xs">
                    Adresa prebivališta <MissingTag fieldKey="address" />
                  </Label>
                  <Input
                    value={profile.address}
                    onChange={(e) => handleChange("address", e.target.value)}
                    placeholder="Ulica, kućni broj, poštanski broj i grad"
                    className={fieldHighlight("address")}
                  />
                </div>
              </div>
            </div>

            {/* 3. Zanimanje, vještine i rodoslovna istraživanja */}
            <div className="rounded-2xl border border-border bg-white p-5 sm:p-6 shadow-sm space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground border-b border-border pb-2">
                3. Zanimanje, iskustvo, vještine i rodoslovna istraživanja
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Zvanje i zanimanje <MissingTag fieldKey="occupation" />
                  </Label>
                  <Input
                    value={profile.occupation}
                    onChange={(e) => handleChange("occupation", e.target.value)}
                    placeholder="Npr. prof. povijesti, dipl. ing."
                    className={fieldHighlight("occupation")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Strani jezici <MissingTag fieldKey="foreignLanguages" />
                  </Label>
                  <Input
                    value={profile.foreignLanguages}
                    onChange={(e) => handleChange("foreignLanguages", e.target.value)}
                    placeholder="Npr. engleski, njemački, latinski..."
                    className={fieldHighlight("foreignLanguages")}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">
                    Radno iskustvo <MissingTag fieldKey="workExperience" />
                  </Label>
                  <Textarea
                    rows={2}
                    value={profile.workExperience}
                    onChange={(e) => handleChange("workExperience", e.target.value)}
                    placeholder="Ukratko navedite Vaše radno iskustvo..."
                    className={fieldHighlight("workExperience")}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">
                    Hobi / vještine i znanja <MissingTag fieldKey="hobbiesSkills" />
                  </Label>
                  <Textarea
                    rows={2}
                    value={profile.hobbiesSkills}
                    onChange={(e) => handleChange("hobbiesSkills", e.target.value)}
                    placeholder="Npr. čitanje glagoljice, gotice, paleografija, rad na računalu..."
                    className={fieldHighlight("hobbiesSkills")}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">
                    Lokacije i prezimena koja istražuje <MissingTag fieldKey="researchAreas" />
                  </Label>
                  <Textarea
                    rows={2}
                    value={researchInput}
                    onChange={(e) => setResearchInput(e.target.value)}
                    placeholder="Upišite prezimena i mjesta/županije odvojena zarezom (npr. Horvat, Kovačić, Zagorje, Lika)"
                    className={fieldHighlight("researchAreas")}
                  />
                </div>
              </div>
            </div>

            {/* 4. Ostali podaci — samo Datum upisa u društvo */}
            <div className="rounded-2xl border border-border bg-white p-5 sm:p-6 shadow-sm space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground border-b border-border pb-2">
                4. Ostali podaci
              </h2>
              <div className="max-w-xs space-y-1.5">
                <Label className="text-xs">
                  Datum upisa u društvo (DD/MM/YYYY) <MissingTag fieldKey="joinDate" />
                </Label>
                <DateOrYearInput
                  value={profile.joinDate}
                  onChange={(val) => handleChange("joinDate", val)}
                  placeholder="DD/MM/YYYY"
                  inputClassName={fieldHighlight("joinDate")}
                />
              </div>
            </div>

            {/* Gumb za predaju */}
            <div className="sticky bottom-4 z-20 rounded-2xl border border-border bg-white/95 backdrop-blur p-4 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Klikom na gumb podaci se automatski spremaju u evidenciju HRD „Pavao Ritter Vitezović”.
              </p>
              <Button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto gap-2 bg-[#1B2B36] hover:bg-[#1B2B36]/90 text-white px-6 h-11 font-semibold"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Spremanje u tijeku...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Spremi i predaj podatke
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
