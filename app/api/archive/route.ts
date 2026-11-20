import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService, getAppDb } from '@/lib/database'
import { extractActor } from '@/lib/trash'
import { parseAccessRights } from '@/lib/inquiry-permissions'
import { MemberService, isAdminRecord } from '@/src/services/member-service'
import { inspectMemberDate } from '@/lib/date-validation'
import { formatDateDMY } from '@/lib/utils'
import { getArchiveResultLabel } from '@/lib/archive-constants'

export const dynamic = 'force-dynamic'

function resolveArchivePermissions(request: NextRequest, body?: any) {
  const actor = extractActor(request, body)
  const roleLower = (actor.role || '').trim().toLowerCase()
  const db = getAppDb()

  const numericActorId = Number(actor.id)
  const emailLower = (actor.email || '').trim().toLowerCase()

  let actorMember: any = null
  if (roleLower !== 'admin') {
    if (Number.isFinite(numericActorId) && numericActorId > 0) {
      actorMember = db
        .prepare('SELECT id, name, email, role, access_rights FROM members WHERE id = ? LIMIT 1')
        .get(numericActorId)
    }
    if (!actorMember && emailLower) {
      actorMember = db
        .prepare('SELECT id, name, email, role, access_rights FROM members WHERE LOWER(TRIM(email)) = ? LIMIT 1')
        .get(emailLower)
    }
  }

  let canView = false
  let canEdit = false
  if (roleLower === 'admin' || roleLower === 'moderator') {
    canView = true
    canEdit = true
  } else if (actorMember) {
    const ar = parseAccessRights(actorMember.access_rights)
    canEdit = Boolean(ar?.archive?.edit === true)
    canView = Boolean(ar?.archive?.view === true || canEdit)
  }

  const actorName =
    roleLower === 'admin'
      ? (db.prepare('SELECT adminName FROM settings WHERE id = 1').get() as any)?.adminName?.trim() ||
        actor.name ||
        'Administrator'
      : actorMember?.name || actor.name || 'Korisnik'

  return { actor, actorName, roleLower, canView, canEdit }
}

