"use client"

import { Archive } from "lucide-react"

export function ArchiveContent() {
  return (
    <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 md:mb-8">
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">Arhiv</h2>
          <p className="text-sm text-muted-foreground">Pregled arhiviranih dokumenata</p>
        </div>

        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-12 text-center h-[50vh]">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary mb-4">
            <Archive className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Arhiv je prazan</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Ova opcija trenutno nije aktivna. Modul arhiva bit će dostupan u nadolazećim nadogradnjama sustava.
          </p>
        </div>
      </div>
    </main>
  )
}
