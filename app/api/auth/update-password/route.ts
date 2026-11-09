import { NextRequest, NextResponse } from 'next/server'
import { MemberService } from '@/src/services/member-service'
import { SettingsService } from '@/src/services/settings-service'

export async function POST(request: NextRequest) {
  try {
    const { userId, currentPassword, newPassword, role, email } = await request.json()
    const memberService = new MemberService()
    const settingsService = new SettingsService()

    const member = userId ? await memberService.getMember(Number(userId)) : null

    // Ako se radi o Administratoru (nije u tablici članova)
    if (!member || role === 'admin' || String(email || '').toLowerCase() === 'admin' || Number(userId) === 2579 || Number(userId) === 0) {
      const settings = (await settingsService.getSettings()) as any
      const storedAdminPassword = settings?.adminPassword || 'admin'
      if (currentPassword !== storedAdminPassword) {
        return NextResponse.json({ error: 'Invalid current password' }, { status: 401 })
      }
      await settingsService.updateSettings({ adminPassword: newPassword })
      return NextResponse.json({ success: true })
    }

    if (member.password !== currentPassword) {
      return NextResponse.json({ error: 'Invalid current password' }, { status: 401 })
    }

    // Update password AND clear isTempPassword for regular member
    await memberService.updateMember(Number(userId), {
      password: newPassword,
      isTempPassword: false,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Password update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
