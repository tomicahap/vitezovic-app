import { NextRequest, NextResponse } from 'next/server'
import { getAppDb, ResearchInquiriesDB, ExternalUsersDB } from '@/lib/database'
import { extractActor } from '@/lib/trash'
import { parseAccessRights } from '@/lib/inquiry-permissions'
import { getVerifiedSession, setSessionCookie } from '@/lib/session-auth'
import { resolveServerSenderIdentity } from '@/lib/sender-role-server'
import { DatabaseService } from '@/lib/database'

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
      const fullSettings = DatabaseService.getSettings()
      const adminResolved = resolveServerSenderIdentity(
        {
          userId: adminId,
          userName: adminName,
          userEmail: adminEmail,
          userRole: 'admin',
        },
        fullSettings
      )
      const res = NextResponse.json(
        {
          authenticated: true,
          user: {
            id: adminId,
            name: adminResolved?.userName || adminName,
            email: adminEmail,
            role: 'admin',
            societyRole: adminResolved?.userFunction || 'Administrator',
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

    if (roleLower !== 'external') {
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
    }

    if (!member) {
      const extUser =
        (hasId && Number.isFinite(numericId) && numericId > 0
          ? ExternalUsersDB.getRawById(numericId)
          : null) || (emailLower ? ExternalUsersDB.getRawByEmail(emailLower) : null)

      if (!extUser || extUser.is_active === 0 || extUser.is_active === false) {
        return NextResponse.json({ authenticated: false }, { headers: { 'Cache-Control': 'no-store' } })
      }

      const extRights = parseAccessRights(extUser.access_rights)
      const extAssignedStats = ResearchInquiriesDB.getAssignedStatsForMember(
        Number(extUser.id),
        extUser.name
      )
      const res = NextResponse.json(
        {
          authenticated: true,
          user: {
            id: Number(extUser.id),
            name: extUser.name,
            email: extUser.email,
            role: 'external',
            isExternal: true,
            organization: extUser.organization || '',
            avatar: '/placeholder.svg',
            isTempPassword: extUser.is_temp_password === 1 || extUser.is_temp_password === true,
            accessRights: Object.keys(extRights).length > 0 ? extRights : null,
            hasAssignedInquiries: extAssignedStats.totalCount > 0,
            assignedInquiriesCount: extAssignedStats.totalCount,
            assignedActiveInquiriesCount: extAssignedStats.activeCount,
          },
        },
        { headers: { 'Cache-Control': 'no-store' } }
      )
      if (!hasSignedSession) {
        setSessionCookie(
          res,
          {
            id: Number(extUser.id),
            role: 'external',
            email: extUser.email,
            name: extUser.name,
          },
          request
        )
      }
      return res
    }

    const parsedRights = parseAccessRights(member.access_rights)
    const assignedStats = ResearchInquiriesDB.getAssignedStatsForMember(Number(member.id), member.name)
    const memberResolved = resolveServerSenderIdentity(
      {
        userId: member.id,
        userName: member.name,
        userEmail: member.email,
        userRole: member.role || 'member',
      },
      DatabaseService.getSettings()
    )
    const res = NextResponse.json(
      {
        authenticated: true,
        user: {
          id: member.id,
          name: member.name,
          email: member.email,
          role: member.role || 'member',
          societyRole: memberResolved?.userFunction || 'Član Društva',
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
