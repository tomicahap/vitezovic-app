"use client"

import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Eye, EyeOff, Lock, Save, Upload, Settings as SettingsIcon, Plus, MapPin, List, Mail, Database, Download, RefreshCw, FileStack, GripVertical, Trash, ChevronDown, ChevronUp, AlertTriangle, ShieldCheck, CheckCircle2, FileJson, Inbox, Copy, Check, ExternalLink, KeyRound, Globe, Server, Search, FileText, Sparkles, Filter, Terminal, Shield, Printer, Wrench, Megaphone, Users, HardDrive, HeartHandshake } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { useAuth } from "@/contexts/auth-context"
import { useActivityLog } from "@/contexts/activity-log-context"
import { useSettings } from "@/contexts/settings-context"
import { useSearchParams } from "next/navigation"
import { generateId, formatDateTimeDMY } from "@/lib/utils"
import { ContributorTemplate, ContributorField } from "@/contexts/settings-context"
import { useMembers } from "@/contexts/members-context"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { PaymentReminderDialog } from "@/components/payment-reminder-dialog"
import { MissingDataEmailDialog } from "@/components/missing-data-email-dialog"
import { HrdOfficialEmailComposerDialog } from "@/components/hrd-official-email-composer-dialog"
import { BackupSimulationDialog } from "@/components/backup-simulation-dialog"
import { AdminMembersCleanupDialog } from "@/components/admin-members-cleanup-dialog"
import { MembersImportDialog } from "@/components/members-import-dialog"
import { SettingsDonationsTab } from "@/components/settings-donations-tab"
import {
  ACTION_BUTTON_STYLES,
  CloseActionButton,
  SaveActionButton,
} from "@/components/ui/action-bar"
import { SettingsAccessTab } from "@/components/settings-access-tab"
import { SettingsAdminInactivityCard } from "@/components/settings-admin-inactivity-card"
import { SettingsStorageMonitorCard } from "@/components/settings-storage-monitor-card"
import { DesktopHeaderNav } from "@/components/desktop-header-nav"
import { getUserAccessRights } from "@/lib/inquiry-permissions"

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Trenutna lozinka je obavezna"),
  newPassword: z.string().min(6, "Nova lozinka mora imati najmanje 6 znakova"),
  confirmPassword: z.string().min(1, "Potvrda lozinke je obavezna"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Lozinke se ne podudaraju",
  path: ["confirmPassword"],
})

type PasswordFormData = z.infer<typeof passwordSchema>

export interface VaultAccountItem {
  id: number
  title: string
  username: string
  password: string
  url?: string
  category?: string
  notes?: string
  created_at?: string
  updated_at?: string
}

