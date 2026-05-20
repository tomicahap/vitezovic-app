"use client"

import { useState, useRef } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useMembers } from "@/contexts/members-context"
import { Upload, FileText, CheckCircle2, AlertTriangle } from "lucide-react"
import { generateId } from "@/lib/utils"

const expectedHeaders = [
  "Br. Prijave",
  "Br. Matice",
  "Ime",
  "Prezime",
  "Datum Rođenja",
  "Email",
  "Telefon",
  "Adresa",
  "Datum Upisa",
  "Status",
  "Počasni",
  "Oslobođen plaćanja",
  "Ispisan/a",
  "Datum Ispisa",
  "Razlog Ispisa",
  "Preminuo/la",
  "Datum Smrti",
  "Zadnja Uplata",
  "Istek",
  "Funkcije",
  "Sve Uplate",
  "Bilješke"
]

function normalizeHeader(header: string) {
  return header
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
}

const headerMapping: Record<string, string> = {
  'br prijave': 'membershipNumber',
  'br prijavnice': 'membershipNumber',
  'prijavnica': 'membershipNumber',
  'br matice': 'registryNumber',
  'matica': 'registryNumber',
  'ime': 'firstName',
  'prezime': 'lastName',
  'ime prezime': 'name',
  'ime i prezime': 'name',
  'email': 'email',
  'e mail': 'email',
  'telefon': 'phone',
  'mobitel': 'phone',
  'adresa': 'address',
  'datum rodjenja': 'birthDate',
  'datum rodenja': 'birthDate',
  'rodjendan': 'birthDate',
  'datum upisa': 'joinDate',
  'status': 'status',
  'status clanstva': 'status',
  'status placanja': 'paymentStatus',
  'status naplate': 'paymentStatus',
  'napomena': 'note',
  'biljeske': 'notes',
  'role': 'role',
  'uloga': 'role',
  'funkcija': 'function',
  'funkcije': 'function',
  'funkcija u drustvu': 'function',
  'funkcije u drustvu': 'function',
  'počasni': 'honorary',
  'osloboden placanja': 'exemptFromPayment',
  'oslobođen plaćanja': 'exemptFromPayment',
  'ispisan a': 'expelled',
  'ispisan/a': 'expelled',
  'datum ispisa': 'expulsionDate',
  'razlog ispisa': 'expulsionReason',
  'preminuo la': 'deceased',
  'preminuo/la': 'deceased',
  'datum smrti': 'deathDate',
  'zadnja uplata': 'lastPayment',
  'istek': 'expiry',
  'sve uplate': 'allPayments'
}

function normalizeStatus(row: Record<string, string>, joinDateStr: string, latestPaymentStr: string): 'active' | 'expired' | 'pending' {
  const statusStr = (row['status'] || '').toLowerCase()
  const isExpelled = statusStr.includes('ispisan') || statusStr.includes('neaktivan') || row['expelled']?.toLowerCase() === 'da'
  const isDeceased = row['deceased']?.toLowerCase() === 'da'
  if (isExpelled || isDeceased) return 'expired'
  
  if (statusStr.includes('cek') || statusStr.includes('pending') || statusStr.includes('na cekanju')) return 'pending'
  
  if (statusStr.includes('aktivan')) return 'active'

  // Ako postoji zadnja uplata i datumi, primijeni nova pravila
  if (latestPaymentStr) {
    const latestPaymentDate = new Date(latestPaymentStr)
    if (!isNaN(latestPaymentDate.getTime())) {
      // Pravilo 1: Datum upisa
      if (joinDateStr) {
        const joinDate = new Date(joinDateStr)
        if (!isNaN(joinDate.getTime())) {
          const joinYear = joinDate.getFullYear()
          const latestPaymentYear = latestPaymentDate.getFullYear()
          if (latestPaymentYear >= joinYear - 1) return 'active'
        }
      }

      // Pravilo 2: Kalendarski (1 godina = 365 dana, 2 godine = 730 dana)
      const now = new Date()
      const diffDays = Math.floor((now.getTime() - latestPaymentDate.getTime()) / (1000 * 60 * 60 * 24))
      
      if (diffDays <= 730) return 'active' // Manje od 2 godine (uključuje DUG)
      return 'expired' // Više od 2 godine = ISPISAN
    }
  }

  return 'active'
}

