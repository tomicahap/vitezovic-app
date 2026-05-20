"use client"

import dynamic from "next/dynamic"
import { Loader2 } from "lucide-react"

const LecturesMap = dynamic(() => import("./lectures-map"), {
  ssr: false,
  loading: () => (
    <div className="h-[600px] w-full flex items-center justify-center bg-card rounded-2xl border border-border shadow-sm">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Učitavanje karte...</span>
      </div>
    </div>
  )
})

export { LecturesMap }
