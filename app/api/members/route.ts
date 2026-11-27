import { NextRequest, NextResponse } from 'next/server'
import { MemberService, isAdminRecord } from '@/src/services/member-service'
import { getAppDb } from '@/lib/database'
import { TrashService, extractActor } from '@/lib/trash'
import { findPotentialDuplicateMembers } from '@/lib/member-duplicates'
import { getNextSequentialMemberNumber, validateMemberNumberChange } from '@/lib/member-numbering'
import { MemberActionPermissionKey, parseAccessRights } from '@/lib/inquiry-permissions'

const memberService = new MemberService();

export const dynamic = 'force-dynamic'
export const revalidate = 0

function canRunMemberBulkAction(body: any, permKey: MemberActionPermissionKey): boolean {
  if (body?.adminRole === 'admin') return true;
  const db = getAppDb();
  const actorId = Number(body?.actorId || 0);
  const actorEmail = typeof body?.actorEmail === 'string' ? body.actorEmail.trim() : '';

  let row: any = null;
  if (actorId > 0) {
    row = db.prepare('SELECT role, access_rights FROM members WHERE id = ?').get(actorId);
  }
  if (!row && actorEmail) {
    row = db.prepare('SELECT role, access_rights FROM members WHERE lower(email) = lower(?)').get(actorEmail);
  }
  if (!row) return false;
  if (row.role === 'admin') return true;

  const ar = parseAccessRights(row.access_rights);
  const entry = ar[permKey];
  if (entry === true) return true;
  return Boolean(entry?.edit === true || entry?.view === true);
}

