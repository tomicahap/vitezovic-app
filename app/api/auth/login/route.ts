import { NextRequest, NextResponse } from 'next/server'
import { SettingsService } from '@/src/services/settings-service'
import { getAppDb, DatabaseService, ResearchInquiriesDB, ExternalUsersDB } from '@/lib/database'
import { hashPassword, isHashedPassword, verifyPassword } from '@/lib/password-hash'
import { setSessionCookie } from '@/lib/session-auth'
import { parseAccessRights } from '@/lib/inquiry-permissions'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()
    const settingsService = new SettingsService()

    const settings = (await settingsService.getSettings()) as any
    const isMaintenanceMode = settings?.maintenanceMode === 1 || settings?.maintenanceMode === true
    const adminPassword = settings?.adminPassword || 'admin'
    const backupEmail = settings?.adminBackupEmail || ''
    const backupPassword = settings?.adminBackupPassword || 'admin'
    const normalizedEmail = (email || '').trim().toLowerCase()

    // 1. Check for main Administrator or Backup Administrator from settings
    const isHardcodedAdmin =
      normalizedEmail === 'admin' && verifyPassword(password, adminPassword)
    const isBackupAdmin =
      Boolean(backupEmail) &&
      normalizedEmail === backupEmail.trim().toLowerCase() &&
      verifyPassword(password, backupPassword)

    if (isHardcodedAdmin || isBackupAdmin) {
      const emailToReturn = isHardcodedAdmin ? 'admin' : backupEmail
      const adminId = isHardcodedAdmin ? 2579 : 0
      const adminDisplayName =
        settings?.adminName?.trim() ||
        (isBackupAdmin ? 'Rezervni Administrator' : 'Administrator')

      // Tiha nadogradnja plain-text administratorske lozinke u scrypt hash
      if (isHardcodedAdmin && !isHashedPassword(settings?.adminPassword)) {
        try {
          await settingsService.updateSettings({ adminPassword: hashPassword(password) })
        } catch {}
      } else if (isBackupAdmin && !isHashedPassword(settings?.adminBackupPassword)) {
        try {
          await settingsService.updateSettings({ adminBackupPassword: hashPassword(password) })
        } catch {}
      }

      DatabaseService.recordUserLogin(adminId)
      try {
        await settingsService.updateSettings({
          lastAdminLoginAt: new Date().toISOString(),
          adminInactivityAlertSentAt: null,
        })
      } catch (e) {
        console.error('Failed to update lastAdminLoginAt:', e)
      }

      const res = NextResponse.json({
        id: adminId,
        name: adminDisplayName,
        email: emailToReturn,
        role: 'admin',
        avatar: '/placeholder.svg',
        isTempPassword: false,
        accessRights: null,
      })
      setSessionCookie(
        res,
        { id: adminId, role: 'admin', email: emailToReturn, name: adminDisplayName },
        request
      )
      return res
    }

    // 2. Regular member authentication (izravan upit u bazu radi sigurnog čitanja password stupca)
    const db = getAppDb()
    const foundMember = normalizedEmail
      ? (db
          .prepare('SELECT * FROM members WHERE lower(trim(email)) = ? LIMIT 1')
          .get(normalizedEmail) as any)
      : null

    const passwordValid =
      foundMember && typeof password === 'string' && verifyPassword(password, foundMember.password)

    if (isMaintenanceMode) {
      const isAdminAttempt =
        normalizedEmail === 'admin' ||
        (Boolean(backupEmail) && normalizedEmail === backupEmail.trim().toLowerCase()) ||
        (foundMember && foundMember.role === 'admin')

      if (!isAdminAttempt || (foundMember && foundMember.role !== 'admin')) {
        return NextResponse.json(
          {
            error: 'Sustav se trenutno ažurira i nije mu moguće pristupiti. Kontaktirajte administratora.',
            maintenanceMode: true,
          },
          { status: 503 }
        )
      }
    }

    if (foundMember && passwordValid) {
      // Tiha nadogradnja plain-text lozinke člana u scrypt hash
      if (!isHashedPassword(foundMember.password)) {
        try {
          db.prepare('UPDATE members SET password = ? WHERE id = ?').run(
            hashPassword(password),
            foundMember.id
          )
        } catch {}
      }

      DatabaseService.recordUserLogin(Number(foundMember.id))
      if (foundMember.role === 'admin') {
        try {
          await settingsService.updateSettings({
            lastAdminLoginAt: new Date().toISOString(),
            adminInactivityAlertSentAt: null,
          })
        } catch (e) {
          console.error('Failed to update lastAdminLoginAt for admin member:', e)
        }
      }

      const assignedStats = ResearchInquiriesDB.getAssignedStatsForMember(
        Number(foundMember.id),
        foundMember.name
      )
      const parsedRights = parseAccessRights(foundMember.access_rights ?? foundMember.accessRights)
      const memberRole = foundMember.role || 'member'

      const res = NextResponse.json({
        id: foundMember.id,
        name: foundMember.name,
        email: foundMember.email,
        role: memberRole,
        avatar: foundMember.avatar || '/placeholder.svg',
        isTempPassword:
          foundMember.is_temp_password === 1 ||
          foundMember.is_temp_password === true ||
          foundMember.isTempPassword === true,
        accessRights: Object.keys(parsedRights).length > 0 ? parsedRights : null,
        hasAssignedInquiries: assignedStats.totalCount > 0,
        assignedInquiriesCount: assignedStats.totalCount,
        assignedActiveInquiriesCount: assignedStats.activeCount,
      })
      setSessionCookie(
        res,
        {
          id: Number(foundMember.id),
          role: memberRole,
          email: foundMember.email,
          name: foundMember.name,
        },
        request
      )
      return res
    }

    // 3. Vanjski suradnik (nije član Društva, pristup modulu Istraživanja)
    const foundExternal = normalizedEmail
      ? ExternalUsersDB.getRawByEmail(normalizedEmail)
      : null

    if (foundExternal && typeof password === 'string' && verifyPassword(password, foundExternal.password)) {
      if (isMaintenanceMode) {
        return NextResponse.json(
          {
            error: 'Sustav se trenutno ažurira i nije mu moguće pristupiti. Kontaktirajte administratora.',
            maintenanceMode: true,
          },
          { status: 503 }
        )
      }

      if (foundExternal.is_active === 0 || foundExternal.is_active === false) {
        return NextResponse.json(
          { error: 'Vaš pristupni račun je deaktiviran. Obratite se administratoru društva.' },
          { status: 403 }
        )
      }

      if (!isHashedPassword(foundExternal.password)) {
        try {
          ExternalUsersDB.update(Number(foundExternal.id), { password: hashPassword(password) })
        } catch {}
      }

      const nowIso = new Date().toISOString()
      try {
        ExternalUsersDB.update(Number(foundExternal.id), { last_login_at: nowIso })
      } catch {}
      DatabaseService.recordUserLogin(Number(foundExternal.id))

      const assignedStats = ResearchInquiriesDB.getAssignedStatsForMember(
        Number(foundExternal.id),
        foundExternal.name
      )
      const parsedRights = parseAccessRights(foundExternal.access_rights)

      const res = NextResponse.json({
        id: Number(foundExternal.id),
        name: foundExternal.name,
        email: foundExternal.email,
        role: 'external',
        isExternal: true,
        organization: foundExternal.organization || '',
        avatar: '/placeholder.svg',
        isTempPassword:
          foundExternal.is_temp_password === 1 || foundExternal.is_temp_password === true,
        accessRights: Object.keys(parsedRights).length > 0 ? parsedRights : null,
        hasAssignedInquiries: assignedStats.totalCount > 0,
        assignedInquiriesCount: assignedStats.totalCount,
        assignedActiveInquiriesCount: assignedStats.activeCount,
      })
      setSessionCookie(
        res,
        {
          id: Number(foundExternal.id),
          role: 'external',
          email: foundExternal.email,
          name: foundExternal.name,
        },
        request
      )
      return res
    }

    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
