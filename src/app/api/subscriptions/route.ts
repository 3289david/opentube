import { NextRequest, NextResponse } from 'next/server'
import { getSubscriptions, addSubscription, removeSubscription } from '@/lib/db'

export async function GET() {
  const subscriptions = getSubscriptions()
  return NextResponse.json({ subscriptions })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { channelId, channelName, channelThumbnail } = body

    if (!channelId || !channelName) {
      return NextResponse.json({ error: 'channelId and channelName required' }, { status: 400 })
    }

    addSubscription(channelId, channelName, channelThumbnail)
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

  removeSubscription(channelId)
  return NextResponse.json({ success: true })
}
