import { NextRequest, NextResponse } from 'next/server'
import { getTrendingVideos, getShorts, getVideosByCategory } from '@/lib/youtube'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') || 'trending'
  const category = searchParams.get('category') || ''
  const pageToken = searchParams.get('pageToken') || undefined

  try {
    if (type === 'shorts') {
      const result = await getShorts(pageToken)
      return NextResponse.json(result)
    }
    if (type === 'category' && category) {
      const result = await getVideosByCategory(category, pageToken)
      return NextResponse.json({ videos: result.items, nextPageToken: result.nextPageToken })
    }
    const videos = await getTrendingVideos()
    return NextResponse.json({ videos })
  } catch (error) {
    console.error('Trending error:', error)
    return NextResponse.json({ videos: [], items: [], error: 'Failed' })
  }
}
