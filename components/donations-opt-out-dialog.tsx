"use client"

import * as React from "react"
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
import { Badge } from "@/components/ui/badge"
import { Plus, RefreshCw, ShieldBan, Trash2 } from "lucide-react"
import { toast } from "sonner"
import type { OptOutItem } from "@/lib/mailcrawl/types"
import { formatDateTimeDMY } from "@/lib/utils"
import { CloseActionButton } from "@/components/ui/action-bar"

interface DonationsOptOutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onChanged?: () => void
}

export function DonationsOptOutDialog({
  open,
  onOpenChange,
  onChanged,
}: DonationsOptOutDialogProps) {
  const [items, setItems] = React.useState<OptOutItem[]>([])
  const [loading, setLoading] = React.useState(false)
  const [adding, setAdding] = React.useState(false)
  const [email, setEmail] = React.useState("")
  const [website, setWebsite] = React.useState("")
  const [companyName, setCompanyName] = React.useState("")
  const [reason, setReason] = React.useState("")

  const loadOptOuts = React.useCallback(async () => {
    if (!open) return
    setLoading(true)
    try {
      const res = await fetch("/api/admin/mailcrawl/opt-out", { cache: "no-store" })
      const data = await res.json()
      if (res.ok && data.ok) {
        setItems(data.items || [])
      }
    } catch {
      toast.error("Greška pri dohvatu liste odjava.")
    } finally {
      setLoading(false)
    }
  }, [open])

  React.useEffect(() => {
    loadOptOuts()
  }, [loadOptOuts])

  const handleAdd = async () => {
    if (!email.trim() && !website.trim()) {
      toast.error("Unesite barem e-mail adresu ili web domenu.")
      return
    }
    setAdding(true)
    try {
      const res = await fetch("/api/admin/mailcrawl/opt-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          website: website.trim(),
          companyName: companyName.trim(),
          reason: reason.trim() || "Zahtjev subjekta da ga se više ne kontaktira",
        }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        toast.success("Subjekt dodan na listu odjava (Ne kontaktirati).")
        setEmail("")
        setWebsite("")
        setCompanyName("")
        setReason("")
        loadOptOuts()
        onChanged?.()
      } else {
        toast.error(data.error || "Greška pri dodavanju.")
      }
    } catch {
      toast.error("Greška pri spremanju.")
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (id: number) => {
    try {
      const res = await fetch(`/api/admin/mailcrawl/opt-out?id=${id}`, { method: "DELETE" })
      if (res.ok) {
        toast.success("Zapis uklonjen s liste odjava.")
        loadOptOuts()
        onChanged?.()
      }
    } catch {
      toast.error("Greška pri uklanjanju.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <ShieldBan className="h-5 w-5" />
            Lista odjava — Ne kontaktirati ({items.length})
          </DialogTitle>
          <DialogDescription>
            Tvrtke i e-mail adrese na ovom popisu trajno su blokirane od budućeg prikupljanja i slanja donacijskih poziva.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          <div className="p-3 rounded-xl border bg-muted/30 space-y-2.5">
            <div className="font-semibold text-foreground">Dodaj ručno na listu odjava:</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input
                placeholder="E-mail (npr. info@tvrtka.hr)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-8 text-xs font-mono"
              />
              <Input
                placeholder="Domena (opcionalno, npr. tvrtka.hr)"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="h-8 text-xs"
              />
              <Input
                placeholder="Naziv subjekta (opcionalno)"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="h-8 text-xs"
              />
              <div className="flex gap-2">
                <Input
                  placeholder="Razlog odjave"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="h-8 text-xs"
                />
                <Button type="button" size="sm" className="h-8 shrink-0" onClick={handleAdd} disabled={adding}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Blokiraj
                </Button>
              </div>
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto rounded-lg border divide-y">
            {loading ? (
              <div className="p-6 text-center text-muted-foreground flex items-center justify-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Učitavam...
              </div>
            ) : items.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                Lista odjava je trenutno prazna.
              </div>
            ) : (
              items.map((item) => (
                <div key={item.id} className="p-2.5 flex items-center justify-between gap-3 hover:bg-muted/30">
                  <div className="min-w-0 space-y-0.5">
                    <div className="font-semibold text-foreground truncate flex items-center gap-1.5">
                      <span>{item.company_name || item.email_norm || item.domain_norm}</span>
                      {item.domain_norm && (
                        <Badge variant="outline" className="text-[10px]">
                          {item.domain_norm}
                        </Badge>
                      )}
                    </div>
                    {item.email_norm && (
                      <div className="font-mono text-[11px] text-rose-600">{item.email_norm}</div>
                    )}
                    <div className="text-[10px] text-muted-foreground">
                      {item.reason} {item.created_at ? `· ${formatDateTimeDMY(item.created_at)}` : ""}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-600 shrink-0"
                    onClick={() => item.id && handleRemove(item.id)}
                    title="Ukloni s liste odjava"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        <DialogFooter>
          <CloseActionButton label="Zatvori" onClick={() => onOpenChange(false)} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
