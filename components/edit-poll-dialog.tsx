"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useMembers } from "@/contexts/members-context"
import { useMeetings } from "@/contexts/meetings-context"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, X, Users, Calendar, Search, Trash2, AlertCircle } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { isBoardMember, isMandateActive } from "@/lib/utils"

interface EditPollDialogProps {
  poll: {
    id: number
    title: string
    description?: string
    options: string[]
    status?: 'active' | 'archived'
    meeting_id?: number | null
    target_member_ids?: any
    invited_members?: string[]
  } | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onPollUpdated?: () => void
}

export function EditPollDialog({ poll, open, onOpenChange, onPollUpdated }: EditPollDialogProps) {
  const { user } = useAuth()
  const { members } = useMembers()
  const { meetings } = useMeetings()

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [options, setOptions] = useState<string[]>([])
  const [status, setStatus] = useState<"active" | "archived">("active")
  const [targetType, setTargetType] = useState<"all" | "selected">("all")
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([])
  const [memberSearch, setMemberSearch] = useState("")
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>("none")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    if (poll) {
      setTitle(poll.title || "")
      setDescription(poll.description || "")
      setOptions(Array.isArray(poll.options) ? [...poll.options] : ["Za", "Protiv", "Suzdržan"])
      setStatus(poll.status || "active")
      setSelectedMeetingId(poll.meeting_id ? String(poll.meeting_id) : "none")

      // Target member IDs parsing
      const targets = poll.target_member_ids
      if (!targets || targets === "all" || (Array.isArray(targets) && targets.length === 0)) {
        setTargetType("all")
        setSelectedMemberIds([])
      } else if (Array.isArray(targets)) {
        setTargetType("selected")
        setSelectedMemberIds(targets.map(Number).filter(n => !isNaN(n)))
      } else {
        setTargetType("all")
        setSelectedMemberIds([])
      }
      setErrorMessage("")
    }
  }, [poll])

  if (!poll) return null

  const sortedMembers = [...members].sort((a, b) => {
    const aBoard = isBoardMember(a)
    const bBoard = isBoardMember(b)
    if (aBoard && !bBoard) return -1
    if (!aBoard && bBoard) return 1
    return a.name.localeCompare(b.name)
  }).filter(m =>
    !memberSearch || m.name.toLowerCase().includes(memberSearch.toLowerCase())
  )

  const handleAddOption = () => {
    setOptions([...options, ""])
  }

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) return
    setOptions(options.filter((_, i) => i !== index))
  }

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options]
    newOptions[index] = value
    setOptions(newOptions)
  }

  const handleToggleMember = (id: number) => {
    setSelectedMemberIds(prev =>
      prev.includes(id) ? prev.filter(mid => mid !== id) : [...prev, id]
    )
  }

  const handleSelectOnlyBoard = () => {
    const boardMemberIds = members.filter(isBoardMember).map(m => m.id)
    setSelectedMemberIds(boardMemberIds)
  }

  const handleSelectAll = () => {
    setSelectedMemberIds(members.map(m => m.id))
  }

  const handleClearAll = () => {
    setSelectedMemberIds([])
  }

  const handleSubmit = async () => {
    if (!title.trim() || options.some(o => !o.trim())) {
      setErrorMessage("Molimo unesite naslov i barem dvije neprazne opcije.")
      return
    }

    setIsSubmitting(true)
    setErrorMessage("")

    try {
      const response = await fetch(`/api/polls/${poll.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          options: options.filter(o => o.trim()),
          status,
          target_member_ids: targetType === "all" ? "all" : selectedMemberIds,
          meeting_id: selectedMeetingId === "none" ? null : parseInt(selectedMeetingId),
        })
      })

      if (response.ok) {
        onPollUpdated?.()
        onOpenChange(false)
      } else {
        const data = await response.json()
        setErrorMessage(data.error || "Greška pri ažuriranju glasovanja.")
      }
    } catch (error) {
      console.error("Failed to update poll:", error)
      setErrorMessage("Greška pri spajanju s poslužiteljem.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Uredi glasovanje / točku dnevnog reda
          </DialogTitle>
          <DialogDescription>
            Izmijenite naslov, opis, opcije glasanja ili povezanost sa sjednicom.
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="space-y-5 py-2">
          {/* Status i Poveznica */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Status glasovanja</Label>
              <Select value={status} onValueChange={(val: any) => setStatus(val)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Aktivno (članovi mogu glasati)</SelectItem>
                  <SelectItem value="archived">Arhivirano (završeno)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Povezana sjednica
              </Label>
              <Select value={selectedMeetingId} onValueChange={setSelectedMeetingId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Bez poveznice" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Bez poveznice</SelectItem>
                  {meetings.map(m => (
                    <SelectItem key={m.id} value={m.id.toString()}>
                      {m.title} ({new Date(m.date).toLocaleDateString('hr-HR')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Naslov / Točka dnevnog reda */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-poll-title" className="text-xs font-semibold">
              Naslov / Točka dnevnog reda *
            </Label>
            <Input
              id="edit-poll-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="npr. 1. Usvajanje financijskog izvještaja 2024"
              className="h-9 font-medium"
            />
          </div>

          {/* Opis */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-poll-desc" className="text-xs font-semibold">
              Opis / Obrazloženje (opcionalno)
            </Label>
            <Textarea
              id="edit-poll-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Detaljnije obrazloženje ove točke i glasanja..."
              rows={3}
              className="resize-none text-sm"
            />
          </div>

          {/* Opcije */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Opcije za glasovanje *</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddOption}
                className="h-7 text-xs gap-1"
              >
                <Plus className="h-3 w-3" /> Dodaj opciju
              </Button>
            </div>
            <div className="space-y-2">
              {options.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground w-5 text-right">{index + 1}.</span>
                  <Input
                    value={option}
                    onChange={e => handleOptionChange(index, e.target.value)}
                    placeholder={`Opcija ${index + 1}`}
                    className="h-8 text-sm"
                  />
                  {options.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveOption(index)}
                      className="h-8 w-8 text-muted-foreground hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Tko ima pravo glasa */}
          <div className="space-y-2 border-t pt-3">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Tko ima pravo glasa
            </Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="radio"
                  name="editTargetType"
                  value="all"
                  checked={targetType === "all"}
                  onChange={() => setTargetType("all")}
                  className="text-primary"
                />
                <span>Svi članovi</span>
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="radio"
                  name="editTargetType"
                  value="selected"
                  checked={targetType === "selected"}
                  onChange={() => setTargetType("selected")}
                  className="text-primary"
                />
                <span>Odabrani članovi / Tijelo ({selectedMemberIds.length})</span>
              </label>
            </div>

            {targetType === "selected" && (
              <div className="mt-2 space-y-2 rounded-xl border p-3 bg-secondary/10">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Označeno: <strong className="text-primary">{selectedMemberIds.length}</strong></span>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSelectOnlyBoard}
                      className="h-6 text-[10px] px-1.5"
                    >
                      Samo odbor
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSelectAll}
                      className="h-6 text-[10px] px-1.5"
                    >
                      Sve
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleClearAll}
                      className="h-6 text-[10px] px-1.5 text-muted-foreground"
                    >
                      Poništi
                    </Button>
                  </div>
                </div>

                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Pretraži članove..."
                    value={memberSearch}
                    onChange={e => setMemberSearch(e.target.value)}
                    className="h-8 pl-8 text-xs bg-background"
                  />
                </div>

                <div className="max-h-40 overflow-y-auto space-y-1 pr-1 border rounded-lg p-2 bg-background">
                  {sortedMembers.map(member => {
                    const isSelected = selectedMemberIds.includes(member.id)
                    const isBoard = isBoardMember(member)
                    return (
                      <div key={member.id} className="flex items-center space-x-2 py-1 px-1 hover:bg-secondary/20 rounded">
                        <Checkbox
                          id={`edit-poll-member-${member.id}`}
                          checked={isSelected}
                          onCheckedChange={() => handleToggleMember(member.id)}
                        />
                        <label
                          htmlFor={`edit-poll-member-${member.id}`}
                          className="text-xs flex-1 cursor-pointer flex items-center justify-between"
                        >
                          <span className={isSelected ? "font-medium text-foreground" : "text-muted-foreground"}>
                            {member.name}
                          </span>
                          {isBoard && (
                            <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-800 border-amber-300 font-semibold px-1 py-0 shrink-0">
                              Odbor
                            </Badge>
                          )}
                        </label>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Odustani
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isSubmitting || !title.trim() || options.some(o => !o.trim())}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isSubmitting ? "Spremanje..." : "Spremi izmjene"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
