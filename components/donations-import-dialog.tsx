"use client"

import * as React from "react"
import * as XLSX from "xlsx"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Download, FileSpreadsheet, RefreshCw, Upload } from "lucide-react"
import { toast } from "sonner"
import { CloseActionButton, ACTION_BUTTON_STYLES } from "@/components/ui/action-bar"

interface MappedImportRow {
  name: string
  email: string
  website: string
  oib: string
  city: string
  address: string
  phone: string
  contact_person: string
  contact_role: string
  entity_type: string
  activity_category: string
}

interface DonationsImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: () => void
}

function normalizeHeader(h: string): string {
  return String(h || "")
    .trim()
    .toLowerCase()
    .replace(/č/g, "c")
    .replace(/ć/g, "c")
    .replace(/ž/g, "z")
    .replace(/š/g, "s")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]/g, "")
}

function pickField(obj: Record<string, any>, aliases: string[]): string {
  for (const [k, v] of Object.entries(obj)) {
    const norm = normalizeHeader(k)
    if (aliases.includes(norm) && v !== undefined && v !== null) {
      return String(v).trim()
    }
  }
  return ""
}

export function DonationsImportDialog({
  open,
  onOpenChange,
  onImported,
}: DonationsImportDialogProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = React.useState("")
  const [rows, setRows] = React.useState<MappedImportRow[]>([])
  const [crawlMissingEmails, setCrawlMissingEmails] = React.useState(true)
  const [prepareTemplate, setPrepareTemplate] = React.useState(true)
  const [importing, setImporting] = React.useState(false)

  const handleDownloadTemplate = () => {
    const sample = [
      {
        Naziv: "Primjer Stolarija d.o.o.",
        Email: "info@primjer-stolarija.hr",
        Web: "https://primjer-stolarija.hr",
        OIB: "12345678901",
        Grad: "Varaždin",
        Adresa: "Ulica bana Jelačića 10",
        Telefon: "042 123 456",
        "Kontakt osoba": "Ivan Horvat",
        Uloga: "Direktor",
        Vrsta: "tvrtka",
        Djelatnost: "Stolarija i izrada namještaja",
      },
    ]
    const ws = XLSX.utils.json_to_sheet(sample)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Kontakti")
    XLSX.writeFile(wb, "predlozak_uvoz_donacija.xlsx")
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: "array" })
      const firstSheet = wb.SheetNames[0]
      if (!firstSheet) {
        toast.error("Datoteka nema niti jedan radni list.")
        return
      }
      const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[firstSheet], { defval: "" })
      const mapped: MappedImportRow[] = rawRows
        .map((r) => ({
          name: pickField(r, ["naziv", "tvrtka", "subjekt", "ime", "name", "company", "companyname", "nazivsubjekta"]),
          email: pickField(r, ["email", "mail", "emailadresa", "eposta"]),
          website: pickField(r, ["web", "website", "url", "webstranica", "stranica", "domena"]),
          oib: pickField(r, ["oib", "maticnibroj"]),
          city: pickField(r, ["grad", "mjesto", "city", "sjediste"]),
          address: pickField(r, ["adresa", "ulica", "address"]),
          phone: pickField(r, ["telefon", "tel", "mobitel", "phone"]),
          contact_person: pickField(r, ["kontaktosoba", "kontakt", "direktor", "vlasnik", "contactperson", "odgovornaosoba"]),
          contact_role: pickField(r, ["uloga", "funkcija", "role", "contactrole"]),
          entity_type: pickField(r, ["vrsta", "tip", "entitytype", "vrstasubjekta"]) || "tvrtka",
          activity_category: pickField(r, ["djelatnost", "sektor", "kategorija", "activity", "activitycategory"]),
        }))
        .filter((r) => r.name || r.email || r.website)

      setFileName(file.name)
      setRows(mapped)
      toast.success(`Učitano ${mapped.length} redaka iz datoteke "${file.name}".`)
    } catch (err: any) {
      toast.error(err?.message || "Greška pri čitanju Excel/CSV datoteke.")
    }
  }

  const handleImport = async () => {
    if (rows.length === 0) {
      toast.error("Prvo učitajte datoteku s kontaktima.")
      return
    }
    setImporting(true)
    try {
      const res = await fetch("/api/admin/mailcrawl/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: rows.slice(0, 500),
          crawlMissingEmails,
          prepareTemplate,
        }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        toast.success(data.message || `Uvezeno ${data.insertedCount} kontakata!`)
        setRows([])
        setFileName("")
        onImported()
        onOpenChange(false)
      } else {
        toast.error(data.error || "Uvoz nije uspio.")
      }
    } catch {
      toast.error("Greška pri spajanju s poslužiteljem.")
    } finally {
      setImporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            Masovni uvoz kontakata (Excel / CSV)
          </DialogTitle>
          <DialogDescription>
            Uvezite do 500 tvrtki, obrta ili udruga odjednom. Sustav automatski prepoznaje stupce i sprječava duplikate.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl border border-dashed bg-muted/30">
            <div className="space-y-0.5">
              <div className="font-semibold text-foreground">
                {fileName ? `Učitano: ${fileName} (${rows.length} redaka)` : "Odaberite .xlsx, .xls ili .csv datoteku"}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Prepoznaje stupce: Naziv, Email, Web, OIB, Grad, Adresa, Telefon, Kontakt osoba, Djelatnost.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={handleDownloadTemplate}>
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Predložak (.xlsx)
              </Button>
              <Button type="button" size="sm" className="h-8 text-xs" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                Odaberi datoteku
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </div>

          {rows.length > 0 && (
            <div className="rounded-lg border overflow-hidden">
              <div className="bg-muted/50 px-3 py-1.5 font-semibold flex items-center justify-between">
                <span>Pretpregled prvih {Math.min(5, rows.length)} redaka:</span>
                <Badge variant="secondary" className="text-[10px]">{rows.length} ukupno</Badge>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px]">
                  <thead className="border-b bg-muted/20 text-muted-foreground">
                    <tr>
                      <th className="py-1.5 px-2.5">Naziv</th>
                      <th className="py-1.5 px-2.5">E-mail</th>
                      <th className="py-1.5 px-2.5">Web</th>
                      <th className="py-1.5 px-2.5">Grad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.slice(0, 5).map((r, i) => (
                      <tr key={i}>
                        <td className="py-1.5 px-2.5 font-medium truncate max-w-[160px]">{r.name || "—"}</td>
                        <td className="py-1.5 px-2.5 font-mono truncate max-w-[160px]">{r.email || "(s weba)"}</td>
                        <td className="py-1.5 px-2.5 truncate max-w-[140px]">{r.website || "—"}</td>
                        <td className="py-1.5 px-2.5">{r.city || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/20">
              <div>
                <div className="font-medium">Izvuci e-mailove s web stranica za retke bez e-maila</div>
                <div className="text-[11px] text-muted-foreground">
                  Paralelno posjećuje navedene web stranice i pronalazi kontakt adrese i OIB.
                </div>
              </div>
              <Switch checked={crawlMissingEmails} onCheckedChange={setCrawlMissingEmails} />
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/20">
              <div>
                <div className="font-medium">Odmah pripremi nacrt poruke pametnim predloškom</div>
                <div className="text-[11px] text-muted-foreground">
                  Uvezeni kontakti odmah dobivaju status &quot;Nacrt spreman&quot; (bez troška AI-ja).
                </div>
              </div>
              <Switch checked={prepareTemplate} onCheckedChange={setPrepareTemplate} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <CloseActionButton
            label="Odustani"
            onClick={() => onOpenChange(false)}
            disabled={importing}
          />
          <Button
            type="button"
            onClick={handleImport}
            disabled={importing || rows.length === 0}
            className={ACTION_BUTTON_STYLES.save}
          >
            {importing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Uvozim kontakte...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 text-[#CEA369]" />
                Uvezi ({Math.min(rows.length, 500)})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
