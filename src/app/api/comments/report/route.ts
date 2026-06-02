import { NextRequest, NextResponse } from 'next/server'
import { reportComment } from '@/lib/db'
import { verifySession } from '@/lib/session'

// POST /api/comments/report
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { commentId, reason, sessionToken } = body

  if (!commentId || !sessionToken) {
    return NextResponse.json({ error: 'commentId and sessionToken required' }, { status: 400 })
  }

  const session = verifySession(sessionToken)
  if (!session) {
    return NextResponse.json({ error: 'invalid session' }, { status: 401 })
  }

  reportComment(parseInt(commentId), session.sessionId, reason || '기타')

  return NextResponse.json({ success: true })
}
