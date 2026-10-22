"use client"

import React, { useEffect, useState } from "react"
import { Shield, Sparkles } from "lucide-react"

interface BootSplashProps {
  message?: string
  logoUrl?: string | null
}

const STATUS_MESSAGES = [
  "Inicijalizacija administrativnog sustava...",
  "Učitavanje baze članova i aktivnih mandata...",
  "Sinkronizacija sjednica i otvorenih glasovanja...",
  "Provjera arhivske građe i knjižnice...",
  "Priprema radnog prostora..."
]

export function BootSplash({ message, logoUrl }: BootSplashProps) {
  const [msgIndex, setMsgIndex] = useState(0)
  const [progress, setProgress] = useState(20)

  useEffect(() => {
    const msgInterval = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % STATUS_MESSAGES.length)
    }, 800)

    const progInterval = setInterval(() => {
      setProgress((prev) => (prev >= 95 ? 95 : prev + 15))
    }, 300)

    return () => {
      clearInterval(msgInterval)
      clearInterval(progInterval)
    }
  }, [])

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-between bg-gradient-to-b from-[#14171f] via-[#0d1017] to-[#07090d] text-white p-6 select-none overflow-hidden animate-in fade-in duration-300">
      {/* Background ambient lighting */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[350px] h-[350px] bg-blue-600/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Top spacing */}
      <div className="h-8" />

      {/* Main emblem and title */}
      <div className="relative flex flex-col items-center text-center max-w-md w-full px-4">
        {/* Emblem container with glowing aura */}
        <div className="relative mb-8">
          <div className="absolute inset-0 rounded-full bg-amber-500/20 blur-xl animate-pulse" />
          <div className="relative flex h-28 w-28 items-center justify-center rounded-full border-2 border-amber-500/40 bg-black/40 p-2 shadow-2xl backdrop-blur-md">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="HRD Logo"
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-full bg-amber-500/10 text-amber-400">
                <Shield className="h-12 w-12 stroke-[1.5]" />
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-amber-400/50 bg-[#14171f] text-amber-400 shadow-md">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
          </div>
        </div>

        {/* Institution title */}
        <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-amber-400/90 mb-2">
          Hrvatsko rodoslovno društvo
        </p>
        <h1 className="font-serif text-2xl md:text-3xl font-bold tracking-tight text-white mb-2 leading-snug">
          „Pavao Ritter Vitezović”
        </h1>
        <p className="text-xs text-muted-foreground/70 max-w-xs mb-8">
          Centralni informacijski i administrativni portal društva
        </p>

        {/* Regal gold progress bar */}
        <div className="w-full max-w-xs space-y-2.5">
          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-600 via-amber-400 to-amber-200 transition-all duration-300 ease-out shadow-[0_0_12px_rgba(245,158,11,0.5)]"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Changing status message */}
          <div className="h-6 flex items-center justify-center">
            <p className="text-xs text-amber-200/80 font-mono tracking-wide transition-all duration-300 animate-pulse text-center">
              {message || STATUS_MESSAGES[msgIndex]}
            </p>
          </div>
        </div>
      </div>

      {/* Bottom info */}
      <div className="flex flex-col items-center gap-1 text-[10px] text-muted-foreground/50 font-mono">
        <div className="flex items-center gap-2">
          <span>HRD-CMS</span>
          <span>•</span>
          <span className="text-amber-400/70 font-semibold">v1.7.4</span>
          <span>•</span>
          <span>Sigurna sesija</span>
        </div>
        <p>© {new Date().getFullYear()} HRD Pavao Ritter Vitezović</p>
      </div>
    </div>
  )
}