function normalizePaymentStatus(row: Record<string, string>, status: string, latestPaymentStr: string): 'pending' | 'paid' | 'overdue' {
  const statusStr = (row['status'] || '').toLowerCase()
  const isHonorary = statusStr.includes('pocasni') || row['honorary']?.toLowerCase() === 'da'
  const isExempt = row['exemptFromPayment']?.toLowerCase() === 'da'
  const isDeceased = row['deceased']?.toLowerCase() === 'da'
  if (isHonorary || isExempt || isDeceased) return 'paid'

  if (status === 'expired') return 'overdue'
  
  if (latestPaymentStr) {
    const latestPaymentDate = new Date(latestPaymentStr)
    if (!isNaN(latestPaymentDate.getTime())) {
      const now = new Date()
      const diffDays = Math.floor((now.getTime() - latestPaymentDate.getTime()) / (1000 * 60 * 60 * 24))
      if (diffDays <= 365) return 'paid'
      return 'overdue' // Status DUG
    }
  }

  return 'pending'
}

function normalizeDate(value: string | undefined | null): string {
  if (!value) return ''
  const str = String(value).trim()
  if (!str) return ''

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.substring(0, 10)
  }

  // DD.MM.YYYY. or DD.MM.YYYY
  const croatianMatch = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\.?/)
  if (croatianMatch) {
    const [_, day, month, year] = croatianMatch
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  // MM/DD/YYYY
  const usMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (usMatch) {
    const [_, month, day, year] = usMatch
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  return str
}

function mapHeaders(headers: string[]) {
  return headers.map(header => {
    const normalized = normalizeHeader(header)
    if (headerMapping[normalized]) {
      return headerMapping[normalized]
    }
    return normalized
  })
}

function rowToMember(row: Record<string, string>) {
  const firstName = row['firstName'] || ''
  const lastName = row['lastName'] || ''
  const name = row['name'] || [firstName, lastName].filter(Boolean).join(' ').trim() || 'Nepoznato'

  // Parsiraj funkcije ako postoje
  let functions: MemberFunctionAssignment[] = []
  if (row['function']) {
    const functionStrings = row['function'].split(/[,;\n]/).map(f => f.trim()).filter(Boolean)
    functions = functionStrings.map(fn => ({
      id: generateId(),
      functionName: fn,
      fromYear: '',
      toYear: ''
    }))
  }

  // Uplate: SVE UPLATE (;) + ZADNJA UPLATA (izbjegni duplicate)
  const uniqueDates = new Set<string>()
  const allPaymentsStr = row['allPayments'] || ''
  if (allPaymentsStr) {
    allPaymentsStr.split(/;/).forEach(p => {
      const d = normalizeDate(p.trim())
      if (d) uniqueDates.add(d)
    })
  }
  
  const lastPaymentDateRaw = normalizeDate(row['lastPayment']?.trim())
  if (lastPaymentDateRaw) {
    uniqueDates.add(lastPaymentDateRaw)
  }

  const payments: MemberPayment[] = Array.from(uniqueDates).map(date => ({
    id: generateId(),
    date,
    amount: 0,
    note: 'Uvezeno'
  }))

  const joinDate = normalizeDate(row['joinDate'])
  const latestPayment = lastPaymentDateRaw || (payments.length > 0 ? [...payments].sort((a,b) => b.date.localeCompare(a.date))[0].date : '')

  const status = normalizeStatus(row, joinDate, latestPayment)
  const paymentStatus = normalizePaymentStatus(row, status, latestPayment)

  return {
    name,
    email: row['email'] || '',
    initials: name.split(' ').map(part => part[0]).join('').toUpperCase().slice(0, 2),
    phone: row['phone'] || '',
    address: row['address'] || '',
    birthDate: normalizeDate(row['birthDate']),
    membershipNumber: row['membershipNumber'] || '',
    registryNumber: row['registryNumber'] || '',
    status,
    paymentStatus,
    joinDate: normalizeDate(row['joinDate']),
    researchAreas: [],
    additionalAreas: 0,
    functions,
    note: row['note'] || row['notes'] || '',
    payments,
    avatar: '/placeholder.svg',
    role: row['role'] === 'moderator' ? 'moderator' : 'member' as const,
    honorary: (row['status'] || '').toLowerCase().includes('pocasni') || row['honorary']?.toLowerCase() === 'da' || row['honorary']?.toLowerCase() === 'true',
    exemptFromPayment: row['exemptFromPayment']?.toLowerCase() === 'da' || row['exemptFromPayment']?.toLowerCase() === 'true',
    expelled: (row['status'] || '').toLowerCase().includes('ispisan') || row['expelled']?.toLowerCase() === 'da' || row['expelled']?.toLowerCase() === 'true',
    expulsionDate: normalizeDate(row['expulsionDate']),
    expulsionReason: row['expulsionReason'] || '',
    deceased: row['deceased']?.toLowerCase() === 'da' || row['deceased']?.toLowerCase() === 'true',
    deathDate: normalizeDate(row['deathDate']),
    lastPayment: normalizeDate(row['lastPayment']),
    expiry: normalizeDate(row['expiry']),
    allPayments: row['allPayments'] || '',
    notes: row['notes'] || row['note'] || '',
  }
}

export function MembersImportDialog() {
  const { importMembers } = useMembers()
  const [fileError, setFileError] = useState('')
  const [importedCount, setImportedCount] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const parseCsv = (text: string) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim())
    if (lines.length < 2) {
      throw new Error('Datoteka ne sadrži podatke za uvoz.')
    }

    // Detekcija separatora (, ili ;)
    const headerLine = lines[0]
    const delimiter = headerLine.includes(';') ? ';' : ','

    const rawHeaders = headerLine.split(delimiter).map(header => normalizeHeader(header))
    const headers = mapHeaders(rawHeaders)
    const rows = lines.slice(1).map(line => line.split(delimiter).map(cell => cell.trim()))

    return rows.map(cells => {
      const record: Record<string, string> = {}
      headers.forEach((header, index) => {
        record[header] = cells[index] ?? ''
      })
      return record
    })
  }

  const parseXlsx = async (buffer: ArrayBuffer) => {
    const XLSX = await import('xlsx')
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' })

    if (rows.length < 2) {
      throw new Error('Datoteka ne sadrži podatke za uvoz.')
    }

    const rawHeaders = (rows[0] as any[]).map(header => normalizeHeader(String(header || '')))
    const headers = mapHeaders(rawHeaders)

    return rows.slice(1).map(row => {
      const record: Record<string, string> = {}
      headers.forEach((header, index) => {
        let value = row[index]
        if (value instanceof Date) {
          // Format date as YYYY-MM-DD
          value = value.toISOString().split('T')[0]
        }
        record[header] = value !== undefined && value !== null ? String(value) : ''
      })
      return record
    })
  }

  const handleFile = async (file: File) => {
    setFileError('')
    setImportedCount(null)

    const name = file.name.toLowerCase()
    let rows: Record<string, string>[]

    try {
      if (name.endsWith('.csv')) {
        const text = await file.text()
        rows = parseCsv(text)
      } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        const buffer = await file.arrayBuffer()
        rows = await parseXlsx(buffer)
      } else {
        throw new Error('Podržani formati su CSV i XLSX.')
      }
    } catch (error) {
      setFileError((error as Error).message)
      return
    }

    const members = rows.map(rowToMember)
    importMembers(members)
    setImportedCount(members.length)
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="h-4 w-4" />
          Uvezi članove
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Uvoz članova</DialogTitle>
          <DialogDescription>
            Učitaj CSV datoteku s članovima prema dostupnoj strukturi.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>CSV datoteka</Label>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="block w-full text-sm text-muted-foreground"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) handleFile(file)
              }}
            />
          </div>

          <div className="rounded-xl border border-border bg-card p-4 text-sm">
            <p className="font-semibold">Očekivani stupci</p>
            <p className="mt-2 text-muted-foreground">{expectedHeaders.join(', ')}</p>
          </div>

          {fileError && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4" />
              {fileError}
            </div>
          )}

          {importedCount !== null && (
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              Uvezeno {importedCount} članova.
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
              Odaberi CSV
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (inputRef.current) {
                  inputRef.current.value = ''
                  setFileError('')
                  setImportedCount(null)
                }
              }}
            >
              Resetiraj
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
