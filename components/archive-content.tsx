"use client"

import { Search, Archive, Upload, Download, Filter, FileText, Image, Video, File, Eye, ChevronLeft, ChevronRight } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/contexts/auth-context"
import { useActivityLog } from "@/contexts/activity-log-context"

const documents = [
  {
    id: 1,
    title: "Popisni zapisi obitelji Horvat 1850-1900",
    type: "document",
    category: "Popisni zapisi",
    size: "2.4 MB",
    uploadDate: "02. listopada 2024.",
    uploadedBy: "Ivan Ivić",
    accessLevel: "restricted",
    tags: ["Horvat", "Popis", "19. stoljeće"]
  },
  {
    id: 2,
    title: "Fotografije migracije Vojvodine",
    type: "image",
    category: "Fotografije",
    size: "15.7 MB",
    uploadDate: "28. rujna 2024.",
    uploadedBy: "Sarah Miller",
    accessLevel: "public",
    tags: ["Vojvodina", "Migracija", "Fotografija"]
  },
  {
    id: 3,
    title: "Smjernice za očuvanje pomorskih zapisa",
    type: "document",
    category: "Smjernice",
    size: "1.2 MB",
    uploadDate: "25. rujna 2024.",
    uploadedBy: "Robert Kincaid",
    accessLevel: "members",
    tags: ["Pomorski", "Očuvanje", "Smjernice"]
  },
  {
    id: 4,
    title: "Intervjui rudarske zajednice Cornwall",
    type: "video",
    category: "Usmene povijesti",
    size: "245 MB",
    uploadDate: "20. rujna 2024.",
    uploadedBy: "Sarah Whitmore",
    accessLevel: "restricted",
    tags: ["Cornwall", "Rudarstvo", "Usmena povijest"]
  }
]

function TypeIcon({ type }: { type: string }) {
  const icons = {
    document: FileText,
    image: Image,
    video: Video,
    audio: File
  }
  const Icon = icons[type as keyof typeof icons] || File
  return <Icon className="h-5 w-5" />
}

