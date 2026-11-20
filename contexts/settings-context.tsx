"use client"

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useAuth } from './auth-context'
import { useActivityLog } from './activity-log-context'

export interface ContributorField {
  id: string
  name: string
  type: 'text' | 'number' | 'email' | 'url' | 'date'
  order: number
}

export interface ContributorTemplate {
  id: string
  name: string
  fields: ContributorField[]
}

export interface AppSettings {
  logoUrl: string | null
  overdueAfterDays: number
  expiredAfterDays: number
  requirePaymentToBeActive: boolean
  maintenanceMode: boolean
  adminInactivityEnabled: boolean
  adminInactivityDays: number
  lastAdminLoginAt: string | null
  adminInactivityAlertSentAt: string | null
  availableFunctions: string[]
  googleDriveUrl: string | null
  googleServiceAccountJson: string | null
  googleDriveFolderId: string | null
  meetingTypes: string[]
  meetingLocations: string[]
  gmailMailbox: string | null
  adminName: string | null
  adminBackupEmail: string | null
  adminBackupPassword: string | null
  vaultNotes: string | null
  smtpHost: string | null
  smtpPort: number | null
  smtpUser: string | null
  smtpPass: string | null
  smtpSecure: boolean
  smtpFrom: string | null
  paymentEmailSubject: string
  paymentEmailBody: string
  paymentSlipUrl: string | null
  paymentQrUrl: string | null
  paymentEmailSignature: string
  invitationEmailSubject: string
  invitationEmailBody: string
  pollEmailSubject: string
  pollEmailBody: string
  projectContributorTemplates: ContributorTemplate[]
  googleDriveOnlyDownload: boolean
  dropboxAppKey: string | null
  dropboxAppSecret: string | null
  dropboxRefreshToken: string | null
  dropboxFolderPath: string | null
  lastBackupTimestamp: string | null
  lastBackupStatus: string | null
  backupIntervalDays: number
  meetingNotificationSubject: string
  meetingNotificationBody: string
  meetingSummarySubject: string
  meetingSummaryBody: string
  lectureNotificationSubject: string
  lectureNotificationBody: string
  lectureSummarySubject: string
  lectureSummaryBody: string
  birthdayEmailSubject: string
  birthdayEmailBody: string
  missingDataEmailSubject: string
  missingDataEmailBody: string
  boardNotice: string | null
  boardNoticeAuthor: string | null
  boardNoticeDate: string | null
  adminPersonalNotes?: string | null
  adminPersonalTodos?: { id: string; text: string; done: boolean; priority?: boolean }[]
  hasGoogleServiceAccount?: boolean
  hasDropboxConfig?: boolean
  hasSmtpPass?: boolean
}

