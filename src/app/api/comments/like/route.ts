import { NextRequest, NextResponse } from 'next/server'
import { likeComment } from '@/lib/db'
import { verifySession } from '@/lib/session'

// POST /api/comments/like
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { commentId, sessionToken } = body

  if (!commentId || !sessionToken) {
    return NextResponse.json({ error: 'commentId and sessionToken required' }, { status: 400 })
  }

  const session = verifySession(sessionToken)
  if (!session) {
    return NextResponse.json({ error: 'invalid session' }, { status: 401 })
  }

  const result = likeComment(parseInt(commentId), session.sessionId)

  return NextResponse.json({ success: true, liked: result.liked })
}
