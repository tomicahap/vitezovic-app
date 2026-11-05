"use client"

import { useEffect, useState, useMemo } from "react"
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import "leaflet-defaulticon-compatibility"
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css"
import { Lecture } from "@/contexts/lectures-context"
import { formatDateShort } from "@/lib/utils"
import { resolveLectureCityAndCoords } from "@/lib/croatia-cities"
import { MapPin, CheckCircle2, AlertCircle, Globe } from "lucide-react"

// Kazalo boja (usklađeno s legendom u kalendaru i oznakama vrsta predavanja)
export const LECTURE_TYPE_COLORS: Record<
  string,
  {
    label: string
    hex: string
    dotCls: string
    badgeCls: string
  }
> = {
  lecture: {
    label: "Predavanje",
    hex: "#9333ea", // purple-600 (bg-purple-500)
    dotCls: "bg-purple-500",
    badgeCls: "border-purple-400 bg-purple-50 text-purple-700",
  },
  gathering: {
    label: "Rodoslovno druženje",
    hex: "#0d9488", // teal-600 (bg-teal-500)
    dotCls: "bg-teal-500",
    badgeCls: "border-teal-400 bg-teal-50 text-teal-700",
  },
  visit: {
    label: "Gostovanje",
    hex: "#2563eb", // blue-600 (bg-blue-500)
    dotCls: "bg-blue-500",
    badgeCls: "border-blue-400 bg-blue-50 text-blue-700",
  },
  guest: {
    label: "Gost predavač",
    hex: "#059669", // emerald-600 (bg-emerald-500)
    dotCls: "bg-emerald-500",
    badgeCls: "border-emerald-400 bg-emerald-50 text-emerald-700",
  },
  workshop: {
    label: "Radionica",
    hex: "#ea580c", // orange-600 (bg-orange-500)
    dotCls: "bg-orange-500",
    badgeCls: "border-orange-400 bg-orange-50 text-orange-700",
  },
  excursion: {
    label: "Izlet",
    hex: "#0284c7", // sky-600 (bg-sky-500)
    dotCls: "bg-sky-500",
    badgeCls: "border-sky-400 bg-sky-50 text-sky-700",
  },
}

function getTypeStyle(type?: string) {
  return (
    LECTURE_TYPE_COLORS[type || "lecture"] || {
      label: type || "Događaj",
      hex: "#9333ea",
      dotCls: "bg-purple-500",
      badgeCls: "border-purple-400 bg-purple-50 text-purple-700",
    }
  )
}

// Pomoćna komponenta za automatsko prilagođavanje okvira karte svim gradovima ili fokusiranom gradu
function MapBoundsAdjuster({
  locations,
  focusedCoords,
}: {
  locations: [number, number][]
  focusedCoords: [number, number] | null
}) {
  const map = useMap()

  useEffect(() => {
    if (focusedCoords) {
      map.flyTo(focusedCoords, 12, { duration: 0.8 })
      return
    }
    if (locations.length === 1) {
      map.setView(locations[0], 10)
    } else if (locations.length > 1) {
      const bounds = L.latLngBounds(locations)
      map.fitBounds(bounds, { padding: [55, 55], maxZoom: 12 })
    }
  }, [locations, focusedCoords, map])

  return null
}

// Izrada prilagođene oznake (markera) na karti obojene prema vrsti predavanja iz kazala boja
function createCityMarkerIcon(city: string, cityLectures: Lecture[]) {
  const safeCity = city.replace(/</g, "&lt;").replace(/>/g, "&gt;")
  const count = cityLectures.length

  // Jedinstvene vrste događanja u ovom gradu
  const uniqueTypes = Array.from(new Set(cityLectures.map((l) => l.type || "lecture")))
  const primaryColor = getTypeStyle(uniqueTypes[0]).hex

  // Ako grad ima više različitih vrsta događanja, napravimo konusni (ili višedijelni) prikaz boja + točkice vrsta
  let bgStyle = `background:${primaryColor};`
  if (uniqueTypes.length > 1) {
    const step = Math.round(100 / uniqueTypes.length)
    const stops = uniqueTypes
      .map((t, idx) => {
        const col = getTypeStyle(t).hex
        const start = idx * step
        const end = idx === uniqueTypes.length - 1 ? 100 : (idx + 1) * step
        return `${col} ${start}% ${end}%`
      })
      .join(", ")
    bgStyle = `background:conic-gradient(${stops});`
  }

  // Male obojene točkice uz naziv grada ako ima više vrsta
  const typeDotsHtml = uniqueTypes
    .map(
      (t) =>
        `<span style="display:inline-block;width:7px;height:7px;border-radius:9999px;background:${getTypeStyle(t).hex};"></span>`
    )
    .join("")

  return L.divIcon({
    className: "custom-lecture-city-pin",
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);cursor:pointer;">
        <div style="display:flex;align-items:center;justify-content:center;min-width:34px;height:34px;padding:0 9px;border-radius:9999px;${bgStyle}color:#ffffff;font-weight:800;font-size:13px;border:2.5px solid #ffffff;box-shadow:0 4px 12px rgba(0,0,0,0.32);text-shadow:0 1px 2px rgba(0,0,0,0.45);">
          ${count}
        </div>
        <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid ${primaryColor};margin-top:-1px;"></div>
        <div style="margin-top:2px;display:inline-flex;align-items:center;gap:4px;padding:1.5px 7px;border-radius:6px;background:rgba(255,255,255,0.96);border:1.5px solid ${primaryColor};color:#0f172a;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 5px rgba(0,0,0,0.15);">
          <span style="display:inline-flex;align-items:center;gap:2px;">${typeDotsHtml}</span>
          <span>${safeCity}</span>
        </div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    popupAnchor: [0, -40],
  })
}

