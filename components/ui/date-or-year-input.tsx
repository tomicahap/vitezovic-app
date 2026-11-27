"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Calendar } from "lucide-react"
import { cn } from "@/lib/utils"
import { inspectMemberDate, isValidCalendarDate } from "@/lib/date-validation"

interface DateOrYearInputProps {
  id?: string
  value: string
  onChange: (val: string) => void
  placeholder?: string
  label?: string
  className?: string
  inputClassName?: string
  allowYearOnly?: boolean
  disabled?: boolean
  error?: string
}

function formatDateInputMasked(nextRaw: string, prevDisplay: string): string {
  // Ako korisnik briše točno na kraju kosom crtom, pustimo da obriše i znamenku ako treba
  const isDeleting = nextRaw.length < prevDisplay.length

  // Podrška za brzi unos npr. "5/" -> "05/", "5/3/" -> "05/03/"
  const normalizedSep = nextRaw.replace(/[.\-\s]/g, "/")
  if (!isDeleting) {
    const singleDay = normalizedSep.match(/^(\d)\/$/)
    if (singleDay) return `0${singleDay[1]}/`
    const singleMonth = normalizedSep.match(/^(\d{2})\/(\d)\/$/)
    if (singleMonth) return `${singleMonth[1]}/0${singleMonth[2]}/`
  }

  // Ako se zalijepi potpuni ISO YYYY-MM-DD, pretvori odmah u DD/MM/YYYY
  const isoPaste = nextRaw.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (isoPaste) {
    return `${isoPaste[3].padStart(2, "0")}/${isoPaste[2].padStart(2, "0")}/${isoPaste[1]}`
  }

  // Izvuci samo znamenke (do 8: DDMMYYYY)
  const digits = nextRaw.replace(/\D/g, "").slice(0, 8)
  if (digits.length === 0) return ""
  if (digits.length <= 2) {
    return !isDeleting && normalizedSep.endsWith("/") && digits.length === 2
      ? `${digits}/`
      : digits
  }
  if (digits.length <= 4) {
    const base = `${digits.slice(0, 2)}/${digits.slice(2)}`
    return !isDeleting && normalizedSep.endsWith("/") && digits.length === 4
      ? `${base}/`
      : base
  }
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`
}

export function DateOrYearInput({
  id,
  value,
  onChange,
  placeholder,
  label,
  className,
  inputClassName,
  allowYearOnly = false,
  disabled = false,
  error,
}: DateOrYearInputProps) {
  const dateInputRef = React.useRef<HTMLInputElement>(null)
  const [touched, setTouched] = React.useState(false)

  const handlePickDate = (e: React.ChangeEvent<HTMLInputElement>) => {
    const iso = e.target.value
    if (!iso) return
    const [y, m, d] = iso.split("-")
    if (y && m && d) {
      setTouched(true)
      onChange(`${d}/${m}/${y}`)
    }
  }

  // Pretvori vrijednost u YYYY-MM-DD ako je upisan datum da se sinkronizira u picker
  const getIsoValue = () => {
    if (!value) return ""
    const inspected = inspectMemberDate(value)
    return inspected.isoDate || ""
  }

  // Ako je vrijednost u starom formatu DD.MM.YYYY ili YYYY-MM-DD (sa ili bez vremena), prikaži kao DD/MM/YYYY
  const displayValue = React.useMemo(() => {
    if (!value) return ""
    const trimmed = value.trim()
    if (!allowYearOnly && (trimmed === "-" || trimmed === "—")) {
      return ""
    }
    const dotMatch = trimmed.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\.?$/)
    if (dotMatch) {
      return `${dotMatch[1].padStart(2, "0")}/${dotMatch[2].padStart(2, "0")}/${dotMatch[3]}`
    }
    const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/)
    if (isoMatch) {
      return `${isoMatch[3].padStart(2, "0")}/${isoMatch[2].padStart(2, "0")}/${isoMatch[1]}`
    }
    return value
  }, [value, allowYearOnly])

  // Provjera ispravnosti u strogom datumskom načinu (allowYearOnly = false)
  const inlineValidationError = React.useMemo(() => {
    if (error) return error
    if (allowYearOnly) return ""
    const trimmed = displayValue.trim()
    if (!trimmed || trimmed === "-" || trimmed === "—") return ""

    const fullSlash = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (fullSlash) {
      const d = Number(fullSlash[1])
      const m = Number(fullSlash[2])
      const y = Number(fullSlash[3])
      if (!isValidCalendarDate(y, m, d)) {
        return "Neispravan datum (provjerite dan, mjesec i godinu)"
      }
      return ""
    }

    if (touched) {
      const inspected = inspectMemberDate(trimmed)
      if (!inspected.isoDate) {
        return "Unesite ispravan datum u formatu DD/MM/YYYY"
      }
    }
    return ""
  }, [error, allowYearOnly, displayValue, touched])

  const effectivePlaceholder =
    placeholder || (allowYearOnly ? "npr. 2024 ili 15/05/2024" : "DD/MM/YYYY")

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    if (allowYearOnly) {
      onChange(raw)
      return
    }
    const formatted = formatDateInputMasked(raw, displayValue)
    onChange(formatted)
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <Label htmlFor={id} className="text-xs">
          {label}
        </Label>
      )}
      <div className="relative flex items-center">
        <Input
          id={id}
          type="text"
          inputMode={allowYearOnly ? "text" : "numeric"}
          maxLength={allowYearOnly ? undefined : 10}
          disabled={disabled}
          className={cn(
            "h-9 text-sm pr-9 bg-background",
            inlineValidationError && "border-red-400 focus-visible:ring-red-400",
            inputClassName
          )}
          value={displayValue}
          onChange={handleTextChange}
          onBlur={() => setTouched(true)}
          placeholder={effectivePlaceholder}
        />
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute right-2 text-muted-foreground p-1 rounded",
            disabled && "opacity-40"
          )}
        >
          <Calendar className="h-4 w-4" />
        </span>
        <input
          ref={dateInputRef}
          type="date"
          disabled={disabled}
          tabIndex={-1}
          aria-label={label ? `${label} — odabir iz kalendara` : "Odaberi datum iz kalendara"}
          title="Odaberi datum iz kalendara"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7 opacity-0 cursor-pointer disabled:pointer-events-none z-10"
          value={getIsoValue()}
          onClick={() => {
            try {
              dateInputRef.current?.showPicker?.()
            } catch {}
          }}
          onChange={handlePickDate}
        />
      </div>
      {inlineValidationError && (
        <p className="text-[11px] text-red-600 leading-tight">{inlineValidationError}</p>
      )}
    </div>
  )
}
