"use client"

import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Eye, EyeOff, Lock, Save, Upload, Settings as SettingsIcon, Plus, MapPin, List, Mail, Database, Download, RefreshCw, FileStack, GripVertical, Trash, ChevronDown, ChevronUp, AlertTriangle, ShieldCheck, CheckCircle2, FileJson, Inbox } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/contexts/auth-context"
import { useActivityLog } from "@/contexts/activity-log-context"
import { useSettings } from "@/contexts/settings-context"
import { useSearchParams } from "next/navigation"
import { generateId } from "@/lib/utils"
import { ContributorTemplate, ContributorField } from "@/contexts/settings-context"
import { useMembers } from "@/contexts/members-context"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { PaymentReminderDialog } from "@/components/payment-reminder-dialog"
import { BackupSimulationDialog } from "@/components/backup-simulation-dialog"

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
  const [showSmtpPassword, setShowSmtpPassword] = useState(false)
  const [success, setSuccess] = useState("")
  const [error, setError] = useState("")
  const [notification, setNotification] = useState("")
  const [logoError, setLogoError] = useState("")
  const [showBulkPaymentDialog, setShowBulkPaymentDialog] = useState(false)
  const [showSimulationModal, setShowSimulationModal] = useState(false)
  const [newFunction, setNewFunction] = useState("")
  const [newMeetingType, setNewMeetingType] = useState("")
  const [newMeetingLocation, setNewMeetingLocation] = useState("")
  const { members, updateMember } = useMembers()
  const debtorsList = members.filter(m => m.status_clana === 'DUG' || m.paymentStatus === 'overdue')

  const { updatePassword, updateUserName, isLoading, user } = useAuth()
  const { addLog } = useActivityLog()
  const hasLoggedRef = useRef(false)

  useEffect(() => {
    if (user && !hasLoggedRef.current) {
      hasLoggedRef.current = true
      addLog({
        userId: user.id.toString(),
        userName: user.name,
        userRole: user.role,
        action: 'Pregled postavki',
        details: `Korisnik ${user.name} je otvorio postavke sustava`
      })
    }
  }, [user?.id])
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
    setAdminName,
    setAdminBackupSettings,
    setSMTPSettings,
    setPaymentEmailSettings,
    setContributorTemplates,
    setGoogleDriveOnlyDownload,
    setDropboxSettings,
    runBackupNow,
    setBackupIntervalDays,
  } = useSettings()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  
  const [overdueDays, setOverdueDays] = useState(settings.overdueAfterDays)
  const [inactiveDays, setInactiveDays] = useState(settings.expiredAfterDays)
  const [driveUrl, setDriveUrl] = useState(settings.googleDriveUrl || "")
  const [adminNameInput, setAdminNameInput] = useState(settings.adminName || "")
  const [isSavingAdminName, setIsSavingAdminName] = useState(false)
  const [adminNameSaved, setAdminNameSaved] = useState(false)
  const [backupEmail, setBackupEmail] = useState(settings.adminBackupEmail || "")
  const [backupPassword, setBackupPassword] = useState(settings.adminBackupPassword || "")
  const [vaultNotes, setVaultNotesLocal] = useState(settings.vaultNotes || "")
  
  const [logoPreview, setLogoPreview] = useState(settings.logoUrl || "")
  const [dropboxConfig, setDropboxConfig] = useState({
    dropboxAppKey: settings.dropboxAppKey || "",
    dropboxAppSecret: settings.dropboxAppSecret || "",
    dropboxRefreshToken: settings.dropboxRefreshToken || "",
    dropboxFolderPath: settings.dropboxFolderPath || "/backups"
  })
  const [isTestingDropbox, setIsTestingDropbox] = useState(false)
  const [isRunningBackup, setIsRunningBackup] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  
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
    invitationSubject: settings.invitationEmailSubject || "",
    invitationBody: settings.invitationEmailBody || "",
    pollSubject: settings.pollEmailSubject || "",
    pollBody: settings.pollEmailBody || "",
    meetingSubject: settings.meetingNotificationSubject || "",
    meetingBody: settings.meetingNotificationBody || "",
    meetingSummarySubject: settings.meetingSummarySubject || "",
    meetingSummaryBody: settings.meetingSummaryBody || "",
    lectureSubject: settings.lectureNotificationSubject || "",
    lectureBody: settings.lectureNotificationBody || "",
    lectureSummarySubject: settings.lectureSummarySubject || "",
    lectureSummaryBody: settings.lectureSummaryBody || "",
    slipUrl: settings.paymentSlipUrl || "",
    qrUrl: settings.paymentQrUrl || "",
    signature: settings.paymentEmailSignature || ""
  })


  const [templates, setTemplates] = useState(settings.projectContributorTemplates || [])
  const [editingTemplate, setEditingTemplate] = useState<null | string>(null)

  // Google Workspace Gmail (Service Account DWD) state
  const serviceAccountFileRef = useRef<HTMLInputElement | null>(null)
  const [gmailServiceAccountJson, setGmailServiceAccountJson] = useState(settings.googleServiceAccountJson || "")
  const [gmailTargetEmail, setGmailTargetEmail] = useState(settings.gmailMailbox || "")
  const [gmailJsonValidation, setGmailJsonValidation] = useState<{
    valid: boolean
    projectId?: string
    clientEmail?: string
    error?: string
  }>({ valid: false })
  const [gmailConnectionStatus, setGmailConnectionStatus] = useState<{
    loading: boolean
    connected: boolean
    configured: boolean
    emailAddress?: string
    clientEmail?: string
    projectId?: string
    messagesTotal?: number
    error?: string
  }>({ loading: true, connected: false, configured: false })

  const validateServiceAccountInput = (raw: string) => {
    if (!raw || !raw.trim()) {
      setGmailJsonValidation({ valid: false, error: undefined })
      return false
    }
    try {
      const parsed = JSON.parse(raw.trim())
      if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
        const missing = [
          !parsed.project_id ? "project_id" : null,
          !parsed.client_email ? "client_email" : null,
          !parsed.private_key ? "private_key" : null,
        ].filter(Boolean)
        setGmailJsonValidation({
          valid: false,
          error: `Neispravan Service Account JSON — nedostaju obavezna polja: ${missing.join(", ")}`,
        })
        return false
      }
      setGmailJsonValidation({
        valid: true,
        projectId: parsed.project_id,
        clientEmail: parsed.client_email,
      })
      return true
    } catch (e: any) {
      setGmailJsonValidation({
        valid: false,
        error: "Tekst nije ispravan JSON format.",
      })
      return false
    }
  }

  const checkGmailConnectionStatus = async () => {
    setGmailConnectionStatus((prev) => ({ ...prev, loading: true }))
    try {
      const res = await fetch("/api/gmail?action=status")
      const data = await res.json()
      setGmailConnectionStatus({
        loading: false,
        connected: Boolean(data.connected),
        configured: Boolean(data.configured),
        emailAddress: data.emailAddress || data.targetEmail,
        clientEmail: data.clientEmail,
        projectId: data.projectId,
        messagesTotal: data.messagesTotal,
        error: data.error,
      })
    } catch (err: any) {
      setGmailConnectionStatus({
        loading: false,
        connected: false,
        configured: false,
        error: "Greška pri provjeri statusa Gmail API veze.",
      })
    }
  }

  useEffect(() => {
    checkGmailConnectionStatus()
  }, [])

  const handleServiceAccountFileUpload = (file: File) => {
    setLogoError("")
    setNotification("")
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = (e.target?.result as string) || ""
      setGmailServiceAccountJson(content)
      setGoogleDriveSettings(content, settings.googleDriveFolderId || "")
      const isValid = validateServiceAccountInput(content)
      if (isValid) {
        setNotification(`Učitana Service Account datoteka: ${file.name}`)
      } else {
        setLogoError("Učitana JSON datoteka ne sadrži obavezna polja (project_id, client_email, private_key).")
      }
    }
    reader.onerror = () => {
      setLogoError("Greška pri čitanju JSON datoteke.")
    }
    reader.readAsText(file)
  }

  const handleSaveAndTestGmailConfig = async (actionType: "save-config" | "test-config" = "save-config") => {
    setLogoError("")
    setNotification("")

    if (!validateServiceAccountInput(gmailServiceAccountJson)) {
      setLogoError(gmailJsonValidation.error || "Unesite valjani Google Service Account JSON ključ (mora sadržavati project_id, client_email i private_key).")
      return
    }
    if (!gmailTargetEmail.trim() || !gmailTargetEmail.includes("@")) {
      setLogoError("Unesite valjanu adresu sandučića (Impersonated User), npr. tajnistvo@rodoslovlje.hr.")
      return
    }

    setGmailConnectionStatus((prev) => ({ ...prev, loading: true }))
    try {
      const res = await fetch("/api/gmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: actionType,
          googleServiceAccountJson: gmailServiceAccountJson.trim(),
          gmailMailbox: gmailTargetEmail.trim(),
        }),
      })
      const data = await res.json()

      if (actionType === "save-config") {
        await refreshSettings()
      }

      if (data.connected) {
        setGmailConnectionStatus({
          loading: false,
          connected: true,
          configured: true,
          emailAddress: data.emailAddress || gmailTargetEmail.trim(),
          clientEmail: data.clientEmail,
          projectId: data.projectId,
          messagesTotal: data.messagesTotal,
        })
        setNotification(
          actionType === "save-config"
            ? `✓ Postavke su spremljene! Povezano s ${data.emailAddress || gmailTargetEmail.trim()}`
            : `✓ Test uspješan! Povezano s ${data.emailAddress || gmailTargetEmail.trim()}`
        )
      } else {
        setGmailConnectionStatus({
          loading: false,
          connected: false,
          configured: true,
          emailAddress: gmailTargetEmail.trim(),
          clientEmail: data.clientEmail,
          projectId: data.projectId,
          error: data.error || "Povezivanje nije uspjelo.",
        })
        setLogoError(data.error || "Povezivanje na Gmail API nije uspjelo.")
      }
    } catch (err: any) {
      setGmailConnectionStatus((prev) => ({ ...prev, loading: false, connected: false, error: "Greška pri komunikaciji s poslužiteljem." }))
      setLogoError("Greška pri komunikaciji s poslužiteljem.")
    }
  }

  const searchParams = useSearchParams()
  const defaultTab = searchParams.get('tab') || 'general'

  useEffect(() => {
    setOverdueDays(settings.overdueAfterDays)
    setInactiveDays(settings.expiredAfterDays)
    setDriveUrl(settings.googleDriveUrl || "")
    setGmailServiceAccountJson(settings.googleServiceAccountJson || "")
    setGmailTargetEmail(settings.gmailMailbox || "")
    if (settings.googleServiceAccountJson) {
      validateServiceAccountInput(settings.googleServiceAccountJson)
    }
    setAdminNameInput(settings.adminName || "")
    setBackupEmail(settings.adminBackupEmail || "")
    setBackupPassword(settings.adminBackupPassword || "")
    setVaultNotesLocal(settings.vaultNotes || "")
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
      invitationSubject: settings.invitationEmailSubject || "",
      invitationBody: settings.invitationEmailBody || "",
      pollSubject: settings.pollEmailSubject || "",
      pollBody: settings.pollEmailBody || "",
      meetingSubject: settings.meetingNotificationSubject || "",
      meetingBody: settings.meetingNotificationBody || "",
      meetingSummarySubject: settings.meetingSummarySubject || "",
      meetingSummaryBody: settings.meetingSummaryBody || "",
      lectureSubject: settings.lectureNotificationSubject || "",
      lectureBody: settings.lectureNotificationBody || "",
      lectureSummarySubject: settings.lectureSummarySubject || "",
      lectureSummaryBody: settings.lectureSummaryBody || "",
      slipUrl: settings.paymentSlipUrl || "",
      qrUrl: settings.paymentQrUrl || "",
      signature: settings.paymentEmailSignature || ""
    })
    setTemplates(settings.projectContributorTemplates || [])
    setDropboxConfig({
      dropboxAppKey: settings.dropboxAppKey || "",
      dropboxAppSecret: settings.dropboxAppSecret || "",
      dropboxRefreshToken: settings.dropboxRefreshToken || "",
      dropboxFolderPath: settings.dropboxFolderPath || "/backups"
    })
  }, [settings])

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

  const handleSaveAdminName = async () => {
    setIsSavingAdminName(true)
    try {
      await setAdminName(adminNameInput)
      if (adminNameInput.trim()) {
        updateUserName(adminNameInput.trim())
      }
      setAdminNameSaved(true)
      setTimeout(() => setAdminNameSaved(false), 4000)
    } catch (e: any) {
      console.error(e)
    } finally {
      setIsSavingAdminName(false)
    }
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
      invitationEmailSubject: emailConfig.invitationSubject,
      invitationEmailBody: emailConfig.invitationBody,
      pollEmailSubject: emailConfig.pollSubject,
      pollEmailBody: emailConfig.pollBody,
      meetingNotificationSubject: emailConfig.meetingSubject,
      meetingNotificationBody: emailConfig.meetingBody,
      meetingSummarySubject: emailConfig.meetingSummarySubject,
      meetingSummaryBody: emailConfig.meetingSummaryBody,
      lectureNotificationSubject: emailConfig.lectureSubject,
      lectureNotificationBody: emailConfig.lectureBody,
      lectureSummarySubject: emailConfig.lectureSummarySubject,
      lectureSummaryBody: emailConfig.lectureSummaryBody,
      paymentSlipUrl: emailConfig.slipUrl,
      paymentQrUrl: emailConfig.qrUrl,
      paymentEmailSignature: emailConfig.signature
    })
    setNotification("Postavke e-mail obavijesti su spremljene.")
  }

  const handleSaveDropbox = async () => {
    setLogoError("")
    setSuccess("")
    setNotification("")
    
    const res = await setDropboxSettings(dropboxConfig)
    if (res) {
      setNotification("Dropbox postavke su uspješno spremljene.")
    } else {
      setLogoError("Greška pri spremanju Dropbox postavki.")
    }
  }

  const handleTestDropbox = async () => {
    setLogoError("")
    setSuccess("")
    setNotification("Testiranje Dropbox veze...")
    setIsTestingDropbox(true)
    
    try {
      const res = await fetch('/api/admin/settings/dropbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...dropboxConfig,
          action: 'test'
        })
      })
      const data = await res.json()
      if (data.success) {
        setNotification(data.message)
      } else {
        setLogoError(data.error || "Greška pri testiranju veze.")
      }
    } catch (err) {
      setLogoError("Greška pri spajanju na API.")
    } finally {
      setIsTestingDropbox(false)
    }
  }

  const handleRunBackup = async () => {
    if (!confirm("Jeste li sigurni da želite pokrenuti sigurnosnu kopiju odmah? Ovo može potrajati ovisno o veličini datoteka.")) return
    
    setLogoError("")
    setSuccess("")
    setNotification("Pokretanje sigurnosne kopije na Dropbox...")
    setIsRunningBackup(true)
    
    const res = await runBackupNow()
    if (res) {
      setNotification("Sigurnosna kopija je uspješno stvorena i spremljena na Dropbox!")
    } else {
      setLogoError("Greška pri stvaranju sigurnosne kopije. Provjerite Dropbox postavke i logove.")
    }
    setIsRunningBackup(false)
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
    <main className="flex-1 min-w-0 overflow-auto">
      <div className="p-4 md:p-8">
        <div className="mb-8">
          <h2 className="font-serif text-2xl font-bold md:text-4xl">Postavke</h2>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Konfigurirajte aplikaciju, sigurnost i parametre članstva.
          </p>
        </div>

        <Tabs defaultValue={defaultTab} className="space-y-6">
          <TabsList className="flex flex-wrap w-full gap-1 rounded-xl bg-muted p-1 h-auto items-center justify-start">
            <TabsTrigger value="general" className="text-xs px-2 flex-1 min-w-fit">Opće</TabsTrigger>
            <TabsTrigger value="meetings-config" className="text-xs px-2 flex-1 min-w-fit">Sjednice</TabsTrigger>
            <TabsTrigger value="email-notifications" className="text-xs px-2 flex-1 min-w-fit">E-mail</TabsTrigger>
            <TabsTrigger value="security" className="text-xs px-2 flex-1 min-w-fit">Sigurnost</TabsTrigger>
            {user?.role === 'admin' && <TabsTrigger value="access" className="text-xs px-2 flex-1 min-w-fit">Pristup</TabsTrigger>}
            {user?.role === 'admin' && <TabsTrigger value="templates" className="text-xs px-2 flex-1 min-w-fit">Projekti</TabsTrigger>}
            {user?.role === 'admin' && <TabsTrigger value="integrations" className="text-xs px-2 flex-1 min-w-fit">Integracije</TabsTrigger>}
            {user?.role === 'admin' && <TabsTrigger value="vault" className="text-xs px-2 flex-1 min-w-fit">Trezor</TabsTrigger>}
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

              </div>
          </TabsContent>

          {/* Sjednice tab */}
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
              {/* Google Workspace Shared Inbox (Service Account DWD) */}
              <Card className="xl:col-span-2 border-primary/25 shadow-sm">
                <CardHeader className="pb-4 border-b border-border/60 bg-muted/20">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Inbox className="h-5 w-5 text-primary" /> Google Workspace — Zajednički INBOX (Service Account)
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Povežite službeni Gmail sandučić društva pomoću Google Workspace Service Accounta s Domain-Wide Delegation ovlastima. Svi ovlašteni korisnici aplikacije moći će čitati i slati poštu bez pojedinačne prijave.
                      </CardDescription>
                    </div>

                    {/* Live Connection Status Badge */}
                    <div className="shrink-0">
                      {gmailConnectionStatus.loading ? (
                        <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3.5 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200">
                          <RefreshCw className="h-3.5 w-3.5 animate-spin text-slate-500" />
                          Provjera statusa...
                        </div>
                      ) : gmailConnectionStatus.connected ? (
                        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3.5 py-1.5 text-xs font-bold text-emerald-700 border border-emerald-200 shadow-xs">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span>Povezano s {gmailConnectionStatus.emailAddress}</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3.5 py-1.5 text-xs font-bold text-amber-800 border border-amber-200">
                          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                          <span>{gmailConnectionStatus.configured ? "Greška u povezivanju" : "Ključ ili sandučić nije podešen"}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-6 space-y-6">
                  {/* Detailed Status Banner */}
                  {!gmailConnectionStatus.loading && gmailConnectionStatus.connected && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
                        <div className="space-y-0.5 text-xs">
                          <p className="font-bold text-emerald-900 text-sm">
                            Povezano s {gmailConnectionStatus.emailAddress}
                          </p>
                          <p className="text-emerald-700">
                            Service Account: <span className="font-mono font-semibold">{gmailConnectionStatus.clientEmail}</span>
                            {gmailConnectionStatus.projectId ? ` (Projekt: ${gmailConnectionStatus.projectId})` : ""}
                            {typeof gmailConnectionStatus.messagesTotal === "number"
                              ? ` • Ukupno poruka u sandučiću: ${gmailConnectionStatus.messagesTotal}`
                              : ""}
                          </p>
                        </div>
                      </div>
                      <Link href="/gmail">
                        <Button size="sm" variant="outline" className="border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-100 font-semibold gap-1.5 shrink-0">
                          <Inbox className="h-3.5 w-3.5" /> Otvori INBOX
                        </Button>
                      </Link>
                    </div>
                  )}

                  {!gmailConnectionStatus.loading && !gmailConnectionStatus.connected && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                      <div className="space-y-1 text-xs text-amber-900">
                        <p className="font-bold text-sm">Zajednički INBOX trenutno nije aktivan</p>
                        <p className="text-amber-800">
                          {gmailConnectionStatus.error ||
                            "Učitajte ili zalijepite Service Account JSON ključ i unesite adresu službenog Google Workspace sandučića."}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="grid gap-6 lg:grid-cols-2">
                    {/* 1. Upload / Paste Service Account JSON */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <Label htmlFor="gmailServiceAccountJsonInput" className="font-semibold">
                          1. Service Account JSON ključ
                        </Label>
                        <div>
                          <input
                            ref={serviceAccountFileRef}
                            type="file"
                            accept=".json,application/json"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) handleServiceAccountFileUpload(file)
                              e.target.value = ""
                            }}
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs gap-1.5"
                            onClick={() => serviceAccountFileRef.current?.click()}
                          >
                            <Upload className="h-3.5 w-3.5" /> Učitaj .json datoteku
                          </Button>
                        </div>
                      </div>

                      <textarea
                        id="gmailServiceAccountJsonInput"
                        rows={7}
                        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        placeholder='{"type": "service_account", "project_id": "...", "private_key": "...", "client_email": "..."}'
                        value={gmailServiceAccountJson}
                        onChange={(e) => {
                          const val = e.target.value
                          setGmailServiceAccountJson(val)
                          setGoogleDriveSettings(val, settings.googleDriveFolderId || "")
                          validateServiceAccountInput(val)
                        }}
                      />

                      {gmailJsonValidation.valid ? (
                        <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-[11px] text-slate-700 flex flex-wrap items-center gap-x-4 gap-y-1">
                          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" /> JSON valjan
                          </span>
                          <span>
                            <strong>project_id:</strong> <code className="font-mono">{gmailJsonValidation.projectId}</code>
                          </span>
                          <span>
                            <strong>client_email:</strong> <code className="font-mono">{gmailJsonValidation.clientEmail}</code>
                          </span>
                        </div>
                      ) : gmailJsonValidation.error ? (
                        <p className="text-xs font-medium text-red-600 flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {gmailJsonValidation.error}
                        </p>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">
                          Učitajte `.json` datoteku ili zalijepite sadržaj ključa (obavezna polja: <code>project_id</code>, <code>client_email</code>, <code>private_key</code>).
                        </p>
                      )}
                    </div>

                    {/* 2. Impersonated User / Target Mailbox Email */}
                    <div className="space-y-4 flex flex-col justify-between">
                      <div className="space-y-3">
                        <Label htmlFor="gmailImpersonatedEmail" className="font-semibold">
                          2. Adresa sandučića (Impersonated User / Subject)
                        </Label>
                        <Input
                          id="gmailImpersonatedEmail"
                          type="email"
                          placeholder="tajnistvo@rodoslovlje.hr"
                          value={gmailTargetEmail}
                          onChange={(e) => setGmailTargetEmail(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Unesite punu Google Workspace e-mail adresu službenog sandučića društva kojim će aplikacija upravljati (npr.{" "}
                          <code className="font-mono text-foreground">tajnistvo@rodoslovlje.hr</code>,{" "}
                          <code className="font-mono text-foreground">info@rodoslovlje.hr</code> ili{" "}
                          <code className="font-mono text-foreground">rodoslovlje@rodoslovlje.hr</code>). Ova adresa koristi se kao{" "}
                          <code>subject</code> parametar prilikom JWT autorizacije.
                        </p>

                        <div className="rounded-lg border border-border/80 bg-muted/30 p-3 space-y-1.5 text-[11px] text-muted-foreground">
                          <p className="font-semibold text-foreground">Odobreni Google Workspace Scopeovi (Gmail & Drive DWD):</p>
                          <ul className="font-mono text-[10px] space-y-0.5 text-slate-600">
                            <li>• https://www.googleapis.com/auth/gmail.readonly</li>
                            <li>• https://www.googleapis.com/auth/gmail.send</li>
                            <li>• https://www.googleapis.com/auth/gmail.compose</li>
                            <li>• https://www.googleapis.com/auth/gmail.modify</li>
                            <li>• https://www.googleapis.com/auth/drive</li>
                            <li>• https://www.googleapis.com/auth/drive.file</li>
                          </ul>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-border">
                        <Button
                          type="button"
                          onClick={() => handleSaveAndTestGmailConfig("save-config")}
                          disabled={gmailConnectionStatus.loading}
                          className="gap-2"
                        >
                          {gmailConnectionStatus.loading ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                          Spremi i poveži sandučić
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleSaveAndTestGmailConfig("test-config")}
                          disabled={gmailConnectionStatus.loading}
                          className="gap-2"
                        >
                          <RefreshCw className={`h-4 w-4 ${gmailConnectionStatus.loading ? "animate-spin" : ""}`} />
                          Testiraj vezu
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

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
                      <div className="flex items-center justify-between">
                        <Label htmlFor="smtpPassNew">Lozinka</Label>
                        {user?.role === 'admin' && (
                          <button
                            type="button"
                            onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                            className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 focus:outline-none"
                            title={showSmtpPassword ? "Sakrij lozinku" : "Prikaži lozinku"}
                          >
                            {showSmtpPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            <span>{showSmtpPassword ? "Sakrij lozinku" : "Prikaži lozinku"}</span>
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <Input
                          id="smtpPassNew"
                          type={user?.role === 'admin' && showSmtpPassword ? "text" : "password"}
                          value={smtpConfig.smtpPass}
                          onChange={e => setSmtpConfig(p => ({ ...p, smtpPass: e.target.value }))}
                          className={user?.role === 'admin' ? "pr-10" : ""}
                        />
                        {user?.role === 'admin' && (
                          <button
                            type="button"
                            onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                            title={showSmtpPassword ? "Sakrij lozinku" : "Prikaži lozinku"}
                          >
                            {showSmtpPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        )}
                      </div>
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
                  <div className="flex gap-3">
                    <Button size="sm" onClick={handleSaveEmailConfig} className="gap-2"><Save className="h-4 w-4" /> Spremi predložak</Button>
                    <Button size="sm" variant="outline" className="gap-2" onClick={async () => {
                      setNotification("Slanje testnog e-maila...")
                      try {
                        const res = await fetch('/api/admin/settings/test-email?type=payment', { method: 'GET' })
                        const data = await res.json()
                        if (data.success) setNotification("Testni e-mail poslan na vašu adresu!")
                        else setLogoError(data.error || "Greška pri slanju.")
                      } catch (err) { setLogoError("Greška pri spajanju.") }
                    }}><Mail className="h-4 w-4" /> Pošalji testni mail na admina</Button>
                  </div>
                </CardContent>
              </Card>

              {/* Invitation Template */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="h-5 w-5 text-primary" /> Predložak za pozivnicu (Pristupni podaci)
                  </CardTitle>
                  <CardDescription>
                    Tekst koji članovi primaju kada im se šalju pristupni podaci ili resetira lozinka.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="invitationSubject">Naslov e-maila</Label>
                    <Input id="invitationSubject" value={emailConfig.invitationSubject} onChange={e => setEmailConfig(p => ({ ...p, invitationSubject: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invitationBody">Tekst poruke</Label>
                    <textarea id="invitationBody" rows={6} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" 
                      value={emailConfig.invitationBody} onChange={e => setEmailConfig(p => ({ ...p, invitationBody: e.target.value }))} />
                    <p className="text-[10px] text-muted-foreground">Možete koristiti varijable: {'{email}'}, {'{tempPassword}'}, {'{link}'}</p>
                  </div>
                  <div className="flex gap-3">
                    <Button size="sm" onClick={handleSaveEmailConfig} className="gap-2"><Save className="h-4 w-4" /> Spremi predložak</Button>
                    <Button size="sm" variant="outline" className="gap-2" onClick={async () => {
                      setNotification("Slanje testnog e-maila...")
                      try {
                        const res = await fetch('/api/admin/settings/test-email?type=invitation', { method: 'GET' })
                        const data = await res.json()
                        if (data.success) setNotification("Testni e-mail poslan na vašu adresu!")
                        else setLogoError(data.error || "Greška pri slanju.")
                      } catch (err) { setLogoError("Greška pri spajanju.") }
                    }}><Mail className="h-4 w-4" /> Pošalji testni mail na admina</Button>
                  </div>
                </CardContent>
              </Card>

              {/* Poll Template */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="h-5 w-5 text-primary" /> Predložak obavijesti o glasovanju
                  </CardTitle>
                  <CardDescription>
                    Tekst koji članovi primaju kada se otvori obavezno glasovanje (Sjednice).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="pollSubject">Naslov e-maila</Label>
                    <Input id="pollSubject" value={emailConfig.pollSubject} onChange={e => setEmailConfig(p => ({ ...p, pollSubject: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pollBody">Tekst poruke</Label>
                    <textarea id="pollBody" rows={6} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" 
                      value={emailConfig.pollBody} onChange={e => setEmailConfig(p => ({ ...p, pollBody: e.target.value }))} />
                    <p className="text-[10px] text-muted-foreground">Možete koristiti varijable: {'{pollTitle}'}, {'{link}'}</p>
                  </div>
                  <div className="flex gap-3">
                    <Button size="sm" onClick={handleSaveEmailConfig} className="gap-2"><Save className="h-4 w-4" /> Spremi predložak</Button>
                    <Button size="sm" variant="outline" className="gap-2" onClick={async () => {
                      setNotification("Slanje testnog e-maila...")
                      try {
                        const res = await fetch('/api/admin/settings/test-email?type=poll', { method: 'GET' })
                        const data = await res.json()
                        if (data.success) setNotification("Testni e-mail poslan na vašu adresu!")
                        else setLogoError(data.error || "Greška pri slanju.")
                      } catch (err) { setLogoError("Greška pri spajanju.") }
                    }}><Mail className="h-4 w-4" /> Pošalji testni mail na admina</Button>
                  </div>
                </CardContent>
              </Card>

              {/* Meeting Notification Template */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="h-5 w-5 text-primary" /> Predložak obavijesti o sjednici
                  </CardTitle>
                  <CardDescription>
                    Tekst koji Tijela društva primaju kada se kreira nova sjednica.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="meetingSubject">Naslov e-maila</Label>
                    <Input id="meetingSubject" value={emailConfig.meetingSubject} onChange={e => setEmailConfig(p => ({ ...p, meetingSubject: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="meetingBody">Tekst poruke (Zakazano)</Label>
                    <textarea id="meetingBody" rows={6} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" 
                      value={emailConfig.meetingBody} onChange={e => setEmailConfig(p => ({ ...p, meetingBody: e.target.value }))} />
                    <p className="text-[10px] text-muted-foreground">Možete koristiti varijable: {'{NASLOV}'}, {'{DATUM}'}, {'{VRIJEME}'}, {'{LOKACIJA}'}</p>
                  </div>
                  
                  <hr className="my-4" />
                  <p className="text-sm font-bold text-muted-foreground mb-2">Predložak nakon završetka (Sažetak)</p>
                  <div className="space-y-2">
                    <Label htmlFor="meetingSummarySubject">Naslov e-maila (Završeno)</Label>
                    <Input id="meetingSummarySubject" value={emailConfig.meetingSummarySubject} onChange={e => setEmailConfig(p => ({ ...p, meetingSummarySubject: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="meetingSummaryBody">Tekst poruke (Završeno)</Label>
                    <textarea id="meetingSummaryBody" rows={6} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" 
                      value={emailConfig.meetingSummaryBody} onChange={e => setEmailConfig(p => ({ ...p, meetingSummaryBody: e.target.value }))} />
                    <p className="text-[10px] text-muted-foreground">Možete koristiti varijable: {'{NASLOV}'}, {'{DATUM}'}, {'{VRIJEME}'}, {'{LOKACIJA}'}</p>
                  </div>
                  <div className="flex gap-3">
                    <Button size="sm" onClick={handleSaveEmailConfig} className="gap-2"><Save className="h-4 w-4" /> Spremi predložak</Button>
                    <Button size="sm" variant="outline" className="gap-2" onClick={async () => {
                      setNotification("Slanje testnog e-maila...")
                      try {
                        const res = await fetch('/api/admin/settings/test-email?type=meeting', { method: 'GET' })
                        const data = await res.json()
                        if (data.success) setNotification("Testni e-mail poslan na vašu adresu!")
                        else setLogoError(data.error || "Greška pri slanju.")
                      } catch (err) { setLogoError("Greška pri spajanju.") }
                    }}><Mail className="h-4 w-4" /> Pošalji testni mail na admina</Button>
                  </div>
                </CardContent>
              </Card>

              {/* Lecture Notification Template */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="h-5 w-5 text-primary" /> Predložak obavijesti o predavanju / druženju
                  </CardTitle>
                  <CardDescription>
                    Tekst koji Tijela društva primaju kada se kreira novo predavanje ili druženje.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="lectureSubject">Naslov e-maila</Label>
                    <Input id="lectureSubject" value={emailConfig.lectureSubject} onChange={e => setEmailConfig(p => ({ ...p, lectureSubject: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lectureBody">Tekst poruke (Zakazano)</Label>
                    <textarea id="lectureBody" rows={6} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" 
                      value={emailConfig.lectureBody} onChange={e => setEmailConfig(p => ({ ...p, lectureBody: e.target.value }))} />
                    <p className="text-[10px] text-muted-foreground">Možete koristiti varijable: {'{NASLOV}'}, {'{DATUM}'}, {'{VRIJEME}'}, {'{LOKACIJA}'}, {'{PREDAVAČ}'}</p>
                  </div>

                  <hr className="my-4" />
                  <p className="text-sm font-bold text-muted-foreground mb-2">Predložak nakon završetka (Sažetak)</p>
                  <div className="space-y-2">
                    <Label htmlFor="lectureSummarySubject">Naslov e-maila (Završeno)</Label>
                    <Input id="lectureSummarySubject" value={emailConfig.lectureSummarySubject} onChange={e => setEmailConfig(p => ({ ...p, lectureSummarySubject: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lectureSummaryBody">Tekst poruke (Završeno)</Label>
                    <textarea id="lectureSummaryBody" rows={6} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" 
                      value={emailConfig.lectureSummaryBody} onChange={e => setEmailConfig(p => ({ ...p, lectureSummaryBody: e.target.value }))} />
                    <p className="text-[10px] text-muted-foreground">Možete koristiti varijable: {'{NASLOV}'}, {'{DATUM}'}, {'{VRIJEME}'}, {'{LOKACIJA}'}, {'{PREDAVAČ}'}</p>
                  </div>
                  <div className="flex gap-3">
                    <Button size="sm" onClick={handleSaveEmailConfig} className="gap-2"><Save className="h-4 w-4" /> Spremi predložak</Button>
                    <Button size="sm" variant="outline" className="gap-2" onClick={async () => {
                      setNotification("Slanje testnog e-maila...")
                      try {
                        const res = await fetch('/api/admin/settings/test-email?type=lecture', { method: 'GET' })
                        const data = await res.json()
                        if (data.success) setNotification("Testni e-mail poslan na vašu adresu!")
                        else setLogoError(data.error || "Greška pri slanju.")
                      } catch (err) { setLogoError("Greška pri spajanju.") }
                    }}><Mail className="h-4 w-4" /> Pošalji testni mail na admina</Button>
                  </div>
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
                      <Button 
                        size="lg" 
                        className="gap-2 bg-red-600 hover:bg-red-700" 
                        onClick={() => setShowBulkPaymentDialog(true)}
                      >
                        <Mail className="h-5 w-5" /> Pregledaj i pošalji obavijesti (DUG)
                      </Button>
                    </div>
                  </div>

                  <PaymentReminderDialog
                    open={showBulkPaymentDialog}
                    onOpenChange={setShowBulkPaymentDialog}
                    mode="bulk"
                    debtorsList={debtorsList}
                    onSuccess={() => {
                      setNotification("✓ Obavijesti o dugovanjima su uspješno poslane.")
                    }}
                  />
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
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Prikazano ime</Label>
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

                  {user?.role === 'admin' && (
                    <div className="pt-4 border-t border-border space-y-3">
                      <div>
                        <Label htmlFor="adminDisplayName" className="font-semibold text-xs text-foreground uppercase tracking-wider">
                          Ime i prezime Administratora (za potpise i evidenciju slanja mailova)
                        </Label>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Upišite vaše ime i prezime kako bi se u internoj evidenciji i statusima poslanih e-mailova prikazivalo vaše ime umjesto općenitog "Administrator".
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          id="adminDisplayName"
                          value={adminNameInput}
                          onChange={(e) => setAdminNameInput(e.target.value)}
                          placeholder="npr. Ivan Horvat"
                          className="max-w-md h-9 text-xs"
                        />
                        <Button
                          type="button"
                          onClick={handleSaveAdminName}
                          disabled={isSavingAdminName}
                          className="shrink-0 gap-1.5 h-9 bg-primary text-primary-foreground text-xs"
                        >
                          {isSavingAdminName ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                          Spremi ime
                        </Button>
                      </div>
                      {adminNameSaved && (
                        <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Ime administratora je spremljeno u bazu i obuhvaćeno je sigurnosnom kopijom (backupom).
                        </p>
                      )}
                    </div>
                  )}
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

          {user?.role === 'admin' && (
            <TabsContent value="access" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Prava pristupa aplikaciji</CardTitle>
                  <CardDescription>
                    Pregled svih članova koji imaju pravo prijave u sustav i njihove razine ovlasti. Kliknite na ime člana kako biste uredili njegova prava.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-xl border border-border overflow-hidden bg-background shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted text-muted-foreground">
                          <tr>
                            <th className="p-4 text-left font-bold uppercase text-[10px] tracking-wider">Korisnik</th>
                            <th className="p-4 text-left font-bold uppercase text-[10px] tracking-wider">Uloga</th>
                            <th className="p-4 text-left font-bold uppercase text-[10px] tracking-wider">INBOX (Gmail) rola</th>
                            <th className="p-4 text-left font-bold uppercase text-[10px] tracking-wider">Moduli i dozvole</th>
                            <th className="p-4 text-center font-bold uppercase text-[10px] tracking-wider">Akcija</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {members
                            .filter(m => m.password || m.role === 'admin' || m.role === 'moderator' || m.invitationSent)
                            .map((member) => {
                              const accessCategories: Array<{ key: string; label: string }> = [
                                { key: 'members', label: 'Članovi' },
                                { key: 'meetings', label: 'Sjednice' },
                                { key: 'projects', label: 'Projekti' },
                                { key: 'finances', label: 'Financije' },
                                { key: 'archive', label: 'Arhiv' },
                                { key: 'drive', label: 'Drive' },
                                { key: 'logs', label: 'Logovi' },
                                { key: 'reports', label: 'Izvješća' },
                                { key: 'contacts', label: 'Imenik' },
                                { key: 'library', label: 'Knjižnica' },
                                { key: 'lectures', label: 'Predavanja / druženja' },
                                { key: 'links', label: 'Linkovi' },
                                { key: 'gmail', label: 'Gmail' },
                                { key: 'chronicle', label: 'Ljetopis' },
                                { key: 'polls', label: 'Glasovanja' },
                                { key: 'notifications', label: 'Obavijesti (Email)' },
                                { key: 'research_inquiries', label: 'Upiti i istraživanja' },
                              ]

                              return (
                                <tr key={member.id} className="hover:bg-muted/30 transition-colors">
                                  <td className="p-4">
                                    <div className="flex items-center gap-3">
                                      <Avatar className="h-9 w-9">
                                        <AvatarImage src={member.avatar} alt={member.name} />
                                        <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                                          {member.initials || member.name.substring(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div className="min-w-0">
                                        <Link 
                                          href={`/members/${member.id}`}
                                          className="font-bold text-slate-800 hover:text-accent transition-colors block text-sm"
                                        >
                                          {member.name}
                                        </Link>
                                        <span className="text-xs text-muted-foreground block">{member.email}</span>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="p-4 font-medium">
                                    {member.role === 'admin' ? (
                                      <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-1 text-xs font-bold text-red-700 ring-1 ring-inset ring-red-600/10">
                                        Administrator
                                      </span>
                                    ) : member.role === 'moderator' ? (
                                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700 ring-1 ring-inset ring-blue-600/10">
                                        Moderator
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center rounded-full bg-slate-50 px-2 py-1 text-xs font-bold text-slate-700 ring-1 ring-inset ring-slate-600/10">
                                        Član
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-4">
                                    {member.role === 'admin' ? (
                                      <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                                        Čitanje i slanje (Admin)
                                      </span>
                                    ) : (
                                      <select
                                        value={
                                          member.accessRights?.gmail?.edit
                                            ? 'send'
                                            : member.accessRights?.gmail?.view
                                            ? 'read'
                                            : 'none'
                                        }
                                        onChange={async (e) => {
                                          const val = e.target.value
                                          const nextGmailRight =
                                            val === 'send'
                                              ? { view: true, edit: true }
                                              : val === 'read'
                                              ? { view: true, edit: false }
                                              : { view: false, edit: false }
                                          const updatedRights = {
                                            ...(member.accessRights || {}),
                                            gmail: nextGmailRight,
                                          } as any
                                          await updateMember(member.id, { accessRights: updatedRights })
                                          setNotification(
                                            `Ažurirana Gmail INBOX ovlast za člana ${member.name}: ${
                                              val === 'send'
                                                ? 'Čitanje i slanje'
                                                : val === 'read'
                                                ? 'Samo čitanje'
                                                : 'Bez pristupa'
                                            }`
                                          )
                                        }}
                                        className="rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                      >
                                        <option value="none">Bez pristupa</option>
                                        <option value="read">Samo čitanje (pregled)</option>
                                        <option value="send">Čitanje i slanje (odgovaranje)</option>
                                      </select>
                                    )}
                                  </td>
                                  <td className="p-4">
                                    {member.role === 'admin' ? (
                                      <span className="text-xs text-muted-foreground font-medium">Puni pristup svim modulima</span>
                                    ) : (
                                      <div className="flex flex-wrap gap-1.5 max-w-md">
                                        {accessCategories.map(({ key, label }) => {
                                          const rights = (member as any).accessRights?.[key] ?? { view: false, edit: false }
                                          if (!rights.view && !rights.edit) return null

                                          return (
                                            <span 
                                              key={key} 
                                              className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold ring-1 ring-inset ${
                                                rights.edit 
                                                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/10' 
                                                  : 'bg-indigo-50 text-indigo-700 ring-indigo-600/10'
                                              }`}
                                            >
                                              {label}{rights.edit ? ' (P/U)' : ' (P)'}
                                            </span>
                                          )
                                        })}
                                        {(!member.accessRights || Object.keys(member.accessRights).length === 0 || 
                                         accessCategories.every(({ key }) => {
                                           const r = (member as any).accessRights?.[key]
                                           return !r?.view && !r?.edit
                                         })) && (
                                          <span className="text-xs text-muted-foreground/60 italic font-medium">Nema dodijeljenih dozvola</span>
                                        )}
                                      </div>
                                    )}
                                  </td>
                                  <td className="p-4 text-center">
                                    <Link href={`/members/${member.id}`}>
                                      <Button variant="outline" size="sm" className="rounded-full px-4 text-xs font-bold border-border bg-white hover:bg-muted">
                                        Uredi prava
                                      </Button>
                                    </Link>
                                  </td>
                                </tr>
                              )
                            })}
                          {members.filter(m => m.password || m.role === 'admin' || m.role === 'moderator' || m.invitationSent).length === 0 && (
                            <tr>
                              <td colSpan={4} className="p-8 text-center text-muted-foreground italic font-medium">
                                Nema članova s aktiviranim pristupom aplikaciji.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle>Google Workspace (Drive & Zajednički Gmail INBOX)</CardTitle>
              <CardDescription>
                Povežite Google Drive repozitorij i službeni Gmail sandučić društva koristeći Google Service Account s Domain-Wide Delegation ovlastima.
              </CardDescription>
            </div>
            {gmailConnectionStatus.connected && (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200 shrink-0">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Povezano s {gmailConnectionStatus.emailAddress}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="serviceAccountJson">Google Service Account JSON</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1.5"
                  onClick={() => serviceAccountFileRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5" /> Učitaj .json datoteku
                </Button>
              </div>
              <textarea
                id="serviceAccountJson"
                className="flex min-h-[150px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
                placeholder='{"type": "service_account", ...}'
                value={gmailServiceAccountJson}
                onChange={(e) => {
                  const val = e.target.value
                  setGmailServiceAccountJson(val)
                  setGoogleDriveSettings(val, settings.googleDriveFolderId || "")
                  validateServiceAccountInput(val)
                }}
              />
              <p className="text-xs text-muted-foreground">
                Zalijepite ili učitajte sadržaj cijelog JSON ključa koji ste preuzeli s Google Cloud Console-a.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="gmailTargetEmailIntegrations">Adresa Gmail sandučića društva (Impersonated User / Subject)</Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  id="gmailTargetEmailIntegrations"
                  type="email"
                  placeholder="tajnistvo@rodoslovlje.hr"
                  value={gmailTargetEmail}
                  onChange={(e) => setGmailTargetEmail(e.target.value)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => handleSaveAndTestGmailConfig("save-config")}
                  disabled={gmailConnectionStatus.loading}
                  className="shrink-0 gap-1.5"
                >
                  <Save className="h-4 w-4" /> Spremi i testiraj Gmail
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Službena e-mail adresa za zajednički INBOX (npr. <code>tajnistvo@rodoslovlje.hr</code> ili <code>rodoslovlje@rodoslovlje.hr</code>).
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="folderId">Google Drive Target Folder ID</Label>
              <Input
                id="folderId"
                placeholder="npr. 1abc2def3ghi4jkl..."
                value={settings.googleDriveFolderId || ""}
                onChange={(e) => {
                  setGoogleDriveSettings(settings.googleServiceAccountJson || "", e.target.value)
                }}
              />
              <p className="text-xs text-muted-foreground">
                ID mape se nalazi u URL-u: drive.google.com/drive/folders/<strong>ID_MAPE_JE_OVDJE</strong>
              </p>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <input
                type="checkbox"
                id="googleDriveOnlyDownload"
                checked={!!settings.googleDriveOnlyDownload}
                onChange={(e) => setGoogleDriveOnlyDownload(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="googleDriveOnlyDownload" className="font-semibold text-slate-700">
                Samo preuzimanje (Only Download)
              </Label>
            </div>
            <p className="text-xs text-muted-foreground pl-6">
              Korisnici mogu pregledavati i preuzimati datoteke, ali ne mogu učitavati nove ili brisati postojeće.
            </p>

            <div className="flex flex-wrap gap-4 pt-4 border-t border-border">
              <Button 
                onClick={async () => {
                  setLogoError("")
                  setNotification("Testiranje Google Drive veze...")
                  try {
                    const response = await fetch('/api/admin/settings/google-drive', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        googleServiceAccountJson: gmailServiceAccountJson,
                        googleDriveFolderId: settings.googleDriveFolderId,
                        gmailMailbox: gmailTargetEmail,
                        action: 'test'
                      })
                    })
                    const data = await response.json()
                    if (data.success) {
                      setNotification(data.message)
                    } else {
                      setLogoError(data.message)
                    }
                  } catch (err) {
                    setLogoError("Greška pri spajanju na API.")
                  }
                }} 
                variant="outline"
              >
                Testiraj Google Drive vezu
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
                      googleServiceAccountJson: gmailServiceAccountJson,
                      googleDriveFolderId: settings.googleDriveFolderId,
                      gmailMailbox: gmailTargetEmail
                    })
                  })
                  if (response.ok) {
                    await refreshSettings()
                    setNotification("Google Workspace (Drive & Gmail) postavke su uspješno spremljene.")
                  } else {
                    setLogoError("Greška pri spremanju postavki.")
                  }
                } catch (err) {
                  setLogoError("Greška pri komunikaciji s poslužiteljem.")
                }
              }} className="gap-2">
                <Save className="h-4 w-4" /> Spremi sve Google Workspace postavke
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" /> Dropbox Integracija & Sigurnosna Kopija
          </CardTitle>
          <CardDescription>
            Povežite svoj Dropbox račun za automatsku izradu sigurnosnih kopija baze podataka i svih učitanih datoteka svakih 7 dana.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dropboxAppKey">Dropbox App Key</Label>
              <Input
                id="dropboxAppKey"
                placeholder="Unesite Dropbox App Key"
                value={dropboxConfig.dropboxAppKey}
                onChange={(e) => setDropboxConfig(prev => ({ ...prev, dropboxAppKey: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dropboxAppSecret">Dropbox App Secret</Label>
              <Input
                id="dropboxAppSecret"
                type="password"
                placeholder="Unesite Dropbox App Secret"
                value={dropboxConfig.dropboxAppSecret}
                onChange={(e) => setDropboxConfig(prev => ({ ...prev, dropboxAppSecret: e.target.value }))}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="dropboxRefreshToken">Dropbox Refresh Token</Label>
              <Input
                id="dropboxRefreshToken"
                type="password"
                placeholder="Unesite Dropbox OAuth2 Refresh Token"
                value={dropboxConfig.dropboxRefreshToken}
                onChange={(e) => setDropboxConfig(prev => ({ ...prev, dropboxRefreshToken: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Dropbox koristi kratkotrajne pristupne tokene. Osvježavajući token (Refresh Token) omogućava automatsku prijavu u pozadini.
              </p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="dropboxFolderPath">Odredišna mapa na Dropboxu</Label>
              <Input
                id="dropboxFolderPath"
                placeholder="npr. /backups ili /Apps/HRD-CMS/Backup"
                value={dropboxConfig.dropboxFolderPath}
                onChange={(e) => setDropboxConfig(prev => ({ ...prev, dropboxFolderPath: e.target.value }))}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="backupIntervalDays">Interval automatskog backupa (u danima)</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="backupIntervalDays"
                  type="number"
                  min={1}
                  max={365}
                  className="w-32"
                  value={settings.backupIntervalDays || 7}
                  onChange={(e) => setBackupIntervalDays(Number(e.target.value))}
                />
                <span className="text-sm text-muted-foreground">dana (npr. 7 = jednom tjedno, 1 = svaki dan)</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 pt-4 border-t border-border">
            <Button
              variant="outline"
              disabled={isTestingDropbox || !dropboxConfig.dropboxAppKey}
              onClick={handleTestDropbox}
              className="gap-2"
            >
              {isTestingDropbox ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
              Testiraj Dropbox Vezu
            </Button>

            <Button
              onClick={handleSaveDropbox}
              disabled={!dropboxConfig.dropboxAppKey}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              Spremi Dropbox Postavke
            </Button>
          </div>

          <div className="pt-6 border-t border-border space-y-4">
            <div>
              <h4 className="font-semibold text-slate-800">Status Sigurnosne Kopije (Backup)</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Automatski backup se pokreće svakih 7 dana u pozadini ako su unesene Dropbox postavke.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground font-medium">Zadnji backup:</span>
                  <span className="ml-2 font-semibold text-slate-700">
                    {settings.lastBackupTimestamp ? new Date(settings.lastBackupTimestamp).toLocaleString('hr-HR') : 'Nikada'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground font-medium">Status:</span>
                  <span className={`ml-2 font-semibold ${settings.lastBackupStatus?.includes('Success') ? 'text-green-600' : settings.lastBackupStatus ? 'text-red-600' : 'text-slate-500'}`}>
                    {settings.lastBackupStatus || 'Nema zapisa'}
                  </span>
                </div>
              </div>

              <div className="pt-2 space-y-2">
                <Button
                  onClick={handleRunBackup}
                  disabled={isRunningBackup || !settings.dropboxRefreshToken}
                  className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium"
                >
                  {isRunningBackup ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                  Pokreni Ručni Backup Sada
                </Button>

                <Button
                  type="button"
                  onClick={() => setShowSimulationModal(true)}
                  variant="outline"
                  className="w-full gap-2 border-amber-300 bg-amber-50/70 hover:bg-amber-100/80 text-amber-950 font-bold shadow-sm"
                >
                  <ShieldCheck className="h-4 w-4 text-amber-600" />
                  🔍 Simuliraj i provjeri valjanost backupa (Dry-Run)
                </Button>
              </div>
            </div>

            <BackupSimulationDialog
              isOpen={showSimulationModal}
              onClose={() => setShowSimulationModal(false)}
            />

            <div className="mt-6 border-t border-border pt-6">
              <h4 className="font-semibold text-slate-800 mb-4">Uvoz podataka (Restore)</h4>
              <div className="rounded-xl border border-red-100 bg-red-50/50 p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-red-800">Upozorenje: Ovo će prebrisati SVE trenutne podatke!</p>
                    <p className="text-xs text-red-600/80">
                      Prije uvoza sustav će automatski kreirati pre-restore sigurnosnu kopiju trenutnog stanja na Dropboxu.
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3 items-center">
                  <Input 
                    type="file" 
                    accept=".db,.zip" 
                    className="flex-1 bg-white"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      
                      if (!confirm("Jeste li sigurni da želite vratiti podatke iz ove datoteke? Svi trenutni podaci bit će trajno izbrisani.")) {
                        e.target.value = ''
                        return
                      }

                      setNotification("Započinjem prijenos...")
                      setUploadProgress(0)
                      const formData = new FormData()
                      formData.append('file', file)

                      const xhr = new XMLHttpRequest()
                      xhr.open('POST', '/api/settings/restore', true)
                      
                      xhr.upload.onprogress = (event) => {
                        if (event.lengthComputable) {
                          const percentComplete = Math.round((event.loaded / event.total) * 100)
                          setUploadProgress(percentComplete)
                        }
                      }
                      
                      xhr.onload = function() {
                        if (xhr.status >= 200 && xhr.status < 300) {
                          try {
                            const data = JSON.parse(xhr.responseText)
                            if (data.success) {
                              setNotification(data.message)
                              setTimeout(() => window.location.reload(), 2000)
                            } else {
                              setLogoError(data.error || "Greška pri vraćanju podataka.")
                            }
                          } catch (err) {
                            setLogoError("Greška pri parsiranju odgovora poslužitelja.")
                          }
                        } else {
                          try {
                            const data = JSON.parse(xhr.responseText)
                            setLogoError(data.error || "Greška pri vraćanju podataka.")
                          } catch (err) {
                            setLogoError("Greška pri komunikaciji s poslužiteljem.")
                          }
                        }
                        setUploadProgress(null)
                      }
                      
                      xhr.onerror = function() {
                        setLogoError("Greška mreže pri komunikaciji s poslužiteljem.")
                        setUploadProgress(null)
                      }
                      
                      xhr.send(formData)
                    }}
                  />
                  <p className="text-[10px] text-muted-foreground w-full sm:w-auto text-center sm:text-left">
                    Odaberite .db ili .zip datoteku za povrat podataka.
                  </p>
                </div>
                {uploadProgress !== null && (
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Učitavanje baze u tijeku...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} className="h-2" />
                  </div>
                )}
              </div>
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
