"use client"

import * as React from "react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CloseActionButton } from "@/components/ui/action-bar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { 
  BarChart3, 
  Users, 
  Mail, 
  Send, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  Eye, 
  Edit3,
  Search,
  Check,
  Clock
} from "lucide-react"
import { useMembers } from "@/contexts/members-context"
import { useAuth } from "@/contexts/auth-context"
import { useSettings } from "@/contexts/settings-context"
import { useActivityLog } from "@/contexts/activity-log-context"
import { formatInvitationDateTime } from "@/components/invitation-preview-dialog"
import { isBoardMember } from "@/lib/utils"
import { buildHrdMasterEmail, escapeHtml } from "@/lib/hrd-email-system"
import { stripDuplicateEventMetaLines } from "@/lib/event-email-templates"
import { EmailSendProgressBanner } from "@/components/email-send-progress-banner"
import {
  consumeEmailSendStream,
  INITIAL_BULK_EMAIL_PROGRESS,
  type BulkEmailProgressState,
} from "@/lib/bulk-email-stream"

interface PollNotificationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pollTitle: string
  targetType?: "all" | "selected"
  selectedMemberIds?: number[] | null
  totalMembersCount?: number
  onSuccess?: () => void
}

export function PollNotificationDialog({
  open,
  onOpenChange,
  pollTitle,
  targetType: initialTargetType = "selected",
  selectedMemberIds,
  totalMembersCount = 0,
  onSuccess,
}: PollNotificationDialogProps) {
  const { members } = useMembers()
  const { user } = useAuth()
  const { settings } = useSettings()
  const { addLog } = useActivityLog()

  const [subject, setSubject] = React.useState("")
  const [customBody, setCustomBody] = React.useState("")
  const [viewMode, setViewMode] = React.useState<"preview" | "edit" | "recipients">("preview")
  const [selectedRecipients, setSelectedRecipients] = React.useState<number[]>([])
  const [recipientSearch, setRecipientSearch] = React.useState("")
  const [testEmailAddress, setTestEmailAddress] = React.useState("")

  const [isSending, setIsSending] = React.useState(false)
  const [isSendingTest, setIsSendingTest] = React.useState(false)
  const [sendProgress, setSendProgress] = React.useState<BulkEmailProgressState>(INITIAL_BULK_EMAIL_PROGRESS)
  const sendAbortRef = React.useRef<AbortController | null>(null)
  const [sendResult, setSendResult] = React.useState<{
    status: "idle" | "success" | "error"
    message: string
    sentAt?: string
  }>({ status: "idle", message: "" })

  const originUrl = typeof window !== "undefined" ? window.location.origin : "https://rodoslovlje.hr"

  const prevOpenRef = React.useRef(false)

  React.useEffect(() => {
    if (open && !prevOpenRef.current) {
      prevOpenRef.current = true
      setSubject(`Obavezno glasovanje: ${pollTitle || ""}`)
      setCustomBody(
        `Poštovane članice i članovi tijela Društva,\n\nobavještavamo Vas da je u sustavu „Rodoslovac” otvoreno novo elektroničko glasovanje. Naslov odluke nalazi se u sažetku u nastavku.\n\nDetaljan tekst prijedloga i mogućnost glasovanja dostupni su nakon prijave u sustav „Rodoslovac”. Prema pravilniku Društva, Vaše sudjelovanje je obavezno za donošenje pravovaljanih odluka.`
      )
      setViewMode("preview")
      setTestEmailAddress(user?.email || settings?.smtpFrom || "")
      setSendResult({ status: "idle", message: "" })
      setSendProgress(INITIAL_BULK_EMAIL_PROGRESS)

      // Default: članovi odbora su automatski označeni (uvijek isključi Ne kontaktirati)
      const isAllowed = (m: any) => Boolean(m && !m.doNotContact && m.email)
      if (selectedMemberIds && selectedMemberIds.length > 0) {
        const blockedSet = new Set(members.filter(m => m?.doNotContact).map(m => m.id))
        setSelectedRecipients(selectedMemberIds.filter(id => !blockedSet.has(id)))
      } else {
        const boardIds = members.filter(m => isAllowed(m) && isBoardMember(m)).map(m => m.id)
        setSelectedRecipients(boardIds.length > 0 ? boardIds : members.filter(isAllowed).map(m => m.id))
      }
    } else if (!open) {
      prevOpenRef.current = false
    }
  }, [open, pollTitle, originUrl, selectedMemberIds, members])

  const selectOnlyBoard = () => {
    const boardIds = (members || []).filter(m => m && !m.doNotContact && m.email && isBoardMember(m)).map(m => m.id)
    setSelectedRecipients(boardIds)
  }

  const selectAllRecipients = () => {
    const allIds = (members || []).filter(m => m && !m.doNotContact && m.email).map(m => m.id)
    setSelectedRecipients(allIds)
  }

  const clearAllRecipients = () => {
    setSelectedRecipients([])
  }

  const toggleRecipient = (id: number) => {
    const target = members.find(m => m.id === id)
    if (target?.doNotContact) return
    setSelectedRecipients(prev =>
      prev.includes(id) ? prev.filter(mid => mid !== id) : [...prev, id]
    )
  }

  const previewHtmlResult = buildHrdMasterEmail({
    templateType: "sluzbena_obavijest",
    title: subject || "Obavijest o glasovanju",
    bodyTextOrHtml: stripDuplicateEventMetaLines(customBody.replace(/{{name}}/gi, "Ivan Horvat")),
    infoBoxTitle: "Predmet glasovanja",
    infoBoxHtml: `<div style="font-weight: bold; font-size: 15px; color: #7C2D12;">${escapeHtml(pollTitle || "Glasovanje")}</div><div style="margin-top: 6px; font-size: 13px; color: #475569;">Svi detalji prijedloga i elektronički glasački listić dostupni su nakon prijave u sustav <strong>Rodoslovac</strong>.</div>`,
    ctaText: "Prijavi se u Rodoslovac i glasuj",
    ctaUrl: `${originUrl}/`,
    settings,
    sender: user
      ? {
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          userRole: user.role,
        }
      : undefined,
    forBrowserPreview: true,
  })

  const handleSendTest = async () => {
    setIsSendingTest(true)
    setSendResult({ status: "idle", message: "" })
    try {
      const payload: any = {
        pollTitle,
        targetType: "selected",
        selectedMemberIds: selectedRecipients,
        customSubject: subject,
        customBody,
        testOnly: true,
        testEmail: testEmailAddress.trim() || user?.email || settings?.smtpFrom,
      }
      if (user) {
        payload.sender = {
          userId: user.id.toString(),
          userName: user.name,
          userRole: user.role,
        }
      }
      const response = await fetch("/api/polls/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (response.ok && data.success) {
        setSendResult({
          status: "success",
          message: data.message || "Testna obavijest o glasovanju je poslana!",
        })
      } else {
        setSendResult({
          status: "error",
          message: data.error || "Slanje testnog e-maila nije uspjelo.",
        })
      }
    } catch (err: any) {
      setSendResult({
        status: "error",
        message: err.message || "Greška pri slanju testnog e-maila.",
      })
    } finally {
      setIsSendingTest(false)
    }
  }

  const handleSend = async () => {
    if (selectedRecipients.length === 0) {
      setSendResult({
        status: "error",
        message: "Molimo odaberite barem jednog primatelja sa popisa.",
      })
      return
    }

    setIsSending(true)
    setSendResult({ status: "idle", message: "" })
    const abortController = new AbortController()
    sendAbortRef.current = abortController
    setSendProgress({
      ...INITIAL_BULK_EMAIL_PROGRESS,
      active: true,
      status: "running",
      total: selectedRecipients.length,
      label: "Slanje obavijesti o glasovanju",
    })

    try {
      const payload: any = {
        pollTitle,
        targetType: "selected",
        selectedMemberIds: selectedRecipients,
        customSubject: subject,
        customBody,
      }

      if (user) {
        payload.sender = {
          userId: user.id.toString(),
          userName: user.name,
          userRole: user.role
        }
      }

      const data = await consumeEmailSendStream(
        "/api/polls/notify",
        payload,
        (prog) => setSendProgress({ ...prog, label: "Slanje obavijesti o glasovanju" }),
        abortController.signal
      )

      if (data?.success) {
        const sentAt = data.sentAt || new Date().toISOString()
        const sentCount = data.sentCount ?? selectedRecipients.length

        if (user) {
          const recipientObjs = members.filter(m => selectedRecipients.includes(m.id))
          const recipientSummary = recipientObjs.length <= 3 
            ? recipientObjs.map(r => `${r.name} (${r.email})`).join(", ")
            : `${recipientObjs.slice(0, 3).map(r => r.name).join(", ")} i još ${recipientObjs.length - 3} članova`

          addLog({
            userId: user.id.toString(),
            userName: user.name,
            userRole: user.role,
            action: "Slanje obavijesti o glasovanju",
            details: `Poslana e-mail obavijest za glasovanje: "${pollTitle}". Poslano na ${sentCount} adresa: ${recipientSummary}`,
          })
        }

        if (onSuccess) {
          onSuccess()
        }

        if (data.cancelled) {
          setSendResult({
            status: "success",
            message: data.message || `Obavijesti su djelomično poslane.`,
            sentAt,
          })
          toast.warning(data.message || "Slanje obavijesti je djelomično zaustavljeno.")
        } else {
          toast.success(data.message || "Obavijest o glasovanju je uspješno poslana!")
          onOpenChange(false)
        }
      } else {
        setSendResult({
          status: "error",
          message: data?.error || "Došlo je do pogreške pri slanju obavijesti.",
        })
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
        setSendProgress((prev) => ({
          ...prev,
          active: false,
          status: "cancelled",
          pausedReason: "Slanje zaustavljeno od strane korisnika.",
        }))
        setSendResult({
          status: "error",
          message: "Slanje je zaustavljeno. Već poslani e-mailovi su isporučeni.",
        })
      } else {
        console.error("Greška pri slanju obavijesti o anketi:", err)
        setSendResult({
          status: "error",
          message: err.message || "Došlo je do mrežne greške.",
        })
      }
    } finally {
      sendAbortRef.current = null
      setIsSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[94vw] sm:max-w-4xl max-h-[92vh] overflow-y-auto p-0 rounded-2xl border border-border shadow-2xl">
        <div className="bg-[#1E3A5F] border-b-2 border-[#D97706] text-white p-6 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center shrink-0 border border-[#D97706]/40">
              <BarChart3 className="h-5 w-5 text-[#FEFCE8]" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-white tracking-tight">
                Provjera i slanje obavijesti o glasovanju
              </DialogTitle>
              <DialogDescription className="text-xs text-[#F8FAFC]">
                Standardizirani HRD predložak (#1E3A5F / #7C2D12 / #D97706) sa službenim potpisom u podnožju
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {(sendProgress.active || sendProgress.status !== "idle") && (
            <EmailSendProgressBanner
              progress={sendProgress}
              onCancel={() => sendAbortRef.current?.abort()}
              title="Brojač slanja obavijesti o glasovanju"
            />
          )}

          {/* Uspjeh alert */}
          {sendResult.status === "success" && (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-900 shadow-sm animate-in fade-in duration-200">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-6 w-6 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-emerald-900">E-mail obavijesti su uspješno poslane!</h4>
                  <p className="text-xs text-emerald-800">{sendResult.message}</p>
                  {sendResult.sentAt && (
                    <p className="text-xs font-semibold text-emerald-950 flex items-center gap-1.5 pt-1">
                      <Clock className="h-3.5 w-3.5" /> Evidentirano vrijeme slanja: {formatInvitationDateTime(sendResult.sentAt)}
                    </p>
                  )}
                  <p className="text-[11px] text-emerald-700 pt-0.5">
                    Evidencija slanja (tko, kome i točno vrijeme) trajno je zabilježena u dnevniku aktivnosti.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Greška alert */}
          {sendResult.status === "error" && (
            <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-900 shadow-sm animate-in fade-in duration-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-6 w-6 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-red-900">Greška: E-mailovi NISU poslani!</h4>
                  <p className="text-xs text-red-800">{sendResult.message}</p>
                </div>
              </div>
            </div>
          )}

          {/* Sažetak ankete */}
          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Glasovanje / Anketa</span>
              <Badge variant="outline" className="text-[10px] font-medium bg-background">
                {selectedRecipients.length === (members || []).filter(m => Boolean(m && !m.doNotContact && m.email)).length ? "Svi članovi" : "Odabrani članovi"}
              </Badge>
            </div>

            <div>
              <h3 className="font-bold text-base text-foreground">{pollTitle}</h3>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-primary" /> Primatelji:{" "}
                  <strong>{selectedRecipients.length} odabranih članova</strong>
                  <span className="text-[11px] text-muted-foreground">(članovi odbora zadano)</span>
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-primary px-2 self-start sm:self-auto hover:underline"
                  onClick={() => setViewMode("recipients")}
                >
                  Uredi primatelje ({selectedRecipients.length}) &rarr;
                </Button>
              </div>
            </div>
          </div>

          {/* Predmet e-pošte */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Predmet e-pošte (Subject):</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="text-xs"
              disabled={sendResult.status === "success" || isSending}
            />
          </div>

          {/* Izbor prikaza */}
          <div className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg border border-border">
                <Button
                  type="button"
                  variant={viewMode === "preview" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 text-xs gap-1.5 px-3 rounded-md"
                  onClick={() => setViewMode("preview")}
                >
                  <Eye className="h-3.5 w-3.5" /> Vizualni izgled e-pošte
                </Button>
                <Button
                  type="button"
                  variant={viewMode === "edit" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 text-xs gap-1.5 px-3 rounded-md"
                  onClick={() => setViewMode("edit")}
                >
                  <Edit3 className="h-3.5 w-3.5" /> Prilagodi tekst poruke
                </Button>
                <Button
                  type="button"
                  variant={viewMode === "recipients" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 text-xs gap-1.5 px-3 rounded-md"
                  onClick={() => setViewMode("recipients")}
                >
                  <Users className="h-3.5 w-3.5" /> Primatelji ({selectedRecipients.length})
                </Button>
              </div>
            </div>

            {viewMode === "preview" && (
              <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden text-xs">
                <div className="bg-muted/40 border-b border-border p-3 space-y-1 font-mono text-[11px]">
                  <div className="flex">
                    <span className="w-16 text-muted-foreground shrink-0">Od:</span>
                    <span className="text-foreground font-medium">
                      Hrvatsko rodoslovno društvo &lt;rodoslovlje@rodoslovlje.hr&gt;
                    </span>
                  </div>
                  <div className="flex">
                    <span className="w-16 text-muted-foreground shrink-0">Za:</span>
                    <span className="text-foreground font-medium">
                      {selectedRecipients.length === (members || []).filter(m => Boolean(m && m.email)).length
                        ? "Svi članovi društva"
                        : `Odabrani članovi (${selectedRecipients.length})`}
                    </span>
                  </div>
                  <div className="flex">
                    <span className="w-16 text-muted-foreground shrink-0">Predmet:</span>
                    <span className="text-foreground font-bold">{subject}</span>
                  </div>
                </div>

                <div className="p-2 bg-[#F8FAFC] overflow-x-auto">
                  <div dangerouslySetInnerHTML={{ __html: previewHtmlResult.html }} />
                </div>
              </div>
            )}

            {viewMode === "edit" && (
              <div className="space-y-3 rounded-xl border border-border bg-card p-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Uredi tekst poruke:</Label>
                  <Textarea
                    value={customBody}
                    onChange={(e) => setCustomBody(e.target.value)}
                    rows={8}
                    className="text-xs font-mono"
                    disabled={sendResult.status === "success" || isSending}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Oznaka <code className="bg-muted px-1 rounded">{"{{name}}"}</code> automatski se zamjenjuje imenom
                    svakog pojedinog člana.
                  </p>
                </div>
              </div>
            )}

            {viewMode === "recipients" && (
              <div className="space-y-3 rounded-xl border border-border bg-card p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-secondary/20 p-3 rounded-lg border border-border">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Primatelji: <span className="text-primary font-extrabold">{selectedRecipients.length}</span> označeno
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Članovi odbora su automatski označeni. Možete dodati ili ukloniti članove klikom.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs bg-background" onClick={selectOnlyBoard}>
                      Samo odbor
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs bg-background" onClick={selectAllRecipients}>
                      Označi sve
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={clearAllRecipients}>
                      Poništi
                    </Button>
                  </div>
                </div>

                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Pretraži članove po imenu ili e-mailu..."
                    value={recipientSearch}
                    onChange={(e) => setRecipientSearch(e.target.value)}
                    className="h-8 text-xs pl-8 bg-background"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[320px] overflow-y-auto pr-1">
                  {members
                    .filter(m => Boolean(m && m.email))
                    .filter(m => {
                      if (!recipientSearch.trim()) return true;
                      const q = recipientSearch.toLowerCase();
                      const name = (m.name || "").toLowerCase();
                      const email = (m.email || "").toLowerCase();
                      return name.includes(q) || email.includes(q);
                    })
                    .sort((a, b) => {
                      const aBoard = isBoardMember(a);
                      const bBoard = isBoardMember(b);
                      if (aBoard && !bBoard) return -1;
                      if (!aBoard && bBoard) return 1;
                      const nameA = a.name || "";
                      const nameB = b.name || "";
                      return nameA.localeCompare(nameB);
                    })
                    .map(member => {
                      const isBlockedNoContact = Boolean(member.doNotContact);
                      const isSelected = !isBlockedNoContact && selectedRecipients.includes(member.id);
                      const isBoard = isBoardMember(member);
                      const initials = member.initials || (member.name ? member.name.charAt(0) : "?");
                      return (
                        <button
                          key={member.id}
                          type="button"
                          disabled={isBlockedNoContact}
                          onClick={() => !isBlockedNoContact && toggleRecipient(member.id)}
                          title={isBlockedNoContact ? "Na izričitu napomenu član je zatražio da ga se ne kontaktira" : undefined}
                          className={`flex items-center justify-between p-2.5 rounded-lg border text-left transition-colors ${
                            isBlockedNoContact
                              ? 'bg-red-50/50 border-red-200 opacity-75 cursor-not-allowed'
                              : isSelected
                              ? 'bg-primary/5 border-primary/20'
                              : 'bg-background hover:bg-secondary/30'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Avatar className="h-7 w-7 shrink-0">
                              <AvatarFallback className="text-[11px]">{initials}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 truncate">
                              <p className="text-xs font-semibold truncate">{member.name || "Bez imena"}</p>
                              <p className={`text-[11px] text-muted-foreground truncate ${isBlockedNoContact ? 'line-through' : ''}`}>{member.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {isBlockedNoContact ? (
                              <Badge variant="outline" className="text-[9px] bg-red-100 text-red-800 border-red-300 font-bold px-1.5 py-0">
                                Ne kontaktirati
                              </Badge>
                            ) : (
                              <>
                                {isBoard && (
                                  <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-800 border-amber-300 font-semibold px-1.5 py-0">
                                    Odbor
                                  </Badge>
                                )}
                                <div
                                  className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                                    isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/30'
                                  }`}
                                >
                                  {isSelected && <Check className="h-2.5 w-2.5" />}
                                </div>
                              </>
                            )}
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border bg-muted/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-b-2xl">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <Input
              value={testEmailAddress}
              onChange={(e) => setTestEmailAddress(e.target.value)}
              placeholder="E-mail za test (admin ili drugi mail)..."
              className="h-8 text-xs bg-background"
              disabled={isSending || isSendingTest}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSendTest}
              disabled={isSending || isSendingTest}
              className="shrink-0 gap-1.5 border-[#D97706] text-[#1E3A5F] hover:bg-[#FEFCE8]"
            >
              {isSendingTest ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5 text-[#D97706]" />}
              Pošalji testni e-mail
            </Button>
          </div>

          <div className="flex items-center justify-end gap-2">
            <CloseActionButton
              label={sendResult.status === "success" ? "Zatvori" : "Odustani"}
              onClick={() => onOpenChange(false)}
              disabled={isSending}
            />

            {sendResult.status === "error" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full h-10 px-4 gap-1.5 border-2 border-slate-300"
                onClick={handleSend}
                disabled={isSending}
              >
                <RefreshCw className="h-3.5 w-3.5" /> Pokušaj ponovno
              </Button>
            )}

            {sendResult.status !== "success" ? (
              <Button
                type="button"
                className="rounded-full h-10 px-6 gap-2 bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 border border-[#D97706] text-white font-bold shadow-md"
                onClick={handleSend}
                disabled={isSending || isSendingTest}
              >
                {isSending ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    {sendProgress.total > 0
                      ? `Šaljem ${sendProgress.sent}/${sendProgress.total}...`
                      : "Slanje obavijesti..."}
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5 text-[#D97706]" />
                    Odobri i pošalji obavijest
                  </>
                )}
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 font-medium"
                onClick={() => onOpenChange(false)}
              >
                <CheckCircle className="h-3.5 w-3.5" /> U redu
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
