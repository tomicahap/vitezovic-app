import { NextRequest, NextResponse } from 'next/server'
import { MemberService } from '@/src/services/member-service'
import { SettingsService } from '@/src/services/settings-service'
import { getAppDb, DatabaseService } from '@/lib/database'
import { extractActor } from '@/lib/trash'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, currentPassword, newPassword, role, email, inviteToken } = body
    const memberService = new MemberService()
    const settingsService = new SettingsService()

    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Nova lozinka mora imati barem 6 znakova.' },
        { status: 400 }
      )
    }

    const member = userId ? await memberService.getMember(Number(userId)) : null

    // Ako se radi o Administratoru (nije u tablici članova)
    if (
      !member ||
      role === 'admin' ||
      String(email || '').toLowerCase() === 'admin' ||
      Number(userId) === 2579 ||
      Number(userId) === 0
    ) {
      const settings = (await settingsService.getSettings()) as any
      const storedAdminPassword = settings?.adminPassword || 'admin'
      if (currentPassword !== storedAdminPassword) {
        return NextResponse.json({ error: 'Invalid current password' }, { status: 401 })
      }
      await settingsService.updateSettings({ adminPassword: newPassword })
      return NextResponse.json({ success: true })
    }

    const db = getAppDb()
    const rawMember = db
      .prepare(
        `SELECT id, email, name, role, password, is_temp_password, invitation_token
         FROM members
         WHERE id = ?
         LIMIT 1`
      )
      .get(Number(userId)) as any

    if (!rawMember) {
      return NextResponse.json({ error: 'Korisnički račun nije pronađen.' }, { status: 404 })
    }

    const isTempSetup =
      rawMember.is_temp_password === 1 || rawMember.is_temp_password === true

    if (isTempSetup) {
      const actor = extractActor(request, body)
      const actorMatchesId =
        actor.id && actor.id !== 'unknown' && Number(actor.id) === Number(rawMember.id)
      const actorMatchesEmail =
        actor.email &&
        rawMember.email &&
        actor.email.trim().toLowerCase() === String(rawMember.email).trim().toLowerCase()
      const inviteTokenMatches = Boolean(
        rawMember.invitation_token &&
          typeof inviteToken === 'string' &&
          inviteToken.trim() === rawMember.invitation_token
      )
      const currentPasswordMatches = Boolean(
        currentPassword && rawMember.password === currentPassword
      )

      if (
        !actorMatchesId &&
        !actorMatchesEmail &&
        !inviteTokenMatches &&
        !currentPasswordMatches
      ) {
        return NextResponse.json(
          { error: 'Neovlašten zahtjev za postavljanje nove lozinke.' },
          { status: 401 }
        )
      }
    } else {
      if (rawMember.password !== currentPassword) {
        return NextResponse.json({ error: 'Invalid current password' }, { status: 401 })
      }
    }

    // Spremi novu lozinku, ukini privremeni status i trajno poništi jednokratni token pozivnice
    await memberService.updateMember(Number(rawMember.id), {
      password: newPassword,
      isTempPassword: false,
      is_temp_password: 0,
      invitationToken: null,
      invitation_token: null,
      invitationTokenExpiresAt: null,
      invitation_token_expires_at: null,
    })

    try {
      DatabaseService.insertLog({
        userId: String(rawMember.id),
        userName: rawMember.name || 'Član',
        userRole: rawMember.role || 'member',
        action: isTempSetup ? 'Postavljanje prve lozinke' : 'Promjena lozinke',
        details: isTempSetup
          ? `Član ${rawMember.name} (${rawMember.email}) uspješno je postavio svoju novu lozinku nakon prijave putem pozivnice.`
          : `Član ${rawMember.name} (${rawMember.email}) je promijenio lozinku.`,
      })
    } catch {}

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Password update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
