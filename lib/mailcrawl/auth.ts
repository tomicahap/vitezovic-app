import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { extractActor, type TrashActor } from '@/lib/trash'

export function requireMailcrawlAdmin(
  req: NextRequest
):
  | { ok: true; actor: TrashActor }
  | { ok: false; response: NextResponse } {
  const actor = extractActor(req)
  const role = (actor.role || '').trim().toLowerCase()
  if (role !== 'admin') {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: 'Pristup modulu Donacije i kampanje dopušten je isključivo administratoru.' },
        { status: 403 }
      ),
    }
  }
  return { ok: true, actor }
}