const VAULT_PRESETS = [
  { title: "GMAIL / Google Workspace", category: "E-mail", url: "https://mail.google.com" },
  { title: "PUTTY / SSH Poslužitelj", category: "Poslužitelj", url: "" },
  { title: "CPANEL / Web Hosting", category: "Hosting", url: "" },
  { title: "GOOGLE CLOUD CONSOLE", category: "Servisi", url: "https://console.cloud.google.com" },
  { title: "DROPBOX Backup", category: "Pohrana", url: "https://www.dropbox.com" },
  { title: "FACEBOOK Stranica", category: "Društvene mreže", url: "https://facebook.com" },
  { title: "CARNET / DNS Domena", category: "Domena", url: "https://domene.hr" },
  { title: "WIFI Usmjernik (Router)", category: "Mreža", url: "http://192.168.1.1" },
  { title: "MYSQL / Baza podataka", category: "Baza", url: "" },
]

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
  const { members, updateMember, exportMembers } = useMembers()
  const debtorsList = members.filter(m => !m.doNotContact && !m.deceased && (m.status_clana === 'DUG' || m.paymentStatus === 'overdue'))

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
    isAdminSettingsLoaded,
    loadAdminSettings,
    setLogoUrl, 
    setBoardNotice,
    setOverdueAfterDays, 
    setExpiredAfterDays, 
    setRequirePaymentToBeActive, 
    setMaintenanceMode,
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

  useEffect(() => {
    if (user?.role === 'admin' && !isAdminSettingsLoaded) {
      loadAdminSettings()
    }
  }, [user?.role, isAdminSettingsLoaded, loadAdminSettings])
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  
  const [overdueDays, setOverdueDays] = useState(settings.overdueAfterDays)
  const [inactiveDays, setInactiveDays] = useState(settings.expiredAfterDays)
  const [requirePayment, setRequirePayment] = useState(Boolean(settings.requirePaymentToBeActive))
  const [driveUrl, setDriveUrl] = useState(settings.googleDriveUrl || "")
  const [adminNameInput, setAdminNameInput] = useState(settings.adminName || "")
  const [isSavingAdminName, setIsSavingAdminName] = useState(false)
  const [adminNameSaved, setAdminNameSaved] = useState(false)
  const [isTogglingMaintenance, setIsTogglingMaintenance] = useState(false)
  const [boardNoticeDraft, setBoardNoticeDraft] = useState(settings.boardNotice || "")
  const [isSavingBoardNotice, setIsSavingBoardNotice] = useState(false)
  const [cleanupDialogOpen, setCleanupDialogOpen] = useState(false)
  const [backupEmail, setBackupEmail] = useState(settings.adminBackupEmail || "")
  const [backupPassword, setBackupPassword] = useState(settings.adminBackupPassword || "")
  const [vaultNotes, setVaultNotesLocal] = useState(settings.vaultNotes || "")

  // Trezor računa i platformi
  const [vaultAccounts, setVaultAccounts] = useState<VaultAccountItem[]>([])
  const [vaultAccountsLoading, setVaultAccountsLoading] = useState(false)
  const [vaultSearch, setVaultSearch] = useState("")
  const [vaultCategoryFilter, setVaultCategoryFilter] = useState("sve")
  const [missingDataDialogOpen, setMissingDataDialogOpen] = useState(false)
  const [officialComposerOpen, setOfficialComposerOpen] = useState(false)
  const [templatePreviewModal, setTemplatePreviewModal] = useState<{
    open: boolean
    type: string
    title: string
    subject: string
    html: string
    loading: boolean
    testTo: string
    sending: boolean
    resultMsg: string
    errorMsg: string
  }>({
    open: false,
    type: "payment",
    title: "",
    subject: "",
    html: "",
    loading: false,
    testTo: "",
    sending: false,
    resultMsg: "",
    errorMsg: "",
  })

  const openTemplatePreview = async (type: string, title: string) => {
    const defaultTo = user?.email || smtpConfig.smtpFrom || settings.smtpFrom || ""
    setTemplatePreviewModal({
      open: true,
      type,
      title,
      subject: "",
      html: "",
      loading: true,
      testTo: defaultTo,
      sending: false,
      resultMsg: "",
      errorMsg: "",
    })
    try {
      const res = await fetch(`/api/admin/settings/test-email?type=${encodeURIComponent(type)}&preview=1`)
      const data = await res.json()
      if (data.success && data.html) {
        setTemplatePreviewModal((prev) => ({
          ...prev,
          loading: false,
          subject: data.subject || title,
          html: data.html,
        }))
      } else {
        setTemplatePreviewModal((prev) => ({
          ...prev,
          loading: false,
          errorMsg: data.error || "Greška pri učitavanju pregleda predloška.",
        }))
      }
    } catch {
      setTemplatePreviewModal((prev) => ({
        ...prev,
        loading: false,
        errorMsg: "Greška pri spajanju s poslužiteljem.",
      }))
    }
  }

  const sendTemplateTestFromModal = async () => {
    setTemplatePreviewModal((prev) => ({ ...prev, sending: true, resultMsg: "", errorMsg: "" }))
    try {
      const targetTo = templatePreviewModal.testTo.trim()
      const url = `/api/admin/settings/test-email?type=${encodeURIComponent(templatePreviewModal.type)}${
        targetTo ? `&to=${encodeURIComponent(targetTo)}` : ""
      }`
      const res = await fetch(url, { method: "GET" })
      const data = await res.json()
      if (data.success) {
        setTemplatePreviewModal((prev) => ({
          ...prev,
          sending: false,
          resultMsg: data.message || "Testni e-mail uspješno je poslan!",
        }))
      } else {
        setTemplatePreviewModal((prev) => ({
          ...prev,
          sending: false,
          errorMsg: data.error || "Greška pri slanju testnog e-maila.",
        }))
      }
    } catch {
      setTemplatePreviewModal((prev) => ({
        ...prev,
        sending: false,
        errorMsg: "Greška pri spajanju s poslužiteljem.",
      }))
    }
  }
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false)
  const [editingAccountId, setEditingAccountId] = useState<number | null>(null)
  const [accountFormData, setAccountFormData] = useState({
    title: "",
    username: "",
    password: "",
    url: "",
    category: "Općenito",
    notes: ""
  })
  const [visiblePasswords, setVisiblePasswords] = useState<Record<number, boolean>>({})
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [showAllVaultPasswords, setShowAllVaultPasswords] = useState(false)
  const [isSavingAccount, setIsSavingAccount] = useState(false)
  const [showPasswordInModal, setShowPasswordInModal] = useState(false)
  
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
    birthdaySubject: settings.birthdayEmailSubject || "",
    birthdayBody: settings.birthdayEmailBody || "",
    missingDataSubject: settings.missingDataEmailSubject || "",
    missingDataBody: settings.missingDataEmailBody || "",
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
  const rawTabParam = searchParams.get('tab') || 'general'
  const resolveTabName = (tab: string) => {
    if (tab === 'meetings-config' || tab === 'templates') return 'membership'
    if (tab === 'restore') return 'backup'
    if (tab === 'donations') return 'donations-settings'
    return tab
  }
  const [activeTab, setActiveTab] = useState<string>(() => resolveTabName(rawTabParam))
  useEffect(() => {
    setActiveTab(resolveTabName(rawTabParam))
  }, [rawTabParam])

  const syncedSettingsSignatureRef = useRef<string>("")

  useEffect(() => {
    const syncSnapshot = {
      boardNotice: settings.boardNotice,
      overdueAfterDays: settings.overdueAfterDays,
      expiredAfterDays: settings.expiredAfterDays,
      requirePaymentToBeActive: settings.requirePaymentToBeActive,
      googleDriveUrl: settings.googleDriveUrl,
      googleServiceAccountJson: settings.googleServiceAccountJson,
      gmailMailbox: settings.gmailMailbox,
      adminName: settings.adminName,
      adminBackupEmail: settings.adminBackupEmail,
      adminBackupPassword: settings.adminBackupPassword,
      vaultNotes: settings.vaultNotes,
      logoUrl: settings.logoUrl,
      smtpHost: settings.smtpHost,
      smtpPort: settings.smtpPort,
      smtpUser: settings.smtpUser,
      smtpPass: settings.smtpPass,
      smtpFrom: settings.smtpFrom,
      smtpSecure: settings.smtpSecure,
      paymentEmailSubject: settings.paymentEmailSubject,
      paymentEmailBody: settings.paymentEmailBody,
      invitationEmailSubject: settings.invitationEmailSubject,
      invitationEmailBody: settings.invitationEmailBody,
      pollEmailSubject: settings.pollEmailSubject,
      pollEmailBody: settings.pollEmailBody,
      meetingNotificationSubject: settings.meetingNotificationSubject,
      meetingNotificationBody: settings.meetingNotificationBody,
      meetingSummarySubject: settings.meetingSummarySubject,
      meetingSummaryBody: settings.meetingSummaryBody,
      lectureNotificationSubject: settings.lectureNotificationSubject,
      lectureNotificationBody: settings.lectureNotificationBody,
      lectureSummarySubject: settings.lectureSummarySubject,
      lectureSummaryBody: settings.lectureSummaryBody,
      birthdayEmailSubject: settings.birthdayEmailSubject,
      birthdayEmailBody: settings.birthdayEmailBody,
      missingDataEmailSubject: settings.missingDataEmailSubject,
      missingDataEmailBody: settings.missingDataEmailBody,
      paymentSlipUrl: settings.paymentSlipUrl,
      paymentQrUrl: settings.paymentQrUrl,
      paymentEmailSignature: settings.paymentEmailSignature,
      projectContributorTemplates: settings.projectContributorTemplates,
      dropboxAppKey: settings.dropboxAppKey,
      dropboxAppSecret: settings.dropboxAppSecret,
      dropboxRefreshToken: settings.dropboxRefreshToken,
      dropboxFolderPath: settings.dropboxFolderPath,
    }
    const sig = JSON.stringify(syncSnapshot)
    if (syncedSettingsSignatureRef.current === sig) return
    syncedSettingsSignatureRef.current = sig
    setBoardNoticeDraft(settings.boardNotice || "")
    setOverdueDays(settings.overdueAfterDays)
    setInactiveDays(settings.expiredAfterDays)
    setRequirePayment(Boolean(settings.requirePaymentToBeActive))
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
      birthdaySubject: settings.birthdayEmailSubject || "",
      birthdayBody: settings.birthdayEmailBody || "",
      missingDataSubject: settings.missingDataEmailSubject || "",
      missingDataBody: settings.missingDataEmailBody || "",
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
    setRequirePaymentToBeActive(requirePayment)
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

  // Funkcije za Trezor računa i platformi
  const fetchVaultAccounts = async () => {
    if (user?.role !== 'admin') return
    setVaultAccountsLoading(true)
    try {
      const res = await fetch('/api/admin/vault', {
        headers: { 'Authorization': `Bearer ${user?.role || 'admin'}` }
      })
      const data = await res.json()
      if (data.items) {
        setVaultAccounts(data.items)
      }
    } catch (e) {
      console.error("Greška pri dohvaćanju računa trezora:", e)
    } finally {
      setVaultAccountsLoading(false)
    }
  }

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchVaultAccounts()
    }
  }, [user?.role])

  const handleOpenAddAccount = (preset?: { title: string; category: string; url?: string }) => {
    setEditingAccountId(null)
    setAccountFormData({
      title: preset?.title || "",
      username: "",
      password: "",
      url: preset?.url || "",
      category: preset?.category || "Općenito",
      notes: ""
    })
    setShowPasswordInModal(false)
    setIsAccountModalOpen(true)
  }

  const handleEditAccount = (item: VaultAccountItem) => {
    setEditingAccountId(item.id)
    setAccountFormData({
      title: item.title,
      username: item.username || "",
      password: item.password || "",
      url: item.url || "",
      category: item.category || "Općenito",
      notes: item.notes || ""
    })
    setShowPasswordInModal(false)
    setIsAccountModalOpen(true)
  }

  const handleSaveAccountModal = async () => {
    if (!accountFormData.title.trim()) {
      alert("Molimo unesite naziv platforme ili servisa.")
      return
    }

    setIsSavingAccount(true)
    try {
      const isEditing = editingAccountId !== null
      const method = isEditing ? 'PUT' : 'POST'
      const payload = isEditing ? { ...accountFormData, id: editingAccountId } : accountFormData

      const res = await fetch('/api/admin/vault', {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.role || 'admin'}`
        },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!res.ok) {
        alert(data.error || "Greška pri spremanju.")
        return
      }

      setIsAccountModalOpen(false)
      fetchVaultAccounts()
      setNotification(isEditing ? "Pristupni račun je uspješno ažuriran." : "Novi račun je dodan u Trezor.")
    } catch (e) {
      alert("Došlo je do pogreške pri spremanju.")
    } finally {
      setIsSavingAccount(false)
    }
  }

  const handleDeleteAccount = async (id: number, title: string) => {
    if (!confirm(`Jeste li sigurni da želite obrisati podatke za platformu "${title}"?`)) return

    try {
      const res = await fetch(`/api/admin/vault?id=${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${user?.role || 'admin'}` }
      })
      if (res.ok) {
        fetchVaultAccounts()
        setNotification(`Podaci za "${title}" su obrisani iz Trezora.`)
      } else {
        const data = await res.json()
        alert(data.error || "Greška pri brisanju.")
      }
    } catch (e) {
      alert("Došlo je do pogreške pri brisanju.")
    }
  }

  const copyToClipboard = async (text: string, key: string) => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2500)
    } catch (err) {
      console.error("Copy failed", err)
    }
  }

  const generateRandomPassword = () => {
    const length = 18
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~|}{[]:;?><,.-="
    let retVal = ""
    for (let i = 0, n = charset.length; i < length; ++i) {
      retVal += charset.charAt(Math.floor(Math.random() * n))
    }
    setAccountFormData(prev => ({ ...prev, password: retVal }))
    setShowPasswordInModal(true)
  }

  const handlePrintVault = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const now = new Date().toLocaleDateString('hr-HR')
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>HRD - Sigurnosni Trezor Pristupnih Podataka</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 30px; color: #111; line-height: 1.5; font-size: 13px; }
          h1 { font-size: 20px; border-bottom: 2px solid #b91c1c; padding-bottom: 8px; margin-bottom: 4px; color: #991b1b; }
          .subtitle { color: #666; font-size: 12px; margin-bottom: 24px; }
          .badge { display: inline-block; padding: 2px 6px; font-size: 10px; font-weight: bold; background: #fee2e2; color: #991b1b; border-radius: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th, td { border: 1px solid #ddd; padding: 8px 10px; text-align: left; vertical-align: top; }
          th { background: #f8fafc; font-weight: 600; font-size: 11px; text-transform: uppercase; color: #475569; }
          .mono { font-family: monospace; font-size: 12px; background: #f1f5f9; padding: 2px 5px; border-radius: 3px; }
          .notes-box { margin-top: 30px; padding: 15px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; white-space: pre-wrap; font-family: monospace; font-size: 12px; }
          @media print { body { padding: 10px; } }
        </style>
      </head>
      <body>
        <h1>HRD „Pavao Ritter Vitezović” — Sigurnosni Trezor</h1>
        <div class="subtitle">Povjerljivi pristupni podaci i računi za kontinuitet upravljanja sustavima • Generirano: ${now}</div>
        
        <h3>1. Pristupni računi po platformama</h3>
        <table>
          <thead>
            <tr>
              <th style="width: 25%">Platforma / Servis</th>
              <th style="width: 25%">Korisničko ime / Račun</th>
              <th style="width: 25%">Lozinka / Ključ</th>
              <th style="width: 25%">Pristupni URL / Upute</th>
            </tr>
          </thead>
          <tbody>
            ${vaultAccounts.map(a => `
              <tr>
                <td><strong>${a.title}</strong><br><span class="badge">${a.category || 'Općenito'}</span></td>
                <td><span class="mono">${a.username || '—'}</span></td>
                <td><span class="mono">${a.password || '—'}</span></td>
                <td>
                  ${a.url ? `<div><a href="${a.url}">${a.url}</a></div>` : ''}
                  ${a.notes ? `<div style="font-size: 11px; color: #64748b; margin-top: 4px;">${a.notes}</div>` : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        ${vaultNotes ? `
          <h3 style="margin-top: 35px;">2. Općenite administratorske bilješke</h3>
          <div class="notes-box">${vaultNotes}</div>
        ` : ''}

        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `
    printWindow.document.write(html)
    printWindow.document.close()
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
      birthdayEmailSubject: emailConfig.birthdaySubject,
      birthdayEmailBody: emailConfig.birthdayBody,
      missingDataEmailSubject: emailConfig.missingDataSubject,
      missingDataEmailBody: emailConfig.missingDataBody,
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
      <DesktopHeaderNav activeItem="settings" showBar />
      <div className="p-4 md:p-8">
        <div className="mb-6">
          <h2 className="font-serif text-2xl font-bold md:text-4xl">Postavke sustava</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground text-sm md:text-base">
            Centralno upravljanje cijelim sustavom „Rodoslovac” — održavanje, članstvo, prava pristupa i ovlasti, e-mail komunikacija, donacije, Google Workspace, sigurnosne kopije i sigurnost.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-2 sm:flex sm:flex-wrap w-full h-auto items-stretch justify-start">
            <TabsTrigger value="general" className="text-xs px-3 py-2 flex-1 min-w-fit gap-1.5">
              <SettingsIcon className="h-3.5 w-3.5" />
              {user?.role === 'admin' ? 'Sustav i Upravljanje' : 'Opće'}
            </TabsTrigger>
            <TabsTrigger value="membership" className="text-xs px-3 py-2 flex-1 min-w-fit gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Članstvo, Sjednice i Projekti
            </TabsTrigger>
            {user?.role === 'admin' && (
              <TabsTrigger value="access" className="text-xs px-3 py-2 flex-1 min-w-fit gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" />
                Prava pristupa i Ovlasti
              </TabsTrigger>
            )}
            <TabsTrigger value="email-notifications" className="text-xs px-3 py-2 flex-1 min-w-fit gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              E-mail i Predlošci
            </TabsTrigger>
            {user?.role === 'admin' && (
              <TabsTrigger value="donations-settings" className="text-xs px-3 py-2 flex-1 min-w-fit gap-1.5">
                <HeartHandshake className="h-3.5 w-3.5" />
                Donacije, HUB-3A i AI
              </TabsTrigger>
            )}
            {user?.role === 'admin' && (
              <TabsTrigger value="integrations" className="text-xs px-3 py-2 flex-1 min-w-fit gap-1.5">
                <Globe className="h-3.5 w-3.5" />
                Google Workspace
              </TabsTrigger>
            )}
            {user?.role === 'admin' && (
              <TabsTrigger value="backup" className="text-xs px-3 py-2 flex-1 min-w-fit gap-1.5">
                <HardDrive className="h-3.5 w-3.5" />
                Sigurnosna kopija i Povrat
              </TabsTrigger>
            )}
            <TabsTrigger value="security" className="text-xs px-3 py-2 flex-1 min-w-fit gap-1.5">
              <Lock className="h-3.5 w-3.5" />
              {user?.role === 'admin' ? 'Sigurnost i Kontinuitet' : 'Sigurnost'}
            </TabsTrigger>
            {user?.role === 'admin' && (
              <TabsTrigger value="vault" className="text-xs px-3 py-2 flex-1 min-w-fit gap-1.5">
                <KeyRound className="h-3.5 w-3.5" />
                Trezor lozinki
              </TabsTrigger>
            )}
          </TabsList>

          {/* ── 1. TAB: SUSTAV I UPRAVLJANJE ── */}
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

            {user?.role === 'admin' && (
              <Card className={settings.maintenanceMode ? "border-2 border-amber-400 bg-amber-50/60 shadow-sm" : "border-border"}>
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Wrench className={settings.maintenanceMode ? "h-5 w-5 text-amber-700" : "h-5 w-5 text-muted-foreground"} />
                        Način održavanja / Ažuriranje sustava (Samo za administratora)
                      </CardTitle>
                      <CardDescription>
                        Kada je ova opcija uključena, aplikacija je zaključana za sve korisnike osim administratora. Svi ostali korisnici vide obavijest da se sustav ažurira i ne mogu koristiti ni prijaviti se u sustav.
                      </CardDescription>
                    </div>
                    <Badge
                      variant={settings.maintenanceMode ? "default" : "outline"}
                      className={
                        settings.maintenanceMode
                          ? "bg-amber-600 text-white hover:bg-amber-600 shrink-0 px-3 py-1 text-xs font-bold"
                          : "border-emerald-300 bg-emerald-50 text-emerald-800 shrink-0 px-3 py-1 text-xs font-semibold"
                      }
                    >
                      {settings.maintenanceMode
                        ? "UKLJUČENO — Pristup samo administratoru"
                        : "ISKLJUČENO — Sustav dostupan svim članovima"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border bg-background/80 p-4">
                    <div className="flex items-start gap-3">
                      <Switch
                        id="maintenance-mode-switch"
                        checked={Boolean(settings.maintenanceMode)}
                        disabled={isTogglingMaintenance}
                        onCheckedChange={async (checked) => {
                          setIsTogglingMaintenance(true)
                          setLogoError("")
                          try {
                            await setMaintenanceMode(Boolean(checked))
                            setNotification(
                              checked
                                ? "Način održavanja je uključen. Aplikacija je sada zaključana za sve korisnike osim administratora."
                                : "Način održavanja je isključen. Aplikacija je ponovno dostupna svim ovlaštenim korisnicima."
                            )
                          } finally {
                            setIsTogglingMaintenance(false)
                          }
                        }}
                        className="mt-0.5"
                      />
                      <div className="space-y-1">
                        <Label htmlFor="maintenance-mode-switch" className="text-sm font-semibold cursor-pointer">
                          Zaključaj aplikaciju za sve osim administratora
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Poruka koja se prikazuje korisnicima:{" "}
                          <span className="italic font-medium text-foreground">
                            „Sustav se trenutno ažurira i nije mu moguće pristupiti. Kontaktirajte administratora.”
                          </span>
                        </p>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant={settings.maintenanceMode ? "default" : "destructive"}
                      disabled={isTogglingMaintenance}
                      onClick={async () => {
                        const next = !settings.maintenanceMode
                        setIsTogglingMaintenance(true)
                        setLogoError("")
                        try {
                          await setMaintenanceMode(next)
                          setNotification(
                            next
                              ? "Način održavanja je uključen. Aplikacija je sada zaključana za sve korisnike osim administratora."
                              : "Način održavanja je isključen. Aplikacija je ponovno dostupna svim ovlaštenim korisnicima."
                          )
                        } finally {
                          setIsTogglingMaintenance(false)
                        }
                      }}
                      className={settings.maintenanceMode ? "bg-emerald-700 hover:bg-emerald-800 shrink-0 gap-2" : "shrink-0 gap-2"}
                    >
                      <Wrench className="h-4 w-4" />
                      {isTogglingMaintenance
                        ? "Spremanje..."
                        : settings.maintenanceMode
                        ? "Isključi način održavanja"
                        : "Uključi način održavanja"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {user?.role === 'admin' && <SettingsStorageMonitorCard />}

            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Logo društva</CardTitle>
                  <CardDescription>Učitajte službeni logotip veličine do 200x200 px (koristi se na prijavi, u izborniku i dokumentima).</CardDescription>
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
                      <SaveActionButton
                        label="Spremi Logo"
                        size="sm"
                        className="mt-2"
                        onClick={handleSaveLogo}
                        disabled={logoPreview === settings.logoUrl}
                      />
                      <p className="text-sm text-muted-foreground">Preporučeno: kvadratna slika, max 200x200 px.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {user?.role === 'admin' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Megaphone className="h-5 w-5 text-amber-600" /> Oglasna ploča odbora (Nadzorna ploča)
                    </CardTitle>
                    <CardDescription>
                      Upravljajte tekstom obavijesti koja se prikazuje svim članovima na Nadzornoj ploči odmah nakon prijave.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Textarea
                      rows={4}
                      value={boardNoticeDraft}
                      onChange={(e) => setBoardNoticeDraft(e.target.value)}
                      placeholder="Upišite obavijest ili važnu poruku za članove društva..."
                    />
                    {settings.boardNoticeAuthor && settings.boardNotice && (
                      <p className="text-xs text-muted-foreground">
                        Trenutna objava: <strong>{settings.boardNoticeAuthor}</strong>{" "}
                        {settings.boardNoticeDate ? `(${formatDateTimeDMY(settings.boardNoticeDate)})` : ""}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        disabled={isSavingBoardNotice}
                        onClick={async () => {
                          setIsSavingBoardNotice(true)
                          try {
                            await setBoardNotice(boardNoticeDraft.trim(), user?.name)
                            setNotification("✓ Oglasna ploča odbora je ažurirana.")
                          } finally {
                            setIsSavingBoardNotice(false)
                          }
                        }}
                        className="gap-2"
                      >
                        <Save className="h-4 w-4" /> Objavi na oglasnu ploču
                      </Button>
                      {settings.boardNotice && (
                        <Button
                          type="button"
                          variant="outline"
                          disabled={isSavingBoardNotice}
                          onClick={async () => {
                            setIsSavingBoardNotice(true)
                            try {
                              await setBoardNotice("", user?.name)
                              setBoardNoticeDraft("")
                              setNotification("Oglasna ploča je očišćena.")
                            } finally {
                              setIsSavingBoardNotice(false)
                            }
                          }}
                          className="text-red-700 hover:bg-red-50"
                        >
                          Ukloni obavijest
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {user?.role === 'admin' && (
                <Card className="xl:col-span-2 border-primary/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="h-5 w-5 text-primary" /> Administrativni alati nad bazom i podacima
                    </CardTitle>
                    <CardDescription>
                      Svi ključni alati za održavanje registra članova, uvoz/izvoz, oporavak obrisanih podataka i sigurnosnu kopiju na jednom mjestu.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-xl border border-border bg-muted/20 p-4 flex flex-col justify-between gap-3">
                        <div>
                          <p className="font-semibold text-sm">Čišćenje datuma i uplata</p>
                          <p className="text-xs text-muted-foreground mt-1">Masovno usklađivanje formata datuma upisa, rođenja i uplata članarina.</p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full gap-1.5 border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100"
                          onClick={() => setCleanupDialogOpen(true)}
                        >
                          <Wrench className="h-3.5 w-3.5" /> Pokreni alat
                        </Button>
                      </div>

                      <div className="rounded-xl border border-border bg-muted/20 p-4 flex flex-col justify-between gap-3">
                        <div>
                          <p className="font-semibold text-sm">Uvoz i izvoz članova</p>
                          <p className="text-xs text-muted-foreground mt-1">Skupni uvoz iz Excel/CSV tablica ili preuzimanje kompletnog popisa u Excel.</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <MembersImportDialog />
                          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={exportMembers}>
                            <Download className="h-3.5 w-3.5" /> Izvoz
                          </Button>
                        </div>
                      </div>

                      <div className="rounded-xl border border-border bg-muted/20 p-4 flex flex-col justify-between gap-3">
                        <div>
                          <p className="font-semibold text-sm">Smeće (Obrisane stavke)</p>
                          <p className="text-xs text-muted-foreground mt-1">Pregled svih obrisanih zapisa, evidencija tko ih je obrisao i Undelete povrat.</p>
                        </div>
                        <Link href="/trash">
                          <Button type="button" variant="outline" size="sm" className="w-full gap-1.5">
                            <Trash className="h-3.5 w-3.5" /> Otvori Smeće
                          </Button>
                        </Link>
                      </div>

                      <div className="rounded-xl border border-border bg-muted/20 p-4 flex flex-col justify-between gap-3">
                        <div>
                          <p className="font-semibold text-sm">Sigurnosna kopija (Backup)</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Zadnji backup: <strong>{settings.lastBackupTimestamp ? formatDateTimeDMY(settings.lastBackupTimestamp) : 'Nikada'}</strong>
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full gap-1.5"
                          onClick={() => setActiveTab("backup")}
                        >
                          <HardDrive className="h-3.5 w-3.5" /> Otvori Backup & Povrat
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* ── 2. TAB: ČLANSTVO, SJEDNICE I PROJEKTI ── */}
          <TabsContent value="membership" className="space-y-6">
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
                  <CardTitle>Pragovi članstva</CardTitle>
                  <CardDescription>
                    Članstvo počinje datumom prve uplate. Definirajte nakon koliko dana od posljednje uplate član
                    prelazi u status &quot;Dug&quot; (zakasnjelo plaćanje), odnosno kada postaje &quot;Neaktivan&quot;.
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
                      Uplata 15/01/2024 → DUG od 15/01/2025 → Neaktivan od 15/01/2026.
                    </div>
                    <div className="flex items-start space-x-3 rounded-xl border border-border bg-background/60 p-4">
                      <Checkbox
                        id="require-payment-active"
                        checked={requirePayment}
                        onCheckedChange={(checked) => setRequirePayment(checked === true)}
                        className="mt-0.5"
                      />
                      <div className="space-y-1 leading-none">
                        <Label
                          htmlFor="require-payment-active"
                          className="text-sm font-medium cursor-pointer"
                        >
                          Član bez ijedne upisane uplate ne može biti aktivan član
                        </Label>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Ako kod člana ne postoji upisana niti jedna uplata članarine, neovisno o datumu upisa u društvo, automatski dobiva status neaktivnog člana. Isključeni su samo počasni članovi i članovi oslobođeni plaćanja članarine.
                        </p>
                      </div>
                    </div>
                    <div className="flex justify-end pt-3 border-t border-border">
                      <SaveActionButton label="Spremi pragove" onClick={saveThresholds} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Funkcije društva (Uloge u tijelima)</CardTitle>
                  <CardDescription>
                    Definirajte funkcije koje članovi obnašaju u tijelima društva te ih dodijelite u kartici člana.
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
                  <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                    {settings.availableFunctions.length > 0 ? (
                      <div className="grid gap-2">
                        {settings.availableFunctions.map((fn) => (
                          <div key={fn} className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-2.5">
                            <span className="text-sm">{fn}</span>
                            <button
                              type="button"
                              onClick={() => removeFunction(fn)}
                              className="rounded-lg border border-border px-3 py-1 text-xs text-red-700 hover:bg-red-50"
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
                          <div key={type} className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-2.5">
                            <span className="text-sm">{type}</span>
                            <button
                              onClick={() => removeMeetingType(type)}
                              className="rounded-lg border border-border px-3 py-1 text-xs text-red-700 hover:bg-red-50"
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
                          <div key={loc} className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                              <span className="text-sm">{loc}</span>
                            </div>
                            <button
                              onClick={() => removeMeetingLocation(loc)}
                              className="rounded-lg border border-border px-3 py-1 text-xs text-red-700 hover:bg-red-50"
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

            {user?.role === 'admin' && (
              <Card>
                <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileStack className="h-5 w-5 text-primary" /> Šablone za doprinositelje projekata
                    </CardTitle>
                    <CardDescription>
                      Definirajte strukturu polja za sudionike i doprinositelje na projektima društva.
                    </CardDescription>
                  </div>
                  <Button onClick={() => {
                    const newT: ContributorTemplate = { id: generateId(), name: "Nova šablona", fields: [{ id: generateId(), name: "Ime i prezime", type: "text", order: 0 }] }
                    setTemplates([...templates, newT])
                    setEditingTemplate(newT.id)
                  }} className="gap-2 shrink-0">
                    <Plus className="h-4 w-4" /> Nova šablona
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {templates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-10 text-center bg-muted/10">
                      <FileStack className="mb-3 h-8 w-8 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">Nema definiranih šablona.</p>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {templates.map(t => (
                        <Card key={t.id} className={editingTemplate === t.id ? "ring-2 ring-primary" : ""}>
                          <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <div className="space-y-1 flex-1">
                              {editingTemplate === t.id ? (
                                <Input value={t.name} onChange={e => {
                                  setTemplates(prev => prev.map(pt => pt.id === t.id ? { ...pt, name: e.target.value } : pt))
                                }} className="max-w-xs font-bold" />
                              ) : (
                                <CardTitle className="text-base">{t.name}</CardTitle>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant={editingTemplate === t.id ? "default" : "outline"}
                                size="sm"
                                className={
                                  editingTemplate === t.id
                                    ? ACTION_BUTTON_STYLES.finishSm
                                    : ACTION_BUTTON_STYLES.cancelSm
                                }
                                onClick={() => setEditingTemplate(editingTemplate === t.id ? null : t.id)}
                              >
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
                                        }} />
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
                  )}

                  {templates.length > 0 && (
                    <div className="flex justify-end pt-3 border-t border-border">
                      <SaveActionButton
                        label="Spremi sve šablone"
                        onClick={() => {
                          setContributorTemplates(templates)
                          setNotification("Šablone projekata su uspješno spremljene.")
                          setEditingTemplate(null)
                        }}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="email-notifications" className="space-y-6">
            {notification && (
              <Alert><AlertDescription>{notification}</AlertDescription></Alert>
            )}
            {logoError && (
              <Alert variant="destructive"><AlertDescription>{logoError}</AlertDescription></Alert>
            )}

            <div className="grid gap-6 xl:grid-cols-2">
              {/* Status zajedničkog Gmail INBOX-a (uređuje se na kartici Google Workspace) */}
              {user?.role === 'admin' && (
                <Card className="xl:col-span-2 border-primary/20 shadow-xs">
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <Inbox className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                      <div className="space-y-0.5">
                        <p className="text-sm font-bold flex items-center gap-2 flex-wrap">
                          Google Workspace — Zajednički INBOX
                          {gmailConnectionStatus.loading ? (
                            <Badge variant="outline" className="text-[10px]">Provjera...</Badge>
                          ) : gmailConnectionStatus.connected ? (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">
                              Povezano: {gmailConnectionStatus.emailAddress}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 text-[10px]">
                              {gmailConnectionStatus.configured ? "Greška u povezivanju" : "Nije podešeno"}
                            </Badge>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Svi parametri Google Service Accounta, Domain-Wide Delegation ključa i Google Drivea nalaze se na kartici „Google Workspace”.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setActiveTab("integrations")}
                        className="gap-1.5 text-xs"
                      >
                        <Globe className="h-3.5 w-3.5" /> Postavke Google Workspacea
                      </Button>
                      {gmailConnectionStatus.connected && (
                        <Link href="/gmail">
                          <Button type="button" size="sm" variant="outline" className="gap-1.5 text-xs">
                            <Inbox className="h-3.5 w-3.5" /> Otvori INBOX
                          </Button>
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

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
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border">
                    <Button size="sm" variant="outline" className={ACTION_BUTTON_STYLES.cancelSm} onClick={async () => {
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
                    }}><RefreshCw className="h-3.5 w-3.5" /> Testiraj vezu</Button>
                    <SaveActionButton label="Spremi SMTP" size="sm" onClick={handleSaveSMTP} />
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
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border">
                    <Button size="sm" variant="outline" className="rounded-full h-8 px-3.5 gap-2 border-[#D97706] text-[#1E3A5F] hover:bg-[#FEFCE8]" onClick={() => openTemplatePreview("payment", "Predložak obavijesti o članarini")}>
                      <Eye className="h-3.5 w-3.5 text-[#D97706]" /> Pregledaj predložak i pošalji test
                    </Button>
                    <SaveActionButton label="Spremi predložak" size="sm" onClick={handleSaveEmailConfig} />
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
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border">
                    <Button size="sm" variant="outline" className="rounded-full h-8 px-3.5 gap-2 border-[#D97706] text-[#1E3A5F] hover:bg-[#FEFCE8]" onClick={() => openTemplatePreview("invitation", "Predložak za pozivnicu")}>
                      <Eye className="h-3.5 w-3.5 text-[#D97706]" /> Pregledaj predložak i pošalji test
                    </Button>
                    <SaveActionButton label="Spremi predložak" size="sm" onClick={handleSaveEmailConfig} />
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
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border">
                    <Button size="sm" variant="outline" className="rounded-full h-8 px-3.5 gap-2 border-[#D97706] text-[#1E3A5F] hover:bg-[#FEFCE8]" onClick={() => openTemplatePreview("poll", "Predložak obavijesti o glasovanju")}>
                      <Eye className="h-3.5 w-3.5 text-[#D97706]" /> Pregledaj predložak i pošalji test
                    </Button>
                    <SaveActionButton label="Spremi predložak" size="sm" onClick={handleSaveEmailConfig} />
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
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border">
                    <Button size="sm" variant="outline" className="rounded-full h-8 px-3.5 gap-2 border-[#D97706] text-[#1E3A5F] hover:bg-[#FEFCE8]" onClick={() => openTemplatePreview("meeting", "Predložak obavijesti o sjednici")}>
                      <Eye className="h-3.5 w-3.5 text-[#D97706]" /> Pregledaj predložak i pošalji test
                    </Button>
                    <SaveActionButton label="Spremi predložak" size="sm" onClick={handleSaveEmailConfig} />
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
                  <hr className="my-4 border-border" />
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <p className="text-sm font-bold text-muted-foreground">Predložak za rođendansku čestitku</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-2 border-[#D97706] text-[#1E3A5F] hover:bg-[#FEFCE8]"
                      onClick={() => openTemplatePreview("birthday", "Predložak rođendanske čestitke")}
                    >
                      <Eye className="h-4 w-4 text-[#D97706]" /> Pregledaj predložak i pošalji test
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="birthdaySubject">Naslov e-maila (Rođendan)</Label>
                    <Input id="birthdaySubject" value={emailConfig.birthdaySubject} onChange={e => setEmailConfig(p => ({ ...p, birthdaySubject: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="birthdayBody">Tekst rođendanske čestitke</Label>
                    <textarea id="birthdayBody" rows={5} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" 
                      value={emailConfig.birthdayBody} onChange={e => setEmailConfig(p => ({ ...p, birthdayBody: e.target.value }))} />
                    <p className="text-[10px] text-muted-foreground">Možete koristiti varijablu {'{{name}}'} za ime člana.</p>
                  </div>
                  <hr className="my-4 border-border" />
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <p className="text-sm font-bold text-muted-foreground">Predložak zamolbe za dopunu podataka člana (s PDF kartonom)</p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-2 border-[#D97706] text-[#1E3A5F] hover:bg-[#FEFCE8]"
                        onClick={() => openTemplatePreview("missing-data", "Predložak zamolbe za dopunu podataka")}
                      >
                        <Eye className="h-4 w-4 text-[#D97706]" /> Pregledaj predložak i pošalji test
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="gap-2 bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white"
                        onClick={() => setMissingDataDialogOpen(true)}
                      >
                        <Mail className="h-4 w-4 text-[#D97706]" /> Odaberi članove i pošalji zamolbu (PDF)
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="missingDataSubject">Naslov e-maila (Dopuna podataka)</Label>
                    <Input id="missingDataSubject" value={emailConfig.missingDataSubject} onChange={e => setEmailConfig(p => ({ ...p, missingDataSubject: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="missingDataBody">Tekst zamolbe za dopunu podataka</Label>
                    <textarea id="missingDataBody" rows={6} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" 
                      value={emailConfig.missingDataBody} onChange={e => setEmailConfig(p => ({ ...p, missingDataBody: e.target.value }))} />
                    <p className="text-[10px] text-muted-foreground">Varijable: {'{{name}}'} (ime člana), {'{{missingFields}}'} (popis polja koja nedostaju) i {'{{formLink}}'} (jednokratni osobni link člana za online dopunu — samo 1 pristup). Sustav u svaki e-mail automatski ugrađuje napomenu o jednokratnom pristupu i prilaže PDF evidencijski list.</p>
                  </div>
                  <hr className="my-4 border-border" />
                  <div className="rounded-xl border border-[#E2E8F0] bg-[#FEFCE8] p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-[#7C2D12]">
                          HRD standardizirani vizualni identitet i Službeni uređivač e-pošte (8 predložaka)
                        </p>
                        <p className="text-xs text-[#1F2937]">
                          Svi službeni e-mailovi koriste jedinstveni HTML predložak (max 600 px), standardizirano zaglavlje (#1E3A5F s linijom #D97706), naslove u boji #7C2D12, informativne blokove #FEFCE8, poveznice #1F77C5 i postojeći službeni potpis u podnožju.
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        className="gap-2 bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white shrink-0"
                        onClick={() => setOfficialComposerOpen(true)}
                      >
                        <Sparkles className="h-4 w-4 text-[#D97706]" />
                        Otvori službeni uređivač e-pošte
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      {[
                        { name: "Institucionalna tamnoplava", hex: "#1E3A5F", fg: "#FFFFFF" },
                        { name: "Tamna terakota", hex: "#7C2D12", fg: "#FFFFFF" },
                        { name: "Zlatno-narančasta", hex: "#D97706", fg: "#FFFFFF" },
                        { name: "Grafitna", hex: "#1F2937", fg: "#FFFFFF" },
                        { name: "Plava poveznica", hex: "#1F77C5", fg: "#FFFFFF" },
                        { name: "Bijela", hex: "#FFFFFF", fg: "#1F2937" },
                        { name: "Svijetlosiva", hex: "#F8FAFC", fg: "#1F2937" },
                        { name: "Svijetla krem", hex: "#FEFCE8", fg: "#1F2937" },
                        { name: "Svijetlosiva za rubove", hex: "#E2E8F0", fg: "#1F2937" },
                      ].map((c) => (
                        <span
                          key={c.name}
                          style={{ backgroundColor: c.hex, color: c.fg }}
                          className="rounded-md border border-black/15 px-2.5 py-1 font-mono font-semibold"
                        >
                          {c.name}: {c.hex}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border">
                    <Button size="sm" variant="outline" className="rounded-full h-8 px-3.5 gap-2 border-[#D97706] text-[#1E3A5F] hover:bg-[#FEFCE8]" onClick={() => openTemplatePreview("lecture", "Predložak obavijesti o predavanju / druženju")}>
                      <Eye className="h-3.5 w-3.5 text-[#D97706]" /> Pregledaj predložak i pošalji test
                    </Button>
                    <SaveActionButton label="Spremi predložak" size="sm" onClick={handleSaveEmailConfig} />
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

                  <div className="flex justify-end border-t pt-4">
                    <SaveActionButton label="Spremi privitke" size="sm" onClick={handleSaveEmailConfig} />
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
            {notification && (
              <Alert><AlertDescription>{notification}</AlertDescription></Alert>
            )}
            {logoError && (
              <Alert variant="destructive"><AlertDescription>{logoError}</AlertDescription></Alert>
            )}
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
                        <SaveActionButton
                          label="Spremi ime"
                          size="sm"
                          loading={isSavingAdminName}
                          onClick={handleSaveAdminName}
                          className="shrink-0"
                        />
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

                    <div className="flex justify-end pt-3 border-t border-border">
                      <SaveActionButton
                        type="submit"
                        label="Spremi promjene"
                        loading={isLoading}
                        loadingLabel="Spremanje..."
                      />
                    </div>
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
                  <div className="flex justify-end pt-3 border-t border-border">
                    <SaveActionButton label="Spremi rezervni pristup" onClick={handleSaveBackupAdmin} />
                  </div>
                </CardContent>
              </Card>
            )}

            {user?.role === 'admin' && (
              <SettingsAdminInactivityCard
                onNotify={(msg) => { setLogoError(""); setNotification(msg) }}
                onError={(msg) => { setNotification(""); setLogoError(msg) }}
              />
            )}
          </TabsContent>

          {user?.role === 'admin' && (
            <TabsContent value="access" className="space-y-6">
              {notification && (
                <Alert><AlertDescription>{notification}</AlertDescription></Alert>
              )}
              <SettingsAccessTab onNotify={(msg) => { setLogoError(""); setNotification(msg) }} />
            </TabsContent>
          )}

          {user?.role === 'admin' && (
            <TabsContent value="donations-settings" className="space-y-6">
              {logoError && (
                <Alert variant="destructive"><AlertDescription>{logoError}</AlertDescription></Alert>
              )}
              {notification && (
                <Alert><AlertDescription>{notification}</AlertDescription></Alert>
              )}
              <SettingsDonationsTab
                onNotify={(msg) => { setLogoError(""); setNotification(msg) }}
                onError={(msg) => { setNotification(""); setLogoError(msg) }}
              />
            </TabsContent>
          )}

    <TabsContent value="integrations" className="space-y-6">
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
                <SaveActionButton
                  label="Spremi i testiraj Gmail"
                  size="sm"
                  loading={gmailConnectionStatus.loading}
                  onClick={() => handleSaveAndTestGmailConfig("save-config")}
                  className="shrink-0"
                />
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

            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-border">
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
                className={ACTION_BUTTON_STYLES.cancel}
              >
                Testiraj Google Drive vezu
              </Button>

              <SaveActionButton
                label="Spremi sve Google Workspace postavke"
                onClick={async () => {
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
                }}
              />
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
      <TabsContent value="backup" className="space-y-6">
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
        <SettingsStorageMonitorCard />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" /> Dropbox Integracija, Sigurnosna Kopija i Povrat
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

          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-border">
            <Button
              variant="outline"
              disabled={isTestingDropbox || !dropboxConfig.dropboxAppKey}
              onClick={handleTestDropbox}
              className={ACTION_BUTTON_STYLES.cancel}
            >
              {isTestingDropbox ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
              Testiraj Dropbox Vezu
            </Button>

            <SaveActionButton
              label="Spremi Dropbox Postavke"
              onClick={handleSaveDropbox}
              disabled={!dropboxConfig.dropboxAppKey}
            />
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
                    {settings.lastBackupTimestamp ? formatDateTimeDMY(settings.lastBackupTimestamp) : 'Nikada'}
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
                  disabled={isRunningBackup || (!settings.dropboxRefreshToken && !settings.hasDropboxConfig)}
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
    )}

    {user?.role === 'admin' && (
      <TabsContent value="vault" className="space-y-6">
        {notification && (
          <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 mr-2" />
            <AlertDescription className="font-medium">{notification}</AlertDescription>
          </Alert>
        )}

        {/* 1. KARTICA: STRUKTURIRANI RAČUNI PO PLATFORMAMA */}
        <Card className="border-red-200 shadow-sm overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-red-50/80 via-white to-amber-50/50 border-b border-red-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2.5 text-red-800 text-lg">
                  <div className="p-1.5 rounded-lg bg-red-100 text-red-700">
                    <Shield className="h-5 w-5" />
                  </div>
                  Sigurnosni Trezor Pristupnih Računa (Platforme & Lozinke)
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 mt-1">
                  Strogo povjerljivi pristupni podaci organizirani po platformama (npr. Gmail, PuTTY, CPanel, Hosting) za kontinuitet upravljanja društvom.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handlePrintVault}
                  className="gap-1.5 h-8 text-xs border-slate-300 text-slate-700 hover:bg-slate-50"
                  title="Generiraj ispis za primopredaju dužnosti"
                >
                  <Printer className="h-3.5 w-3.5 text-slate-500" />
                  Ispiši / Izvoz
                </Button>
                <Button 
                  size="sm" 
                  onClick={() => handleOpenAddAccount()}
                  className="gap-1.5 h-8 text-xs bg-red-700 hover:bg-red-800 text-white shadow-sm font-medium"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Dodaj platformu
                </Button>
              </div>
            </div>

            {/* Brzi predlošci za unos */}
            <div className="mt-3 pt-3 border-t border-red-100/60 flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mr-1">
                Brzi predložak:
              </span>
              {VAULT_PRESETS.map((p) => (
                <button
                  key={p.title}
                  type="button"
                  onClick={() => handleOpenAddAccount(p)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-white hover:bg-red-50 text-slate-700 hover:text-red-700 border border-slate-200 hover:border-red-300 transition-colors shadow-2xs"
                >
                  <Plus className="h-2.5 w-2.5 text-red-500" />
                  {p.title.split(' ')[0]}
                </button>
              ))}
            </div>
          </CardHeader>

          <CardContent className="p-5 space-y-4">
            {/* Filteri i pretraga */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  value={vaultSearch}
                  onChange={(e) => setVaultSearch(e.target.value)}
                  placeholder="Pretraži platforme ili korisnička imena..."
                  className="pl-8 h-8 text-xs bg-slate-50 focus:bg-white"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllVaultPasswords(!showAllVaultPasswords)}
                  className="h-8 text-xs text-slate-600 gap-1.5"
                >
                  {showAllVaultPasswords ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {showAllVaultPasswords ? "Sakrij sve lozinke" : "Prikaži sve lozinke"}
                </Button>
                <div className="text-xs text-slate-400 font-medium">
                  Ukupno: <strong>{vaultAccounts.length}</strong>
                </div>
              </div>
            </div>

            {/* Prikaz računa */}
            {vaultAccountsLoading ? (
              <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin text-red-500" />
                Učitavanje računa iz trezora...
              </div>
            ) : vaultAccounts.length === 0 ? (
              <div className="p-10 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
                <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-3">
                  <KeyRound className="h-6 w-6" />
                </div>
                <h4 className="text-sm font-semibold text-slate-800">Trezor računa je prazan</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
                  Dodajte pristupne podatke za Gmail, PuTTY, hosting servere i ostale servise kako bi bili sigurno pohranjeni.
                </p>
                <Button 
                  size="sm" 
                  onClick={() => handleOpenAddAccount()}
                  className="bg-red-700 hover:bg-red-800 text-white text-xs gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" /> Dodaj prvu platformu
                </Button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {vaultAccounts
                  .filter(acc => {
                    if (!vaultSearch.trim()) return true
                    const q = vaultSearch.toLowerCase().trim()
                    return (
                      acc.title.toLowerCase().includes(q) ||
                      (acc.username && acc.username.toLowerCase().includes(q)) ||
                      (acc.category && acc.category.toLowerCase().includes(q)) ||
                      (acc.notes && acc.notes.toLowerCase().includes(q))
                    )
                  })
                  .map((acc) => {
                    const isPassVisible = showAllVaultPasswords || visiblePasswords[acc.id]
                    return (
                      <div 
                        key={acc.id}
                        className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs hover:shadow-sm hover:border-red-200 transition-all flex flex-col justify-between gap-3 relative group"
                      >
                        {/* Header kartice */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-0.5 overflow-hidden">
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-sm font-bold text-slate-900 truncate" title={acc.title}>
                                {acc.title}
                              </h4>
                            </div>
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                              {acc.category || "Općenito"}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                            {acc.url && (
                              <a
                                href={acc.url.startsWith('http') ? acc.url : `https://${acc.url}`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-100"
                                title="Otvori poveznicu"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => handleEditAccount(acc)}
                              className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
                              title="Uredi račun"
                            >
                              <SettingsIcon className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteAccount(acc.id, acc.title)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50"
                              title="Obriši"
                            >
                              <Trash className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Polja korisničko ime i lozinka */}
                        <div className="space-y-2 bg-slate-50/80 p-2.5 rounded-lg border border-slate-100 text-xs">
                          {/* Korisničko ime */}
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] uppercase font-semibold text-slate-500 flex-shrink-0">Korisnik:</span>
                            <div className="flex items-center gap-1.5 overflow-hidden">
                              <span className="font-mono text-slate-800 truncate font-medium" title={acc.username || "—"}>
                                {acc.username || "—"}
                              </span>
                              {acc.username && (
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(acc.username, `user-${acc.id}`)}
                                  className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-white"
                                  title="Kopiraj korisničko ime"
                                >
                                  {copiedKey === `user-${acc.id}` ? (
                                    <Check className="h-3 w-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Lozinka */}
                          <div className="flex items-center justify-between gap-2 border-t border-slate-200/50 pt-1.5">
                            <span className="text-[10px] uppercase font-semibold text-slate-500 flex-shrink-0">Lozinka:</span>
                            <div className="flex items-center gap-1.5 overflow-hidden">
                              <span className="font-mono text-slate-800 truncate font-semibold" title={isPassVisible ? acc.password : "Skriveno"}>
                                {isPassVisible ? (acc.password || "—") : "••••••••••••"}
                              </span>
                              {acc.password && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setVisiblePasswords(prev => ({ ...prev, [acc.id]: !prev[acc.id] }))}
                                    className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-white"
                                    title={isPassVisible ? "Sakrij lozinku" : "Prikaži lozinku"}
                                  >
                                    {isPassVisible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(acc.password, `pass-${acc.id}`)}
                                    className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-white"
                                    title="Kopiraj lozinku"
                                  >
                                    {copiedKey === `pass-${acc.id}` ? (
                                      <Check className="h-3 w-3 text-emerald-600" />
                                    ) : (
                                      <Copy className="h-3 w-3" />
                                    )}
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Bilješke / napomena */}
                        {acc.notes && (
                          <p className="text-[11px] text-slate-500 italic bg-amber-50/60 border border-amber-100 rounded px-2 py-1 line-clamp-2" title={acc.notes}>
                            {acc.notes}
                          </p>
                        )}
                      </div>
                    )
                  })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 2. KARTICA: OPĆENITE TEKSTUALNE BILJEŠKE */}
        <Card className="border-red-100 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-800 text-base">
              <FileText className="h-4 w-4 text-red-600" />
              Slobodne administratorske bilješke i upute
            </CardTitle>
            <CardDescription className="text-xs">
              Slobodni tekstualni prostor za dodatne upute, procedure, kontakt brojeve tehničke podrške i opće napomene.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <textarea
              className="flex min-h-[220px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono text-xs leading-relaxed"
              placeholder="Ovdje možete slobodno zapisati dodatne procedure, kontakt osobe davatelja usluga, backup upute ili detalje koje novi administrator treba znati..."
              value={vaultNotes}
              onChange={(e) => setVaultNotesLocal(e.target.value)}
            />
            <div className="pt-3 border-t border-border flex justify-end">
              <SaveActionButton label="Spremi tekstualne bilješke" size="sm" onClick={handleSaveVault} />
            </div>
          </CardContent>
        </Card>

        {/* DIJALOG ZA DODAVANJE / UREĐIVANJE PLATFORME */}
        <Dialog open={isAccountModalOpen} onOpenChange={setIsAccountModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-800">
                <KeyRound className="h-5 w-5 text-red-600" />
                {editingAccountId ? "Uredi pristupni račun" : "Dodaj novi pristupni račun"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Unesite pristupne podatke platforme koji će biti trajno i sigurno spremljeni u bazu.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 py-2">
              <div className="space-y-1">
                <Label htmlFor="vault-title" className="text-xs font-semibold">Platforma / Usluga *</Label>
                <Input
                  id="vault-title"
                  placeholder="npr. GMAIL, PUTTY SSH, CPANEL, DROPBOX..."
                  value={accountFormData.title}
                  onChange={(e) => setAccountFormData({ ...accountFormData, title: e.target.value })}
                  className="h-8 text-xs font-medium"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="vault-category" className="text-xs font-semibold">Kategorija</Label>
                  <Input
                    id="vault-category"
                    placeholder="npr. E-mail, Server, Hosting..."
                    value={accountFormData.category}
                    onChange={(e) => setAccountFormData({ ...accountFormData, category: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="vault-url" className="text-xs font-semibold">Pristupni URL / IP</Label>
                  <Input
                    id="vault-url"
                    placeholder="npr. https://mail.google.com"
                    value={accountFormData.url}
                    onChange={(e) => setAccountFormData({ ...accountFormData, url: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="vault-user" className="text-xs font-semibold">Korisničko ime / Račun</Label>
                <Input
                  id="vault-user"
                  placeholder="npr. tajnistvo@hrd.hr, root, admin..."
                  value={accountFormData.username}
                  onChange={(e) => setAccountFormData({ ...accountFormData, username: e.target.value })}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="vault-pass" className="text-xs font-semibold">Lozinka / Ključ</Label>
                  <button
                    type="button"
                    onClick={generateRandomPassword}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1"
                  >
                    <Sparkles className="h-3 w-3" /> Generiraj jaku lozinku
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="vault-pass"
                    type={showPasswordInModal ? "text" : "password"}
                    placeholder="Lozinka računa..."
                    value={accountFormData.password}
                    onChange={(e) => setAccountFormData({ ...accountFormData, password: e.target.value })}
                    className="h-8 text-xs font-mono pr-8"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordInModal(!showPasswordInModal)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPasswordInModal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="vault-notes" className="text-xs font-semibold">Dodatne upute / Bilješke</Label>
                <textarea
                  id="vault-notes"
                  placeholder="npr. Port 22, recovery kodovi, rezervni telefon..."
                  value={accountFormData.notes}
                  onChange={(e) => setAccountFormData({ ...accountFormData, notes: e.target.value })}
                  className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
            </div>

            <DialogFooter className="gap-2.5">
              <CloseActionButton label="Odustani" size="sm" onClick={() => setIsAccountModalOpen(false)} />
              <SaveActionButton
                label={editingAccountId ? "Spremi izmjene" : "Spremi račun"}
                size="sm"
                loading={isSavingAccount}
                onClick={handleSaveAccountModal}
              />
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </TabsContent>
    )}
        </Tabs>
      </div>
      <MissingDataEmailDialog
        open={missingDataDialogOpen}
        onOpenChange={setMissingDataDialogOpen}
      />
      {user?.role === 'admin' && (
        <AdminMembersCleanupDialog
          open={cleanupDialogOpen}
          onOpenChange={setCleanupDialogOpen}
          selectedMemberIds={[]}
        />
      )}
      <HrdOfficialEmailComposerDialog
        open={officialComposerOpen}
        onOpenChange={setOfficialComposerOpen}
      />
      <Dialog
        open={templatePreviewModal.open}
        onOpenChange={(open) => setTemplatePreviewModal((prev) => ({ ...prev, open }))}
      >
        <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[92vh] overflow-y-auto p-0 rounded-2xl border border-[#E2E8F0] shadow-2xl">
          <DialogHeader className="bg-[#1E3A5F] border-b-2 border-[#D97706] text-white px-6 py-4 rounded-t-2xl">
            <DialogTitle className="font-serif text-base font-bold text-white">
              Pregled HRD predloška i slanje testnog e-maila — {templatePreviewModal.title}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#F8FAFC]">
              Provjerite konačni HTML izgled predloška prije slanja i pošaljite test na e-mail administratora ili drugu adresu.
            </DialogDescription>
          </DialogHeader>
          <div className="p-5 space-y-4">
            {templatePreviewModal.resultMsg && (
              <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>{templatePreviewModal.resultMsg}</span>
              </div>
            )}
            {templatePreviewModal.errorMsg && (
              <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-xs font-semibold text-red-900 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                <span>{templatePreviewModal.errorMsg}</span>
              </div>
            )}
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-2 max-h-[540px] overflow-y-auto">
              {templatePreviewModal.loading ? (
                <div className="p-10 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Učitavanje pregleda predloška...
                </div>
              ) : (
                <div dangerouslySetInnerHTML={{ __html: templatePreviewModal.html }} />
              )}
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 -mx-5 -mb-5 border-t-2 border-border bg-[#FBF9F6] rounded-b-2xl">
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <Input
                  value={templatePreviewModal.testTo}
                  onChange={(e) =>
                    setTemplatePreviewModal((prev) => ({ ...prev, testTo: e.target.value }))
                  }
                  placeholder="E-mail za test (admin ili drugi mail)..."
                  className="h-10 text-xs bg-background"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={sendTemplateTestFromModal}
                  disabled={templatePreviewModal.sending || templatePreviewModal.loading}
                  className="rounded-full h-10 px-4 shrink-0 gap-1.5 bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 border border-[#D97706] text-white font-semibold"
                >
                  {templatePreviewModal.sending ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Mail className="h-3.5 w-3.5 text-[#D97706]" />
                  )}
                  Pošalji testni e-mail
                </Button>
              </div>
              <CloseActionButton
                label="Zatvori"
                onClick={() => setTemplatePreviewModal((prev) => ({ ...prev, open: false }))}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  )
}
