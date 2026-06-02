"use client"

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
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
  availableFunctions: string[]
  googleDriveUrl: string | null
  googleServiceAccountJson: string | null
  googleDriveFolderId: string | null
  meetingTypes: string[]
  meetingLocations: string[]
  gmailMailbox: string | null
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
  projectContributorTemplates: ContributorTemplate[]
  googleDriveOnlyDownload: boolean
  dropboxAppKey: string | null
  dropboxAppSecret: string | null
  dropboxRefreshToken: string | null
  dropboxFolderPath: string | null
  lastBackupTimestamp: string | null
  lastBackupStatus: string | null
}

interface SettingsContextType {
  settings: AppSettings
  setLogoUrl: (url: string | null) => void
  setOverdueAfterDays: (days: number) => void
  setExpiredAfterDays: (days: number) => void
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
  setAdminBackupSettings: (email: string | null, password?: string | null) => void
  setVaultNotes: (notes: string) => void
  setSMTPSettings: (settings: Partial<AppSettings>) => void
  setPaymentEmailSettings: (settings: Partial<AppSettings>) => void
  setContributorTemplates: (templates: ContributorTemplate[]) => void
  setGoogleDriveOnlyDownload: (onlyDownload: boolean) => void
  setDropboxSettings: (settings: Partial<AppSettings>) => Promise<boolean>
  runBackupNow: () => Promise<boolean>
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

const defaultSettings: AppSettings = {
  logoUrl: null,
  overdueAfterDays: 365,
  expiredAfterDays: 730,
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
    'Online (Zoom)', 'Knjižnica',
  ],
  gmailMailbox: null,
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
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings)
  const { user } = useAuth()
  const { addLog } = useActivityLog()

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings')
      if (response.ok) {
        const data = await response.json()
        setSettings({
          ...defaultSettings,
          ...data,
          expiredAfterDays: data.expiredAfterDays || data.inactiveAfterDays || defaultSettings.expiredAfterDays,
          meetingTypes: data.meetingTypes
            ? (typeof data.meetingTypes === 'string' ? JSON.parse(data.meetingTypes) : data.meetingTypes)
            : defaultSettings.meetingTypes,
          meetingLocations: data.meetingLocations
            ? (typeof data.meetingLocations === 'string' ? JSON.parse(data.meetingLocations) : data.meetingLocations)
            : defaultSettings.meetingLocations,
          gmailMailbox: data.gmailMailbox ?? null,
          adminBackupEmail: data.adminBackupEmail ?? null,
          adminBackupPassword: data.adminBackupPassword ?? null,
          vaultNotes: data.vaultNotes ?? "",
          smtpHost: data.smtpHost ?? null,
          smtpPort: data.smtpPort ?? 587,
          smtpUser: data.smtpUser ?? null,
          smtpPass: data.smtpPass ?? null,
          smtpSecure: data.smtpSecure === 1 || data.smtpSecure === true,
          smtpFrom: data.smtpFrom ?? null,
          paymentEmailSubject: data.paymentEmailSubject ?? defaultSettings.paymentEmailSubject,
          paymentEmailBody: data.paymentEmailBody ?? defaultSettings.paymentEmailBody,
          paymentSlipUrl: data.paymentSlipUrl ?? null,
          paymentQrUrl: data.paymentQrUrl ?? null,
          paymentEmailSignature: data.paymentEmailSignature ?? defaultSettings.paymentEmailSignature,
          projectContributorTemplates: data.projectContributorTemplates
            ? (typeof data.projectContributorTemplates === 'string' ? JSON.parse(data.projectContributorTemplates) : data.projectContributorTemplates)
            : defaultSettings.projectContributorTemplates,
          googleDriveOnlyDownload: data.googleDriveOnlyDownload === 1 || data.googleDriveOnlyDownload === true,
          dropboxAppKey: data.dropboxAppKey ?? null,
          dropboxAppSecret: data.dropboxAppSecret ?? null,
          dropboxRefreshToken: data.dropboxRefreshToken ?? null,
          dropboxFolderPath: data.dropboxFolderPath ?? null,
          lastBackupTimestamp: data.lastBackupTimestamp ?? null,
          lastBackupStatus: data.lastBackupStatus ?? null,
        })
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  useEffect(() => { loadSettings() }, [])

  const saveSettings = async (newSettingsPartial: Partial<AppSettings>, description: string = 'Ažuriranje postavki') => {
    try {
      // Prednost: šaljemo samo promjene serveru
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
        // Bitno: odmah učitavamo najnovije stanje iz baze kako bismo bili sigurni da je spremljeno
        await loadSettings()
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
    saveSettings({ meetingLocations: updated as any })
    saveSettings({ meetingLocations: updated as any }, `Uklonjena lokacija sjednice: ${location}`)
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
    saveSettings({ googleDriveOnlyDownload: onlyDownload ? 1 : 0 }, `Promjena postavke Google Drive: samo preuzimanje = ${onlyDownload}`)
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

  const refreshSettings = async () => { await loadSettings() }

  return (
    <SettingsContext.Provider value={{
      settings, setLogoUrl, setOverdueAfterDays, setExpiredAfterDays,
      addFunction, removeFunction, setGoogleDriveUrl, setGoogleDriveSettings,
      setGmailMailbox, refreshSettings, addMeetingType, removeMeetingType,
      addMeetingLocation, removeMeetingLocation, setAdminBackupSettings, setVaultNotes,
      setSMTPSettings, setPaymentEmailSettings, setContributorTemplates,
      setGoogleDriveOnlyDownload, setDropboxSettings, runBackupNow
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