export async function GET(request: NextRequest) {
  try {
    const actor = extractActor(request)
    if ((actor.role || '').trim().toLowerCase() === 'external') {
      return NextResponse.json(
        { error: 'Vanjski suradnici nemaju pristup popisu članova Društva.' },
        { status: 403 }
      )
    }
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (id) {
      const member = await memberService.getMember(Number(id))
      if (!member) {
        return NextResponse.json({ error: 'Član nije pronađen' }, { status: 404 })
      }
      return NextResponse.json(member, { headers: { 'Cache-Control': 'no-store' } })
    } else {
      const members = await memberService.getAllMembers()
      return NextResponse.json(members, { headers: { 'Cache-Control': 'no-store' } })
    }
  } catch (error) {
    console.error('Greška pri dohvaćanju članova:', error)
    return NextResponse.json({ error: 'Interna greška poslužitelja' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const actorCheck = extractActor(request, body)
    if ((actorCheck.role || '').trim().toLowerCase() === 'external') {
      return NextResponse.json(
        { error: 'Vanjski suradnici nemaju ovlasti nad popisom članova Društva.' },
        { status: 403 }
      )
    }
    const { action, ...data } = body

    switch (action) {
      case 'add': {
        const { forceDuplicate, ...memberPayload } = data
        if (typeof memberPayload.email === 'string') {
          memberPayload.email = memberPayload.email.trim()
        }
        const allMembers = await memberService.getAllMembers()
        const numCheck = validateMemberNumberChange({
          mode: 'add',
          membershipNumber: memberPayload.membershipNumber,
          registryNumber: memberPayload.registryNumber,
          existingMembers: allMembers,
        })
        if (!numCheck.ok) {
          return NextResponse.json(
            {
              error: numCheck.error,
              code: numCheck.code || 'INVALID_MEMBER_NUMBER',
            },
            { status: 409 }
          )
        }
        if (numCheck.normalized !== undefined) {
          memberPayload.membershipNumber = numCheck.normalized
          memberPayload.registryNumber = numCheck.normalized
        }

        const duplicates = findPotentialDuplicateMembers(memberPayload, allMembers)

        if (!forceDuplicate && duplicates.length > 0) {
          return NextResponse.json(
            {
              error: 'Pronađen je mogući duplikat osobe u bazi članova.',
              code: 'DUPLICATE_MEMBER',
              duplicates: duplicates.map((d) => ({
                id: d.member.id,
                name: d.member.name,
                email: d.member.email,
                registryNumber: d.member.registryNumber,
                membershipNumber: d.member.membershipNumber,
                joinDate: d.member.joinDate,
                reasons: d.reasons,
              })),
            },
            { status: 409 }
          )
        }

        try {
          const id = await memberService.createMember(memberPayload, {
            allowDuplicateEmail: Boolean(forceDuplicate),
          })
          return NextResponse.json({
            id,
            membershipNumber: memberPayload.membershipNumber,
            registryNumber: memberPayload.registryNumber,
          })
        } catch (err: any) {
          if (String(err?.code || err?.message || '').includes('UNIQUE')) {
            return NextResponse.json(
              {
                error: `Baza podataka zahtijeva jedinstvenu e-mail adresu — "${memberPayload.email}" već koristi drugi član. Upišite drugu e-mail adresu.`,
                code: 'DUPLICATE_EMAIL_UNIQUE',
              },
              { status: 409 }
            )
          }
          throw err
        }
      }

      case 'update': {
        const { id, ...updates } = data
        if (typeof updates.email === 'string') {
          updates.email = updates.email.trim()
        }
        if (updates.membershipNumber !== undefined || updates.registryNumber !== undefined) {
          const allMembers = await memberService.getAllMembers()
          const currentMember = allMembers.find((m: any) => Number(m.id) === Number(id))
          const numCheck = validateMemberNumberChange({
            mode: 'update',
            membershipNumber: updates.membershipNumber,
            registryNumber: updates.registryNumber,
            existingMembers: allMembers,
            currentMemberId: Number(id),
            currentMember,
          })
          if (!numCheck.ok) {
            return NextResponse.json(
              {
                error: numCheck.error,
                code: numCheck.code || 'INVALID_MEMBER_NUMBER',
              },
              { status: 409 }
            )
          }
          if (numCheck.normalized !== undefined) {
            updates.membershipNumber = numCheck.normalized
            updates.registryNumber = numCheck.normalized
          }
        }
        const actor = extractActor(request, body)
        const oldRow = getAppDb().prepare('SELECT * FROM members WHERE id = ?').get(Number(id))
        TrashService.checkAndTrashMemberUpdates(Number(id), oldRow, updates, actor)
        try {
          await memberService.updateMember(Number(id), updates)
          return NextResponse.json({
            success: true,
            ...(updates.membershipNumber !== undefined ? { membershipNumber: updates.membershipNumber } : {}),
            ...(updates.registryNumber !== undefined ? { registryNumber: updates.registryNumber } : {}),
          })
        } catch (err: any) {
          if (String(err?.code || err?.message || '').includes('UNIQUE')) {
            return NextResponse.json(
              { error: `E-mail adresa "${updates.email}" već pripada drugom članu u bazi.` },
              { status: 409 }
            )
          }
          throw err
        }
      }

      case 'delete': {
        const { id } = data
        const actor = extractActor(request, body)
        TrashService.trashMember(Number(id), actor)
        return NextResponse.json({ success: true })
      }

      case 'import': {
        const { members } = data
        const runningMembers = await memberService.getAllMembers()
        let importedCount = 0
        for (const m of members) {
          if (isAdminRecord(m)) continue
          const emailLower = String(m.email || '').trim().toLowerCase()
          const alreadyExists =
            emailLower &&
            runningMembers.some((rm: any) => String(rm.email || '').trim().toLowerCase() === emailLower)
          if (alreadyExists) {
            await memberService.createMember(m, { skipExistingEmail: true })
            importedCount++
            continue
          }
          const numCheck = validateMemberNumberChange({
            mode: 'add',
            membershipNumber: m.membershipNumber,
            registryNumber: m.registryNumber,
            existingMembers: runningMembers,
          })
          const assignedNumber =
            numCheck.ok && numCheck.normalized
              ? numCheck.normalized
              : getNextSequentialMemberNumber(runningMembers).formatted
          const nextMemberPayload = {
            ...m,
            membershipNumber: assignedNumber,
            registryNumber: assignedNumber,
          }
          const createdId = await memberService.createMember(nextMemberPayload, { skipExistingEmail: true })
          runningMembers.push({ ...nextMemberPayload, id: createdId })
          importedCount++
        }
        return NextResponse.json({ imported: importedCount })
      }

      case 'bulk-update-status': {
        const updated = await memberService.bulkCleanup('recalculate-statuses', undefined, data.settings)
        return NextResponse.json({ updated })
      }

      case 'bulk-cleanup': {
        if (!canRunMemberBulkAction(body, 'member_action_ciscenje_datuma_uplata')) {
          return NextResponse.json({ error: 'Nemate odobrenje za čišćenje datuma i uplata' }, { status: 403 })
        }
        const actor = extractActor(request, body)
        if (data.mode === 'clear-payments' || data.mode === 'clear-both') {
          const db = getAppDb()
          const targetSet = Array.isArray(data.memberIds) && data.memberIds.length > 0
            ? new Set(data.memberIds.map(Number))
            : null
          const rows = db.prepare('SELECT id, name, payments FROM members').all() as any[]
          for (const row of rows) {
            if (targetSet && !targetSet.has(Number(row.id))) continue
            TrashService.checkAndTrashMemberUpdates(Number(row.id), row, { payments: [] }, actor)
          }
        }
        const updated = await memberService.bulkCleanup(data.mode, data.memberIds, data.settings)
        return NextResponse.json({ success: true, updated })
      }

      case 'batch-update-dates': {
        if (!canRunMemberBulkAction(body, 'member_action_krivi_datumi')) {
          return NextResponse.json({ error: 'Nemate odobrenje za ispravak krivih datuma' }, { status: 403 })
        }
        const actor = extractActor(request, body)
        const db = getAppDb()
        for (const item of data.items || []) {
          if (item.clearPayments && item.id) {
            const row = db.prepare('SELECT id, name, payments FROM members WHERE id = ?').get(Number(item.id)) as any
            if (row) {
              TrashService.checkAndTrashMemberUpdates(Number(row.id), row, { payments: [] }, actor)
            }
          }
        }
        const updated = await memberService.batchUpdateDates(data.items || [], data.settings)
        return NextResponse.json({ success: true, updated })
      }

      default:
        return NextResponse.json({ error: 'Neispravna akcija' }, { status: 400 })
    }
  } catch (error) {
    console.error('Greška pri obradi operacije člana:', error)
    return NextResponse.json({ error: 'Interna greška poslužitelja' }, { status: 500 })
  }
}