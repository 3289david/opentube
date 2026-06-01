import { NextResponse } from 'next/server'
import { getTrendingVideos } from '@/lib/youtube'

export async function GET() {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) {
    return NextResponse.json({ videos: [], noApiKey: true })
  }

  try {
    const videos = await getTrendingVideos()
    return NextResponse.json({ videos })
  } catch (error) {
    console.error('Trending error:', error)
    return NextResponse.json({ videos: [], error: 'Failed to load trending' })
  }
}
