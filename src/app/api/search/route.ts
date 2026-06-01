import { NextRequest, NextResponse } from 'next/server'
import { searchVideos, searchChannels, getPlaylistItems, getPlaylist } from '@/lib/youtube'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const type = searchParams.get('type') || 'video'
  const pageToken = searchParams.get('pageToken') || undefined
  const playlistId = searchParams.get('playlistId')

  const apiKey = process.env.YOUTUBE_API_KEY

  if (!apiKey) {
    if (type === 'video') {
      return NextResponse.json({ items: [], totalResults: 0, noApiKey: true })
    }
    return NextResponse.json({ items: [], noApiKey: true })
  }

  try {
    if (playlistId) {
      const [playlist, result] = await Promise.all([
        getPlaylist(playlistId),
        getPlaylistItems(playlistId, pageToken),
      ])
      return NextResponse.json({ playlist, ...result })
    }

    if (type === 'channel') {
      const channels = await searchChannels(q)
      return NextResponse.json({ items: channels })
    }

    const result = await searchVideos(q, pageToken)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json({ items: [], totalResults: 0, error: 'Search failed' })
  }
}
