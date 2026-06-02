import { NextRequest, NextResponse } from 'next/server'
import { getWatchPosition, saveWatchPosition, getRecentHistory, clearHistory } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const videoId = searchParams.get('videoId')
  const all = searchParams.get('all')

  if (all === '1') {
    const history = getRecentHistory(50)
    return NextResponse.json({ history })
  }

  if (!videoId) return NextResponse.json({ watchTime: 0 })
  const watchTime = getWatchPosition(videoId)
  return NextResponse.json({ videoId, watchTime })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { videoId, watchTime, title, channel, thumbnail } = body
  if (!videoId || watchTime === undefined) {
    return NextResponse.json({ error: 'videoId and watchTime required' }, { status: 400 })
  }
  saveWatchPosition(videoId, watchTime, { title, channel, thumbnail })
  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  clearHistory()
  return NextResponse.json({ ok: true })
}
