import { NextRequest, NextResponse } from 'next/server'
import { getVideoLikes, setVideoLike, removeVideoLike, getUserVideoLike } from '@/lib/db'
import { verifySession } from '@/lib/session'

// GET /api/likes?videoId=xxx&sessionToken=xxx
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const videoId = searchParams.get('videoId')
  const sessionToken = searchParams.get('sessionToken')

  if (!videoId) {
    return NextResponse.json({ error: 'videoId required' }, { status: 400 })
  }

  const { likes, dislikes } = getVideoLikes(videoId)

  let userLike: 'like' | 'dislike' | null = null
  if (sessionToken) {
    const session = verifySession(sessionToken)
    if (session) {
      userLike = getUserVideoLike(videoId, session.sessionId)
    }
  }

  return NextResponse.json({ likes, dislikes, userLike })
}

// POST /api/likes
// Body: { videoId, type: 'like' | 'dislike' | 'none', sessionToken }
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { videoId, type, sessionToken } = body

  if (!videoId || !sessionToken) {
    return NextResponse.json({ error: 'videoId and sessionToken required' }, { status: 400 })
  }

  const session = verifySession(sessionToken)
  if (!session) {
    return NextResponse.json({ error: 'invalid session' }, { status: 401 })
  }

  if (type === 'none' || !type) {
    removeVideoLike(videoId, session.sessionId)
  } else if (type === 'like' || type === 'dislike') {
    setVideoLike(videoId, session.sessionId, type)
  } else {
    return NextResponse.json({ error: 'type must be like, dislike, or none' }, { status: 400 })
  }

  const { likes, dislikes } = getVideoLikes(videoId)
  const userLike = getUserVideoLike(videoId, session.sessionId)

  return NextResponse.json({ likes, dislikes, userLike })
}
