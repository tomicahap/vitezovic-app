"use client"

import { useState, useRef, useEffect } from "react"
import { Clock } from "lucide-react"

interface TimeInput24hProps {
  value: string
  onChange: (value: string) => void
  className?: string
}

export function TimeInput24h({ value, onChange, className = "" }: TimeInput24hProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Parse current value or default to 00:00
  const [currentH, currentM] = (value || "00:00").split(":")
  
  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"))
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, "0"))

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  function setHour(h: string) {
    onChange(`${h}:${currentM || "00"}`)
  }

  function setMinute(m: string) {
    onChange(`${currentH || "00"}:${m}`)
    setOpen(false) // Close when minute is selected
  }

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div 
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-3 text-sm cursor-pointer hover:border-accent/40 transition-colors shadow-sm"
      >
        <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <span className="font-medium">{value || "00:00"}</span>
      </div>
      
      {open && (
        <div className="absolute top-full left-0 z-[100] mt-1 flex h-64 w-40 rounded-xl border border-border bg-background p-1 shadow-2xl animate-in fade-in zoom-in-95 duration-100">
          {/* Hours Column */}
          <div className="flex-1 overflow-y-auto border-r border-border scrollbar-thin scrollbar-thumb-muted">
            <div className="p-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-center sticky top-0 bg-background pb-1">Sat</div>
            {hours.map(hour => (
              <button 
                key={hour}
                type="button"
                onClick={(e) => { e.stopPropagation(); setHour(hour) }}
                className={`w-full rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground ${currentH === hour ? 'bg-primary text-primary-foreground font-bold' : ''}`}
              >
                {hour}
              </button>
            ))}
          </div>
          
          {/* Minutes Column */}
          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-muted">
            <div className="p-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-center sticky top-0 bg-background pb-1">Min</div>
            {minutes.map(min => (
              <button 
                key={min}
                type="button"
                onClick={(e) => { e.stopPropagation(); setMinute(min) }}
                className={`w-full rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground ${currentM === min ? 'bg-primary text-primary-foreground font-bold' : ''}`}
              >
                {min}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
