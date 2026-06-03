import { NextRequest, NextResponse } from 'next/server'
import { getSubscriptions, addSubscription, removeSubscription } from '@/lib/db'
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
  const sessionId = getSessionId(req)
  const subscriptions = getSubscriptions(sessionId)
  return NextResponse.json({ subscriptions })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { channelId, channelName, channelThumbnail } = body
    if (!channelId || !channelName) {
      return NextResponse.json({ error: 'channelId and channelName required' }, { status: 400 })
    }
    const sessionId = getSessionId(req, body)
    addSubscription(channelId, channelName, sessionId, channelThumbnail)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const channelId = searchParams.get('channelId')
  if (!channelId) {
    return NextResponse.json({ error: 'channelId required' }, { status: 400 })
  }
  const sessionId = getSessionId(req)
  removeSubscription(channelId, sessionId)
  return NextResponse.json({ success: true })
}
