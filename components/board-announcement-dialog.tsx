"use client"

import * as React from "react"
import { useAuth } from "@/contexts/auth-context"
import { useMembers, isAdminAccountEntry, type Member } from "@/contexts/members-context"
import { useSettings } from "@/contexts/settings-context"
import { useActivityLog } from "@/contexts/activity-log-context"
import {
  buildBoardAnnouncementEmail,
  DEFAULT_BOARD_ANNOUNCEMENT_SUBJECT,
} from "@/lib/hrd-email-system"
import {
  isBoardMember,
  getMemberActiveFunctions,
  formatDateTimeDMY,
} from "@/lib/utils"
import { getMemberActionPermissions } from "@/lib/inquiry-permissions"
import {
  BoardAnnouncementsHistoryList,
  type BoardAnnouncementHistoryItem,
} from "@/components/board-announcements-history"
import { EmailSendProgressBanner } from "@/components/email-send-progress-banner"
import { CloseActionButton } from "@/components/ui/action-bar"
import {
  consumeEmailSendStream,
  INITIAL_BULK_EMAIL_PROGRESS,
  type BulkEmailProgressState,
} from "@/lib/bulk-email-stream"
import {
  BOARD_ATTACHMENT_ACCEPT_ATTR,
  BOARD_ATTACHMENT_MAX_FILES,
  BOARD_ATTACHMENT_MAX_FILE_BYTES,
  BOARD_ATTACHMENT_MAX_TOTAL_BYTES,
  type BoardAnnouncementAttachment,
  formatAttachmentSize,
  formatAttachmentsCountLabel,
  getBoardAttachmentExtension,
  isAllowedBoardAttachmentName,
} from "@/lib/board-attachment-utils"

export function canUserSendBoardAnnouncement(user: any, _members?: Member[]): boolean {
  if (!user) return false
  return getMemberActionPermissions(user).obavijest_tijelima
}

export function canUserViewBoardAnnouncementHistory(user: any, members?: Member[]): boolean {
  if (!user) return false
  if (getMemberActionPermissions(user).obavijest_tijelima) return true
  const me = (members || []).find(
    (m) =>
      Number(m.id) === Number(user.id) ||
      (user.email && m.email && m.email.toLowerCase() === user.email.toLowerCase())
  )
  return Boolean(me && !me.deceased && !me.expelled && isBoardMember(me))
}
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Mail,
  Send,
  Users,
  Eye,
  Edit3,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  UserCheck,
  AlertTriangle,
  Megaphone,
  ChevronDown,
  ChevronUp,
  History,
  Paperclip,
  Upload,
  X,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  FileArchive,
  File as FileIcon,
} from "lucide-react"

interface DraftBoardAttachment extends BoardAnnouncementAttachment {
  isSessionUpload?: boolean
}

function renderAttachmentTypeIcon(name: string, mimeType?: string) {
  const ext = getBoardAttachmentExtension(name)
  const mime = String(mimeType || "").toLowerCase()
  if (mime.startsWith("image/") || [".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext)) {
    return <ImageIcon className="h-4 w-4 text-sky-700 shrink-0" />
  }
  if ([".xls", ".xlsx", ".ods", ".csv"].includes(ext)) {
    return <FileSpreadsheet className="h-4 w-4 text-emerald-700 shrink-0" />
  }
  if (ext === ".zip") {
    return <FileArchive className="h-4 w-4 text-amber-700 shrink-0" />
  }
  if ([".pdf", ".doc", ".docx", ".odt", ".rtf", ".txt", ".ppt", ".pptx", ".odp"].includes(ext)) {
    return <FileText className="h-4 w-4 text-[#1E3A5F] shrink-0" />
  }
  return <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
}

interface BoardAnnouncementDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialMessage?: string
  initialTab?: "edit" | "preview" | "history"
  onSent?: () => void
}

interface BoardRecipient {
  member: Member
  id: number
  name: string
  email: string
  functions: string[]
}

