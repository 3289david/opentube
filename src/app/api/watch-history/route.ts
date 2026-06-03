import { NextRequest, NextResponse } from 'next/server'
import { getDb, getWatchPosition, saveWatchPosition, getRecentHistory, clearHistory } from '@/lib/db'
import { verifySession } from '@/lib/session'

function getSessionId(req: NextRequest, body?: Record<string, string>): string {
  const token =
    body?.sessionToken ||
    req.nextUrl.searchParams.get('sessionToken') ||
    req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return ''
  const payload = verifySession(token)
  return payload?.sessionId ?? ''
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const videoId = searchParams.get('videoId')
  const all = searchParams.get('all')
  const sessionId = getSessionId(req)

  if (all === '1') {
    const history = getRecentHistory(50, sessionId)
    return NextResponse.json({ history })
  }

  if (!videoId) return NextResponse.json({ watchTime: 0 })
  const watchTime = getWatchPosition(videoId, sessionId)
  return NextResponse.json({ videoId, watchTime })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { videoId, watchTime, title, channel, thumbnail } = body
  if (!videoId || watchTime === undefined) {
    return NextResponse.json({ error: 'videoId and watchTime required' }, { status: 400 })
  }
  const sessionId = getSessionId(req, body)
  saveWatchPosition(videoId, watchTime, { title, channel, thumbnail }, sessionId)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const videoId = searchParams.get('videoId')
  const sessionId = getSessionId(req)
  if (videoId) {
    getDb().prepare('DELETE FROM watch_history WHERE video_id = ? AND session_id = ?').run(videoId, sessionId)
  } else {
    clearHistory(sessionId)
  }
  return NextResponse.json({ ok: true })
}
