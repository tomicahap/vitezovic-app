import { NextRequest, NextResponse } from 'next/server'
import { VaultDB, DatabaseService } from '@/lib/database'

export const dynamic = 'force-dynamic'

function checkAdmin(request: NextRequest): boolean {
  const authHeader = request.headers.get('Authorization') || ''
  const role = authHeader.replace('Bearer ', '').trim().toLowerCase()
  if (role === 'admin') return true

  // Fallback provjera ako je prosljeđeno kroz query ili header
  const roleHeader = request.headers.get('x-user-role')?.toLowerCase()
  if (roleHeader === 'admin') return true

  return false
}

// GET: Dohvati sve račune / stavke iz trezora
export async function GET(request: NextRequest) {
  if (!checkAdmin(request)) {
    return NextResponse.json({ error: 'Pristup odbijen. Samo administrator ima pristup Trezoru.' }, { status: 403 })
  }

  try {
    const items = VaultDB.getAll()
    return NextResponse.json({ items })
  } catch (error: any) {
    console.error('[Vault GET Error]:', error)
    return NextResponse.json({ error: error.message || 'Greška pri dohvaćanju stavki trezora.' }, { status: 500 })
  }
}

// POST: Dodaj novu platformu / stavku u trezor
export async function POST(request: NextRequest) {
  if (!checkAdmin(request)) {
    return NextResponse.json({ error: 'Pristup odbijen. Samo administrator ima pristup Trezoru.' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { title, username, password, url, category, notes } = body

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Naziv platforme ili servisa je obavezan.' }, { status: 400 })
    }

    const newId = VaultDB.insert({
      title: title.trim(),
      username: username ? username.trim() : '',
      password: password ? password.trim() : '',
      url: url ? url.trim() : '',
      category: category ? category.trim() : 'Općenito',
      notes: notes ? notes.trim() : '',
    })

    // Zabilježi u ActivityLog
    try {
      DatabaseService.insertLog({
        userId: 'admin',
        userName: 'Administrator',
        userRole: 'admin',
        action: 'Trezor - Dodavanje računa',
        details: `Dodan pristupni račun za platformu: ${title.trim()}`
      })
    } catch (e) {
      console.warn('Logging failed', e)
    }

    return NextResponse.json({ success: true, id: newId })
  } catch (error: any) {
    console.error('[Vault POST Error]:', error)
    return NextResponse.json({ error: error.message || 'Greška pri spremanju u trezor.' }, { status: 500 })
  }
}

// PUT: Ažuriraj postojeći unos u trezoru
export async function PUT(request: NextRequest) {
  if (!checkAdmin(request)) {
    return NextResponse.json({ error: 'Pristup odbijen. Samo administrator ima pristup Trezoru.' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { id, title, username, password, url, category, notes } = body

    if (!id) {
      return NextResponse.json({ error: 'Nedostaje ID zapisa.' }, { status: 400 })
    }

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Naziv platforme ili servisa je obavezan.' }, { status: 400 })
    }

    VaultDB.update(Number(id), {
      title: title.trim(),
      username: username ? username.trim() : '',
      password: password ? password.trim() : '',
      url: url ? url.trim() : '',
      category: category ? category.trim() : 'Općenito',
      notes: notes ? notes.trim() : '',
    })

    try {
      DatabaseService.insertLog({
        userId: 'admin',
        userName: 'Administrator',
        userRole: 'admin',
        action: 'Trezor - Izmjena računa',
        details: `Ažuriran pristupni račun za platformu: ${title.trim()}`
      })
    } catch (e) {
      console.warn('Logging failed', e)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Vault PUT Error]:', error)
    return NextResponse.json({ error: error.message || 'Greška pri ažuriranju zapisa.' }, { status: 500 })
  }
}

// DELETE: Obriši unos iz trezora
export async function DELETE(request: NextRequest) {
  if (!checkAdmin(request)) {
    return NextResponse.json({ error: 'Pristup odbijen. Samo administrator ima pristup Trezoru.' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Nedostaje ID zapisa za brisanje.' }, { status: 400 })
    }

    VaultDB.delete(Number(id))

    try {
      DatabaseService.insertLog({
        userId: 'admin',
        userName: 'Administrator',
        userRole: 'admin',
        action: 'Trezor - Brisanje računa',
        details: `Obrisan unos iz trezora (ID: ${id})`
      })
    } catch (e) {
      console.warn('Logging failed', e)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Vault DELETE Error]:', error)
    return NextResponse.json({ error: error.message || 'Greška pri brisanju zapisa.' }, { status: 500 })
  }
}