function AccessBadge({ level }: { level: string }) {
  const variants: Record<string, string> = {
    public: "bg-green-100 text-green-700 border-green-200",
    members: "bg-blue-100 text-blue-700 border-blue-200",
    restricted: "bg-red-100 text-red-700 border-red-200"
  }

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${variants[level] || variants.members}`}>
      {level.toUpperCase()}
    </span>
  )
}

export function ArchiveContent() {
  const { user } = useAuth()
  const { addLog } = useActivityLog()

  const logAction = (action: string, doc: any) => {
    if (user) addLog({ userId: user.id.toString(), userName: user.name, userRole: user.role, action: `Arhiv - ${action}`, details: `${action}: ${doc.title}` })
  }

  return (
    <main className="flex-1 overflow-auto">
      {/* Top Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between px-8 py-4">
          {/* Search */}
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Pretraži arhiv po naslovu, oznakama ili uploader-u..."
              className="border-border bg-card pl-10"
            />
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-4">
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Filter
            </Button>
            <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              <Upload className="h-4 w-4" />
              Učitaj dokument
            </Button>
          </div>
        </div>
      </header>

      <div className="p-8">
        {/* Page Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h2 className="font-serif text-4xl font-bold">Digitalni arhiv</h2>
            <p className="mt-2 max-w-xl text-muted-foreground">
              Sigurno spremište za rodoslovne dokumente, fotografije i istraživačke materijale.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="rounded-lg border border-border bg-card p-4 text-center">
              <p className="text-2xl font-bold text-accent">18,502</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Ukupno dokumenata</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4 text-center">
              <p className="text-2xl font-bold text-accent">2.4 TB</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Iskorišten prostor</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4 text-center">
              <p className="text-2xl font-bold text-accent">1,284</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Aktivnih članova</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4 text-center">
              <p className="text-2xl font-bold text-accent">95%</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Digitalizacija</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Type Filter */}
              <div>
                <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  VRSTA DOKUMENTA
                </label>
                <Select defaultValue="all">
                  <SelectTrigger className="w-40 border-border bg-background">
                    <SelectValue placeholder="Sve vrste" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Sve vrste</SelectItem>
                    <SelectItem value="document">Dokumenti</SelectItem>
                    <SelectItem value="image">Slike</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                    <SelectItem value="audio">Audio</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Category Filter */}
              <div>
                <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  KATEGORIJA
                </label>
                <Select defaultValue="all">
                  <SelectTrigger className="w-40 border-border bg-background">
                    <SelectValue placeholder="Sve kategorije" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Sve kategorije</SelectItem>
                    <SelectItem value="census">Popisni zapisi</SelectItem>
                    <SelectItem value="photographs">Fotografije</SelectItem>
                    <SelectItem value="oral-histories">Usmene povijesti</SelectItem>
                    <SelectItem value="guidelines">Smjernice</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Access Filter */}
              <div>
                <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  RAZINA PRISTUPA
                </label>
                <Select defaultValue="all">
                  <SelectTrigger className="w-36 border-border bg-background">
                    <SelectValue placeholder="Sav pristup" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Sav pristup</SelectItem>
                    <SelectItem value="public">Javni</SelectItem>
                    <SelectItem value="members">Članovi</SelectItem>
                    <SelectItem value="restricted">Ograničen</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date Filter */}
              <div>
                <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  DATUM UČITAVANJA
                </label>
                <Select defaultValue="all">
                  <SelectTrigger className="w-36 border-border bg-background">
                    <SelectValue placeholder="Sve vrijeme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Sve vrijeme</SelectItem>
                    <SelectItem value="today">Danas</SelectItem>
                    <SelectItem value="week">Ovaj tjedan</SelectItem>
                    <SelectItem value="month">Ovaj mjesec</SelectItem>
                    <SelectItem value="year">Ova godina</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <Filter className="h-4 w-4" />
              Očisti filtere
            </button>
          </div>
        </div>

        {/* Documents Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {documents.map((document) => (
            <div key={document.id} className="rounded-xl border border-border bg-card p-6">
              <div className="mb-4 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                    <TypeIcon type={document.type} />
                  </div>
                  <div>
                    <AccessBadge level={document.accessLevel} />
                  </div>
                </div>
              </div>

              <h3 className="mb-2 font-semibold line-clamp-2">{document.title}</h3>

              <div className="mb-3 space-y-1 text-sm text-muted-foreground">
                <p>Kategorija: {document.category}</p>
                <p>Veličina: {document.size}</p>
                <p>Učitano: {document.uploadDate}</p>
                <p>Od: {document.uploadedBy}</p>
              </div>

              {/* Tags */}
              <div className="mb-4 flex flex-wrap gap-1">
                {document.tags.map((tag, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <Button variant="outline" size="sm" className="gap-2" onClick={() => logAction('Pregled', document)}>
                  <Eye className="h-4 w-4" />
                  Pregled
                </Button>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => logAction('Preuzimanje', document)}>
                  <Download className="h-4 w-4" />
                  Preuzmi
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        <div className="mt-8 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Prikazano <span className="font-medium text-foreground">1-12</span> od{" "}
            <span className="font-medium text-foreground">18,502</span> dokumenata
          </p>
          <div className="flex items-center gap-1">
            <button className="rounded p-2 hover:bg-secondary">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button className="h-8 w-8 rounded bg-primary text-sm font-medium text-primary-foreground">
              1
            </button>
            <button className="h-8 w-8 rounded text-sm hover:bg-secondary">2</button>
            <button className="h-8 w-8 rounded text-sm hover:bg-secondary">3</button>
            <span className="px-2 text-muted-foreground">...</span>
            <button className="h-8 w-8 rounded text-sm hover:bg-secondary">1,541</button>
            <button className="rounded p-2 hover:bg-secondary">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