interface SettingsContextType {
  settings: AppSettings
  isSettingsLoaded: boolean
  isAdminSettingsLoaded: boolean
  loadAdminSettings: () => Promise<void>
  syncSystemStatus: () => Promise<void>
  setLogoUrl: (url: string | null) => void
  setBoardNotice: (notice: string, author?: string) => Promise<void>
  setOverdueAfterDays: (days: number) => void
  setExpiredAfterDays: (days: number) => void
  setRequirePaymentToBeActive: (enabled: boolean) => void
  setMaintenanceMode: (enabled: boolean) => Promise<void>
  setAdminInactivitySettings: (cfg: { adminInactivityEnabled: boolean; adminInactivityDays: number }) => Promise<void>
  addFunction: (name: string) => void
  removeFunction: (name: string) => void
  setGoogleDriveUrl: (url: string | null) => void
  setGoogleDriveSettings: (json: string, folderId: string) => void
  setGmailMailbox: (email: string | null) => void
  refreshSettings: () => Promise<void>
  addMeetingType: (type: string) => void
  removeMeetingType: (type: string) => void
  addMeetingLocation: (location: string) => void
  removeMeetingLocation: (location: string) => void
  setAdminName: (name: string | null) => Promise<void>
  setAdminBackupSettings: (email: string | null, password?: string | null) => void
  setVaultNotes: (notes: string) => void
  setSMTPSettings: (settings: Partial<AppSettings>) => void
  setPaymentEmailSettings: (settings: Partial<AppSettings>) => void
  setContributorTemplates: (templates: ContributorTemplate[]) => void
  setGoogleDriveOnlyDownload: (onlyDownload: boolean) => void
  setDropboxSettings: (settings: Partial<AppSettings>) => Promise<boolean>
  runBackupNow: () => Promise<boolean>
  setBackupIntervalDays: (days: number) => void
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

const defaultSettings: AppSettings = {
  logoUrl: null,
  overdueAfterDays: 365,
  expiredAfterDays: 730,
  requirePaymentToBeActive: false,
  maintenanceMode: false,
  adminInactivityEnabled: false,
  adminInactivityDays: 30,
  lastAdminLoginAt: null,
  adminInactivityAlertSentAt: null,
  availableFunctions: [
    'Predsjednik odbora', 'Tajnik', 'Član povjerenstva',
    'Edukacijski koordinator', 'Urednik newslettera',
  ],
  googleDriveUrl: null,
  googleServiceAccountJson: null,
  googleDriveFolderId: null,
  meetingTypes: [
    'Opća sjednica', 'Sjednica uprave', 'Posebni odbor',
    'Radionica', 'Izvanredna sjednica',
  ],
  meetingLocations: [
    'Vijećnica', 'Velika dvorana', 'Mala vijećnica',
    'Online (Zoom)', 'Online (Meet)', 'Knjižnica',
  ],
  gmailMailbox: null,
  adminName: null,
  adminBackupEmail: null,
  adminBackupPassword: null,
  vaultNotes: "",
  smtpHost: null,
  smtpPort: 587,
  smtpUser: null,
  smtpPass: null,
  smtpSecure: true,
  smtpFrom: null,
  paymentEmailSubject: 'Obavijest o članarini',
  paymentEmailBody: 'Poštovani,\n\nmolimo Vas da podmirite Vašu članarinu za tekuću godinu.\n\nU privitku se nalazi uplatnica i QR kod za plaćanje.',
  invitationEmailSubject: 'Pozivnica za pristup sustavu HRD',
  invitationEmailBody: 'Poštovani/a,\n\nHrvatsko rodoslovno društvo "Pavao Ritter Vitezović" Vas poziva da se prijavite u naš novi sustav.\n\nVaši podaci za prijavu:\nKorisničko ime (Username): {email}\nPrivremena lozinka: {tempPassword}\n\nLink za prijavu: {link}',
  pollEmailSubject: 'Obavezno glasovanje: {pollTitle}',
  pollEmailBody: 'Poštovani/a,\n\nObavještavamo Vas da je u sustavu HRD otvoreno novo obavezno glasovanje:\n\n"{pollTitle}"\n\nMolimo Vas da se prijavite u sustav kako biste dali svoj glas.\n\nLink za prijavu: {link}',
  paymentSlipUrl: null,
  paymentQrUrl: null,
  paymentEmailSignature: 'Srdačan pozdrav,\nVaše rodoslovno društvo',
  projectContributorTemplates: [],
  googleDriveOnlyDownload: false,
  dropboxAppKey: null,
  dropboxAppSecret: null,
  dropboxRefreshToken: null,
  dropboxFolderPath: null,
  lastBackupTimestamp: null,
  lastBackupStatus: null,
  backupIntervalDays: 7,
  meetingNotificationSubject: 'Sazvana je nova sjednica: [NASLOV]',
  meetingNotificationBody: 'Poštovane članice i članovi tijela Društva,\n\nPozivamo Vas na sjednicu koja će se održati prema sljedećim podacima:\n\nNaziv sjednice: [NASLOV]\nDatum i vrijeme: [DATUM] u [VRIJEME]\nLokacija: [LOKACIJA]\n\nMolimo Vas da svoj dolazak potvrdite ili se prijavite u sustav radi uvida u dnevni red.\n\nPoveznica za prijavu u sustav: [LINK]\n\nSrdačan pozdrav,\nIzvršni odbor HRD "Pavao Ritter Vitezović"',
  meetingSummarySubject: 'Zapisnik i detalji sa sjednice: [NASLOV]',
  meetingSummaryBody: 'Poštovane članice i članovi tijela Društva,\n\nOvim putem Vas obavještavamo da je sjednica uspješno završena te su u sustavu dostupni zapisnik i materijali.\n\nNaziv: [NASLOV]\nDatum održavanja: [DATUM] u [VRIJEME]\nLokacija: [LOKACIJA]\n\nPoveznica za prijavu u sustav: [LINK]\n\nSrdačan pozdrav,\nIzvršni odbor HRD "Pavao Ritter Vitezović"',
  lectureNotificationSubject: 'Novo predavanje: [NASLOV]',
  lectureNotificationBody: 'Poštovane članice i članovi tijela Društva,\n\nZadovoljstvo nam je najaviti predavanje:\n\nNaziv predavanja: [NASLOV]\nPredavač: [PREDAVAČ]\nDatum i vrijeme: [DATUM] u [VRIJEME]\nLokacija: [LOKACIJA]\n\nRadujemo se Vašem dolasku.\n\nPoveznica za prijavu u sustav: [LINK]\n\nSrdačan pozdrav,\nHRD "Pavao Ritter Vitezović"',
  lectureSummarySubject: 'Održano predavanje: [NASLOV]',
  lectureSummaryBody: 'Poštovane članice i članovi tijela Društva,\n\nPredavanje je uspješno održano te su u sustavu dostupni sažetak i materijali.\n\nNaziv predavanja: [NASLOV]\nPredavač: [PREDAVAČ]\nDatum održavanja: [DATUM] u [VRIJEME]\nLokacija: [LOKACIJA]\n\nPoveznica za prijavu u sustav: [LINK]\n\nSrdačan pozdrav,\nHRD "Pavao Ritter Vitezović"',
  birthdayEmailSubject: 'Sretan rođendan želi Vam HRD "Pavao Ritter Vitezović"!',
  birthdayEmailBody: 'Poštovani/a {{name}},\n\nU ime Hrvatskog rodoslovnog društva "Pavao Ritter Vitezović" od srca Vam želimo sretan rođendan, puno zdravlja, radosti i uspjeha u daljnjem radu i istraživanju!\n\nSrdačan pozdrav,\nHRD "Pavao Ritter Vitezović"',
  missingDataEmailSubject: 'Zamolba za dopunu članskih podataka - HRD "Pavao Ritter Vitezović"',
  missingDataEmailBody: 'Poštovani/a {{name}},\n\nU tijeku je ažuriranje službene matične knjige Hrvatskog rodoslovnog društva „Pavao Ritter Vitezović”. U privitku ove poruke šaljemo Vam Vaš trenutni evidencijski list u PDF formatu kako biste imali uvid u podatke koje trenutno imamo zabilježene.\n\nZa potpunu evidenciju u našem kartonu trenutno nam nedostaju sljedeći podaci:\n{{missingFields}}\n\nPodatke možete najbrže dopuniti i provjeriti klikom na Vašu osobnu jednokratnu poveznicu:\n{{formLink}}\n\nVAŽNA NAPOMENA: Poveznica za dopunu podataka ograničena je na samo jedan (1) pristup. Svaki sljedeći pristup putem iste poveznice nije legalan niti dopušten, a nakon predaje podataka poveznica se trajno poništava. Molimo pripremite potrebne podatke prije otvaranja poveznice.\n\nAlternativno, možete nam odgovoriti i na ovu poruku. Unaprijed zahvaljujemo na suradnji!\n\nSrdačan pozdrav,\nTajništvo HRD „Pavao Ritter Vitezović”',
  boardNotice: null,
  boardNoticeAuthor: null,
  boardNoticeDate: null,
  adminPersonalNotes: "",
  adminPersonalTodos: [],
  hasGoogleServiceAccount: false,
  hasDropboxConfig: false,
  hasSmtpPass: false,
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings)
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false)
  const [isAdminSettingsLoaded, setIsAdminSettingsLoaded] = useState(false)
  const isAdminSettingsLoadedRef = React.useRef(false)
  const lastAdminUserKeyRef = React.useRef<string>("")
  const { user } = useAuth()
  const { addLog } = useActivityLog()

  const loadSettings = React.useCallback(async (scope: 'lite' | 'admin' = 'lite') => {
    try {
      const response = await fetch(`/api/settings?scope=${scope}`, { cache: 'no-store' })
      if (response.ok) {
        const data = await response.json()
        setSettings(prev => {
          const preserveAdminSecrets = scope === 'lite' && isAdminSettingsLoadedRef.current
          const nextSettings: AppSettings = {
            ...defaultSettings,
            ...data,
            expiredAfterDays: data.expiredAfterDays || data.inactiveAfterDays || defaultSettings.expiredAfterDays,
            requirePaymentToBeActive: data.requirePaymentToBeActive === 1 || data.requirePaymentToBeActive === true,
            maintenanceMode: data.maintenanceMode === 1 || data.maintenanceMode === true,
            adminInactivityEnabled: data.adminInactivityEnabled === 1 || data.adminInactivityEnabled === true,
            adminInactivityDays: typeof data.adminInactivityDays === 'number' && data.adminInactivityDays > 0 ? data.adminInactivityDays : 30,
            lastAdminLoginAt: data.lastAdminLoginAt ?? null,
            adminInactivityAlertSentAt: data.adminInactivityAlertSentAt ?? null,
            meetingTypes: data.meetingTypes
              ? (typeof data.meetingTypes === 'string' ? JSON.parse(data.meetingTypes) : data.meetingTypes)
              : defaultSettings.meetingTypes,
            meetingLocations: data.meetingLocations
              ? (typeof data.meetingLocations === 'string' ? JSON.parse(data.meetingLocations) : data.meetingLocations)
              : defaultSettings.meetingLocations,
            gmailMailbox: data.gmailMailbox ?? null,
            adminBackupEmail: data.adminBackupEmail ?? null,
            adminBackupPassword: data.adminBackupPassword ?? (preserveAdminSecrets ? prev.adminBackupPassword : null),
            vaultNotes: data.vaultNotes ?? (preserveAdminSecrets ? prev.vaultNotes : ""),
            smtpHost: data.smtpHost ?? null,
            smtpPort: data.smtpPort ?? 587,
            smtpUser: data.smtpUser ?? null,
            smtpPass: data.smtpPass ?? (preserveAdminSecrets ? prev.smtpPass : null),
            smtpSecure: data.smtpSecure === 1 || data.smtpSecure === true,
            smtpFrom: data.smtpFrom ?? null,
            paymentEmailSubject: data.paymentEmailSubject ?? defaultSettings.paymentEmailSubject,
            paymentEmailBody: data.paymentEmailBody ?? defaultSettings.paymentEmailBody,
            invitationEmailSubject: data.invitationEmailSubject ?? defaultSettings.invitationEmailSubject,
            invitationEmailBody: data.invitationEmailBody ?? defaultSettings.invitationEmailBody,
            pollEmailSubject: data.pollEmailSubject ?? defaultSettings.pollEmailSubject,
            pollEmailBody: data.pollEmailBody ?? defaultSettings.pollEmailBody,
            paymentSlipUrl: data.paymentSlipUrl ?? null,
            paymentQrUrl: data.paymentQrUrl ?? null,
            paymentEmailSignature: data.paymentEmailSignature ?? defaultSettings.paymentEmailSignature,
            projectContributorTemplates: data.projectContributorTemplates
              ? (typeof data.projectContributorTemplates === 'string' ? JSON.parse(data.projectContributorTemplates) : data.projectContributorTemplates)
              : defaultSettings.projectContributorTemplates,
            googleDriveOnlyDownload: data.googleDriveOnlyDownload === 1 || data.googleDriveOnlyDownload === true,
            googleServiceAccountJson: data.googleServiceAccountJson ?? (preserveAdminSecrets ? prev.googleServiceAccountJson : null),
            dropboxAppKey: data.dropboxAppKey ?? null,
            dropboxAppSecret: data.dropboxAppSecret ?? (preserveAdminSecrets ? prev.dropboxAppSecret : null),
            dropboxRefreshToken: data.dropboxRefreshToken ?? (preserveAdminSecrets ? prev.dropboxRefreshToken : null),
            dropboxFolderPath: data.dropboxFolderPath ?? null,
            lastBackupTimestamp: data.lastBackupTimestamp ?? null,
            lastBackupStatus: data.lastBackupStatus ?? null,
            backupIntervalDays: data.backupIntervalDays ?? 7,
            meetingNotificationSubject: data.meetingNotificationSubject ?? defaultSettings.meetingNotificationSubject,
            meetingNotificationBody: data.meetingNotificationBody ?? defaultSettings.meetingNotificationBody,
            meetingSummarySubject: data.meetingSummarySubject ?? defaultSettings.meetingSummarySubject,
            meetingSummaryBody: data.meetingSummaryBody ?? defaultSettings.meetingSummaryBody,
            lectureNotificationSubject: data.lectureNotificationSubject ?? defaultSettings.lectureNotificationSubject,
            lectureNotificationBody: data.lectureNotificationBody ?? defaultSettings.lectureNotificationBody,
            lectureSummarySubject: data.lectureSummarySubject ?? defaultSettings.lectureSummarySubject,
            lectureSummaryBody: data.lectureSummaryBody ?? defaultSettings.lectureSummaryBody,
            birthdayEmailSubject: data.birthdayEmailSubject || defaultSettings.birthdayEmailSubject,
            birthdayEmailBody: data.birthdayEmailBody || defaultSettings.birthdayEmailBody,
            missingDataEmailSubject: data.missingDataEmailSubject || defaultSettings.missingDataEmailSubject,
            missingDataEmailBody: data.missingDataEmailBody || defaultSettings.missingDataEmailBody,
            adminPersonalNotes: data.adminPersonalNotes ?? (preserveAdminSecrets ? prev.adminPersonalNotes : ""),
            adminPersonalTodos: data.adminPersonalTodos
              ? (typeof data.adminPersonalTodos === 'string' ? JSON.parse(data.adminPersonalTodos) : data.adminPersonalTodos)
              : (preserveAdminSecrets ? prev.adminPersonalTodos : []),
            hasGoogleServiceAccount: Boolean(data.hasGoogleServiceAccount ?? data.googleServiceAccountJson),
            hasDropboxConfig: Boolean(data.hasDropboxConfig),
            hasSmtpPass: Boolean(data.hasSmtpPass ?? data.smtpPass),
          }
          try {
            if (JSON.stringify(prev) === JSON.stringify(nextSettings)) {
              return prev
            }
          } catch {}
          return nextSettings
        })

        if (scope === 'admin') {
          isAdminSettingsLoadedRef.current = true
          setIsAdminSettingsLoaded(true)
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    } finally {
      setIsSettingsLoaded(true)
    }
  }, [])

  const loadAdminSettings = React.useCallback(async () => {
    await loadSettings('admin')
  }, [loadSettings])

  const syncSystemStatus = React.useCallback(async () => {
    try {
      const res = await fetch('/api/system/status', { cache: 'no-store' })
      if (!res.ok) return
      const st = await res.json()
      setSettings(prev => {
        const nextMaint = Boolean(st.maintenanceMode)
        const nextOverdue = Number(st.overdueAfterDays) || prev.overdueAfterDays
        const nextExpired = Number(st.expiredAfterDays) || prev.expiredAfterDays
        const nextReqPay = Boolean(st.requirePaymentToBeActive)
        const nextNotice = st.boardNotice ?? null
        const nextAuthor = st.boardNoticeAuthor ?? null
        const nextDate = st.boardNoticeDate ?? null

        if (
          prev.maintenanceMode === nextMaint &&
          prev.overdueAfterDays === nextOverdue &&
          prev.expiredAfterDays === nextExpired &&
          prev.requirePaymentToBeActive === nextReqPay &&
          (prev.boardNotice ?? null) === nextNotice &&
          (prev.boardNoticeAuthor ?? null) === nextAuthor &&
          (prev.boardNoticeDate ?? null) === nextDate
        ) {
          return prev
        }

        return {
          ...prev,
          maintenanceMode: nextMaint,
          overdueAfterDays: nextOverdue,
          expiredAfterDays: nextExpired,
          requirePaymentToBeActive: nextReqPay,
          boardNotice: nextNotice,
          boardNoticeAuthor: nextAuthor,
          boardNoticeDate: nextDate,
        }
      })
    } catch {
      // Ignore transient network errors
    }
  }, [])

  useEffect(() => { loadSettings('lite') }, [loadSettings])

  useEffect(() => {
    const userKey = user ? `${user.id}:${user.role}` : ''
    if (!user) {
      if (isAdminSettingsLoadedRef.current) {
        isAdminSettingsLoadedRef.current = false
        setIsAdminSettingsLoaded(false)
        loadSettings('lite')
      }
      lastAdminUserKeyRef.current = ''
      return
    }
    if (user.role === 'admin' && lastAdminUserKeyRef.current !== userKey) {
      lastAdminUserKeyRef.current = userKey
      loadSettings('lite')
    }
  }, [user?.id, user?.role, user, loadSettings])

  const saveSettings = async (newSettingsPartial: Partial<AppSettings>, description: string = 'Ažuriranje postavki') => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettingsPartial),
      })
      
      if (res.ok) {
        if (user && description) {
          addLog({ 
            userId: user.id.toString(), 
            userName: user.name, 
            userRole: user.role, 
            action: 'Promjena postavki', 
            details: description 
          })
        }
        await loadSettings(isAdminSettingsLoadedRef.current && user?.role === 'admin' ? 'admin' : 'lite')
      } else {
        console.error('Server returned error when saving settings')
      }
    } catch (error) {
      console.error('Failed to save settings:', error)
    }
  }

  const setLogoUrl = (url: string | null) => {
    const updated = { ...settings, logoUrl: url }
    setSettings(updated)
    saveSettings({ logoUrl: url }, `Promjena logotipa društva na URL: ${url || 'uklonjeno'}`)
  }

  const setOverdueAfterDays = (days: number) => {
    setSettings(prev => ({ ...prev, overdueAfterDays: days }))
    saveSettings({ overdueAfterDays: days }, `Promjena roka za dugovanja na ${days} dana`)
  }

  const setExpiredAfterDays = (days: number) => {
    setSettings(prev => ({ ...prev, expiredAfterDays: days }))
    saveSettings({ expiredAfterDays: days }, `Promjena roka za inaktivnost na ${days} dana`)
  }

  const setRequirePaymentToBeActive = (enabled: boolean) => {
    setSettings(prev => ({ ...prev, requirePaymentToBeActive: enabled }))
    saveSettings(
      { requirePaymentToBeActive: enabled },
      enabled
        ? 'Uključeno pravilo: član bez ijedne uplate ne može biti aktivan'
        : 'Isključeno pravilo: član bez ijedne uplate ne može biti aktivan'
    )
  }

  const setMaintenanceMode = async (enabled: boolean) => {
    setSettings(prev => ({ ...prev, maintenanceMode: enabled }))
    await saveSettings(
      { maintenanceMode: enabled },
      enabled
        ? 'Uključen način održavanja (aplikacija zaključana za sve osim administratora)'
        : 'Isključen način održavanja (aplikacija ponovno dostupna svim korisnicima)'
    )
  }

  const setAdminInactivitySettings = async (cfg: { adminInactivityEnabled: boolean; adminInactivityDays: number }) => {
    const safeDays = Math.max(1, Math.min(3650, Number(cfg.adminInactivityDays) || 30))
    setSettings(prev => ({
      ...prev,
      adminInactivityEnabled: cfg.adminInactivityEnabled,
      adminInactivityDays: safeDays,
    }))
    await saveSettings(
      { adminInactivityEnabled: cfg.adminInactivityEnabled, adminInactivityDays: safeDays },
      cfg.adminInactivityEnabled
        ? `Uključena kontrola neaktivnosti administratora (${safeDays} dana)`
        : 'Isključena kontrola neaktivnosti administratora'
    )
  }

  const addFunction = (name: string) => {
    if (settings.availableFunctions.includes(name)) return
    const updated = [...settings.availableFunctions, name]
    setSettings(prev => ({ ...prev, availableFunctions: updated }))
    saveSettings({ availableFunctions: updated as any })
  }

  const removeFunction = (name: string) => {
    const updated = settings.availableFunctions.filter(fn => fn !== name)
    setSettings(prev => ({ ...prev, availableFunctions: updated }))
    saveSettings({ availableFunctions: updated as any })
  }

  const setGoogleDriveUrl = (url: string | null) => {
    setSettings(prev => ({ ...prev, googleDriveUrl: url }))
    saveSettings({ googleDriveUrl: url }, `Ažuriranje Google Drive linka: ${url || 'uklonjeno'}`)
  }

  const setGoogleDriveSettings = (json: string, folderId: string) => {
    setSettings(prev => ({ ...prev, googleServiceAccountJson: json, googleDriveFolderId: folderId }))
  }

  const setGmailMailbox = (email: string | null) => {
    setSettings(prev => ({ ...prev, gmailMailbox: email }))
    saveSettings({ gmailMailbox: email }, `Ažuriranje Gmail sandučića: ${email || 'uklonjeno'}`)
  }

  const setSMTPSettings = (smtpSettings: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...smtpSettings }))
    saveSettings(smtpSettings, `Ažuriranje SMTP postavki`)
  }

  const addMeetingType = (type: string) => {
    if (settings.meetingTypes.includes(type)) return
    const updated = [...settings.meetingTypes, type]
    setSettings(prev => ({ ...prev, meetingTypes: updated }))
    saveSettings({ meetingTypes: updated as any }, `Dodana nova vrsta sjednice: ${type}`)
  }

  const removeMeetingType = (type: string) => {
    const updated = settings.meetingTypes.filter(t => t !== type)
    setSettings(prev => ({ ...prev, meetingTypes: updated }))
    saveSettings({ meetingTypes: updated as any })
  }

  const addMeetingLocation = (location: string) => {
    if (settings.meetingLocations.includes(location)) return
    const updated = [...settings.meetingLocations, location]
    setSettings(prev => ({ ...prev, meetingLocations: updated }))
    saveSettings({ meetingLocations: updated as any }, `Dodana nova lokacija sjednice: ${location}`)
  }

  const removeMeetingLocation = (location: string) => {
    const updated = settings.meetingLocations.filter(l => l !== location)
    setSettings(prev => ({ ...prev, meetingLocations: updated }))
    saveSettings({ meetingLocations: updated as any }, `Uklonjena lokacija sjednice: ${location}`)
  }

  const setAdminName = async (name: string | null) => {
    const trimmed = name?.trim() || null
    setSettings(prev => ({ ...prev, adminName: trimmed }))
    await saveSettings({ adminName: trimmed }, `Promjena imena administratora u: ${trimmed || 'Administrator'}`)
  }

  const setAdminBackupSettings = (email: string | null, password?: string | null) => {
    setSettings(prev => ({ ...prev, adminBackupEmail: email, adminBackupPassword: password ?? prev.adminBackupPassword }))
    saveSettings({ adminBackupEmail: email, adminBackupPassword: password }, `Promjena postavki rezervnog admina`)
  }

  const setVaultNotes = (notes: string) => {
    setSettings(prev => ({ ...prev, vaultNotes: notes }))
    saveSettings({ vaultNotes: notes }, `Ažuriranje bilješki u trezoru`)
  }
  
  const setPaymentEmailSettings = (emailSettings: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...emailSettings }))
    saveSettings(emailSettings, `Ažuriranje predložaka za e-mail obavijesti`)
  }

  const setContributorTemplates = (templates: ContributorTemplate[]) => {
    setSettings(prev => ({ ...prev, projectContributorTemplates: templates }))
    saveSettings({ projectContributorTemplates: templates as any }, `Ažuriranje šablona za doprinositelje projekata`)
  }

  const setGoogleDriveOnlyDownload = (onlyDownload: boolean) => {
    setSettings(prev => ({ ...prev, googleDriveOnlyDownload: onlyDownload }))
    saveSettings({ googleDriveOnlyDownload: onlyDownload }, `Promjena postavke Google Drive: samo preuzimanje = ${onlyDownload}`)
  }

  const setDropboxSettings = async (dropboxSettings: Partial<AppSettings>) => {
    try {
      setSettings(prev => ({ ...prev, ...dropboxSettings }))
      await saveSettings(dropboxSettings, `Ažuriranje Dropbox postavki`)
      return true
    } catch (e) {
      console.error(e)
      return false
    }
  }

  const runBackupNow = async () => {
    try {
      const res = await fetch('/api/admin/settings/dropbox/backup', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        await loadSettings()
        return true
      }
      return false
    } catch (e) {
      console.error(e)
      return false
    }
  }

  const setBoardNotice = async (notice: string, author?: string) => {
    const now = new Date().toISOString()
    setSettings(prev => ({ ...prev, boardNotice: notice, boardNoticeAuthor: author || null, boardNoticeDate: now }))
    await saveSettings({ boardNotice: notice, boardNoticeAuthor: author || null, boardNoticeDate: now }, 'Ažuriranje oglasne ploče odbora')
  }

  const setBackupIntervalDays = (days: number) => {
    setSettings(prev => ({ ...prev, backupIntervalDays: days }))
    saveSettings({ backupIntervalDays: days }, `Promjena intervala automatskog backupa na ${days} dana`)
  }

  const refreshSettings = React.useCallback(async () => {
    await loadSettings(isAdminSettingsLoadedRef.current && user?.role === 'admin' ? 'admin' : 'lite')
  }, [loadSettings, user?.role])

  return (
    <SettingsContext.Provider value={{
      settings, isSettingsLoaded, isAdminSettingsLoaded, loadAdminSettings, syncSystemStatus,
      setLogoUrl, setBoardNotice, setOverdueAfterDays, setExpiredAfterDays, setRequirePaymentToBeActive,
      setMaintenanceMode, setAdminInactivitySettings,
      addFunction, removeFunction, setGoogleDriveUrl, setGoogleDriveSettings,
      setGmailMailbox, refreshSettings, addMeetingType, removeMeetingType,
      addMeetingLocation, removeMeetingLocation, setAdminName, setAdminBackupSettings, setVaultNotes,
      setSMTPSettings, setPaymentEmailSettings, setContributorTemplates,
      setGoogleDriveOnlyDownload, setDropboxSettings, runBackupNow, setBackupIntervalDays
    }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (!context) throw new Error('useSettings must be used within SettingsProvider')
  return context
}
