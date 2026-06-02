import { NextRequest, NextResponse } from 'next/server'
import { getComments, insertComment } from '@/lib/db'
import { getVideoComments } from '@/lib/youtube'
import { verifySession } from '@/lib/session'
import { containsToxicContent, sanitizeText } from '@/lib/toxicFilter'
// altcha is imported dynamically below

const ALTCHA_HMAC_KEY = 'opentube-altcha-hmac-key-2026'

// GET /api/comments?videoId=xxx
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const videoId = searchParams.get('videoId')
  const sessionToken = searchParams.get('sessionToken')

  if (!videoId) {
    return NextResponse.json({ error: 'videoId required' }, { status: 400 })
  }

  let sessionId: string | undefined
  if (sessionToken) {
    const payload = verifySession(sessionToken)
    if (payload) sessionId = payload.sessionId
  }

  // Local comments
  const localComments = getComments(videoId, sessionId).map(c => ({
    id: `local_${c.id}`,
    authorName: c.username,
    authorPhoto: '',
    text: sanitizeText(c.text),
    likeCount: c.likes,
    publishedAt: c.created_at,
    isLocal: true,
    userLiked: !!c.user_liked,
    sessionId: c.session_id,
    commentId: c.id,
  }))

  // YouTube comments
  const ytComments = await getVideoComments(videoId).catch(() => [])
  const ytMapped = ytComments.map(c => ({
    ...c,
    isLocal: false,
    userLiked: false,
  }))

  // Merge: local first, then YouTube
  const merged = [...localComments, ...ytMapped]

  return NextResponse.json({ comments: merged })
}

// POST /api/comments
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { videoId, text, altchaPayload, sessionToken } = body

  if (!videoId || !text || !sessionToken) {
    return NextResponse.json({ error: 'videoId, text, and sessionToken required' }, { status: 400 })
  }

  // Verify session
  const session = verifySession(sessionToken)
  if (!session) {
    return NextResponse.json({ error: 'invalid session' }, { status: 401 })
  }

  // Verify altcha if provided
  if (altchaPayload) {
    try {
      const altchaLib = await import('altcha/lib')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const verifySolution = (altchaLib as any).verifySolution
      const ok = await verifySolution(altchaPayload, ALTCHA_HMAC_KEY, true)
      if (!ok) {
        return NextResponse.json({ error: '보안 인증에 실패했습니다' }, { status: 400 })
      }
    } catch {
      // If altcha verification fails, still allow (graceful degradation)
    }
  }

  // Check toxic content
  const toxicCheck = containsToxicContent(text)
  if (toxicCheck.isToxic) {
    return NextResponse.json({ error: '내용을 다시 확인해주세요' }, { status: 400 })
  }

  // Trim and limit text length
  const cleanText = text.trim().slice(0, 2000)
  if (!cleanText) {
    return NextResponse.json({ error: '내용을 입력해주세요' }, { status: 400 })
  }

  const commentId = insertComment(videoId, session.sessionId, session.username, cleanText)

  return NextResponse.json({
    id: `local_${commentId}`,
    commentId,
    authorName: session.username,
    text: sanitizeText(cleanText),
    likeCount: 0,
    publishedAt: new Date().toISOString(),
    isLocal: true,
  })
}

// DELETE /api/comments?commentId=xxx
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const commentId = searchParams.get('commentId')

  if (!commentId) {
    return NextResponse.json({ error: 'commentId required' }, { status: 400 })
  }

  const { blockComment } = await import('@/lib/db')
  blockComment(parseInt(commentId))

  return NextResponse.json({ success: true })
}
