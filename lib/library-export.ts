import type { Book } from "@/contexts/library-context"
import { formatDateDMY } from "./utils"

export function buildLibraryFilterDescription(params: {
  search?: string
  loanedOnly?: boolean
  rightsFilter?: string
}): string {
  const parts: string[] = []
  if (params.loanedOnly) {
    parts.push("Posuđene knjige")
  }
  switch (params.rightsFilter) {
    case "with":
      parts.push("S dozvolom za posudbu")
      break
    case "without":
      parts.push("Bez dozvole")
      break
    case "scanned":
      parts.push("Skenirano")
      break
    case "digitized":
      parts.push("Digitalizirano")
      break
  }
  const cleanSearch = String(params.search || "").trim()
  if (cleanSearch) {
    parts.push(`Pretraga: „${cleanSearch}”`)
  }
  return parts.length > 0 ? parts.join(" • ") : "Cijeli katalog knjiga"
}

export function sortBooksForExport(books: Book[]): Book[] {
  return [...books].sort((a, b) => {
    const numA = typeof a.broj === "number" && !Number.isNaN(a.broj) ? a.broj : Number.MAX_SAFE_INTEGER
    const numB = typeof b.broj === "number" && !Number.isNaN(b.broj) ? b.broj : Number.MAX_SAFE_INTEGER
    if (numA !== numB) return numA - numB
    return Number(a.id || 0) - Number(b.id || 0)
  })
}

export function buildLibraryBooksExportRows(books: Book[]): Record<string, string | number>[] {
  return sortBooksForExport(books).map((b) => {
    const isLoaned = Boolean(b.loan_member_name && String(b.loan_member_name).trim())
    const attachmentsCount = Array.isArray(b.attachments) ? b.attachments.length : 0

    return {
      "Br.": b.broj ?? "",
      "Naslov": b.naslov || "",
      "Podnaslov": b.podnaslov || "",
      "Autor(i)": b.autor || "",
      "Izdavač": b.izdavac || "",
      "Mjesto izdanja": b.mjesto || "",
      "Godina": b.godina || "",
      "ISBN": b.isbn || "",
      "Uvez": b.uvez || "",
      "Stranice": b.stranice ?? "",
      "Jezik": b.jezik || "",
      "Signatura": b.signatura || "",
      "Polica": b.polica || "",
      "Status posudbe": isLoaned ? "Posuđeno" : "Dostupno",
      "Posuditelj": b.loan_member_name || "",
      "Datum posudbe": b.loan_date ? formatDateDMY(b.loan_date, "") : "",
      "Rok povrata": b.loan_return_date ? formatDateDMY(b.loan_return_date, "") : "",
      "Napomena posudbe": b.loan_notes || "",
      "Kontaktiran autor/izdavač": b.rights_contacted === 1 ? "Da" : "Ne",
      "Datum kontakta": b.rights_contact_date ? formatDateDMY(b.rights_contact_date, "") : "",
      "Odgovor zaprimljen": b.rights_responded === 1 ? "Da" : "Ne",
      "Datum odgovora": b.rights_response_date ? formatDateDMY(b.rights_response_date, "") : "",
      "Dozvola za posudbu": b.rights_consent === 1 ? "Da" : "Ne",
      "Skenirano": b.is_scanned === 1 ? "Da" : "Ne",
      "Digitalizirano": b.is_digitized === 1 ? "Da" : "Ne",
      "Broj priloga": attachmentsCount,
      "Napomena": b.napomena || "",
    }
  })
}

export function buildLibraryExportFileName(ext: "xlsx" | "csv" | "pdf", isFiltered: boolean): string {
  const todayIso = new Date().toISOString().slice(0, 10)
  return `HRD_Knjiznica_Knjige_${todayIso}${isFiltered ? "_filtrirano" : ""}.${ext}`
}

export async function exportLibraryBooksToExcel(books: Book[], isFiltered: boolean): Promise<string> {
  const XLSX = await import("xlsx")
  const rows = buildLibraryBooksExportRows(books)
  const worksheet = XLSX.utils.json_to_sheet(rows)

  worksheet["!cols"] = [
    { wch: 7 },  // Br.
    { wch: 38 }, // Naslov
    { wch: 28 }, // Podnaslov
    { wch: 26 }, // Autor(i)
    { wch: 24 }, // Izdavač
    { wch: 16 }, // Mjesto izdanja
    { wch: 9 },  // Godina
    { wch: 18 }, // ISBN
    { wch: 12 }, // Uvez
    { wch: 10 }, // Stranice
    { wch: 12 }, // Jezik
    { wch: 14 }, // Signatura
    { wch: 12 }, // Polica
    { wch: 14 }, // Status posudbe
    { wch: 22 }, // Posuditelj
    { wch: 14 }, // Datum posudbe
    { wch: 14 }, // Rok povrata
    { wch: 24 }, // Napomena posudbe
    { wch: 14 }, // Kontaktiran
    { wch: 14 }, // Datum kontakta
    { wch: 14 }, // Odgovor
    { wch: 14 }, // Datum odgovora
    { wch: 14 }, // Dozvola
    { wch: 11 }, // Skenirano
    { wch: 13 }, // Digitalizirano
    { wch: 12 }, // Broj priloga
    { wch: 36 }, // Napomena
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Knjige")

  const fileName = buildLibraryExportFileName("xlsx", isFiltered)
  XLSX.writeFile(workbook, fileName)
  return fileName
}

function escapeCsvCell(val: unknown): string {
  const str = String(val ?? "")
  return `"${str.replace(/"/g, '""')}"`
}

export function exportLibraryBooksToCsv(books: Book[], isFiltered: boolean): string {
  const rows = buildLibraryBooksExportRows(books)
  const headers = rows.length > 0 ? Object.keys(rows[0]) : []
  const csvLines = [
    headers.map(escapeCsvCell).join(";"),
    ...rows.map((row) => headers.map((h) => escapeCsvCell(row[h])).join(";")),
  ]
  const csvContent = "\uFEFF" + csvLines.join("\r\n")

  const fileName = buildLibraryExportFileName("csv", isFiltered)
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  return fileName
}
