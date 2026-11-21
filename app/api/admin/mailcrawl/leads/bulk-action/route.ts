import { NextRequest, NextResponse } from 'next/server'
import { requireMailcrawlAdmin } from '@/lib/mailcrawl/auth'
import { addOptOut, db, updateLead } from '@/lib/mailcrawl/db'
import { TrashService } from '@/lib/trash'
import { DatabaseService } from '@/lib/database'
import type { Lead } from '@/lib/mailcrawl/types'

export async function POST(req: NextRequest) {
  const auth = requireMailcrawlAdmin(req)
  if (!auth.ok) return auth.response

  try {
    const body = await req.json().catch(() => ({}))
    const { action, ids, reason } = body || {}

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ ok: false, error: 'Odaberite barem jedan zapis.' }, { status: 400 })
    }

    const cleanIds = Array.from(
      new Set(ids.map((x: any) => Number(x)).filter((x: number) => Number.isFinite(x) && x > 0))
    )

    if (cleanIds.length === 0) {
      return NextResponse.json({ ok: false, error: 'Nema valjanih ID-jeva za obradu.' }, { status: 400 })
    }

    let affected = 0

    if (action === 'delete') {
      for (const id of cleanIds) {
        const res = TrashService.trashMailcrawlLead(id, auth.actor)
        if (res.trashedId) affected++
      }
      return NextResponse.json({
        ok: true,
        action,
        affected,
        message: `Premješteno u smeće: ${affected} kontakata.`,
      })
    }

    if (action === 'reject') {
      for (const id of cleanIds) {
        const updated = updateLead(id, { status: 'rejected' })
        if (updated) affected++
      }
      return NextResponse.json({
        ok: true,
        action,
        affected,
        message: `Označeno kao odbijeno: ${affected} kontakata.`,
      })
    }

    if (action === 'reset_draft') {
      for (const id of cleanIds) {
        const updated = updateLead(id, { status: 'draft_ready' })
        if (updated) affected++
      }
      return NextResponse.json({
        ok: true,
        action,
        affected,
        message: `Vraćeno u status nacrta: ${affected} kontakata.`,
      })
    }

    if (action === 'opt_out') {
      for (const id of cleanIds) {
        const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(id) as Lead | undefined
        if (!lead) continue
        if (lead.email || lead.website || lead.oib) {
          addOptOut({
            email: lead.email,
            website: lead.website,
            oib: lead.oib,
            companyName: lead.name,
            reason: reason || 'Označeno kao Ne kontaktirati iz popisa kandidata',
          })
          affected++
        }
      }
      try {
        DatabaseService.insertLog({
          userId: auth.actor.id || 'system',
          userName: auth.actor.name || 'Administrator',
          userRole: auth.actor.role || 'admin',
          action: 'Dodavanje u listu odjava (Donacije)',
          details: `Administrator ${auth.actor.name} dodao je ${affected} subjekata na listu odjava (Ne kontaktirati).`,
          timestamp: new Date().toISOString(),
        })
      } catch {}

      return NextResponse.json({
        ok: true,
        action,
        affected,
        message: `Dodano na listu odjava (Ne kontaktirati): ${affected} subjekata.`,
      })
    }

    return NextResponse.json({ ok: false, error: 'Nepoznata skupna radnja.' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Greška pri skupnoj obradi.' }, { status: 500 })
  }
}
