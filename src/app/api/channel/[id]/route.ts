import { NextRequest, NextResponse } from 'next/server'
import { getChannelDetails, getChannelVideos } from '@/lib/youtube'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const pageToken = searchParams.get('pageToken') || undefined

  try {
    const [channel, videosResult] = await Promise.all([
      pageToken ? null : getChannelDetails(id),
      getChannelVideos(id, pageToken),
    ])

    return NextResponse.json({
      channel,
      videos: videosResult.items,
      nextPageToken: videosResult.nextPageToken,
      totalResults: videosResult.totalResults,
    })
  } catch (error) {
    console.error('Channel error:', error)
    return NextResponse.json({ channel: null, videos: [], error: 'Failed to load channel' })
  }
}
