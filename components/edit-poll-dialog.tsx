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
import { Plus, X, Users, Calendar, Search } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"

interface Poll {
  id: number
  title: string
  description?: string
  options: string[]
  target_member_ids: 'all' | number[] | string
  meeting_id?: number | null
}

interface EditPollDialogProps {
  poll: Poll
  onClose: () => void
  onPollUpdated: () => void
}

export function EditPollDialog({ poll, onClose, onPollUpdated }: EditPollDialogProps) {
  const { user } = useAuth()
  const { members } = useMembers()
  const { meetings } = useMeetings()
  
  const [title, setTitle] = useState(poll.title)
  const [description, setDescription] = useState(poll.description || "")
  const [options, setOptions] = useState<string[]>(poll.options)
  
  // Parse target type
  let initialTargetType: "all" | "selected" = "all"
  let initialSelectedMemberIds: number[] = []
  
  if (poll.target_member_ids && poll.target_member_ids !== 'all') {
    initialTargetType = "selected"
    if (Array.isArray(poll.target_member_ids)) {
      initialSelectedMemberIds = poll.target_member_ids.map(Number)
    } else if (typeof poll.target_member_ids === 'string') {
      try {
        const parsed = JSON.parse(poll.target_member_ids)
        if (Array.isArray(parsed)) {
          initialSelectedMemberIds = parsed.map(Number)
        }
      } catch (e) {
        console.error("Failed to parse target_member_ids:", e)
      }
    }
  }

  const [targetType, setTargetType] = useState<"all" | "selected">(initialTargetType)
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>(initialSelectedMemberIds)
  const [memberSearch, setMemberSearch] = useState("")
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>(
    poll.meeting_id ? poll.meeting_id.toString() : "none"
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  const sortedMembers = [...members].sort((a, b) => {
    const aHasRole = (a.functions?.length || 0) > 0;
    const bHasRole = (b.functions?.length || 0) > 0;
    if (aHasRole && !bHasRole) return -1;
    if (!aHasRole && bHasRole) return 1;
    return a.name.localeCompare(b.name);
  }).filter(m => 
    !memberSearch || m.name.toLowerCase().includes(memberSearch.toLowerCase())
  );

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

  const handleSubmit = async () => {
    if (!title || options.some(o => !o.trim())) return
    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/polls/${poll.id}`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${user?.role || 'admin'}`
        },
        body: JSON.stringify({
          title,
          description,
          options: options.filter(o => o.trim()),
          target_member_ids: targetType === "all" ? "all" : selectedMemberIds,
          meeting_id: selectedMeetingId === "none" ? null : parseInt(selectedMeetingId)
        })
      })

      if (response.ok) {
        onPollUpdated();
        onClose();
      } else {
        const errorData = await response.json()
        alert(errorData.error || "Greška pri ažuriranju glasovanja.")
      }
    } catch (error) {
      console.error("Failed to update poll:", error)
      alert("Došlo je do greške.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-[95%] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Uredi glasovanje / anketu</DialogTitle>
          <DialogDescription>
            Ažurirajte detalje već otvorenog glasovanja.
          </DialogDescription>
        </DialogHeader>

        {isSubmitting && <div className="p-4 bg-primary/10 text-primary text-xs text-center rounded-md animate-pulse">Spremanje promjena u bazu...</div>}

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Naslov glasovanja</Label>
            <Input 
              id="title" 
              placeholder="Naslov..." 
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Opis / Objašnjenje (opcionalno)</Label>
            <Textarea 
              id="description" 
              placeholder="Detaljnije pojasnite..." 
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            <Label>Opcije odgovora</Label>
            <div className="space-y-2">
              {options.map((option, index) => (
                <div key={index} className="flex gap-2">
                  <Input 
                    placeholder={`Opcija ${index + 1}`} 
                    value={option}
                    onChange={e => handleOptionChange(index, e.target.value)}
                  />
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => handleRemoveOption(index)}
                    disabled={options.length <= 2}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleAddOption}>
              <Plus className="h-4 w-4" /> Dodaj opciju
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t">
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" /> Tko treba glasovati?
              </Label>
              <Select value={targetType} onValueChange={(v: any) => setTargetType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Svi aktivni članovi</SelectItem>
                  <SelectItem value="selected">Odabrani članovi</SelectItem>
                </SelectContent>
              </Select>

              {targetType === "selected" && (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input 
                      placeholder="Traži člana..." 
                      className="h-8 pl-8 text-xs"
                      value={memberSearch}
                      onChange={e => setMemberSearch(e.target.value)}
                    />
                  </div>
                  <div className="border rounded-md p-3 max-h-40 overflow-auto space-y-2 bg-muted/30">
                    {sortedMembers.map(member => {
                      const hasActiveRole = (member.functions?.length || 0) > 0;
                      return (
                        <div key={member.id} className="flex items-center space-x-2">
                          <Checkbox 
                            id={`edit-member-${member.id}`} 
                            checked={selectedMemberIds.includes(member.id)}
                            onCheckedChange={() => handleToggleMember(member.id)}
                          />
                          <label htmlFor={`edit-member-${member.id}`} className="text-sm cursor-pointer truncate flex items-center gap-2">
                            {member.name}
                            {hasActiveRole && <Badge variant="secondary" className="text-[8px] h-3 px-1">Tijelo</Badge>}
                          </label>
                        </div>
                      );
                    })}
                    {sortedMembers.length === 0 && (
                      <p className="text-[10px] text-center text-muted-foreground py-2">Nema rezultata</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Poveži sa sjednicom
              </Label>
              <Select value={selectedMeetingId} onValueChange={setSelectedMeetingId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Bez poveznice</SelectItem>
                  {meetings.map(meeting => (
                    <SelectItem key={meeting.id} value={meeting.id.toString()}>
                      {meeting.title} ({meeting.date})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Glasovi će automatski ući u zapisnik odabrane sjednice.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Odustani</Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !title || options.some(o => !o.trim())}
          >
            {isSubmitting ? "Spremanje..." : "Spremi promjene"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
