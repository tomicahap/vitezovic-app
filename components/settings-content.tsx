"use client"

import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Eye, EyeOff, Lock, Save, Upload, Settings as SettingsIcon, Plus, MapPin, List, Mail, Database, Download, RefreshCw, FileStack, GripVertical, Trash, ChevronDown, ChevronUp, Clock, FileArchive, Trash2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/contexts/auth-context"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useSettings } from "@/contexts/settings-context"
import { useSearchParams } from "next/navigation"
import { generateId } from "@/lib/utils"
import { ContributorTemplate, ContributorField } from "@/contexts/settings-context"

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Trenutna lozinka je obavezna"),
  newPassword: z.string().min(6, "Nova lozinka mora imati najmanje 6 znakova"),
  confirmPassword: z.string().min(1, "Potvrda lozinke je obavezna"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Lozinke se ne podudaraju",
  path: ["confirmPassword"],
})

type PasswordFormData = z.infer<typeof passwordSchema>

export function SettingsContent() {
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [success, setSuccess] = useState("")
  const [error, setError] = useState("")
  const [notification, setNotification] = useState("")
  const [logoError, setLogoError] = useState("")
  const [newFunction, setNewFunction] = useState("")
  const [newMeetingType, setNewMeetingType] = useState("")
  const [newMeetingLocation, setNewMeetingLocation] = useState("")
  const { updatePassword, isLoading, user } = useAuth()
  const { 
    settings, 
    setLogoUrl, 
    setOverdueAfterDays, 
    setExpiredAfterDays, 
    addFunction, 
    removeFunction, 
    setGoogleDriveUrl, 
    setGoogleDriveSettings,
    setGmailMailbox,
    refreshSettings,
    addMeetingType,
    removeMeetingType,
    addMeetingLocation,
    removeMeetingLocation,
    setAdminBackupSettings,
    setSMTPSettings,
    setPaymentEmailSettings,
    setContributorTemplates,
    setAutoBackupIntervalDays,
  } = useSettings()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  
  const [overdueDays, setOverdueDays] = useState(settings.overdueAfterDays)
  const [inactiveDays, setInactiveDays] = useState(settings.expiredAfterDays)
  const [driveUrl, setDriveUrl] = useState(settings.googleDriveUrl || "")
  const [backupEmail, setBackupEmail] = useState(settings.adminBackupEmail || "")
  const [backupPassword, setBackupPassword] = useState(settings.adminBackupPassword || "")
  const [vaultNotes, setVaultNotesLocal] = useState(settings.vaultNotes || "")
  const [zipBackups, setZipBackups] = useState<any[]>([])
  const [isCreatingZip, setIsCreatingZip] = useState(false)
  const [autoBackupDays, setAutoBackupDays] = useState(settings.autoBackupIntervalDays || 0)
  
  const [logoPreview, setLogoPreview] = useState(settings.logoUrl || "")
  const [smtpConfig, setSmtpConfig] = useState({
    smtpHost: settings.smtpHost || "",
    smtpPort: settings.smtpPort || 587,
    smtpUser: settings.smtpUser || "",
    smtpPass: settings.smtpPass || "",
    smtpFrom: settings.smtpFrom || "",
    smtpSecure: !!settings.smtpSecure
  })

  const [emailConfig, setEmailConfig] = useState({
    subject: settings.paymentEmailSubject || "",
    body: settings.paymentEmailBody || "",
    slipUrl: settings.paymentSlipUrl || "",
    qrUrl: settings.paymentQrUrl || "",
    signature: settings.paymentEmailSignature || ""
  })

  const [templates, setTemplates] = useState(settings.projectContributorTemplates || [])
  const [editingTemplate, setEditingTemplate] = useState<null | string>(null)
  const [connectionMethod, setConnectionMethod] = useState<'oauth' | 'service_account'>('service_account')
  const [showClientSecret, setShowClientSecret] = useState(false)

  const searchParams = useSearchParams()
  const defaultTab = searchParams.get('tab') || 'general'

  useEffect(() => {
    setOverdueDays(settings.overdueAfterDays)
    setInactiveDays(settings.expiredAfterDays)
    setDriveUrl(settings.googleDriveUrl || "")
    setBackupEmail(settings.adminBackupEmail || "")
    setBackupPassword(settings.adminBackupPassword || "")
    setVaultNotesLocal(settings.vaultNotes || "")
    setAutoBackupDays(settings.autoBackupIntervalDays || 0)
    setLogoPreview(settings.logoUrl || "")
    setSmtpConfig({
      smtpHost: settings.smtpHost || "",
      smtpPort: settings.smtpPort || 587,
      smtpUser: settings.smtpUser || "",
      smtpPass: settings.smtpPass || "",
      smtpFrom: settings.smtpFrom || "",
      smtpSecure: !!settings.smtpSecure
    })
    setEmailConfig({
      subject: settings.paymentEmailSubject || "",
      body: settings.paymentEmailBody || "",
      slipUrl: settings.paymentSlipUrl || "",
      qrUrl: settings.paymentQrUrl || "",
      signature: settings.paymentEmailSignature || ""
    })
    setTemplates(settings.projectContributorTemplates || [])
    
    if (settings.googleClientId) {
      setConnectionMethod('oauth')
    }
  }, [settings])

  useEffect(() => {
    const googleAuth = searchParams.get('google_auth')
    const details = searchParams.get('details')
    if (googleAuth === 'success') {
      setNotification("Google račun je uspješno autoriziran i povezan!")
    } else if (googleAuth === 'error') {
      setLogoError(`Greška pri autorizaciji Google računa: ${decodeURIComponent(details || 'Nepoznata greška')}`)
    }
  }, [searchParams])

  const fetchZipBackups = async () => {
    try {
      const res = await fetch('/api/admin/backup-zip', {
        headers: { 'Authorization': `Bearer ${user?.role || 'admin'}` }
      })
      if (res.ok) {
        const data = await res.json()
        setZipBackups(data)
      }
    } catch (err) {
      console.error("Error fetching zip backups:", err)
    }
  }

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchZipBackups()
    }
  }, [user])

  const handleAutoBackupChange = (value: string) => {
    const days = parseInt(value, 10)
    setAutoBackupDays(days)
    setAutoBackupIntervalDays(days)
    setNotification(`Interval automatskog backupa postavljen na ${days === 0 ? 'Isključeno' : days + ' dana'}.`)
  }

  const handleCreateCompleteBackup = async () => {
    setIsCreatingZip(true)
    setNotification("Pokretanje cjelokupnog backupa (baza + slike)...")
    try {
      const res = await fetch('/api/admin/backup-zip', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${user?.role || 'admin'}`,
          'Content-Type': 'application/json'
        }
      })
      const data = await res.json()
      if (data.success) {
        let msg = `Cjelokupni backup stvoren: ${data.filename}.`
        if (data.uploadedToDrive) {
          msg += ' Uspješno poslan na Google Drive.'
        } else if (data.driveError) {
          msg += ` Greška pri slanju na Google Drive: ${data.driveError}`
        }
        setNotification(msg)
        fetchZipBackups()
      } else {
        setLogoError(data.error || "Greška pri kreiranju backupa.")
      }
    } catch (err) {
      setLogoError("Komunikacijska greška s poslužiteljem.")
    } finally {
      setIsCreatingZip(false)
    }
  }

  const handleDeleteZipBackup = async (filename: string) => {
    if (!confirm(`Jeste li sigurni da želite trajno obrisati sigurnosnu kopiju ${filename} s poslužitelja?`)) return
    
    try {
      const res = await fetch(`/api/admin/backup-zip?filename=${filename}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${user?.role || 'admin'}` }
      })
      const data = await res.json()
      if (data.success) {
        setNotification("Sigurnosna kopija uspješno obrisana s diska.")
        fetchZipBackups()
      } else {
        setLogoError(data.error || "Greška pri brisanju sigurnosne kopije.")
      }
    } catch (err) {
      setLogoError("Komunikacijska greška s poslužiteljem.")
    }
  }

  const handleDownloadZipBackup = (filename: string) => {
    window.location.href = `/api/admin/backup-zip?action=download&filename=${filename}&role=${user?.role || 'admin'}`
  }

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  })

  const onSubmit = async (data: PasswordFormData) => {
    setError("")
    setSuccess("")
    setNotification("")

    const success = await updatePassword(data.currentPassword, data.newPassword)
    if (success) {
      setSuccess("Lozinka je uspješno promijenjena")
      reset()
    } else {
      setError("Trenutna lozinka je netočna")
    }
  }

  const onLogoChange = (file: File) => {
    setLogoError("")
    setNotification("")

    if (file.size > 500 * 1024) {
      setLogoError("Logo je prevelik (maks. 500KB).")
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const base64 = e.target?.result as string
      setLogoPreview(base64)
    }
    reader.onerror = () => {
      setLogoError("Greška pri čitanju datoteke.")
    }
    reader.readAsDataURL(file)
  }

  const handleSaveLogo = () => {
    setLogoUrl(logoPreview)
    setNotification("Logo je uspješno spremljen.")
  }

  const saveThresholds = () => {
    setLogoError("")
    setSuccess("")
    setNotification("")

    if (overdueDays < 1 || inactiveDays < 1 || overdueDays >= inactiveDays) {
      setLogoError("Prag za DUG mora biti manji od praga za NEAKTIVAN, a oba moraju biti veća od 0.")
      return
    }

    setOverdueAfterDays(overdueDays)
    setExpiredAfterDays(inactiveDays)
    setNotification("Pragovi članstva su uspješno spremljeni.")
  }

  const handleAddFunction = () => {
    if (!newFunction.trim()) {
      setLogoError("Unesite naziv funkcije.")
      return
    }

    addFunction(newFunction.trim())
    setNewFunction("")
    setNotification("Funkcija je dodana u društvo.")
  }

  const handleSaveBackupAdmin = () => {
    setAdminBackupSettings(backupEmail || null, backupPassword || null)
    setNotification("Postavke rezervnog administratora su spremljene.")
  }

  const { setVaultNotes } = useSettings()
  const handleSaveVault = () => {
    setVaultNotes(vaultNotes)
    setNotification("Bilješke u trezoru su uspješno spremljene.")
  }

  const handleSaveSMTP = () => {
    setSMTPSettings({
      smtpHost: smtpConfig.smtpHost,
      smtpPort: smtpConfig.smtpPort,
      smtpUser: smtpConfig.smtpUser,
      smtpPass: smtpConfig.smtpPass,
      smtpFrom: smtpConfig.smtpFrom,
      smtpSecure: smtpConfig.smtpSecure
    })
    setNotification("SMTP postavke su spremljene.")
  }

  const handleSaveEmailConfig = () => {
    setPaymentEmailSettings({
      paymentEmailSubject: emailConfig.subject,
      paymentEmailBody: emailConfig.body,
      paymentSlipUrl: emailConfig.slipUrl,
      paymentQrUrl: emailConfig.qrUrl,
      paymentEmailSignature: emailConfig.signature
    })
    setNotification("Postavke e-mail obavijesti su spremljene.")
  }

  const handleImageUpload = (file: File, target: 'slip' | 'qr') => {
    if (file.size > 1024 * 1024) {
      setLogoError("Slika je prevelika (maks. 1MB).")
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      const base64 = e.target?.result as string
      if (target === 'slip') setEmailConfig(p => ({ ...p, slipUrl: base64 }))
      else setEmailConfig(p => ({ ...p, qrUrl: base64 }))
    }
    reader.readAsDataURL(file)
  }

  return (
    <main className="flex-1 overflow-auto">
      <div className="p-4 sm:p-8">
        <div className="mb-8">
          <h2 className="font-serif text-3xl sm:text-4xl font-bold">Postavke</h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Konfigurirajte aplikaciju, sigurnost i parametre članstva.
          </p>
        </div>

        <Tabs defaultValue={defaultTab} className="space-y-6">
          <TabsList className={`flex md:grid w-full overflow-x-auto md:overflow-x-visible whitespace-nowrap scrollbar-none justify-start md:justify-center ${user?.role === 'admin' ? 'md:grid-cols-7' : 'md:grid-cols-4'} gap-1 rounded-full bg-muted p-1`}>
            <TabsTrigger value="general" className="text-xs px-3 py-1.5 flex-shrink-0">Opće</TabsTrigger>
            <TabsTrigger value="meetings-config" className="text-xs px-3 py-1.5 flex-shrink-0">Sjednice</TabsTrigger>
            <TabsTrigger value="email-notifications" className="text-xs px-3 py-1.5 flex-shrink-0">E-mail</TabsTrigger>
            <TabsTrigger value="security" className="text-xs px-3 py-1.5 flex-shrink-0">Sigurnost</TabsTrigger>
            {user?.role === 'admin' && <TabsTrigger value="templates" className="text-xs px-3 py-1.5 flex-shrink-0">Projekti</TabsTrigger>}
            {user?.role === 'admin' && <TabsTrigger value="integrations" className="text-xs px-3 py-1.5 flex-shrink-0">Integracije</TabsTrigger>}
            {user?.role === 'admin' && <TabsTrigger value="vault" className="text-xs px-3 py-1.5 flex-shrink-0">Trezor</TabsTrigger>}
          </TabsList>

          <TabsContent value="general" className="space-y-6">
            {logoError && (
              <Alert variant="destructive">
                <AlertDescription>{logoError}</AlertDescription>
              </Alert>
            )}
            {notification && (
              <Alert>
                <AlertDescription>{notification}</AlertDescription>
              </Alert>
            )}

            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Logo društva</CardTitle>
                  <CardDescription>Učitajte logo veličine do 200x200 px.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    {logoPreview ? (
                      <img src={logoPreview} alt="Logo društva" className="h-24 w-24 rounded-lg border border-border object-cover" />
                    ) : (
                      <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-dashed border-border bg-background text-muted-foreground">
                        <SettingsIcon className="h-10 w-10" />
                      </div>
                    )}
                    <div className="space-y-3">
                      <Button variant="outline" className="gap-2" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="h-4 w-4" />
                        Učitaj logo
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png, image/jpeg"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0]
                          if (file) onLogoChange(file)
                        }}
                      />
                       <Button 
                        variant="default" 
                        size="sm" 
                        className="gap-2 mt-2" 
                        onClick={handleSaveLogo}
                        disabled={logoPreview === settings.logoUrl}
                      >
                        <Save className="h-4 w-4" /> Spremi Logo
                      </Button>
                      <p className="text-sm text-muted-foreground">Preporučeno: kvadratna slika, max 200x200 px.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Pragovi članstva</CardTitle>
                  <CardDescription>
                    Članstvo počinje datumom prve uplate. Definirajte nakon koliko dana od posljednje uplate član
                    prelazi u status "Dug" (zakasnjelo plaćanje), odnosno kada postaje "Neaktivan" (brisanje iz
                    aktivnog članstva).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="overdueDays">
                        Dana od zadnje uplate → Status <span className="font-bold text-red-600">DUG</span>
                      </Label>
                      <div className="flex items-center gap-3">
                        <Input
                          id="overdueDays"
                          type="number"
                          min={1}
                          className="w-32"
                          value={overdueDays}
                          onChange={(e) => setOverdueDays(Number(e.target.value))}
                        />
                        <span className="text-sm text-muted-foreground">dana (npr. 365 = 1 godina)</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="inactiveDays">
                        Dana od zadnje uplate → Status <span className="font-bold text-gray-600">Neaktivan</span>
                      </Label>
                      <div className="flex items-center gap-3">
                        <Input
                          id="inactiveDays"
                          type="number"
                          min={1}
                          className="w-32"
                          value={inactiveDays}
                          onChange={(e) => setInactiveDays(Number(e.target.value))}
                        />
                        <span className="text-sm text-muted-foreground">dana (npr. 730 = 2 godine)</span>
                      </div>
                    </div>
                    <div className="rounded-xl bg-muted/60 border border-border px-4 py-3 text-xs text-muted-foreground">
                      <strong>Primjer:</strong> Ako je prag DUG = 365, a NEAKTIVAN = 730 dana:<br />
                      Uplata 15. siječnja 2024. → DUG od 15. siječnja 2025. → Neaktivan od 15. siječnja 2026.
                    </div>
                    <Button onClick={saveThresholds} className="gap-2">
                      <Save className="h-4 w-4" /> Spremi pragove
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="xl:col-span-2">
                <CardHeader>
                  <CardTitle>Funkcije društva</CardTitle>
                  <CardDescription>
                    Definirajte uloge koje članovi mogu preuzeti te ih kasnije dodijelite u kartici člana.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                    <Input
                      placeholder="Nova funkcija (npr. Tajnik)"
                      value={newFunction}
                      onChange={(event) => setNewFunction(event.target.value)}
                    />
                    <Button className="gap-2" onClick={handleAddFunction}>
                      <Plus className="h-4 w-4" />
                      Dodaj
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {settings.availableFunctions.length > 0 ? (
                      <div className="grid gap-2">
                        {settings.availableFunctions.map((fn) => (
                          <div key={fn} className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3">
                            <span>{fn}</span>
                            <button
                              type="button"
                              onClick={() => removeFunction(fn)}
                              className="rounded-lg border border-border px-3 py-2 text-xs text-red-700 hover:bg-red-50"
                            >
                              Ukloni
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Nema definiranih funkcija.</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="xl:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-primary" /> Sigurnosna kopija i oporavak (Backup & Restore)
                  </CardTitle>
                  <CardDescription>
                    Izvezite cijelu bazu podataka na svoje računalo ili vratite podatke iz postojeće sigurnosne kopije.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-4 rounded-xl border border-border bg-muted/30 p-6">
                      <div className="space-y-1">
                        <h4 className="font-semibold text-foreground">Izvoz baze podataka (.db)</h4>
                        <p className="text-sm text-muted-foreground">Preuzmite aktivnu SQLite bazu podataka sa svim članovima, sjednicama i postavkama.</p>
                      </div>
                      <Button 
                        onClick={() => {
                          window.location.href = '/api/settings/backup?download=true'
                          setNotification("Započeto preuzimanje baze podataka.")
                        }}
                        className="w-full gap-2 rounded-xl" 
                        variant="outline"
                      >
                        <Download className="h-4 w-4" /> Preuzmi bazu (.db)
                      </Button>
                    </div>

                    <div className="space-y-4 rounded-xl border border-border bg-muted/30 p-6">
                      <div className="space-y-1">
                        <h4 className="font-semibold text-foreground">Uvoz baze podataka (.db)</h4>
                        <p className="text-sm text-muted-foreground font-medium text-red-600">⚠️ Upozorenje: Ovo će prebrisati SVE trenutne podatke!</p>
                      </div>
                      <div className="flex gap-2">
                        <Input 
                          type="file" 
                          accept=".db" 
                          className="flex-1 rounded-xl"
                          onChange={async (e) => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            
                            if (!confirm("Jeste li sigurni da želite vratiti podatke iz ove datoteke? Svi trenutni podaci bit će trajno izbrisani.")) {
                              e.target.value = ''
                              return
                            }

                            setNotification("Vraćanje podataka u tijeku...")
                            const formData = new FormData()
                            formData.append('file', file)

                            try {
                              const res = await fetch('/api/settings/restore', {
                                method: 'POST',
                                body: formData
                              })
                              const data = await res.json()
                              if (data.success) {
                                setNotification(data.message)
                                setTimeout(() => window.location.reload(), 2000)
                              } else {
                                setLogoError(data.error || "Greška pri vraćanju podataka.")
                              }
                            } catch (err) {
                              setLogoError("Greška pri komunikaciji s poslužiteljem.")
                            }
                          }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground italic">Odaberite prethodno preuzetu .db datoteku.</p>
                    </div>

                    {/* Auto-backup settings panel */}
                    <div className="space-y-4 rounded-xl border border-border bg-muted/30 p-6 md:col-span-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <h4 className="font-semibold text-foreground flex items-center gap-2">
                            <Clock className="h-4 w-4 text-primary" /> Planer automatskih kopija (Auto Backup)
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            Odaberite interval za automatsko spremanje kompletne arhive na disk i Google Drive.
                          </p>
                          {settings.lastBackupTime && (
                            <p className="text-[10px] text-emerald-600 font-semibold mt-1">
                              Zadnji uspješni automatski backup: {new Date(settings.lastBackupTime).toLocaleString("hr-HR")}
                            </p>
                          )}
                        </div>
                        <div className="w-full sm:w-64">
                          <Select 
                            value={autoBackupDays.toString()} 
                            onValueChange={handleAutoBackupChange}
                          >
                            <SelectTrigger className="w-full bg-background rounded-xl">
                              <SelectValue placeholder="Odaberite interval" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">Onemogućeno</SelectItem>
                              <SelectItem value="1">Svaki dan (1 dan)</SelectItem>
                              <SelectItem value="3">Svaka 3 dana</SelectItem>
                              <SelectItem value="7">Svaki tjedan (7 dana)</SelectItem>
                              <SelectItem value="14">Svaka 2 tjedna (14 dana)</SelectItem>
                              <SelectItem value="30">Svaki mjesec (30 dana)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {/* Manual Zip Backup */}
                    <div className="space-y-4 rounded-xl border border-border bg-muted/30 p-6 md:col-span-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <h4 className="font-semibold text-foreground flex items-center gap-2">
                            <FileArchive className="h-4 w-4 text-primary" /> Cjelokupna sigurnosna kopija (Baza + Slike)
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            Pokrenite ručnu izradu kompletne `.zip` arhive koja spaja bazu podataka i prenesene slike.
                          </p>
                        </div>
                        <Button 
                          onClick={handleCreateCompleteBackup}
                          disabled={isCreatingZip}
                          className="h-11 rounded-xl shadow-md gap-2"
                        >
                          {isCreatingZip ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" /> Stvaranje arhive...
                            </>
                          ) : (
                            <>
                              <Plus className="h-4 w-4" /> Pokreni cjelokupni backup
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* zip file backups list */}
                    {zipBackups.length > 0 && (
                      <div className="space-y-3 md:col-span-2 pt-2">
                        <h4 className="font-semibold text-foreground flex items-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">
                          <FileArchive className="h-4 w-4" /> Dostupne kompletne kopije (.zip)
                        </h4>
                        <div className="border rounded-xl overflow-hidden bg-background">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-muted/50 border-b border-border font-semibold text-muted-foreground">
                                <th className="p-3">Naziv arhive</th>
                                <th className="p-3">Veličina</th>
                                <th className="p-3">Stvoreno</th>
                                <th className="p-3 text-right">Akcije</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {zipBackups.map((backup) => (
                                <tr key={backup.name} className="hover:bg-muted/30 transition-colors">
                                  <td className="p-3 font-mono text-slate-700 font-semibold">{backup.name}</td>
                                  <td className="p-3 text-slate-500">{(backup.size / (1024 * 1024)).toFixed(2)} MB</td>
                                  <td className="p-3 text-slate-500">{new Date(backup.createdAt).toLocaleString("hr-HR")}</td>
                                  <td className="p-3 text-right space-x-1">
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      onClick={() => handleDownloadZipBackup(backup.name)}
                                      title="Preuzmi arhivu"
                                      className="h-8 w-8 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg"
                                    >
                                      <Download className="h-4 w-4" />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      onClick={() => handleDeleteZipBackup(backup.name)}
                                      title="Obriši s poslužitelja"
                                      className="h-8 w-8 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg"
                                    >
                                      <Trash className="h-4 w-4" />
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg bg-blue-50 p-4 border border-blue-100 flex items-start gap-3">
                    <RefreshCw className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div className="text-xs text-blue-800 leading-relaxed">
                      <strong>Savjet:</strong> Preporučamo stvaranje cjelokupne sigurnosne kopije (.zip) prije svake veće nadogradnje aplikacije. 
                      Datoteke se pohranjuju na disk poslužitelja i na Google Drive, te su potpuno zaštićene od brisanja prilikom update-a aplikacije.
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── Sjednice tab ─────────────────────────────────────────────── */}
          <TabsContent value="meetings-config" className="space-y-6">
            {logoError && (
              <Alert variant="destructive"><AlertDescription>{logoError}</AlertDescription></Alert>
            )}
            {notification && (
              <Alert><AlertDescription>{notification}</AlertDescription></Alert>
            )}

            <div className="grid gap-6 xl:grid-cols-2">
              {/* Meeting Types */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <List className="h-4 w-4" /> Vrste sjednica
                  </CardTitle>
                  <CardDescription>
                    Definirajte vrste sjednica koje se mogu koristiti pri zakazivanju.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                    <Input
                      placeholder="Nova vrsta (npr. Svečana skupština)"
                      value={newMeetingType}
                      onChange={e => setNewMeetingType(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && newMeetingType.trim()) {
                          addMeetingType(newMeetingType.trim())
                          setNewMeetingType('')
                          setNotification('Vrsta sjednice dodana.')
                        }
                      }}
                    />
                    <Button className="gap-2" onClick={() => {
                      if (!newMeetingType.trim()) return
                      addMeetingType(newMeetingType.trim())
                      setNewMeetingType('')
                      setNotification('Vrsta sjednice dodana.')
                    }}>
                      <Plus className="h-4 w-4" /> Dodaj
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {settings.meetingTypes.length > 0 ? (
                      <div className="grid gap-2">
                        {settings.meetingTypes.map(type => (
                          <div key={type} className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3">
                            <span className="text-sm">{type}</span>
                            <button
                              onClick={() => removeMeetingType(type)}
                              className="rounded-lg border border-border px-3 py-1.5 text-xs text-red-700 hover:bg-red-50"
                            >
                              Ukloni
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Nema definiranih vrsta.</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Meeting Locations */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" /> Lokacije sastanaka
                  </CardTitle>
                  <CardDescription>
                    Preddefinirane adrese i prostorije koje se koriste za sjednice.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                    <Input
                      placeholder="Nova lokacija (npr. Vijećnica, Trg bana J. Jelačića 1)"
                      value={newMeetingLocation}
                      onChange={e => setNewMeetingLocation(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && newMeetingLocation.trim()) {
                          addMeetingLocation(newMeetingLocation.trim())
                          setNewMeetingLocation('')
                          setNotification('Lokacija dodana.')
                        }
                      }}
                    />
                    <Button className="gap-2" onClick={() => {
                      if (!newMeetingLocation.trim()) return
                      addMeetingLocation(newMeetingLocation.trim())
                      setNewMeetingLocation('')
                      setNotification('Lokacija dodana.')
                    }}>
                      <Plus className="h-4 w-4" /> Dodaj
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {settings.meetingLocations.length > 0 ? (
                      <div className="grid gap-2">
                        {settings.meetingLocations.map(loc => (
                          <div key={loc} className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                              <span className="text-sm">{loc}</span>
                            </div>
                            <button
                              onClick={() => removeMeetingLocation(loc)}
                              className="rounded-lg border border-border px-3 py-1.5 text-xs text-red-700 hover:bg-red-50"
                            >
                              Ukloni
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Nema definiranih lokacija.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="email-notifications" className="space-y-6">
            {notification && (
              <Alert><AlertDescription>{notification}</AlertDescription></Alert>
            )}
            {logoError && (
              <Alert variant="destructive"><AlertDescription>{logoError}</AlertDescription></Alert>
            )}

            <div className="grid gap-6 xl:grid-cols-2">
              {/* SMTP Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5 text-primary" /> SMTP Server
                  </CardTitle>
                  <CardDescription>
                    Konfiguracija servera za slanje službenih obavijesti društva.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="smtpHostNew">SMTP Host</Label>
                      <Input id="smtpHostNew" placeholder="mail.rodoslovlje.hr" value={smtpConfig.smtpHost} onChange={e => setSmtpConfig(p => ({ ...p, smtpHost: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="smtpPortNew">Port</Label>
                      <Input id="smtpPortNew" type="number" value={smtpConfig.smtpPort} onChange={e => setSmtpConfig(p => ({ ...p, smtpPort: Number(e.target.value) }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="smtpUserNew">Korisničko ime</Label>
                      <Input id="smtpUserNew" placeholder="rodoslovlje@rodoslovlje.hr" value={smtpConfig.smtpUser} onChange={e => setSmtpConfig(p => ({ ...p, smtpUser: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="smtpPassNew">Lozinka</Label>
                      <Input id="smtpPassNew" type="password" value={smtpConfig.smtpPass} onChange={e => setSmtpConfig(p => ({ ...p, smtpPass: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="smtpFromNew">Email pošiljatelja (From)</Label>
                      <Input id="smtpFromNew" placeholder="rodoslovlje@rodoslovlje.hr" value={smtpConfig.smtpFrom} onChange={e => setSmtpConfig(p => ({ ...p, smtpFrom: e.target.value }))} />
                    </div>
                    <div className="flex items-center space-x-2 pt-8">
                      <input type="checkbox" id="smtpSecureNew" checked={smtpConfig.smtpSecure} onChange={e => setSmtpConfig(p => ({ ...p, smtpSecure: e.target.checked }))} className="h-4 w-4 rounded border-gray-300" />
                      <Label htmlFor="smtpSecureNew">SSL/TLS</Label>
                    </div>
                  </div>
                  <div className="flex gap-3 pt-4 border-t">
                    <Button size="sm" onClick={handleSaveSMTP} className="gap-2"><Save className="h-4 w-4" /> Spremi SMTP</Button>
                    <Button size="sm" variant="outline" className="gap-2" onClick={async () => {
                       setNotification("Testiranje SMTP veze...")
                       try {
                         const response = await fetch('/api/admin/settings/test-email', {
                           method: 'POST',
                           headers: { 'Content-Type': 'application/json' },
                           body: JSON.stringify(smtpConfig)
                         })
                         const data = await response.json()
                         if (data.success) setNotification("Testni e-mail je uspješno poslan!")
                         else setLogoError(data.error || "Greška pri slanju.")
                       } catch (err) { setLogoError("Greška pri spajanju na API.") }
                    }}><RefreshCw className="h-4 w-4" /> Testiraj vezu</Button>
                  </div>
                </CardContent>
              </Card>

              {/* Email Content Template */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="h-5 w-5 text-primary" /> Predložak obavijesti o članarini
                  </CardTitle>
                  <CardDescription>
                    Tekst koji će članovi primiti prilikom obavijesti o dugovanju.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="emailSubject">Naslov e-maila</Label>
                    <Input id="emailSubject" value={emailConfig.subject} onChange={e => setEmailConfig(p => ({ ...p, subject: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emailBody">Tekst poruke</Label>
                    <textarea id="emailBody" rows={6} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" 
                      value={emailConfig.body} onChange={e => setEmailConfig(p => ({ ...p, body: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emailSignature">Potpis e-maila (s logom društva)</Label>
                    <textarea id="emailSignature" rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" 
                      value={emailConfig.signature} onChange={e => setEmailConfig(p => ({ ...p, signature: e.target.value }))} />
                  </div>
                  <Button size="sm" onClick={handleSaveEmailConfig} className="gap-2"><Save className="h-4 w-4" /> Spremi predložak</Button>
                </CardContent>
              </Card>

              {/* Attachments & Bulk Action */}
              <Card className="xl:col-span-2">
                <CardHeader>
                  <CardTitle>Prilozi i masovno slanje</CardTitle>
                  <CardDescription>Učitajte slike uplatnice i QR koda te pošaljite obavijesti svim dužnicima.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    {/* Payment Slip */}
                    <div className="space-y-3 rounded-lg border p-4">
                      <Label>Slika uplatnice</Label>
                      <div className="flex items-center gap-4">
                        {emailConfig.slipUrl ? (
                          <img src={emailConfig.slipUrl} alt="Uplatnica" className="h-20 w-32 rounded object-contain border" />
                        ) : (
                          <div className="h-20 w-32 rounded border border-dashed flex items-center justify-center text-[10px] text-muted-foreground text-center">Nema uplatnice</div>
                        )}
                        <Input type="file" accept="image/*" className="text-xs" onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'slip')} />
                      </div>
                    </div>
                    {/* QR Code */}
                    <div className="space-y-3 rounded-lg border p-4">
                      <Label>QR kod za plaćanje</Label>
                      <div className="flex items-center gap-4">
                        {emailConfig.qrUrl ? (
                          <img src={emailConfig.qrUrl} alt="QR Kod" className="h-20 w-20 rounded object-contain border" />
                        ) : (
                          <div className="h-20 w-20 rounded border border-dashed flex items-center justify-center text-[10px] text-muted-foreground text-center">Nema QR koda</div>
                        )}
                        <Input type="file" accept="image/*" className="text-xs" onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'qr')} />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-start border-t pt-4">
                    <Button size="sm" onClick={handleSaveEmailConfig} className="gap-2 bg-green-600 hover:bg-green-700 text-white">
                      <Save className="h-4 w-4" /> Spremi privitke
                    </Button>
                  </div>

                  <div className="rounded-xl bg-accent/5 border border-accent/20 p-6">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h4 className="font-bold">Slanje obavijesti svim dužnicima</h4>
                        <p className="text-sm text-muted-foreground mt-1">Svi članovi sa statusom <span className="font-bold text-red-600 uppercase">DUG</span> će primiti ovaj e-mail.</p>
                      </div>
                      <Button size="lg" className="gap-2 bg-red-600 hover:bg-red-700" onClick={async () => {
                        if (!confirm("Jeste li sigurni da želite poslati obavijesti svim članovima koji duguju članarinu?")) return
                        setNotification("Slanje masovnih obavijesti...")
                        try {
                          const res = await fetch('/api/admin/notifications/payment-reminders', { method: 'POST' })
                          const data = await res.json()
                          if (data.success) setNotification(`Uspješno poslano ${data.count} obavijesti.`)
                          else setLogoError(data.error || "Greška pri slanju masovnih obavijesti.")
                        } catch (err) { setLogoError("Greška pri komunikaciji s API-jem.") }
                      }}>
                        <Mail className="h-5 w-5" /> Pošalji obavijesti (DUG)
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Informacije o profilu</CardTitle>
                  <CardDescription>Osnovne informacije o vašem računu.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>Ime</Label>
                      <p className="mt-1 text-sm font-medium">{user?.name}</p>
                    </div>
                    <div>
                      <Label>Email</Label>
                      <p className="mt-1 text-sm font-medium">{user?.email}</p>
                    </div>
                    <div>
                      <Label>Uloga</Label>
                      <p className="mt-1 text-sm font-medium">
                        {user?.role === 'admin' ? 'Administrator' : user?.role === 'moderator' ? 'Moderator' : 'Član'}
                      </p>
                    </div>
                    <div>
                      <Label>ID korisnika</Label>
                      <p className="mt-1 text-sm font-medium">#{user?.id}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Promjena lozinke</CardTitle>
                  <CardDescription>Ažurirajte svoju lozinku za sigurniji pristup.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    {success && (
                      <Alert>
                        <AlertDescription className="text-green-600">{success}</AlertDescription>
                      </Alert>
                    )}
                    {error && (
                      <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="currentPassword">Trenutna lozinka</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="currentPassword"
                          type={showCurrentPassword ? "text" : "password"}
                          placeholder="Unesite trenutnu lozinku"
                          className="pl-10 pr-10"
                          {...register("currentPassword")}
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        >
                          {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {errors.currentPassword && <p className="text-sm text-red-600">{errors.currentPassword.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="newPassword">Nova lozinka</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="newPassword"
                          type={showNewPassword ? "text" : "password"}
                          placeholder="Unesite novu lozinku"
                          className="pl-10 pr-10"
                          {...register("newPassword")}
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                        >
                          {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {errors.newPassword && <p className="text-sm text-red-600">{errors.newPassword.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Potvrdite novu lozinku</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Ponovite novu lozinku"
                          className="pl-10 pr-10"
                          {...register("confirmPassword")}
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {errors.confirmPassword && <p className="text-sm text-red-600">{errors.confirmPassword.message}</p>}
                    </div>

                    <Button type="submit" disabled={isLoading} className="gap-2">
                      <Save className="h-4 w-4" />
                      {isLoading ? "Spremanje..." : "Spremi promjene"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            {user?.role === 'admin' && (
              <Card className="border-amber-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="h-5 w-5 text-amber-600" /> Rezervni Administrator
                  </CardTitle>
                  <CardDescription>
                    Dodijelite alternativni e-mail za "rezervnog" administratora koji se može prijaviti u sustav u slučaju hitnoće.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="backupEmail">Email rezervnog admina</Label>
                      <Input
                        id="backupEmail"
                        type="email"
                        placeholder="rezerva@primjer.hr"
                        value={backupEmail}
                        onChange={(e) => setBackupEmail(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Ovaj e-mail će biti prepoznat kao administratorski prilikom prijave (koristi istu ili posebno definiranu lozinku).
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="backupPassword">Lozinka rezervnog admina</Label>
                      <Input
                        id="backupPassword"
                        type="password"
                        placeholder="Ostavite prazno za 'admin'"
                        value={backupPassword}
                        onChange={(e) => setBackupPassword(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Preporučamo postavljanje snažne lozinke za ovaj rescue pristup.
                      </p>
                    </div>
                  </div>
                  <div className="pt-2">
                    <Button onClick={handleSaveBackupAdmin} className="gap-2 bg-amber-600 hover:bg-amber-700">
                      <Save className="h-4 w-4" /> Spremi rezervni pristup
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="templates" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Šablone za doprinositelje</h3>
                <p className="text-sm text-muted-foreground">Definirajte strukturu podataka za različite vrste projekata.</p>
              </div>
              <Button onClick={() => {
                const newT: ContributorTemplate = { id: generateId(), name: "Nova šablona", fields: [{ id: generateId(), name: "Ime i prezime", type: "text", order: 0 }] }
                setTemplates([...templates, newT])
                setEditingTemplate(newT.id)
              }} className="gap-2">
                <Plus className="h-4 w-4" /> Nova šablona
              </Button>
            </div>

            <div className="grid gap-6">
              {templates.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-12 text-center bg-card">
                  <FileStack className="mb-3 h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Nema definiranih šablona.</p>
                </div>
              ) : templates.map(t => (
                <Card key={t.id} className={editingTemplate === t.id ? "ring-2 ring-primary" : ""}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="space-y-1 flex-1">
                      {editingTemplate === t.id ? (
                        <Input value={t.name} onChange={e => {
                          setTemplates(prev => prev.map(pt => pt.id === t.id ? { ...pt, name: e.target.value } : pt))
                        }} className="max-w-xs font-bold" />
                      ) : (
                        <CardTitle>{t.name}</CardTitle>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setEditingTemplate(editingTemplate === t.id ? null : t.id)}>
                        {editingTemplate === t.id ? "Završi" : "Uredi polja"}
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-600" onClick={() => {
                        if (confirm("Jeste li sigurni da želite obrisati ovu šablonu?")) {
                          setTemplates(prev => prev.filter(pt => pt.id !== t.id))
                        }
                      }}>
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  {editingTemplate === t.id && (
                    <CardContent className="space-y-4 border-t pt-4">
                      <div className="space-y-2">
                        {t.fields.sort((a, b) => a.order - b.order).map((f, idx) => (
                          <div key={f.id} className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                            <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                            <div className="grid flex-1 grid-cols-12 gap-3">
                              <div className="col-span-5">
                                <Label className="text-[10px] uppercase text-muted-foreground mb-1 block">Naziv polja</Label>
                                <Input value={f.name} onChange={e => {
                                  setTemplates(prev => prev.map(pt => pt.id === t.id ? {
                                    ...pt, fields: pt.fields.map(pf => pf.id === f.id ? { ...pf, name: e.target.value } : pf)
                                  } : pt))
                                }} bs-size="sm" />
                              </div>
                              <div className="col-span-4">
                                <Label className="text-[10px] uppercase text-muted-foreground mb-1 block">Tip podatka</Label>
                                <select 
                                  value={f.type} 
                                  onChange={e => {
                                    setTemplates(prev => prev.map(pt => pt.id === t.id ? {
                                      ...pt, fields: pt.fields.map(pf => pf.id === f.id ? { ...pf, type: e.target.value as any } : pf)
                                    } : pt))
                                  }}
                                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                                >
                                  <option value="text">Tekst</option>
                                  <option value="number">Broj</option>
                                  <option value="email">E-mail</option>
                                  <option value="url">Web URL</option>
                                  <option value="date">Datum</option>
                                </select>
                              </div>
                              <div className="col-span-2 flex items-end gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                                  if (idx === 0) return
                                  setTemplates(prev => prev.map(pt => pt.id === t.id ? {
                                    ...pt, fields: pt.fields.map(pf => {
                                      if (pf.id === f.id) return { ...pf, order: idx - 1 }
                                      if (pf.order === idx - 1) return { ...pf, order: idx }
                                      return pf
                                    })
                                  } : pt))
                                }}>
                                  <ChevronUp className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                                  if (idx === t.fields.length - 1) return
                                  setTemplates(prev => prev.map(pt => pt.id === t.id ? {
                                    ...pt, fields: pt.fields.map(pf => {
                                      if (pf.id === f.id) return { ...pf, order: idx + 1 }
                                      if (pf.order === idx + 1) return { ...pf, order: idx }
                                      return pf
                                    })
                                  } : pt))
                                }}>
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                              </div>
                              <div className="col-span-1 flex items-end justify-end">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => {
                                  setTemplates(prev => prev.map(pt => pt.id === t.id ? {
                                    ...pt, fields: pt.fields.filter(pf => pf.id !== f.id)
                                  } : pt))
                                }}>
                                  <Trash className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => {
                        setTemplates(prev => prev.map(pt => pt.id === t.id ? {
                          ...pt, fields: [...pt.fields, { id: generateId(), name: "Novo polje", type: "text", order: pt.fields.length }]
                        } : pt))
                      }}>
                        <Plus className="h-4 w-4" /> Dodaj polje
                      </Button>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>

            {templates.length > 0 && (
              <div className="flex justify-end pt-4">
                <Button onClick={() => {
                  setContributorTemplates(templates)
                  setNotification("Šablone projekata su uspješno spremljene.")
                  setEditingTemplate(null)
                }} className="gap-2">
                  <Save className="h-4 w-4" /> Spremi sve šablone
                </Button>
              </div>
            )}
          </TabsContent>

    <TabsContent value="integrations" className="space-y-6">
      {notification && (
        <Alert>
          <AlertDescription>{notification}</AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Google Drive Integracija</CardTitle>
          <CardDescription>
            Povežite Google Drive repozitorij za preuzimanje datoteka i pohranu sigurnosnih kopija (backup).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            {/* Metoda povezivanja */}
            <div className="space-y-2">
              <Label>Metoda povezivanja</Label>
              <div className="flex gap-2 p-1 bg-muted rounded-lg w-fit">
                <button
                  type="button"
                  onClick={() => setConnectionMethod('oauth')}
                  className={`px-4 py-2 text-xs font-semibold rounded-md transition-all ${connectionMethod === 'oauth' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Google Račun (OAuth 2.0)
                </button>
                <button
                  type="button"
                  onClick={() => setConnectionMethod('service_account')}
                  className={`px-4 py-2 text-xs font-semibold rounded-md transition-all ${connectionMethod === 'service_account' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Service Account JSON
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {connectionMethod === 'oauth' 
                  ? "Preporučeno za osobne @gmail.com račune jer koristi Vašu osobnu pohranu i izbjegava greške s limitom prostora."
                  : "Preporučeno za Google Workspace (poslovne) račune i Shared Drive (Zajedničke diskove)."}
              </p>
            </div>

            {/* OAuth 2.0 Sučelje */}
            {connectionMethod === 'oauth' && (
              <div className="space-y-4 pt-2 border-t border-border">
                <div className="space-y-2">
                  <Label htmlFor="googleClientId">OAuth 2.0 Client ID</Label>
                  <Input
                    id="googleClientId"
                    placeholder="npr. 123456789-abcde.apps.googleusercontent.com"
                    value={settings.googleClientId || ""}
                    onChange={(e) => {
                      setGoogleOAuthSettings(e.target.value, settings.googleClientSecret || "")
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Client ID kreiran na Google Cloud Console-u za ovu web aplikaciju.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="googleClientSecret">OAuth 2.0 Client Secret</Label>
                  <div className="relative">
                    <Input
                      id="googleClientSecret"
                      type={showClientSecret ? "text" : "password"}
                      placeholder="Unesite Client Secret ključ..."
                      className="pr-10"
                      value={settings.googleClientSecret || ""}
                      onChange={(e) => {
                        setGoogleOAuthSettings(settings.googleClientId || "", e.target.value)
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowClientSecret(!showClientSecret)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showClientSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Tajni ključ dodijeljen uz kreirani Client ID na Google Cloud Console-u.
                  </p>
                </div>

                {/* Status autorizacije i gumb */}
                <div className="p-4 rounded-lg border border-border bg-card/50 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Status Google autorizacije</Label>
                      <div className="flex items-center gap-2">
                        {settings.googleRefreshToken ? (
                          <>
                            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Povezano s Google računom</span>
                          </>
                        ) : (
                          <>
                            <span className="flex h-2.5 w-2.5 rounded-full bg-amber-500" />
                            <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">Nije autorizirano</span>
                          </>
                        )}
                      </div>
                    </div>
                    
                    <Button
                      type="button"
                      variant={settings.googleRefreshToken ? "outline" : "default"}
                      className={settings.googleRefreshToken ? "" : "bg-blue-600 hover:bg-blue-700 text-white font-semibold"}
                      onClick={async () => {
                        if (!settings.googleClientId || !settings.googleClientSecret) {
                          setLogoError("Morate unijeti Client ID i Client Secret kako biste pokrenuli autorizaciju.")
                          return
                        }
                        
                        setNotification("Spremanje parametara i pokretanje Google prijave...")
                        try {
                          const res = await fetch('/api/admin/settings/google-drive', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              googleClientId: settings.googleClientId,
                              googleClientSecret: settings.googleClientSecret,
                              googleDriveFolderId: settings.googleDriveFolderId,
                              googleDriveBackupFolderId: settings.googleDriveBackupFolderId
                            })
                          })
                          if (res.ok) {
                            // Preusmjeravanje na autorizacijski endpoint
                            window.location.href = '/api/admin/auth/google'
                          } else {
                            setLogoError("Greška pri pohrani konfiguracije prije prijave.")
                          }
                        } catch (err) {
                          setLogoError("Komunikacijska greška sa serverom.")
                        }
                      }}
                    >
                      {settings.googleRefreshToken ? "Autoriziraj ponovno" : "Poveži Google račun"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {settings.googleRefreshToken 
                      ? "Aplikacija ima važeći Refresh Token te će automatski prenositi sigurnosne kopije na Vaš disk."
                      : "Unesite Client ID i Client Secret, spremite ih, a zatim kliknite na gumb iznad kako biste autorizirali svoj Google disk račun."}
                  </p>
                </div>
              </div>
            )}

            {/* Service Account JSON Sučelje */}
            {connectionMethod === 'service_account' && (
              <div className="space-y-2 pt-2 border-t border-border">
                <Label htmlFor="serviceAccountJson">Google Service Account JSON</Label>
                <textarea
                  id="serviceAccountJson"
                  className="flex min-h-[150px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono text-xs"
                  placeholder='{"type": "service_account", ...}'
                  value={settings.googleServiceAccountJson || ""}
                  onChange={(e) => {
                    setGoogleDriveSettings(e.target.value, settings.googleDriveFolderId || "", settings.googleDriveBackupFolderId)
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Zalijepite sadržaj cijele JSON datoteke koju ste preuzeli s Google Cloud-a.
                </p>
              </div>
            )}

            {/* ID Mape */}
            <div className="space-y-4 pt-4 border-t border-border">
              <div className="space-y-2">
                <Label htmlFor="folderId">Primarna mapa za preuzimanje i dokumente (Target Folder ID)</Label>
                <Input
                  id="folderId"
                  placeholder="npr. 1abc2def3ghi4jkl..."
                  value={settings.googleDriveFolderId || ""}
                  onChange={(e) => {
                    setGoogleDriveSettings(settings.googleServiceAccountJson || "", e.target.value, settings.googleDriveBackupFolderId)
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  ID mape se koristi za preuzimanje i sinkronizaciju datoteka s Google Drivea.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="backupFolderId">Zasebna mapa za sigurnosne kopije (Backup Folder ID)</Label>
                <Input
                  id="backupFolderId"
                  placeholder="npr. 1xyz2uvw3rst4nop..."
                  value={settings.googleDriveBackupFolderId || ""}
                  onChange={(e) => {
                    setGoogleDriveSettings(settings.googleServiceAccountJson || "", settings.googleDriveFolderId || "", e.target.value)
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  ID posebne mape koja će se koristiti isključivo za pohranu ZIP arhivskih backupa. Ako se ostavi prazno, koristit će se primarna mapa gore.
                </p>
              </div>
            </div>

            {/* Testiranje i spremanje */}
            <div className="flex flex-wrap gap-4 pt-4 border-t border-border">
              <Button 
                onClick={async () => {
                  setNotification("Testiranje veze...")
                  try {
                    const response = await fetch('/api/admin/settings/google-drive', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        googleServiceAccountJson: settings.googleServiceAccountJson,
                        googleDriveFolderId: settings.googleDriveFolderId,
                        googleDriveBackupFolderId: settings.googleDriveBackupFolderId,
                        googleClientId: settings.googleClientId,
                        googleClientSecret: settings.googleClientSecret,
                        googleRefreshToken: settings.googleRefreshToken,
                        action: 'test'
                      })
                    })
                    const data = await response.json()
                    if (data.success) {
                      setNotification(data.message)
                    } else {
                      setLogoError(data.message)
                    }
                  } catch (err: any) {
                    setLogoError(err.message || "Greška pri spajanju na API.")
                  }
                }} 
                variant="outline"
              >
                Test Connection
              </Button>

              <Button onClick={async () => {
                setError("")
                setSuccess("")
                setLogoError("")
                try {
                  const response = await fetch('/api/admin/settings/google-drive', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      googleServiceAccountJson: settings.googleServiceAccountJson,
                      googleDriveFolderId: settings.googleDriveFolderId,
                      googleDriveBackupFolderId: settings.googleDriveBackupFolderId,
                      googleClientId: settings.googleClientId,
                      googleClientSecret: settings.googleClientSecret,
                      googleRefreshToken: settings.googleRefreshToken
                    })
                  })
                  if (response.ok) {
                    await refreshSettings()
                    setNotification("Google Drive postavke su uspješno spremljene.")
                  } else {
                    setLogoError("Greška pri spremanju postavki.")
                  }
                } catch (err) {
                  setLogoError("Greška pri komunikaciji s poslužiteljem.")
                }
              }} className="gap-2">
                <Save className="h-4 w-4" /> Spremi integraciju
              </Button>
            </div>
          </div>

          <div className="pt-6 border-t border-border">
            <Label className="text-muted-foreground">Legacy (Iframe Display)</Label>
            <div className="mt-2 space-y-2">
              <Label htmlFor="driveUrl" className="text-xs">Ugrađeni URL (za prikaz cijele mape u iframeu)</Label>
              <Input
                id="driveUrl"
                placeholder="https://drive.google.com/drive/folders/..."
                value={driveUrl}
                onChange={(e) => setDriveUrl(e.target.value)}
              />
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setGoogleDriveUrl(driveUrl)}
                className="mt-1"
              >
                Ažuriraj Legacy URL
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </TabsContent>

    {user?.role === 'admin' && (
      <TabsContent value="vault" className="space-y-6">
        {notification && (
          <Alert>
            <AlertDescription>{notification}</AlertDescription>
          </Alert>
        )}
        <Card className="border-red-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <Lock className="h-5 w-5" /> Admin Trezor (Povjerljive bilješke)
            </CardTitle>
            <CardDescription>
              Ovaj prostor je strogo povjerljiv i vidljiv samo Administratoru. 
              Ovdje zapisujete lozinke, mail račune i pristupne podatke za sve platforme.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-800 mb-4">
              <strong>Napomena:</strong> Ovi podaci su namijenjeni za kontinuitet upravljanja društvom. 
              Svi budući administratori imat će pristup ovim bilješkama kako bi mogli preuzeti kontrolu nad sustavima.
            </div>
            <textarea
              className="flex min-h-[400px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
              placeholder="Zalijepite pristupne podatke ovdje...
              
Primjer:
Gmail: tajnistvo@... / lozinka: ...
Hosting: ... / korisničko ime: ...
Google Cloud: ..."
              value={vaultNotes}
              onChange={(e) => setVaultNotesLocal(e.target.value)}
            />
            <div className="pt-4 flex justify-end">
              <Button onClick={handleSaveVault} className="gap-2 bg-red-700 hover:bg-red-800">
                <Save className="h-4 w-4" /> Spremi u Trezor
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    )}
        </Tabs>
      </div>
    </main>
  )
}