interface LecturesMapProps {
  lectures: Lecture[]
  onSelectLecture: (lecture: Lecture) => void
}

export default function LecturesMap({ lectures, onSelectLecture }: LecturesMapProps) {
  const [extraCoords, setExtraCoords] = useState<Record<string, [number, number]>>({})
  const [failedLocations, setFailedLocations] = useState<Set<string>>(new Set())
  const [focusedCoords, setFocusedCoords] = useState<[number, number] | null>(null)

  // Razvrstaj sva predavanja na:
  // 1) Prepoznate gradove s koordinatama (grupirano po gradu)
  // 2) Nepoznate gradove koje treba geokodirati
  // 3) Online ili potpuno bez lokacije
  const { cityGroups, pendingGeocodeCities, unmappedLectures, onlineLectures } = useMemo(() => {
    const groups = new Map<string, { city: string; coords: [number, number]; lectures: Lecture[] }>()
    const pendingCities = new Map<string, Lecture[]>()
    const unmapped: Lecture[] = []
    const online: Lecture[] = []

    for (const l of lectures) {
      const resolved = resolveLectureCityAndCoords(l)
      if (resolved.isOnline) {
        online.push(l)
        continue
      }

      const cityKey = resolved.city
      const coords = resolved.coords || (cityKey ? extraCoords[cityKey] : null)

      if (cityKey && coords) {
        if (!groups.has(cityKey)) {
          groups.set(cityKey, { city: cityKey, coords, lectures: [] })
        }
        groups.get(cityKey)!.lectures.push(l)
      } else if (cityKey && !failedLocations.has(cityKey)) {
        if (!pendingCities.has(cityKey)) {
          pendingCities.set(cityKey, [])
        }
        pendingCities.get(cityKey)!.push(l)
      } else {
        unmapped.push(l)
      }
    }

    return {
      cityGroups: Array.from(groups.values()).sort((a, b) => b.lectures.length - a.lectures.length),
      pendingGeocodeCities: Array.from(pendingCities.keys()),
      unmappedLectures: unmapped,
      onlineLectures: online,
    }
  }, [lectures, extraCoords, failedLocations])

  // Fallback geokodiranje samo za ručno upisana mjesta izvan ugrađenog popisa
  useEffect(() => {
    if (pendingGeocodeCities.length === 0) return
    let cancelled = false

    const geocodeRemaining = async () => {
      const updatedCoords: Record<string, [number, number]> = {}
      const newlyFailed: string[] = []

      for (const place of pendingGeocodeCities) {
        if (cancelled) return
        try {
          const cleanPlace = place.split(",")[0].trim()
          const query = encodeURIComponent(
            cleanPlace.toLowerCase().includes("hrvatska") ? cleanPlace : `${cleanPlace}, Hrvatska`
          )
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&accept-language=hr&q=${query}&limit=1`
          )
          if (res.ok) {
            const data = await res.json()
            if (Array.isArray(data) && data.length > 0) {
              updatedCoords[place] = [parseFloat(data[0].lat), parseFloat(data[0].lon)]
              continue
            }
          }
          newlyFailed.push(place)
        } catch {
          newlyFailed.push(place)
        }
        await new Promise((r) => setTimeout(r, 900))
      }

      if (!cancelled) {
        if (Object.keys(updatedCoords).length > 0) {
          setExtraCoords((prev) => ({ ...prev, ...updatedCoords }))
        }
        if (newlyFailed.length > 0) {
          setFailedLocations((prev) => {
            const next = new Set(prev)
            newlyFailed.forEach((f) => next.add(f))
            return next
          })
        }
      }
    }

    geocodeRemaining()
    return () => {
      cancelled = true
    }
  }, [pendingGeocodeCities])

  const activeCoords = useMemo(() => cityGroups.map((g) => g.coords), [cityGroups])
  const mappedCount = useMemo(
    () => cityGroups.reduce((sum, g) => sum + g.lectures.length, 0),
    [cityGroups]
  )

  return (
    <div className="space-y-4">
      {/* Statusna traka, Kazalo boja i brzi pregled gradova na karti */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>
              Na karti je prikazano{" "}
              <strong className="font-bold text-foreground">
                {mappedCount} od {lectures.length}
              </strong>{" "}
              predavanja, gostovanja i druženja u{" "}
              <strong className="font-bold text-foreground">{cityGroups.length}</strong>{" "}
              {cityGroups.length === 1 ? "gradu/mjestu" : "gradova/mjesta"}.
            </span>
          </div>
          {focusedCoords && (
            <button
              type="button"
              onClick={() => setFocusedCoords(null)}
              className="text-xs font-semibold text-blue-600 hover:underline"
            >
              Prikaži cijelu kartu
            </button>
          )}
        </div>

        {/* Kazalo boja vrsta događanja na karti */}
        <div className="flex flex-wrap items-center gap-3 border-t border-border/60 pt-2.5 text-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Kazalo boja na karti:
          </span>
          {Object.entries(LECTURE_TYPE_COLORS).map(([key, meta]) => (
            <span key={key} className="inline-flex items-center gap-1.5 font-medium text-foreground">
              <span className={`h-2.5 w-2.5 rounded-full ${meta.dotCls}`} />
              <span>{meta.label}</span>
            </span>
          ))}
        </div>

        {cityGroups.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-1">
              Gradovi na karti:
            </span>
            {cityGroups.map((group) => {
              const uniqueTypes = Array.from(new Set(group.lectures.map((l) => l.type || "lecture")))
              const primaryStyle = getTypeStyle(uniqueTypes[0])
              return (
                <button
                  key={group.city}
                  type="button"
                  onClick={() => setFocusedCoords(group.coords)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all hover:opacity-90 ${primaryStyle.badgeCls}`}
                  title={`Kliknite za fokusiranje karte na ${group.city}`}
                >
                  <span className="flex items-center gap-0.5">
                    {uniqueTypes.map((t) => (
                      <span
                        key={t}
                        className={`h-2 w-2 rounded-full ${getTypeStyle(t).dotCls}`}
                      />
                    ))}
                  </span>
                  <span className="font-semibold">{group.city}</span>
                  <span
                    className="rounded-full px-1.5 py-0.2 text-[10px] font-bold text-white"
                    style={{ backgroundColor: primaryStyle.hex }}
                  >
                    {group.lectures.length}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Interaktivna karta */}
      <div className="h-[600px] w-full rounded-2xl overflow-hidden border border-border shadow-sm relative z-0">
        <MapContainer
          key="lectures-map-container"
          center={[45.1, 16.3]}
          zoom={7}
          style={{ height: "100%", width: "100%", zIndex: 0 }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapBoundsAdjuster locations={activeCoords} focusedCoords={focusedCoords} />

          {cityGroups.map(({ city, coords, lectures: cityLectures }) => (
            <Marker
              key={city}
              position={coords}
              icon={createCityMarkerIcon(city, cityLectures)}
            >
              <Popup>
                <div className="p-1 min-w-[250px] max-w-[320px]">
                  <div className="flex items-center justify-between border-b pb-1.5 mb-2">
                    <h4 className="font-serif font-bold text-base text-slate-900 flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-slate-700 shrink-0" />
                      {city}
                    </h4>
                    <span className="rounded-full bg-slate-100 text-slate-800 px-2 py-0.5 text-[11px] font-bold">
                      {cityLectures.length} {cityLectures.length === 1 ? "događaj" : "događaja"}
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                    {cityLectures.map((l) => {
                      const tMeta = getTypeStyle(l.type)
                      return (
                        <div
                          key={l.id}
                          className="text-xs p-2.5 border border-slate-200/80 hover:border-slate-400 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors space-y-1"
                          style={{ borderLeftWidth: "4px", borderLeftColor: tMeta.hex }}
                          onClick={() => onSelectLecture(l)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.2 text-[10px] font-semibold ${tMeta.badgeCls}`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${tMeta.dotCls}`} />
                              {tMeta.label}
                            </span>
                            <span className="text-[11px] font-mono text-slate-500">
                              {formatDateShort(l.date)}
                            </span>
                          </div>
                          <div className="font-semibold text-slate-900 leading-snug">
                            {l.title}
                          </div>
                          {l.location && l.location.toLowerCase() !== city.toLowerCase() && (
                            <div className="text-[11px] text-slate-600 flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                              <span className="truncate">{l.location}</span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Popis predavanja koja nemaju upisan grad (ako postoje) ili su Online */}
      {(unmappedLectures.length > 0 || onlineLectures.length > 0) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-2.5">
          {unmappedLectures.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                <span>
                  Događanja kojima nije odabran grad ({unmappedLectures.length}) – kliknite za odabir grada:
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {unmappedLectures.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => onSelectLecture(l)}
                    className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-amber-100/60 transition-colors shadow-2xs"
                  >
                    <span className={`h-2 w-2 rounded-full ${getTypeStyle(l.type).dotCls}`} />
                    <span className="font-semibold">{l.title}</span>
                    <span className="text-muted-foreground">({formatDateShort(l.date)})</span>
                    <span className="text-blue-600 font-bold">+ Odaberi grad</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {onlineLectures.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <Globe className="h-4 w-4 text-blue-600 shrink-0" />
                <span>Online predavanja i druženja ({onlineLectures.length}):</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {onlineLectures.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => onSelectLecture(l)}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    <span className={`h-2 w-2 rounded-full ${getTypeStyle(l.type).dotCls}`} />
                    <span className="font-medium">{l.title}</span>
                    <span className="text-muted-foreground">({formatDateShort(l.date)})</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
