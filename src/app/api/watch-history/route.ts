import { NextRequest, NextResponse } from 'next/server'
import { getWatchPosition, saveWatchPosition, getRecentHistory } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const videoId = searchParams.get('videoId')

  if (videoId) {
    const watchTime = getWatchPosition(videoId)
    return NextResponse.json({ videoId, watchTime })
  }

  // Return recent history
  const history = getRecentHistory(20)
  return NextResponse.json({ history })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { videoId, watchTime } = body

    if (!videoId || watchTime === undefined) {
      return NextResponse.json({ error: 'videoId and watchTime required' }, { status: 400 })
    }

    saveWatchPosition(videoId, watchTime)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
