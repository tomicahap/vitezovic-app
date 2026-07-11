"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { useMembers, Member } from "@/contexts/members-context"
import { Mail, Loader2 } from "lucide-react"

export interface SendNotificationDialogProps {
  isOpen: boolean
  onClose: () => void
  type: "meeting" | "lecture"
  item: {
    title: string
    date: string
    time: string
    location: string
    host?: string
  }
}

export function SendNotificationDialog({ isOpen, onClose, type, item }: SendNotificationDialogProps) {
  const { members } = useMembers()
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set())
  const [isSending, setIsSending] = useState(false)
  const [resultMessage, setResultMessage] = useState<{ text: string, isError: boolean } | null>(null)

  // Only consider active members with an email address
  const activeMembersWithEmail = members.filter(m => m.status === 'active' && m.email)

  // Members who hold some function in the board ("Tijela društva")
  const boardMembers = activeMembersWithEmail.filter(m => {
    return Array.isArray(m.functions) && m.functions.length > 0
  })

  // Group into Board and Others
  const otherMembers = activeMembersWithEmail.filter(m => !boardMembers.includes(m))

  // When dialog opens, preselect all board members
  useEffect(() => {
    if (isOpen) {
      setResultMessage(null)
      const initialSelection = new Set<string>()
      boardMembers.forEach(m => initialSelection.add(m.email))
      setSelectedEmails(initialSelection)
    }
  }, [isOpen, members])

  const handleToggle = (email: string) => {
    const next = new Set(selectedEmails)
    if (next.has(email)) next.delete(email)
    else next.add(email)
    setSelectedEmails(next)
  }

  const handleToggleAll = (list: Member[], checked: boolean) => {
    const next = new Set(selectedEmails)
    list.forEach(m => {
      if (checked) next.add(m.email)
      else next.delete(m.email)
    })
    setSelectedEmails(next)
  }

  const handleSend = async () => {
    if (selectedEmails.size === 0) return

    setIsSending(true)
    setResultMessage(null)
    
    try {
      const response = await fetch('/api/send-board-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          item,
          recipients: Array.from(selectedEmails)
        })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setResultMessage({ text: data.message || "Obavijesti su uspješno poslane.", isError: false })
        setTimeout(() => {
          onClose()
        }, 2500)
      } else {
        setResultMessage({ text: data.error || "Greška pri slanju obavijesti.", isError: true })
      }
    } catch (error) {
      setResultMessage({ text: "Dogodila se mrežna greška pri slanju.", isError: true })
    } finally {
      setIsSending(false)
    }
  }

  if (!isOpen) return null

  const allBoardSelected = boardMembers.length > 0 && boardMembers.every(m => selectedEmails.has(m.email))
  const allOtherSelected = otherMembers.length > 0 && otherMembers.every(m => selectedEmails.has(m.email))

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isSending && !open && onClose()}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Slanje obavijesti ({type === 'meeting' ? 'Sjednica' : 'Predavanje'})
          </DialogTitle>
          <DialogDescription>
            Odaberite članove kojima želite poslati obavijest o ovoj stavci. Prema zadanim postavkama označena su sva Tijela društva.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 space-y-6 my-2">
          
          {/* Tijela društva */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border/50">
              <h3 className="font-semibold text-sm text-primary flex items-center gap-2">
                Tijela društva (Članovi s funkcijom)
              </h3>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleToggleAll(boardMembers, !allBoardSelected)}>
                {allBoardSelected ? "Odznači sve" : "Označi sve"}
              </Button>
            </div>
            
            {boardMembers.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nema aktivnih članova s dodijeljenim funkcijama.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-2">
                {boardMembers.map(m => (
                  <label key={m.id} className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-muted/50 cursor-pointer border border-transparent hover:border-border transition-colors">
                    <Checkbox 
                      checked={selectedEmails.has(m.email)} 
                      onCheckedChange={() => handleToggle(m.email)} 
                      className="mt-0.5"
                    />
                    <div className="grid gap-0.5 leading-none">
                      <span className="text-sm font-medium">{m.name}</span>
                      <span className="text-[10px] text-muted-foreground truncate max-w-[160px]" title={m.email}>{m.email}</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {m.functions?.map((f, i) => (
                          <span key={i} className="text-[9px] bg-accent/10 text-accent px-1.5 py-0.5 rounded-sm">{f.functionName}</span>
                        ))}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Ostali članovi */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border/50">
              <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
                Ostali aktivni članovi
              </h3>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleToggleAll(otherMembers, !allOtherSelected)}>
                {allOtherSelected ? "Odznači sve" : "Označi sve"}
              </Button>
            </div>
            
            {otherMembers.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nema ostalih članova.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-2">
                {otherMembers.map(m => (
                  <label key={m.id} className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-muted/50 cursor-pointer border border-transparent hover:border-border transition-colors">
                    <Checkbox 
                      checked={selectedEmails.has(m.email)} 
                      onCheckedChange={() => handleToggle(m.email)}
                      className="mt-0.5"
                    />
                    <div className="grid gap-0.5 leading-none">
                      <span className="text-sm font-medium">{m.name}</span>
                      <span className="text-[10px] text-muted-foreground truncate max-w-[160px]" title={m.email}>{m.email}</span>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

        </div>

        {resultMessage && (
          <div className={`p-3 rounded-md text-sm font-medium ${resultMessage.isError ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-700 border border-green-100'}`}>
            {resultMessage.text}
          </div>
        )}

        <DialogFooter className="pt-4 border-t border-border mt-2">
          <Button variant="outline" onClick={onClose} disabled={isSending}>
            Odustani
          </Button>
          <Button 
            onClick={handleSend} 
            disabled={isSending || selectedEmails.size === 0}
            className="gap-2 shadow-sm transition-all hover:scale-105"
          >
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            {isSending ? "Slanje u tijeku..." : `Pošalji obavijest (${selectedEmails.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
