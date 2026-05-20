import { NextRequest, NextResponse } from 'next/server'
import { MemberService } from '@/src/services/member-service'

export async function POST(request: NextRequest) {
  try {
    const { userId, currentPassword, newPassword } = await request.json()
    const memberService = new MemberService();

    // Even if userId is 0, if they have an email 'admin' in the database, we should allow it.
    // However, the MembersProvider auto-creates a record for 'admin' so they will eventually have a non-zero ID.
    // Let's just remove this restriction and rely on the memberService.

    const member = await memberService.getMember(userId)
    if (!member) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (member.password !== currentPassword) {
      return NextResponse.json({ error: 'Invalid current password' }, { status: 401 })
    }

    // Update password AND clear isTempPassword
    await memberService.updateMember(userId, { 
      password: newPassword,
      isTempPassword: false 
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Password update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
