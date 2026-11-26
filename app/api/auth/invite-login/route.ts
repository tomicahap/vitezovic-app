import { NextRequest, NextResponse } from 'next/server'
import { getAppDb, DatabaseService, ResearchInquiriesDB, ExternalUsersDB } from '@/lib/database'
import { SettingsService } from '@/src/services/settings-service'
import { parseAccessRights } from '@/lib/inquiry-permissions'
import { setSessionCookie } from '@/lib/session-auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const token = typeof body?.token === 'string' ? body.token.trim() : ''

    if (!token) {
      return NextResponse.json(
        { error: 'Nedostaje aktivacijski token pozivnice.', code: 'MISSING_TOKEN' },
        { status: 400 }
      )
    }

    if (token === 'test-pregled') {
      return NextResponse.json(
        {
          error:
            'Ovo je testna poveznica iz probnog e-maila. Prava aktivacijska poveznica generira se pri stvarnom slanju pozivnice članu.',
          code: 'TEST_LINK',
        },
        { status: 400 }
      )
    }

    const db = getAppDb()
    const member = db
      .prepare('SELECT * FROM members WHERE invitation_token = ? LIMIT 1')
      .get(token) as any

    const externalUser = !member ? ExternalUsersDB.getRawByInvitationToken(token) : null

    if (!member && !externalUser) {
      return NextResponse.json(
        {
          error:
            'Poveznica za aktivaciju nije valjana ili je već iskorištena. Ako ste već postavili svoju lozinku, prijavite se na početnom ekranu.',
          code: 'INVALID_OR_USED',
        },
        { status: 404 }
      )
    }

    if (externalUser) {
      if (externalUser.is_active === 0 || externalUser.is_active === false) {
        return NextResponse.json(
          { error: 'Pristup ovom korisničkom računu je deaktiviran.', code: 'FORBIDDEN' },
          { status: 403 }
        )
      }

      const settingsService = new SettingsService()
      const settings = (await settingsService.getSettings()) as any
      const isMaintenanceMode = settings?.maintenanceMode === 1 || settings?.maintenanceMode === true
      if (isMaintenanceMode) {
        return NextResponse.json(
          {
            error: 'Sustav se trenutno ažurira i nije mu moguće pristupiti. Kontaktirajte administratora.',
            maintenanceMode: true,
            code: 'MAINTENANCE',
          },
          { status: 503 }
        )
      }

      if (externalUser.invitation_token_expires_at) {
        const expiresMs = new Date(externalUser.invitation_token_expires_at).getTime()
        if (!Number.isNaN(expiresMs) && expiresMs < Date.now()) {
          return NextResponse.json(
            {
              error:
                'Poveznica za aktivaciju je istekla. Molimo obratite se administratoru društva za slanje nove pozivnice.',
              code: 'EXPIRED',
            },
            { status: 410 }
          )
        }
      }

      try {
        ExternalUsersDB.update(Number(externalUser.id), {
          is_temp_password: 1,
          last_login_at: new Date().toISOString(),
        })
      } catch {}

      DatabaseService.recordUserLogin(Number(externalUser.id))
      try {
        DatabaseService.insertLog({
          userId: String(externalUser.id),
          userName: externalUser.name || 'Vanjski suradnik',
          userRole: 'external',
          action: 'Prijava vanjskog suradnika putem pozivnice',
          details: `Vanjski suradnik ${externalUser.name} (${externalUser.email}) automatski se prijavio putem aktivacijske poveznice pozivnice.`,
        })
      } catch {}

      const parsedRights = parseAccessRights(externalUser.access_rights)
      const assignedStats = ResearchInquiriesDB.getAssignedStatsForMember(
        Number(externalUser.id),
        externalUser.name || ''
      )

      const res = NextResponse.json({
        id: Number(externalUser.id),
        name: externalUser.name,
        email: externalUser.email,
        role: 'external',
        isExternal: true,
        organization: externalUser.organization || '',
        avatar: '/placeholder.svg',
        isTempPassword: true,
        accessRights: Object.keys(parsedRights).length > 0 ? parsedRights : null,
        hasAssignedInquiries: assignedStats.totalCount > 0,
        assignedInquiriesCount: assignedStats.totalCount,
        assignedActiveInquiriesCount: assignedStats.activeCount,
      })
      setSessionCookie(
        res,
        {
          id: Number(externalUser.id),
          role: 'external',
          email: externalUser.email,
          name: externalUser.name,
        },
        request
      )
      return res
    }

    if (member.deceased === 1 || member.deceased === true) {
      return NextResponse.json(
        { error: 'Pristup ovom korisničkom računu nije moguć.', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }

    const settingsService = new SettingsService()
    const settings = (await settingsService.getSettings()) as any
    const isMaintenanceMode = settings?.maintenanceMode === 1 || settings?.maintenanceMode === true
    if (isMaintenanceMode && String(member.role || '').toLowerCase() !== 'admin') {
      return NextResponse.json(
        {
          error: 'Sustav se trenutno ažurira i nije mu moguće pristupiti. Kontaktirajte administratora.',
          maintenanceMode: true,
          code: 'MAINTENANCE',
        },
        { status: 503 }
      )
    }

    if (member.invitation_token_expires_at) {
      const expiresMs = new Date(member.invitation_token_expires_at).getTime()
      if (!Number.isNaN(expiresMs) && expiresMs < Date.now()) {
        return NextResponse.json(
          {
            error:
              'Poveznica za aktivaciju je istekla. Molimo obratite se administratoru društva za slanje nove pozivnice.',
            code: 'EXPIRED',
          },
          { status: 410 }
        )
      }
    }

    // Osiguraj da korisnik nakon automatske prijave mora postaviti svoju novu lozinku
    try {
      db.prepare('UPDATE members SET is_temp_password = 1 WHERE id = ?').run(member.id)
    } catch {}

    DatabaseService.recordUserLogin(Number(member.id))
    try {
      DatabaseService.insertLog({
        userId: String(member.id),
        userName: member.name || 'Član',
        userRole: member.role || 'member',
        action: 'Prijava putem pozivnice',
        details: `Član ${member.name} (${member.email}) automatski se prijavio putem aktivacijske poveznice pozivnice.`,
      })
    } catch {}

    const parsedRights = parseAccessRights(member.access_rights ?? member.accessRights)
    const assignedStats = ResearchInquiriesDB.getAssignedStatsForMember(
      Number(member.id),
      member.name || ''
    )

    const res = NextResponse.json({
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role || 'member',
      avatar: member.avatar || '/placeholder.svg',
      isTempPassword: true,
      accessRights: Object.keys(parsedRights).length > 0 ? parsedRights : null,
      hasAssignedInquiries: assignedStats.totalCount > 0,
      assignedInquiriesCount: assignedStats.totalCount,
      assignedActiveInquiriesCount: assignedStats.activeCount,
    })
    setSessionCookie(
      res,
      {
        id: Number(member.id),
        role: member.role || 'member',
        email: member.email,
        name: member.name,
      },
      request
    )
    return res
  } catch (error: any) {
    console.error('Invite login error:', error)
    return NextResponse.json(
      { error: 'Došlo je do pogreške na poslužitelju prilikom automatske prijave.' },
      { status: 500 }
    )
  }
}
