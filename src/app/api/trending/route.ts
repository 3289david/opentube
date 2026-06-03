import { NextRequest, NextResponse } from 'next/server'
import { getTrendingVideos, getShorts, getVideosByCategory } from '@/lib/youtube'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') || 'trending'
  const category = searchParams.get('category') || ''
  const pageToken = searchParams.get('pageToken') || undefined
  const region = (searchParams.get('region') || 'KR').toUpperCase()

  try {
    if (type === 'shorts') {
      const result = await getShorts(pageToken, region)
      return NextResponse.json(result)
    }
    if (type === 'category' && category) {
      const result = await getVideosByCategory(category, pageToken, region)
      return NextResponse.json({ videos: result.items, nextPageToken: result.nextPageToken })
    }
    const result = await getTrendingVideos(region, pageToken)
    return NextResponse.json({ videos: result.items, nextPageToken: result.nextPageToken })
  } catch (error) {
    console.error('Trending error:', error)
    return NextResponse.json({ videos: [], items: [], error: 'Failed' })
  }
}
