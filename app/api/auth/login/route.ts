import { NextRequest, NextResponse } from 'next/server'
import { MemberService } from '@/src/services/member-service'
import { SettingsService } from '@/src/services/settings-service'
import { DatabaseService } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()
    const memberService = new MemberService()
    const settingsService = new SettingsService()

    // 1. Check for main Administrator or Backup Administrator from settings
    const settings = (await settingsService.getSettings()) as any
    const adminPassword = settings?.adminPassword || 'admin'
    const backupEmail = settings?.adminBackupEmail || ''
    const backupPassword = settings?.adminBackupPassword || 'admin'

    const isHardcodedAdmin =
      email && email.trim().toLowerCase() === 'admin' && password === adminPassword
    const isBackupAdmin =
      backupEmail &&
      email &&
      email.trim().toLowerCase() === backupEmail.trim().toLowerCase() &&
      password === backupPassword

    if (isHardcodedAdmin || isBackupAdmin) {
      const emailToReturn = isHardcodedAdmin ? 'admin' : backupEmail
      const adminId = isHardcodedAdmin ? 2579 : 0

      // Evidentiraj prijavu za praćenje promjena od zadnje prijave
      DatabaseService.recordUserLogin(adminId)

      return NextResponse.json({
        id: adminId,
        name:
          settings?.adminName?.trim() ||
          (isBackupAdmin ? 'Rezervni Administrator' : 'Administrator'),
        email: emailToReturn,
        role: 'admin',
        avatar: '/placeholder.svg',
        isTempPassword: false,
        accessRights: null,
      })
    }

    // 2. Regular member authentication
    const members = await memberService.getAllMembers()
    const foundMember = members.find(
      (m) => m.email && m.email.toLowerCase() === (email || '').toLowerCase() && m.password === password
    )

    if (foundMember) {
      DatabaseService.recordUserLogin(foundMember.id)
      return NextResponse.json({
        id: foundMember.id,
        name: foundMember.name,
        email: foundMember.email,
        role: foundMember.role || 'member',
        avatar: foundMember.avatar || '/placeholder.svg',
        isTempPassword: !!foundMember.isTempPassword,
        accessRights: foundMember.accessRights || null,
      })
    }

    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
