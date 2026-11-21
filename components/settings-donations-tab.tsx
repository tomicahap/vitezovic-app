"use client"

import * as React from "react"
import { DonationsSettingsPanel } from "@/components/donations-settings-panel"

interface SettingsDonationsTabProps {
  onNotify: (msg: string) => void
  onError: (msg: string) => void
}

export function SettingsDonationsTab({ onNotify, onError }: SettingsDonationsTabProps) {
  return <DonationsSettingsPanel onNotify={onNotify} onError={onError} />
}
