import { NextRequest, NextResponse } from 'next/server'
import { getAppDb, ResearchInquiriesDB } from '@/lib/database'
import { extractActor } from '@/lib/trash'
import { parseAccessRights } from '@/lib/inquiry-permissions'
import { getVerifiedSession, setSessionCookie } from '@/lib/session-auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const actor = extractActor(request)
    const hasId = actor.id && actor.id !== 'unknown'
    const roleLower = (actor.role || '').trim().toLowerCase()
    const emailLower = (actor.email || '').trim().toLowerCase()

    if (!hasId && !emailLower && roleLower !== 'admin') {
      return NextResponse.json({ authenticated: false }, { headers: { 'Cache-Control': 'no-store' } })
    }

    const db = getAppDb()
    const hasSignedSession = Boolean(getVerifiedSession(request))

    if (roleLower === 'admin') {
      const settingsRow = db.prepare('SELECT adminName FROM settings WHERE id = 1').get() as any
      const fallbackAdminName =
        actor.id === '0' || actor.name.toLowerCase().includes('rezervni')
          ? 'Rezervni Administrator'
          : 'Administrator'
      const adminId = Number.isFinite(Number(actor.id)) ? Number(actor.id) : 2579
      const adminName = settingsRow?.adminName?.trim() || actor.name || fallbackAdminName
      const adminEmail = actor.email || 'admin'
      const res = NextResponse.json(
        {
          authenticated: true,
          user: {
            id: adminId,
            name: adminName,
            email: adminEmail,
            role: 'admin',
            avatar: '/placeholder.svg',
            isTempPassword: false,
            accessRights: null,
          },
        },
        { headers: { 'Cache-Control': 'no-store' } }
      )
      if (!hasSignedSession) {
        setSessionCookie(res, { id: adminId, role: 'admin', email: adminEmail, name: adminName }, request)
      }
      return res
    }

    const numericId = Number(actor.id)
    let member: any = null

    if (hasId && Number.isFinite(numericId) && numericId > 0) {
      member = db
        .prepare(
          `SELECT id, name, email, role, access_rights, is_temp_password, avatar
           FROM members
           WHERE id = ?
           LIMIT 1`
        )
        .get(numericId)
    }

    if (!member && emailLower) {
      member = db
        .prepare(
          `SELECT id, name, email, role, access_rights, is_temp_password, avatar
           FROM members
           WHERE lower(trim(email)) = ?
           LIMIT 1`
        )
        .get(emailLower)
    }

    if (!member) {
      return NextResponse.json({ authenticated: false }, { headers: { 'Cache-Control': 'no-store' } })
    }

    const parsedRights = parseAccessRights(member.access_rights)
    const assignedStats = ResearchInquiriesDB.getAssignedStatsForMember(Number(member.id), member.name)
    const res = NextResponse.json(
      {
        authenticated: true,
        user: {
          id: member.id,
          name: member.name,
          email: member.email,
          role: member.role || 'member',
          avatar: member.avatar || '/placeholder.svg',
          isTempPassword: member.is_temp_password === 1 || member.is_temp_password === true,
          accessRights: Object.keys(parsedRights).length > 0 ? parsedRights : null,
          hasAssignedInquiries: assignedStats.totalCount > 0,
          assignedInquiriesCount: assignedStats.totalCount,
          assignedActiveInquiriesCount: assignedStats.activeCount,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
    if (!hasSignedSession) {
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
    }
    return res
  } catch (error: any) {
    console.error('[Auth Me GET Error]:', error)
    return NextResponse.json({ error: error?.message || 'Interna greška poslužitelja.' }, { status: 500 })
  }
}
