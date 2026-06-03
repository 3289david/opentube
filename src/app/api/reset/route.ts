import { NextRequest, NextResponse } from 'next/server'
import { resetSession } from '@/lib/db'
import { verifySession } from '@/lib/session'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { sessionToken } = body
    if (!sessionToken) return NextResponse.json({ error: 'sessionToken required' }, { status: 400 })

    const payload = verifySession(sessionToken)
    if (!payload) return NextResponse.json({ error: 'invalid session' }, { status: 401 })

    const result = resetSession(payload.sessionId)
    return NextResponse.json({ success: true, ...result })
  } catch (e) {
    console.error('Reset error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