export function BoardAnnouncementDialog({
  open,
  onOpenChange,
  initialMessage,
  initialTab = "edit",
  onSent,
}: BoardAnnouncementDialogProps) {
  const { user } = useAuth()
  const { members } = useMembers()
  const { settings, refreshSettings } = useSettings()
  const { refreshLogs } = useActivityLog()

  const canSend = React.useMemo(() => canUserSendBoardAnnouncement(user, members), [user, members])

  const [subject, setSubject] = React.useState("")
  const [message, setMessage] = React.useState("")
  const [selectedIds, setSelectedIds] = React.useState<number[]>([])
  const [viewMode, setViewMode] = React.useState<"edit" | "preview" | "history">(
    canSend ? initialTab : "history"
  )
  const [showRecipientsList, setShowRecipientsList] = React.useState(true)
  const [syncBoardNotice, setSyncBoardNotice] = React.useState(false)
  const [testEmailAddress, setTestEmailAddress] = React.useState("")
  const [historyItems, setHistoryItems] = React.useState<BoardAnnouncementHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = React.useState(false)
  const [historyError, setHistoryError] = React.useState<string | null>(null)

  const [attachments, setAttachments] = React.useState<DraftBoardAttachment[]>([])
  const [isUploadingAttachments, setIsUploadingAttachments] = React.useState(false)
  const [uploadError, setUploadError] = React.useState<string | null>(null)
  const [isDragOver, setIsDragOver] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)

  const [isSending, setIsSending] = React.useState(false)
  const [isSendingTest, setIsSendingTest] = React.useState(false)
  const [isBroadcastSent, setIsBroadcastSent] = React.useState(false)
  const [sendProgress, setSendProgress] = React.useState<BulkEmailProgressState>(INITIAL_BULK_EMAIL_PROGRESS)
  const sendAbortRef = React.useRef<AbortController | null>(null)
  const [statusBanner, setStatusBanner] = React.useState<{
    type: "idle" | "success" | "error"
    title?: string
    message: string
    sentAt?: string
  }>({ type: "idle", message: "" })

  const originUrl =
    typeof window !== "undefined" ? window.location.origin : "https://cms.rodoslovlje.hr"

  // Trenutni sastav tijela društva (aktivne funkcije s važećim mandatom, bez admina, preminulih, ispisanih i Ne kontaktirati)
  const { eligibleRecipients, missingEmailBoardMembers, doNotContactBoardMembers } = React.useMemo(() => {
    const activeBoard = (members || [])
      .filter((m) => m && !isAdminAccountEntry(m) && !m.deceased && !m.expelled && isBoardMember(m))
      .sort((a, b) => a.name.localeCompare(b.name, "hr"))

    const eligible: BoardRecipient[] = []
    const missingEmail: Array<{ id: number; name: string; functions: string[] }> = []
    const blockedNoContact: Array<{ id: number; name: string; functions: string[] }> = []
    const seenEmails = new Set<string>()

    for (const m of activeBoard) {
      const activeFns = getMemberActiveFunctions(m)
      if (m.doNotContact) {
        blockedNoContact.push({ id: m.id, name: m.name, functions: activeFns })
        continue
      }
      const email = String(m.email || "").trim()
      if (!email || !email.includes("@")) {
        missingEmail.push({ id: m.id, name: m.name, functions: activeFns })
        continue
      }
      const key = email.toLowerCase()
      if (seenEmails.has(key)) continue
      seenEmails.add(key)

      eligible.push({
        member: m,
        id: m.id,
        name: m.name,
        email,
        functions: activeFns,
      })
    }

    return {
      eligibleRecipients: eligible,
      missingEmailBoardMembers: missingEmail,
      doNotContactBoardMembers: blockedNoContact,
    }
  }, [members])

  // Odredi identitet prijavljenog pošiljatelja za zaglavlje/okvir obavijesti
  const { senderDisplayName, senderRoleLabel } = React.useMemo(() => {
    if (!user) {
      return { senderDisplayName: "Administrator", senderRoleLabel: "Administrator" }
    }
    if (user.role === "admin") {
      return {
        senderDisplayName: settings?.adminName?.trim() || user.name || "Administrator",
        senderRoleLabel: "Administrator",
      }
    }
    const me = (members || []).find(
      (m) =>
        Number(m.id) === Number(user.id) ||
        (user.email && m.email && m.email.toLowerCase() === user.email.toLowerCase())
    )
    const activeFns = me ? getMemberActiveFunctions(me) : []
    return {
      senderDisplayName: me?.name || user.name,
      senderRoleLabel:
        activeFns.length > 0
          ? activeFns.join(", ")
          : user.role === "moderator"
          ? "Moderator (tijelo društva)"
          : "Član tijela društva",
    }
  }, [user, members, settings?.adminName])

  const canSyncBoardNotice = user?.role === "admin" || user?.role === "moderator"

  const loadHistory = React.useCallback(async () => {
    setHistoryLoading(true)
    setHistoryError(null)
    try {
      const res = await fetch("/api/board/announcement", { cache: "no-store" })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setHistoryError(data.error || "Nije moguće učitati povijest obavijesti.")
        return
      }
      setHistoryItems(Array.isArray(data.announcements) ? data.announcements : [])
    } catch (err: any) {
      setHistoryError(err?.message || "Greška pri učitavanju povijesti poslanih obavijesti.")
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  const prevOpenRef = React.useRef(false)
  React.useEffect(() => {
    if (open && !prevOpenRef.current) {
      prevOpenRef.current = true
      setSubject(DEFAULT_BOARD_ANNOUNCEMENT_SUBJECT)
      setMessage(initialMessage || "")
      setSelectedIds(eligibleRecipients.map((r) => r.id))
      setViewMode(canSend ? initialTab : "history")
      setShowRecipientsList(true)
      setSyncBoardNotice(false)
      setIsBroadcastSent(false)
      setAttachments([])
      setUploadError(null)
      setIsDragOver(false)
      setIsUploadingAttachments(false)
      setStatusBanner({ type: "idle", message: "" })
      setSendProgress(INITIAL_BULK_EMAIL_PROGRESS)
      const userEmail = user?.email && user.email.includes("@") ? user.email : ""
      setTestEmailAddress(userEmail || settings?.smtpFrom || "")
      loadHistory()
    } else if (!open) {
      prevOpenRef.current = false
    }
  }, [open, initialMessage, initialTab, canSend, eligibleRecipients, user?.email, settings?.smtpFrom, loadHistory])

  const selectedRecipients = React.useMemo(
    () => eligibleRecipients.filter((r) => selectedIds.includes(r.id)),
    [eligibleRecipients, selectedIds]
  )

  const toggleAllRecipients = (checked: boolean) => {
    setSelectedIds(checked ? eligibleRecipients.map((r) => r.id) : [])
  }

  const toggleSingleRecipient = (id: number, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((item) => item !== id)
    )
  }

  const totalAttachmentsBytes = React.useMemo(
    () => attachments.reduce((sum, item) => sum + (Number(item.size) || 0), 0),
    [attachments]
  )

  const handleFilesUpload = React.useCallback(
    async (fileList: FileList | File[] | null) => {
      if (!fileList || isBroadcastSent || isSending) return
      const incoming = Array.from(fileList)
      if (incoming.length === 0) return

      setUploadError(null)

      if (attachments.length + incoming.length > BOARD_ATTACHMENT_MAX_FILES) {
        setUploadError(
          `Možete priložiti najviše ${BOARD_ATTACHMENT_MAX_FILES} datoteka po obavijesti (trenutno priloženo: ${attachments.length}).`
        )
        return
      }

      let incomingBytes = 0
      for (const file of incoming) {
        if (!isAllowedBoardAttachmentName(file.name)) {
          setUploadError(
            `Datoteka "${file.name}" nije podržane vrste. Dozvoljeni su dokumenti (PDF, Word, Excel, PowerPoint, ODT, TXT, CSV), slike i ZIP arhive.`
          )
          return
        }
        if (file.size <= 0) {
          setUploadError(`Datoteka "${file.name}" je prazna i ne može se priložiti.`)
          return
        }
        if (file.size > BOARD_ATTACHMENT_MAX_FILE_BYTES) {
          setUploadError(
            `Datoteka "${file.name}" (${formatAttachmentSize(file.size)}) premašuje ograničenje od ${formatAttachmentSize(BOARD_ATTACHMENT_MAX_FILE_BYTES)} po datoteci.`
          )
          return
        }
        incomingBytes += file.size
      }

      if (totalAttachmentsBytes + incomingBytes > BOARD_ATTACHMENT_MAX_TOTAL_BYTES) {
        setUploadError(
          `Ukupna veličina svih priloga (${formatAttachmentSize(totalAttachmentsBytes + incomingBytes)}) premašuje dopuštenih ${formatAttachmentSize(BOARD_ATTACHMENT_MAX_TOTAL_BYTES)}.`
        )
        return
      }

      const formData = new FormData()
      for (const file of incoming) {
        formData.append("files", file)
      }

      setIsUploadingAttachments(true)
      try {
        const headers: Record<string, string> = {}
        if (user) {
          headers["x-user-id"] = String(user.id ?? "")
          headers["x-user-role"] = String(user.role ?? "")
          headers["x-user-email"] = String(user.email ?? "")
          headers["x-user-name"] = encodeURIComponent(String(user.name ?? ""))
        }

        const res = await fetch("/api/board/announcement/upload", {
          method: "POST",
          headers,
          body: formData,
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data?.success) {
          setUploadError(data?.error || "Greška pri učitavanju priloženih datoteka.")
          return
        }
        const added: DraftBoardAttachment[] = (Array.isArray(data.attachments) ? data.attachments : []).map(
          (att: BoardAnnouncementAttachment) => ({
            ...att,
            isSessionUpload: true,
          })
        )
        setAttachments((prev) => [...prev, ...added])
      } catch (err: any) {
        setUploadError(err?.message || "Nije moguće povezati se s poslužiteljem za učitavanje datoteka.")
      } finally {
        setIsUploadingAttachments(false)
      }
    },
    [attachments.length, isBroadcastSent, isSending, totalAttachmentsBytes, user]
  )

  const handleRemoveAttachment = React.useCallback(
    async (index: number) => {
      if (isBroadcastSent || isSending) return
      const target = attachments[index]
      setAttachments((prev) => prev.filter((_, i) => i !== index))
      setUploadError(null)

      if (target?.isSessionUpload && target.url.startsWith("/api/uploads/")) {
        const rawFilename = target.url.slice("/api/uploads/".length).split("?")[0]
        if (rawFilename) {
          try {
            const headers: Record<string, string> = {}
            if (user) {
              headers["x-user-id"] = String(user.id ?? "")
              headers["x-user-role"] = String(user.role ?? "")
              headers["x-user-email"] = String(user.email ?? "")
            }
            await fetch(
              `/api/board/announcement/upload?filename=${encodeURIComponent(rawFilename)}`,
              { method: "DELETE", headers }
            )
          } catch {}
        }
      }
    },
    [attachments, isBroadcastSent, isSending, user]
  )

  // Live pregled u standardiziranom HRD predlošku (#1E3A5F / #D97706 / #7C2D12 + potpis)
  const previewBuilt = React.useMemo(() => {
    const now = new Date()
    const formattedDateTime = formatDateTimeDMY(now)
    return buildBoardAnnouncementEmail({
      subject: subject.trim() || DEFAULT_BOARD_ANNOUNCEMENT_SUBJECT,
      message:
        message.trim() ||
        "Ovdje će se prikazati tekst Vaše poslane poruke za članove tijela Društva...",
      senderName: senderDisplayName,
      sentDate: now,
      formattedDateTime,
      ctaUrl: originUrl,
      settings,
      attachments,
      sender: user
        ? {
            userId: user.id,
            userName: senderDisplayName,
            userEmail: user.email,
            userRole: user.role,
          }
        : undefined,
      forBrowserPreview: true,
    })
  }, [
    subject,
    message,
    senderDisplayName,
    originUrl,
    settings,
    attachments,
    user,
  ])

  const sendPayload = async (isTest: boolean) => {
    if (!subject.trim()) {
      setStatusBanner({
        type: "error",
        title: "Nedostaje predmet",
        message: "Unesite predmet e-mail obavijesti.",
      })
      return
    }
    if (!message.trim()) {
      setStatusBanner({
        type: "error",
        title: "Nedostaje sadržaj",
        message: "Upišite tekst obavijesti za članove tijela.",
      })
      return
    }
    if (!isTest && selectedRecipients.length === 0) {
      setStatusBanner({
        type: "error",
        title: "Nema odabranih primatelja",
        message: "Odaberite barem jednog člana iz trenutnog sastava tijela društva.",
      })
      return
    }
    if (isTest && (!testEmailAddress.trim() || !testEmailAddress.includes("@"))) {
      setStatusBanner({
        type: "error",
        title: "Neispravna testna adresa",
        message: "Unesite valjanu e-mail adresu za slanje testnog maila.",
      })
      return
    }

    if (isTest) setIsSendingTest(true)
    else setIsSending(true)
    setStatusBanner({ type: "idle", message: "" })

    const payloadBody = {
      subject: subject.trim(),
      message: message.trim(),
      recipientIds: selectedRecipients.map((r) => r.id),
      attachments: attachments.map(({ name, url, size, mimeType }) => ({
        name,
        url,
        size,
        mimeType,
      })),
      testOnly: isTest,
      testEmail: testEmailAddress.trim(),
      syncBoardNotice: !isTest && canSyncBoardNotice && syncBoardNotice,
      sender: user
        ? {
            userId: user.id.toString(),
            userName: senderDisplayName,
            userRole: user.role,
            userEmail: user.email,
          }
        : undefined,
    }

    const abortController = !isTest ? new AbortController() : null
    if (abortController) {
      sendAbortRef.current = abortController
      setSendProgress({
        ...INITIAL_BULK_EMAIL_PROGRESS,
        active: true,
        status: "running",
        total: selectedRecipients.length,
        label: "Slanje obavijesti članovima tijela",
      })
    }

    try {
      let data: any
      if (isTest) {
        const response = await fetch("/api/board/announcement", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payloadBody),
        })
        data = await response.json()
        if (!response.ok || !data.success) {
          setStatusBanner({
            type: "error",
            title: "Slanje testnog maila nije uspjelo",
            message: data.error || "Greška pri slanju e-maila.",
          })
          return
        }
      } else {
        data = await consumeEmailSendStream(
          "/api/board/announcement",
          payloadBody,
          (prog) => setSendProgress({ ...prog, label: "Slanje obavijesti članovima tijela" }),
          abortController?.signal
        )
        if (!data?.success) {
          setStatusBanner({
            type: "error",
            title: "Slanje obavijesti nije uspjelo",
            message: data?.error || "Greška pri slanju e-maila.",
          })
          return
        }
      }

      if (isTest) {
        setStatusBanner({
          type: "success",
          title: "Testni mail poslan!",
          message: data.message || `Testni e-mail uspješno je poslan na ${testEmailAddress.trim()}.`,
          sentAt: data.sentAt,
        })
      } else {
        setIsBroadcastSent(true)
        setStatusBanner({
          type: "success",
          title: data.cancelled
            ? "Slanje zaustavljeno (djelomično poslano)"
            : "Obavijest je poslana svim odabranim članovima tijela!",
          message:
            data.message ||
            `Uspješno poslano na ${selectedRecipients.length} adresa trenutnog sastava tijela društva.`,
          sentAt: data.sentAt,
        })
        await refreshLogs()
        await loadHistory()
        if (syncBoardNotice && canSyncBoardNotice) {
          await refreshSettings()
        }
        onSent?.()
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
        setSendProgress((prev) => ({
          ...prev,
          active: false,
          status: "cancelled",
          pausedReason: "Slanje zaustavljeno od strane korisnika.",
        }))
        setStatusBanner({
          type: "error",
          title: "Slanje zaustavljeno",
          message: "Slanje je prekinuto. Već poslani primatelji zabilježeni su u povijesti.",
        })
      } else {
        setStatusBanner({
          type: "error",
          title: isTest ? "Slanje testnog maila nije uspjelo" : "Greška poslužitelja",
          message: err?.message || "Nije moguće povezati se s poslužiteljem.",
        })
      }
    } finally {
      sendAbortRef.current = null
      if (isTest) setIsSendingTest(false)
      else setIsSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[92vh] overflow-y-auto p-0 rounded-2xl border border-border shadow-2xl">
        {/* Standardizirano HRD zaglavlje dijaloga (#1E3A5F + #D97706) */}
        <div className="bg-[#1E3A5F] border-b-2 border-[#D97706] text-white p-6 rounded-t-2xl">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center shrink-0 border border-[#D97706]/40">
                <Megaphone className="h-5 w-5 text-[#FEFCE8]" />
              </div>
              <div>
                <DialogTitle className="text-lg font-serif font-bold text-white tracking-tight">
                  Obavijest članovima tijela društva (E-mail)
                </DialogTitle>
                <DialogDescription className="text-xs text-[#F8FAFC]/90 mt-0.5">
                  Unificirano HRD zaglavlje i službeni potpis • Prima isključivo trenutni aktivni sastav tijela društva
                </DialogDescription>
              </div>
            </div>
            <Badge className="bg-[#D97706] text-white border-0 text-[11px] font-semibold shrink-0">
              {eligibleRecipients.length} u tijelu
            </Badge>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {(sendProgress.active || sendProgress.status !== "idle") && (
            <EmailSendProgressBanner
              progress={sendProgress}
              onCancel={() => sendAbortRef.current?.abort()}
              title="Brojač slanja obavijesti tijelima društva"
            />
          )}

          {/* Statusna obavijest */}
          {statusBanner.type === "success" && (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-900 shadow-xs animate-in fade-in duration-200">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-emerald-950">{statusBanner.title}</h4>
                  <p className="text-xs text-emerald-800">{statusBanner.message}</p>
                  {statusBanner.sentAt && (
                    <p className="text-[11px] font-semibold text-emerald-900">
                      Vrijeme slanja: {formatDateTimeDMY(statusBanner.sentAt)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {statusBanner.type === "error" && (
            <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-900 shadow-xs animate-in fade-in duration-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-red-950">{statusBanner.title}</h4>
                  <p className="text-xs text-red-800">{statusBanner.message}</p>
                </div>
              </div>
            </div>
          )}

          {/* Info traka: Tko dijeli obavijest */}
          <div className="rounded-xl border border-[#E2E8F0] bg-[#FEFCE8] px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <UserCheck className="h-4 w-4 text-[#7C2D12] shrink-0" />
              <div className="text-xs text-[#1F2937]">
                <span className="font-semibold text-[#7C2D12]">Pošiljatelj (u podacima obavijesti): </span>
                <strong className="text-[#1E3A5F]">{senderDisplayName}</strong>{" "}
                <span className="text-muted-foreground">({senderRoleLabel})</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1 bg-white p-0.5 rounded-lg border border-border self-start sm:self-auto">
              {canSend && (
                <>
                  <Button
                    type="button"
                    variant={viewMode === "edit" ? "default" : "ghost"}
                    size="sm"
                    className="h-7 text-xs gap-1.5 px-3 rounded-md"
                    onClick={() => setViewMode("edit")}
                  >
                    <Edit3 className="h-3.5 w-3.5" /> Uredi obavijest
                  </Button>
                  <Button
                    type="button"
                    variant={viewMode === "preview" ? "default" : "ghost"}
                    size="sm"
                    className="h-7 text-xs gap-1.5 px-3 rounded-md"
                    onClick={() => setViewMode("preview")}
                  >
                    <Eye className="h-3.5 w-3.5" /> Pregled e-maila
                  </Button>
                </>
              )}
              <Button
                type="button"
                variant={viewMode === "history" ? "default" : "ghost"}
                size="sm"
                className="h-7 text-xs gap-1.5 px-3 rounded-md"
                onClick={() => {
                  setViewMode("history")
                  if (historyItems.length === 0 && !historyLoading) {
                    loadHistory()
                  }
                }}
              >
                <History className="h-3.5 w-3.5" />
                Povijest slanja ({historyItems.length})
              </Button>
            </div>
          </div>

          {viewMode === "history" ? (
            <BoardAnnouncementsHistoryList
              items={historyItems}
              loading={historyLoading}
              error={historyError}
              onRefresh={loadHistory}
              settings={settings}
              onReuseMessage={
                canSend
                  ? (item) => {
                      setSubject(item.subject || DEFAULT_BOARD_ANNOUNCEMENT_SUBJECT)
                      setMessage(item.message || "")
                      setAttachments(
                        Array.isArray(item.attachments)
                          ? item.attachments.map((att) => ({ ...att, isSessionUpload: false }))
                          : []
                      )
                      setUploadError(null)
                      setIsBroadcastSent(false)
                      setStatusBanner({ type: "idle", message: "" })
                      setViewMode("edit")
                    }
                  : undefined
              }
            />
          ) : viewMode === "edit" ? (
            <div className="space-y-4">
              {/* Predmet */}
              <div className="space-y-1.5">
                <Label htmlFor="board-announcement-subject" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Predmet obavijesti (Naslov)
                </Label>
                <Input
                  id="board-announcement-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={DEFAULT_BOARD_ANNOUNCEMENT_SUBJECT}
                  className="bg-card"
                  disabled={isBroadcastSent || isSending}
                />
              </div>

              {/* Prostor za pisanje obavijesti */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="board-announcement-body" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Tekst obavijesti
                  </Label>
                  {settings?.boardNotice && !isBroadcastSent && (
                    <button
                      type="button"
                      onClick={() => setMessage(settings.boardNotice || "")}
                      className="text-[11px] font-semibold text-[#1F77C5] hover:underline"
                    >
                      Preuzmi s Oglasne ploče odbora
                    </button>
                  )}
                </div>
                <Textarea
                  id="board-announcement-body"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={7}
                  placeholder="Upišite važnu informaciju ili obavijest koju želite poslati članovima trenutnog sastava tijela društva..."
                  className="bg-card text-sm leading-relaxed"
                  disabled={isBroadcastSent || isSending}
                />
              </div>

              {/* Priložene datoteke (Attachmenti) */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/30 px-4 py-2.5 border-b border-border">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-foreground">
                    <Paperclip className="h-3.5 w-3.5 text-[#D97706]" />
                    <span>Priložene datoteke (neobavezno)</span>
                  </div>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {attachments.length}/{BOARD_ATTACHMENT_MAX_FILES} ·{" "}
                    {formatAttachmentSize(totalAttachmentsBytes)} /{" "}
                    {formatAttachmentSize(BOARD_ATTACHMENT_MAX_TOTAL_BYTES)}
                  </span>
                </div>

                <div className="p-3 space-y-2.5">
                  {!isBroadcastSent && (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault()
                        if (!isSending && !isUploadingAttachments) setIsDragOver(true)
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault()
                        setIsDragOver(false)
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        setIsDragOver(false)
                        if (!isSending && !isUploadingAttachments && e.dataTransfer?.files?.length) {
                          handleFilesUpload(e.dataTransfer.files)
                        }
                      }}
                      className={`rounded-lg border-2 border-dashed px-4 py-3 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isDragOver
                          ? "border-[#D97706] bg-[#FEFCE8]"
                          : "border-border/80 bg-[#FBF9F6]/70 hover:border-[#CEA369]"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-8 w-8 rounded-lg bg-[#1E3A5F]/10 flex items-center justify-center shrink-0">
                          {isUploadingAttachments ? (
                            <RefreshCw className="h-4 w-4 text-[#1E3A5F] animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4 text-[#1E3A5F]" />
                          )}
                        </div>
                        <div className="text-xs min-w-0">
                          <p className="font-semibold text-foreground">
                            {isUploadingAttachments
                              ? "Učitavanje odabranih datoteka..."
                              : "Povucite datoteke ovdje ili ih odaberite s računala"}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            PDF, Word, Excel, PowerPoint, ODT, TXT, CSV, slike ili ZIP (maks. 15 MB po datoteci, 20 MB ukupno)
                          </p>
                        </div>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept={BOARD_ATTACHMENT_ACCEPT_ATTR}
                        className="hidden"
                        disabled={isSending || isUploadingAttachments}
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            handleFilesUpload(e.target.files)
                          }
                          e.target.value = ""
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={
                          isSending ||
                          isUploadingAttachments ||
                          attachments.length >= BOARD_ATTACHMENT_MAX_FILES
                        }
                        onClick={() => fileInputRef.current?.click()}
                        className="shrink-0 h-8 text-xs gap-1.5 border-[#D97706]/60 text-[#1E3A5F] bg-white hover:bg-[#FEFCE8]"
                      >
                        <Paperclip className="h-3.5 w-3.5 text-[#D97706]" />
                        Dodaj datoteke
                      </Button>
                    </div>
                  )}

                  {uploadError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                      <span>{uploadError}</span>
                    </div>
                  )}

                  {attachments.length > 0 && (
                    <div className="space-y-1.5">
                      {attachments.map((att, idx) => (
                        <div
                          key={`${att.url}-${idx}`}
                          className="flex items-center justify-between gap-3 rounded-lg border border-[#E2E8F0] bg-[#FBF9F6] px-3 py-2 text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {renderAttachmentTypeIcon(att.name, att.mimeType)}
                            <div className="min-w-0">
                              <a
                                href={att.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-[#1E3A5F] hover:underline truncate block"
                                title={att.name}
                              >
                                {att.name}
                              </a>
                              <span className="font-mono text-[10px] text-muted-foreground">
                                {formatAttachmentSize(att.size)}
                              </span>
                            </div>
                          </div>
                          {!isBroadcastSent && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={isSending}
                              onClick={() => handleRemoveAttachment(idx)}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50 shrink-0"
                              title="Ukloni privitak"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {canSyncBoardNotice && !isBroadcastSent && (
                <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer select-none">
                  <Checkbox
                    checked={syncBoardNotice}
                    onCheckedChange={(checked) => setSyncBoardNotice(checked === true)}
                    disabled={isSending}
                  />
                  <span>Istovremeno objavi ovaj tekst i na Oglasnoj ploči odbora (Nadzorna ploča)</span>
                </label>
              )}

              {/* Primatelji: isključivo trenutni sastav tijela */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/30 px-4 py-2.5 border-b border-border">
                  <button
                    type="button"
                    onClick={() => setShowRecipientsList((v) => !v)}
                    className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-foreground"
                  >
                    <Users className="h-3.5 w-3.5 text-primary" />
                    <span>
                      Primatelji — trenutni sastav tijela ({selectedRecipients.length}/{eligibleRecipients.length})
                    </span>
                    {showRecipientsList ? (
                      <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </button>
                  {!isBroadcastSent && eligibleRecipients.length > 0 && (
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => toggleAllRecipients(true)}
                        className="font-semibold text-primary hover:underline"
                      >
                        Označi sve
                      </button>
                      <span className="text-muted-foreground">·</span>
                      <button
                        type="button"
                        onClick={() => toggleAllRecipients(false)}
                        className="font-semibold text-muted-foreground hover:text-foreground hover:underline"
                      >
                        Poništi
                      </button>
                    </div>
                  )}
                </div>

                {showRecipientsList && (
                  <div className="p-3 space-y-2">
                    {eligibleRecipients.length === 0 ? (
                      <div className="py-4 text-center text-xs text-muted-foreground">
                        U registru trenutno nema članova tijela s aktivnim mandatom i upisanom e-mail adresom.
                      </div>
                    ) : (
                      <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                        {eligibleRecipients.map((r) => {
                          const isChecked = selectedIds.includes(r.id)
                          return (
                            <label
                              key={r.id}
                              className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs cursor-pointer transition-colors ${
                                isChecked
                                  ? "border-[#CEA369]/60 bg-[#FEFCE8]/40"
                                  : "border-border bg-background hover:bg-muted/30"
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <Checkbox
                                  checked={isChecked}
                                  onCheckedChange={(checked) => toggleSingleRecipient(r.id, checked === true)}
                                  disabled={isBroadcastSent || isSending}
                                />
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="font-bold text-foreground truncate">{r.name}</span>
                                    {r.functions.map((fn) => (
                                      <Badge
                                        key={fn}
                                        variant="secondary"
                                        className="text-[10px] py-0 px-1.5 bg-amber-100/80 text-amber-900 border border-amber-200"
                                      >
                                        {fn}
                                      </Badge>
                                    ))}
                                  </div>
                                  <p className="font-mono text-[11px] text-muted-foreground truncate">
                                    {r.email}
                                  </p>
                                </div>
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    )}

                    {missingEmailBoardMembers.length > 0 && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-[11px] text-amber-900 flex items-start gap-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <span>
                          Sljedeći članovi tijela nemaju upisanu e-mail adresu pa su preskočeni:{" "}
                          <strong>{missingEmailBoardMembers.map((m) => m.name).join(", ")}</strong>.
                        </span>
                      </div>
                    )}

                    {doNotContactBoardMembers.length > 0 && (
                      <div className="rounded-lg border border-red-200 bg-red-50/80 px-3 py-2 text-[11px] text-red-900 flex items-start gap-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0 mt-0.5" />
                        <span>
                          Sljedeći članovi tijela isključeni su jer su na izričitu napomenu zatražili da ih se ne kontaktira:{" "}
                          <strong>{doNotContactBoardMembers.map((m) => m.name).join(", ")}</strong>.
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Pregled kompletnog HRD HTML e-maila uživo */
            <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
              <div className="bg-muted/40 border-b border-border px-4 py-2.5 space-y-1 font-mono text-[11px]">
                <div className="flex gap-2">
                  <span className="w-16 text-muted-foreground shrink-0">Za:</span>
                  <span className="text-foreground font-medium">
                    Trenutni sastav tijela Društva ({selectedRecipients.length} primatelja)
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="w-16 text-muted-foreground shrink-0">Predmet:</span>
                  <span className="text-foreground font-bold">{subject || "(Bez predmeta)"}</span>
                </div>
                <div className="flex gap-2">
                  <span className="w-16 text-muted-foreground shrink-0">Autor:</span>
                  <span className="text-foreground">
                    {senderDisplayName} ({senderRoleLabel})
                  </span>
                </div>
                {attachments.length > 0 && (
                  <div className="flex items-start gap-2 pt-0.5">
                    <span className="w-16 text-muted-foreground shrink-0">Prilozi:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {attachments.map((att, idx) => (
                        <span
                          key={`${att.url}-${idx}`}
                          className="inline-flex items-center gap-1 rounded bg-white border border-border px-1.5 py-0.5 text-[10px] text-[#1E3A5F]"
                        >
                          <Paperclip className="h-2.5 w-2.5 text-[#D97706]" />
                          <span>{att.name}</span>
                          <span className="text-muted-foreground">({formatAttachmentSize(att.size)})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="bg-[#F8FAFC] p-2">
                <iframe
                  title="Pregled obavijesti tijelima društva"
                  srcDoc={previewBuilt.html}
                  className="w-full h-[460px] border-0 rounded-lg bg-white"
                  sandbox="allow-same-origin"
                />
              </div>
            </div>
          )}
        </div>

        {/* Podnožje s opcijom za testni mail i slanjem svima */}
        <div className="border-t border-border bg-muted/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-b-2xl">
          {canSend ? (
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <Input
                value={testEmailAddress}
                onChange={(e) => setTestEmailAddress(e.target.value)}
                placeholder="E-mail adresa za testni mail..."
                className="h-8 text-xs bg-background"
                disabled={isSending || isSendingTest}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => sendPayload(true)}
                disabled={isSending || isSendingTest || isUploadingAttachments}
                className="shrink-0 gap-1.5 border-[#D97706] text-[#1E3A5F] hover:bg-[#FEFCE8]"
              >
                {isSendingTest ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Mail className="h-3.5 w-3.5 text-[#D97706]" />
                )}
                Pošalji testni mail
              </Button>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">
              Pregled arhive poslanih obavijesti tijelima Društva
            </span>
          )}

          <div className="flex items-center justify-end gap-2.5">
            <CloseActionButton
              label={isBroadcastSent || !canSend ? "Zatvori" : "Odustani"}
              onClick={() => onOpenChange(false)}
              disabled={isSending}
            />

            {canSend && !isBroadcastSent && (
              <Button
                type="button"
                className="rounded-full h-10 px-6 gap-2 bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 border border-[#D97706] text-white font-bold shadow-md"
                onClick={() => sendPayload(false)}
                disabled={isSending || isSendingTest || isUploadingAttachments || selectedRecipients.length === 0}
              >
                {isSending ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    {sendProgress.total > 0
                      ? `Šaljem ${sendProgress.sent}/${sendProgress.total}...`
                      : "Slanje..."}
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    Pošalji svima iz tijela ({selectedRecipients.length})
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
