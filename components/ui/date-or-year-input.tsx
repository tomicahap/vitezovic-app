"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Calendar } from "lucide-react"
import { cn } from "@/lib/utils"

interface DateOrYearInputProps {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  label?: string
  className?: string
}

export function DateOrYearInput({
  value,
  onChange,
  placeholder = "npr. 2024 ili 15.05.2024",
  label,
  className,
}: DateOrYearInputProps) {
  const dateInputRef = React.useRef<HTMLInputElement>(null)

  const handlePickDate = (e: React.ChangeEvent<HTMLInputElement>) => {
    const iso = e.target.value
    if (!iso) return
    const [y, m, d] = iso.split("-")
    if (y && m && d) {
      onChange(`${d}.${m}.${y}`)
    }
  }

  // Pretvori vrijednost u YYYY-MM-DD ako je upisan datum da se sinkronizira u picker
  const getIsoValue = () => {
    if (!value) return ""
    const dotParts = value.replace(/\.+$/, "").split(".")
    if (dotParts.length === 3) {
      const d = dotParts[0].padStart(2, "0")
      const m = dotParts[1].padStart(2, "0")
      const y = dotParts[2]
      if (y.length === 4) return `${y}-${m}-${d}`
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
    return ""
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <Label className="text-xs">{label}</Label>}
      <div className="relative flex items-center">
        <Input
          type="text"
          className="h-9 text-sm pr-8 bg-background"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => {
            try {
              dateInputRef.current?.showPicker?.()
            } catch {
              dateInputRef.current?.focus()
            }
          }}
          className="absolute right-2 text-muted-foreground hover:text-primary transition-colors p-1 rounded hover:bg-muted"
          title="Odaberi datum iz kalendara"
        >
          <Calendar className="h-4 w-4" />
        </button>
        <input
          ref={dateInputRef}
          type="date"
          className="sr-only"
          value={getIsoValue()}
          onChange={handlePickDate}
        />
      </div>
    </div>
  )
}
