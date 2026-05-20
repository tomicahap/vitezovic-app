"use client"

import { useEffect, useState } from "react"
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import "leaflet-defaulticon-compatibility"
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css"
import { Lecture } from "@/contexts/lectures-context"
import { formatDateShort } from "@/lib/utils"

// Helper component to adjust map bounds to show all markers
function MapBoundsAdjuster({ locations }: { locations: [number, number][] }) {
  const map = useMap()
  
  useEffect(() => {
    if (locations.length > 0) {
      const bounds = L.latLngBounds(locations)
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 })
    }
  }, [locations, map])
  
  return null
}

const CROATIA_CITIES: Record<string, [number, number]> = {
  "Zagreb": [45.8150, 15.9819],
  "Split": [43.5081, 16.4402],
  "Rijeka": [45.3271, 14.4422],
  "Osijek": [45.5550, 18.6955],
  "Zadar": [44.1194, 15.2314],
  "Pula": [44.8683, 13.8481],
  "Slavonski Brod": [45.1631, 18.0116],
  "Karlovac": [45.4929, 15.5553],
  "Varaždin": [46.3044, 16.3378],
  "Šibenik": [43.7322, 15.8943],
  "Sisak": [45.4851, 16.3778],
  "Vinkovci": [45.2890, 18.8043],
  "Dubrovnik": [42.6507, 18.0944],
  "Velika Gorica": [45.7144, 16.0740],
  "Bjelovar": [45.8988, 16.8423],
  "Koprivnica": [46.1628, 16.8275],
  "Požega": [45.3403, 17.6853],
  "Đakovo": [45.3090, 18.4116],
  "Vukovar": [45.3435, 18.9998],
  "Čakovec": [46.3844, 16.4336],
  "Krapina": [46.1608, 15.8753],
  "Gospić": [44.5461, 15.3746],
  "Pazin": [45.2403, 13.9350],
  "Samobor": [45.8011, 15.7142],
  "Zaprešić": [45.8569, 15.8042],
  "Nova Gradiška": [45.2547, 17.3828],
  "Ogulin": [45.2678, 15.2281],
  "Petrinja": [45.4372, 16.2783],
  "Virovitica": [45.8319, 17.3839],
  "Križevci": [46.0272, 16.5433],
  "Kastav": [45.3761, 14.3486],
  "Opatija": [45.3376, 14.3052],
  "Knin": [44.0408, 16.1964],
  "Makarska": [43.2936, 17.0197]
}

interface LecturesMapProps {
  lectures: Lecture[]
  onSelectLecture: (lecture: Lecture) => void
}

export default function LecturesMap({ lectures, onSelectLecture }: LecturesMapProps) {
  const [extraCoords, setExtraCoords] = useState<Record<string, [number, number]>>({})
  const [failedLocations, setFailedLocations] = useState<Set<string>>(new Set())

  // We need to group lectures by location
  const locationsMap = new Map<string, Lecture[]>()

  lectures.forEach(l => {
    if (!l.location) return
    const locName = l.location.trim()
    if (!locationsMap.has(locName)) {
      locationsMap.set(locName, [])
    }
    locationsMap.get(locName)!.push(l)
  })

  // Geocoding logic
  useEffect(() => {
    const uniqueLocations = Array.from(locationsMap.keys())
    
    const geocode = async () => {
      let changed = false
      const updatedCoords = { ...extraCoords }
      const updatedFailed = new Set(failedLocations)

      for (const loc of uniqueLocations) {
        if (CROATIA_CITIES[loc] || updatedCoords[loc] || updatedFailed.has(loc)) continue

        const isDetailed = loc.includes(',') || loc.includes(' ') || /\d/.test(loc)
        
        if (isDetailed || !CROATIA_CITIES[loc]) {
          // Wait at the beginning of the loop to ensure gap between ANY attempt
          await new Promise(r => setTimeout(r, 1100))
          
          try {
            const query = encodeURIComponent(loc.toLowerCase().includes('hrvatska') ? loc : `${loc}, Hrvatska`)
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`, {
              headers: { 'User-Agent': 'GEDCOM-CMS/1.0 (contact: admin@example.com)' }
            })
            
            if (!response.ok) {
              console.warn(`Nominatim returned ${response.status} for ${loc}`)
              continue
            }

            const data = await response.json()
            
            if (data && data.length > 0) {
              updatedCoords[loc] = [parseFloat(data[0].lat), parseFloat(data[0].lon)]
              changed = true
            } else {
              updatedFailed.add(loc)
              changed = true
            }
          } catch (error) {
            console.error(`Geocoding error for: ${loc}`, error)
            // Wait extra on error
            await new Promise(r => setTimeout(r, 2000))
          }
        }
      }

      if (changed) {
        setExtraCoords(updatedCoords)
        setFailedLocations(updatedFailed)
      }
    }

    geocode()
  }, [lectures])

  // Get all active coordinates for fitting bounds
  const activeCoords: [number, number][] = Array.from(locationsMap.keys())
    .map(loc => {
      let c = extraCoords[loc] || CROATIA_CITIES[loc]
      if (!c) {
        const foundKey = Object.keys(CROATIA_CITIES).find(k => loc.toLowerCase().includes(k.toLowerCase()))
        if (foundKey) c = CROATIA_CITIES[foundKey]
      }
      return c
    })
    .filter((c): c is [number, number] => !!c)

  return (
    <div className="h-[600px] w-full rounded-2xl overflow-hidden border border-border shadow-sm relative z-0">
      <MapContainer 
        key="lectures-map-container"
        center={[44.4, 16.4]} 
        zoom={6.5} 
        style={{ height: "100%", width: "100%", zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapBoundsAdjuster locations={activeCoords} />

        {Array.from(locationsMap.entries()).map(([location, locLectures]) => {
          let coords = extraCoords[location] || CROATIA_CITIES[location]
          
          // Basic substring matching fallback
          if (!coords) {
            const foundKey = Object.keys(CROATIA_CITIES).find(k => location.toLowerCase().includes(k.toLowerCase()))
            if (foundKey) coords = CROATIA_CITIES[foundKey]
          }
          
          if (!coords) return null

          return (
            <Marker key={location} position={coords}>
              <Popup>
                <div className="p-1 min-w-[200px]">
                  <h4 className="font-bold mb-2 text-base border-b pb-1">{location}</h4>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {locLectures.map(l => (
                      <div 
                        key={l.id} 
                        className="text-xs p-2 hover:bg-secondary rounded cursor-pointer transition-colors"
                        onClick={() => onSelectLecture(l)}
                      >
                        <div className="font-medium text-foreground">{l.title}</div>
                        <div className="text-muted-foreground mt-0.5">
                          {formatDateShort(l.date)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
    </div>
  )
}
