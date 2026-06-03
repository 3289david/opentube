import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getRecommendedFeed, getTrendingVideos } from '@/lib/youtube'
import { verifySession } from '@/lib/session'

// Extract meaningful keywords from a video title
function extractKeywords(title: string): string[] {
  const stopwords = new Set([
    '이', '가', '을', '를', '은', '는', '의', '에', '와', '과', '도', '만', '로', '으로',
    '에서', '에게', '까지', '부터', '보다', '처럼', '같이', '때문에', '동안', '위해',
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'out',
    'and', 'or', 'but', 'not', 'this', 'that', 'it', 'its',
    '#shorts', '#short', 'shorts', 'official', 'music', 'video', 'mv',
    '|', '-', '·', '•', '/', '\\',
  ])

  return title
    .replace(/[【】\[\]()（）「」『』《》<>""'']/g, ' ')
    .split(/\s+/)
    .map(w => w.toLowerCase().replace(/[^a-z0-9가-힣]/g, ''))
    .filter(w => w.length > 1 && !stopwords.has(w))
    .slice(0, 5)
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const region = (searchParams.get('region') || 'KR').toUpperCase()
  const pageToken = searchParams.get('pageToken') || undefined
  const sessionToken = searchParams.get('sessionToken') || req.headers.get('authorization')?.replace('Bearer ', '')

  const db = getDb()

  try {
    // ── 1. Get session info ────────────────────────────────────────────────────
    let sessionId: string | null = null
    if (sessionToken) {
      try {
        const sess = verifySession(sessionToken)
        sessionId = sess?.sessionId ?? null
      } catch { /* invalid token is ok */ }
    }

    // ── 2. Get recent watch history (global, last 15 titles) ──────────────────
    const history = db.prepare(
      `SELECT video_id, title, channel FROM watch_history
       WHERE title IS NOT NULL ORDER BY watched_at DESC LIMIT 15`
    ).all() as { video_id: string; title: string; channel: string }[]

    // ── 3. Get liked videos for this session ──────────────────────────────────
    const likedVideoIds: string[] = sessionId
      ? (db.prepare(
          `SELECT video_id FROM video_likes WHERE session_id = ? AND type = 'like' ORDER BY rowid DESC LIMIT 10`
        ).all(sessionId) as { video_id: string }[]).map(r => r.video_id)
      : []

    // Get titles of liked videos from watch_history
    const likedTitles: string[] = likedVideoIds.length > 0
      ? (db.prepare(
          `SELECT title FROM watch_history WHERE video_id IN (${likedVideoIds.map(() => '?').join(',')}) AND title IS NOT NULL`
        ).all(...likedVideoIds) as { title: string }[]).map(r => r.title)
      : []

    // ── 4. Get subscriptions ──────────────────────────────────────────────────
    const subscriptions = db.prepare(
      `SELECT channel_id FROM subscriptions LIMIT 10`
    ).all() as { channel_id: string }[]
    const channelIds = subscriptions.map(s => s.channel_id)

    // ── 5. Build topic queries ────────────────────────────────────────────────
    const allTitles = [
      ...likedTitles,
      ...history.map(h => h.title),
    ].filter(Boolean)

    // Fallback: if no history, use trending
    if (allTitles.length === 0 && channelIds.length === 0) {
      const trending = await getTrendingVideos(region, pageToken)
      return NextResponse.json({ items: trending.items, nextPageToken: trending.nextPageToken, isPersonalized: false })
    }

    // Extract keywords and build unique topic queries
    const kwMap = new Map<string, number>()
    for (const title of allTitles) {
      for (const kw of extractKeywords(title)) {
        kwMap.set(kw, (kwMap.get(kw) || 0) + 1)
      }
    }

    // Top keywords by frequency, combined into query groups of 3 words
    const topKws = [...kwMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([kw]) => kw)
      .slice(0, 9)

    const topics: string[] = []
    for (let i = 0; i < topKws.length; i += 3) {
      topics.push(topKws.slice(i, i + 3).join(' '))
    }

    // ── 6. Fetch recommended feed ─────────────────────────────────────────────
    const result = await getRecommendedFeed(topics, channelIds, region, pageToken)

    // ── 7. Filter out already-watched videos (if small history) ───────────────
    const watchedIds = new Set(history.map(h => h.video_id))
    const filtered = result.items.filter(v => !watchedIds.has(v.id))
    const finalItems = filtered.length >= 8 ? filtered : result.items

    return NextResponse.json({
      items: finalItems,
      nextPageToken: result.nextPageToken,
      isPersonalized: true,
      topicsUsed: topics,
    })
  } catch (error) {
    console.error('Recommendations error:', error)
    // Fallback to trending
    const trending = await getTrendingVideos(region, pageToken)
    return NextResponse.json({ items: trending.items, nextPageToken: trending.nextPageToken, isPersonalized: false })
  }
}
