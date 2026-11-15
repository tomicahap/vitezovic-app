import { NextRequest, NextResponse } from 'next/server'
import { MemberService } from '@/src/services/member-service'

const memberService = new MemberService();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (id) {
      const member = await memberService.getMember(Number(id))
      if (!member) {
        return NextResponse.json({ error: 'Član nije pronađen' }, { status: 404 })
      }
      return NextResponse.json(member)
    } else {
      const members = await memberService.getAllMembers()
      return NextResponse.json(members)
    }
  } catch (error) {
    console.error('Greška pri dohvaćanju članova:', error)
    return NextResponse.json({ error: 'Interna greška poslužitelja' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, ...data } = body

    switch (action) {
      case 'add': {
        const id = await memberService.createMember(data)
        return NextResponse.json({ id })
      }

      case 'update': {
        const { id, ...updates } = data
        await memberService.updateMember(Number(id), updates)
        return NextResponse.json({ success: true })
      }

      case 'delete': {
        const { id } = data
        await memberService.deleteMember(Number(id))
        return NextResponse.json({ success: true })
      }

      case 'import': {
        const { members } = data
        let importedCount = 0
        for (const m of members) {
          await memberService.createMember(m)
          importedCount++
        }
        return NextResponse.json({ imported: importedCount })
      }

      case 'bulk-update-status': {
        const updated = await memberService.bulkCleanup('recalculate-statuses', undefined, data.settings)
        return NextResponse.json({ updated })
      }

      case 'bulk-cleanup': {
        if (data.adminRole !== 'admin') {
          return NextResponse.json({ error: 'Samo administrator može izvršiti ovu radnju' }, { status: 403 })
        }
        const updated = await memberService.bulkCleanup(data.mode, data.memberIds, data.settings)
        return NextResponse.json({ success: true, updated })
      }

      case 'batch-update-dates': {
        if (data.adminRole !== 'admin') {
          return NextResponse.json({ error: 'Samo administrator može izvršiti ovu radnju' }, { status: 403 })
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