import { NextRequest, NextResponse } from 'next/server'
import { getChannelDetails, getChannelVideos } from '@/lib/youtube'
import { isSubscribed } from '@/lib/db'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const pageToken = searchParams.get('pageToken') || undefined
  const wantsVideos = searchParams.get('videos') === '1'

  try {
    const [channel, videosResult] = await Promise.all([
      pageToken ? null : getChannelDetails(id),
      (wantsVideos || !pageToken) ? getChannelVideos(id, pageToken) : Promise.resolve({ items: [], nextPageToken: undefined, totalResults: 0 }),
    ])

    const subscribed = isSubscribed(id)

    return NextResponse.json({
      channel,
      videos: videosResult.items,
      nextPageToken: videosResult.nextPageToken,
      totalResults: videosResult.totalResults,
      isSubscribed: subscribed,
    })
  } catch (error) {
    console.error('Channel error:', error)
    return NextResponse.json({ channel: null, videos: [], error: 'Failed to load channel' })
  }
}