export async function GET(request: NextRequest) {
  try {
    const { canView, canEdit } = resolveArchivePermissions(request)
    if (!canView) {
      return NextResponse.json(
        { error: 'Nemate ovlast za pregled modula Arhiv.' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const memberIdParam = searchParams.get('memberId')

    if (memberIdParam !== null) {
      const memberId = Number(memberIdParam)
      if (!Number.isFinite(memberId) || memberId <= 0) {
        return NextResponse.json({ error: 'Neispravan identifikator člana.' }, { status: 400 })
      }
      const memberService = new MemberService()
      const member = await memberService.getMember(memberId)
      if (!member) {
        return NextResponse.json({ error: 'Član nije pronađen u registru.' }, { status: 404 })
      }

      const nameParts = String(member.name || '').trim().split(/\s+/).filter(Boolean)
      const firstName = nameParts[0] || ''
      const lastName = nameParts.slice(1).join(' ')
      const rawBirth = String(member.birthDate || '').trim()
      const displayBirthDate = /^\d{4}$/.test(rawBirth)
        ? rawBirth
        : formatDateDMY(rawBirth, rawBirth)

      return NextResponse.json(
        {
          success: true,
          canEdit,
          member: {
            memberId: Number(member.id),
            name: String(member.name || ''),
            firstName,
            lastName,
            maidenName: String(member.maidenName || ''),
            oib: String(member.oib || ''),
            birthDate: displayBirthDate,
            birthPlace: String(member.birthPlace || ''),
            birthCountry: String(member.birthCountry || ''),
            email: String(member.email || ''),
            phone: String(member.phone || ''),
            landlinePhone: String(member.landlinePhone || ''),
            address: String(member.address || ''),
            deceased: Boolean(member.deceased),
            deathDate: member.deathDate ? formatDateDMY(member.deathDate, String(member.deathDate)) : '',
            doNotContact: Boolean(member.doNotContact),
            doNotContactDate: member.doNotContactDate
              ? formatDateDMY(member.doNotContactDate, String(member.doNotContactDate))
              : '',
            doNotContactNote: String(member.doNotContactNote || ''),
          },
        },
        { headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const rows = DatabaseService.getArchiveMembersList()
    const items = rows
      .map((r: any) => ({
        memberId: Number(r.memberId),
        name: String(r.name || ''),
        email: String(r.email || ''),
        phone: String(r.phone || ''),
        landlinePhone: String(r.landlinePhone || ''),
        address: String(r.address || ''),
        deceased: r.deceased === 1 || r.deceased === true,
        deathDate: String(r.deathDate || ''),
        doNotContact: r.doNotContact === 1 || r.doNotContact === true,
        doNotContactDate: r.doNotContactDate ? formatDateDMY(r.doNotContactDate, String(r.doNotContactDate)) : '',
        doNotContactNote: String(r.doNotContactNote || ''),
        contacted: r.contacted === 1 || r.contacted === true,
        contactedAt: r.contactedAt ? formatDateDMY(r.contactedAt, String(r.contactedAt)) : '',
        contactResult: String(r.contactResult || ''),
        note: String(r.note || ''),
        updatedByName: String(r.updatedByName || ''),
        updatedAt: String(r.updatedAt || ''),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'hr'))

    return NextResponse.json(
      { success: true, items, canEdit },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error: any) {
    console.error('[Archive GET Error]:', error)
    return NextResponse.json(
      { error: error?.message || 'Greška pri učitavanju arhive članova.' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { actor, actorName, roleLower, canEdit } = resolveArchivePermissions(request, body)

    if (!canEdit) {
      return NextResponse.json(
        { error: 'Nemate pravo uređivanja evidencije u modulu Arhiv.' },
        { status: 403 }
      )
    }

    const memberId = Number(body?.memberId)
    if (!Number.isFinite(memberId) || memberId <= 0) {
      return NextResponse.json({ error: 'Neispravan identifikator člana.' }, { status: 400 })
    }

    const db = getAppDb()
    const memberRow = db
      .prepare('SELECT id, name, email, role, COALESCE(do_not_contact, 0) AS doNotContact FROM members WHERE id = ? LIMIT 1')
      .get(memberId) as any

    if (!memberRow || isAdminRecord(memberRow)) {
      return NextResponse.json({ error: 'Član nije pronađen u registru.' }, { status: 404 })
    }

    const contacted = Boolean(body?.contacted)
    if (contacted && (memberRow.doNotContact === 1 || memberRow.doNotContact === true)) {
      const existingArchive = db
        .prepare('SELECT contacted FROM archive_member_contacts WHERE member_id = ? LIMIT 1')
        .get(memberId) as any
      if (!existingArchive || existingArchive.contacted !== 1) {
        return NextResponse.json(
          { error: 'Član je na izričitu napomenu zatražio da ga se ne kontaktira. Označavanje kontakta nije dopušteno.' },
          { status: 403 }
        )
      }
    }
    const rawDate = String(body?.contactedAt || '').trim()
    let normalizedDate = ''

    if (rawDate) {
      const inspected = inspectMemberDate(rawDate)
      if (!inspected.isoDate) {
        return NextResponse.json(
          { error: 'Datum kontakta nije ispravan. Unesite datum u formatu DD/MM/YYYY.' },
          { status: 400 }
        )
      }
      normalizedDate = formatDateDMY(inspected.isoDate, rawDate)
    }

    const contactResult = String(body?.contactResult || '').trim()
    const note = String(body?.note || '').trim()

    const updated = DatabaseService.upsertArchiveMemberContact({
      memberId,
      contacted,
      contactedAt: normalizedDate,
      contactResult,
      note,
      updatedById: String(actor.id || ''),
      updatedByName: actorName,
    })

    try {
      const resultLabel = contactResult ? getArchiveResultLabel(contactResult) : ''
      const notePreview = note ? ` | Napomena: "${note.slice(0, 80)}${note.length > 80 ? '…' : ''}"` : ''
      DatabaseService.insertLog({
        userId: String(actor.id || 'system'),
        userName: actorName,
        userRole: roleLower || 'member',
        action: 'Ažuriranje arhiva',
        details: `${actorName} ažurirao/la je arhivsku evidenciju za člana ${memberRow.name} (Kontaktiran: ${contacted ? 'Da' : 'Ne'}${normalizedDate ? `, datum: ${normalizedDate}` : ''}${resultLabel ? `, rezultat: ${resultLabel}` : ''}${notePreview})`,
        timestamp: new Date().toISOString(),
      })
    } catch (logErr) {
      console.warn('[Archive PATCH] Log warning:', logErr)
    }

    return NextResponse.json({ success: true, item: updated })
  } catch (error: any) {
    console.error('[Archive PATCH Error]:', error)
    return NextResponse.json(
      { error: error?.message || 'Greška pri spremanju arhivskog zapisa.' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { actor, actorName, roleLower, canEdit } = resolveArchivePermissions(request, body)

    if (!canEdit) {
      return NextResponse.json(
        { error: 'Nemate pravo uređivanja podataka člana u modulu Arhiv.' },
        { status: 403 }
      )
    }

    const memberId = Number(body?.memberId)
    if (!Number.isFinite(memberId) || memberId <= 0) {
      return NextResponse.json({ error: 'Neispravan identifikator člana.' }, { status: 400 })
    }

    const memberService = new MemberService()
    const existing = await memberService.getMember(memberId)
    if (!existing) {
      return NextResponse.json({ error: 'Član nije pronađen u registru.' }, { status: 404 })
    }

    const firstName = String(body?.firstName ?? '').trim()
    const lastName = String(body?.lastName ?? '').trim()
    const combinedName = [firstName, lastName].filter(Boolean).join(' ').trim()
    if (!combinedName) {
      return NextResponse.json(
        { error: 'Unesite ime i prezime člana.' },
        { status: 400 }
      )
    }

    const rawBirthDate = String(body?.birthDate ?? '').trim()
    let validBirthDate = ''
    if (rawBirthDate) {
      if (/^\d{4}$/.test(rawBirthDate) && Number(rawBirthDate) >= 1900 && Number(rawBirthDate) <= 2100) {
        validBirthDate = rawBirthDate
      } else {
        const inspected = inspectMemberDate(rawBirthDate)
        if (!inspected.isoDate) {
          return NextResponse.json(
            { error: 'Datum rođenja nije ispravan. Unesite datum (DD/MM/YYYY) ili četveroznamenkastu godinu.' },
            { status: 400 }
          )
        }
        validBirthDate = inspected.isoDate
      }
    }

    const nextEmail = String(body?.email ?? '').trim()
    const existingEmail = String(existing.email || '').trim()
    const db = getAppDb()
    if (nextEmail.toLowerCase() !== existingEmail.toLowerCase()) {
      const conflict = db
        .prepare('SELECT id, name FROM members WHERE LOWER(TRIM(COALESCE(email, ""))) = LOWER(TRIM(?)) AND id != ? LIMIT 1')
        .get(nextEmail, memberId) as any
      if (conflict) {
        return NextResponse.json(
          {
            error: nextEmail
              ? `E-mail adresa "${nextEmail}" već je dodijeljena drugom članu (${conflict.name}).`
              : 'Drugi zapis već ima praznu e-mail adresu. Unesite valjani e-mail ili zadržite postojeći.',
          },
          { status: 409 }
        )
      }
    }

    const maidenName = String(body?.maidenName ?? '').trim()
    const oib = String(body?.oib ?? '').trim()
    const birthPlace = String(body?.birthPlace ?? '').trim()
    const birthCountry = String(body?.birthCountry ?? '').trim()
    const phone = String(body?.phone ?? '').trim()
    const landlinePhone = String(body?.landlinePhone ?? '').trim()
    const address = String(body?.address ?? '').trim()

    await memberService.updateMember(memberId, {
      name: combinedName,
      maidenName,
      oib,
      birthDate: validBirthDate,
      birthPlace,
      birthCountry,
      email: nextEmail,
      phone,
      landlinePhone,
      address,
    })

    const changedLabels: string[] = []
    if (combinedName !== String(existing.name || '').trim()) changedLabels.push('Ime i prezime')
    if (maidenName !== String(existing.maidenName || '').trim()) changedLabels.push('Djevojačko prezime')
    if (oib !== String(existing.oib || '').trim()) changedLabels.push('OIB')
    if (validBirthDate !== String(existing.birthDate || '').trim()) changedLabels.push('Datum rođenja')
    if (birthPlace !== String(existing.birthPlace || '').trim()) changedLabels.push('Mjesto rođenja')
    if (birthCountry !== String(existing.birthCountry || '').trim()) changedLabels.push('Zemlja rođenja')
    if (nextEmail !== existingEmail) changedLabels.push('E-mail')
    if (phone !== String(existing.phone || '').trim()) changedLabels.push('Mobitel')
    if (landlinePhone !== String(existing.landlinePhone || '').trim()) changedLabels.push('Fiksni telefon')
    if (address !== String(existing.address || '').trim()) changedLabels.push('Adresa prebivališta')

    try {
      DatabaseService.insertLog({
        userId: String(actor.id || 'system'),
        userName: actorName,
        userRole: roleLower || 'member',
        action: 'Dopuna podataka člana (Arhiv)',
        details: `${actorName} ažurirao/la je osobne i kontakt podatke člana ${combinedName} (ID: ${memberId}) kroz modul Arhiv.${
          changedLabels.length > 0 ? ` Izmijenjena polja: ${changedLabels.join(', ')}.` : ''
        }`,
        timestamp: new Date().toISOString(),
      })
    } catch (logErr) {
      console.warn('[Archive PUT] Log warning:', logErr)
    }

    return NextResponse.json({
      success: true,
      member: {
        memberId,
        name: combinedName,
        email: nextEmail,
        phone,
        landlinePhone,
        address,
      },
    })
  } catch (error: any) {
    console.error('[Archive PUT Error]:', error)
    return NextResponse.json(
      { error: error?.message || 'Greška pri spremanju podataka člana.' },
      { status: 500 }
    )
  }
}
