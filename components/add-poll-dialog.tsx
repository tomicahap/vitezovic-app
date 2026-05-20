"use client"

import { useState } from "react"
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

export function AddPollDialog({ onClose, onPollAdded }: { onClose: () => void, onPollAdded?: () => void }) {
  const { user } = useAuth()
  const { members } = useMembers()
  const { meetings } = useMeetings()
  
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [options, setOptions] = useState(["Za", "Protiv", "Suzdržan"])
  const [targetType, setTargetType] = useState<"all" | "selected">("all")
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([])
  const [memberSearch, setMemberSearch] = useState("")
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>("none")
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
      const response = await fetch("/api/polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          options: options.filter(o => o.trim()),
          target_member_ids: targetType === "all" ? "all" : selectedMemberIds,
          meeting_id: selectedMeetingId === "none" ? null : parseInt(selectedMeetingId),
          created_by: user?.name
        })
      })

      if (response.ok) {
        const { id } = await response.json()
        
        // Slanje obavijesti na mail
        try {
          await fetch("/api/polls/notify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              pollTitle: title,
              targetType,
              selectedMemberIds: targetType === "all" ? null : selectedMemberIds
            })
          })
        } catch (mailError) {
          console.error("Failed to send poll notifications:", mailError)
        }

        if (onPollAdded) {
          onPollAdded();
        }
        onClose();
      }
    } catch (error) {
      console.error("Failed to create poll:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Nova anketa / glasovanje</DialogTitle>
          <DialogDescription>
            Kreirajte anketu koja će se prikazati odabranim članovima pri sljedećoj prijavi.
          </DialogDescription>
        </DialogHeader>

        {isSubmitting && <div className="p-4 bg-primary/10 text-primary text-xs text-center rounded-md animate-pulse">Spremanje podataka u bazu...</div>}

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Naslov glasovanja</Label>
            <Input 
              id="title" 
              placeholder="npr. Usvajanje financijskog izvještaja 2023" 
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Opis / Objašnjenje (opcionalno)</Label>
            <Textarea 
              id="description" 
              placeholder="Detaljnije pojasnite predmet glasovanja..." 
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

          <div className="grid grid-cols-2 gap-6 pt-4 border-t">
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
                            id={`member-${member.id}`} 
                            checked={selectedMemberIds.includes(member.id)}
                            onCheckedChange={() => handleToggleMember(member.id)}
                          />
                          <label htmlFor={`member-${member.id}`} className="text-sm cursor-pointer truncate flex items-center gap-2">
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
            {isSubmitting ? "Kreiranje..." : "Objavi glasovanje"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
