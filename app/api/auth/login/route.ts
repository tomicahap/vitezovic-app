import { NextRequest, NextResponse } from 'next/server'
import { MemberService } from '@/src/services/member-service'
import { SettingsService } from '@/src/services/settings-service'
import { DatabaseService } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()
    const memberService = new MemberService();
    const settingsService = new SettingsService();

    // 1. Check for hardcoded admin or backup admin from settings
    const settings = await settingsService.getSettings()
    const members = await memberService.getAllMembers();
    
    const adminMember = members.find(m => m.email.toLowerCase() === 'admin')
    const backupEmail = settings?.adminBackupEmail || ''
    const backupMember = backupEmail ? members.find(m => m.email.toLowerCase() === backupEmail.toLowerCase()) : null

    const isHardcodedAdmin = email === 'admin' && (password === (adminMember?.password || 'admin'))
    const isBackupAdmin = backupEmail && 
                         email.toLowerCase() === backupEmail.toLowerCase() && 
                         (password === (backupMember?.password || settings?.adminBackupPassword || 'admin'))

    // Find if a member already exists for these special accounts
    const emailToSearch = isHardcodedAdmin ? 'admin' : isBackupAdmin ? backupEmail : email
    const existingMember = members.find(m => m.email.toLowerCase() === (emailToSearch?.toLowerCase() || ''))

    if (isHardcodedAdmin || isBackupAdmin) {
      const targetMember = existingMember || adminMember;
      const memberId = targetMember ? targetMember.id : (isHardcodedAdmin ? 2579 : 0);
      if (memberId) {
        DatabaseService.recordUserLogin(memberId);
      }

      return NextResponse.json({
        id: memberId,
        name: targetMember ? targetMember.name : (isBackupAdmin ? 'Rezervni Administrator' : 'Administrator'),
        email: emailToSearch,
        role: 'admin',
        avatar: targetMember?.avatar || '/placeholder.svg',
        isTempPassword: !!targetMember?.isTempPassword,
        accessRights: targetMember?.accessRights || null
      })
    }

    const foundMember = members.find(m => m.email.toLowerCase() === email.toLowerCase() && m.password === password)

    if (foundMember) {
      DatabaseService.recordUserLogin(foundMember.id);
      return NextResponse.json({
        id: foundMember.id,
        name: foundMember.name,
        email: foundMember.email,
        role: foundMember.role || 'member',
        avatar: foundMember.avatar || '/placeholder.svg',
        isTempPassword: !!foundMember.isTempPassword,
        accessRights: foundMember.accessRights || null
      })
    }

    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
