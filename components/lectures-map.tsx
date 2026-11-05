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

const TYPE_LABELS: Record<string, { label: string; badgeCls: string }> = {
  lecture:   { label: "Predavanje",           badgeCls: "bg-purple-100 text-purple-800 border-purple-300" },
  gathering: { label: "Rodoslovno druženje", badgeCls: "bg-teal-100 text-teal-800 border-teal-300" },
  visit:     { label: "Gostovanje",           badgeCls: "bg-blue-100 text-blue-800 border-blue-300" },
  guest:     { label: "Gost predavač",        badgeCls: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  workshop:  { label: "Radionica",            badgeCls: "bg-orange-100 text-orange-800 border-orange-300" },
  excursion: { label: "Izlet",                badgeCls: "bg-sky-100 text-sky-800 border-sky-300" },
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

// Izrada prilagođene oznake (markera) s brojem događanja i nazivom grada
function createCityMarkerIcon(city: string, count: number) {
  const safeCity = city.replace(/</g, "&lt;").replace(/>/g, "&gt;")
  return L.divIcon({
    className: "custom-lecture-city-pin",
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);cursor:pointer;">
        <div style="display:flex;align-items:center;justify-content:center;min-width:32px;height:32px;padding:0 8px;border-radius:9999px;background:#1e40af;color:#ffffff;font-weight:700;font-size:13px;border:2.5px solid #ffffff;box-shadow:0 4px 10px rgba(0,0,0,0.28);">
          ${count}
        </div>
        <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:7px solid #1e40af;margin-top:-1px;"></div>
        <div style="margin-top:2px;padding:1px 6px;border-radius:4px;background:rgba(255,255,255,0.94);border:1px solid rgba(30,64,175,0.25);color:#0f172a;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.12);">
          ${safeCity}
        </div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    popupAnchor: [0, -38],
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
          // Prvo probaj samo prvi dio prije zareza (npr. naziv mjesta bez adrese dvorane)
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
      {/* Statusna traka i brzi pregled gradova na karti */}
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

        {cityGroups.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mr-1">
              Gradovi na karti:
            </span>
            {cityGroups.map((group) => (
              <button
                key={group.city}
                type="button"
                onClick={() => setFocusedCoords(group.coords)}
                className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50/70 px-2.5 py-1 text-xs font-medium text-blue-900 hover:bg-blue-100 transition-colors"
                title={`Kliknite za fokusiranje karte na ${group.city}`}
              >
                <MapPin className="h-3 w-3 text-blue-700" />
                <span>{group.city}</span>
                <span className="rounded-full bg-blue-700 px-1.5 py-0.2 text-[10px] font-bold text-white">
                  {group.lectures.length}
                </span>
              </button>
            ))}
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
              icon={createCityMarkerIcon(city, cityLectures.length)}
            >
              <Popup>
                <div className="p-1 min-w-[250px] max-w-[320px]">
                  <div className="flex items-center justify-between border-b pb-1.5 mb-2">
                    <h4 className="font-serif font-bold text-base text-slate-900 flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-blue-700 shrink-0" />
                      {city}
                    </h4>
                    <span className="rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-[11px] font-bold">
                      {cityLectures.length} {cityLectures.length === 1 ? "događaj" : "događaja"}
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                    {cityLectures.map((l) => {
                      const tMeta = TYPE_LABELS[l.type] ?? {
                        label: l.type,
                        badgeCls: "bg-slate-100 text-slate-700 border-slate-300",
                      }
                      return (
                        <div
                          key={l.id}
                          className="text-xs p-2.5 border border-slate-200/80 hover:border-blue-300 hover:bg-blue-50/50 rounded-lg cursor-pointer transition-colors space-y-1"
                          onClick={() => onSelectLecture(l)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className={`inline-block rounded-full border px-2 py-0.2 text-[10px] font-semibold ${tMeta.badgeCls}`}>
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
