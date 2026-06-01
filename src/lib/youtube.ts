import { google } from 'googleapis'

const youtube = google.youtube('v3')

function getApiKey(): string | null {
  return process.env.YOUTUBE_API_KEY || null
}

export interface YouTubeVideo {
  id: string
  title: string
  description: string
  channelId: string
  channelTitle: string
  thumbnail: string
  duration: string
  viewCount: string
  publishedAt: string
  liveBroadcastContent?: string
}

export interface YouTubeChannel {
  id: string
  title: string
  description: string
  thumbnail: string
  subscriberCount: string
  videoCount: string
  customUrl?: string
}

export interface YouTubeSearchResult {
  items: YouTubeVideo[]
  nextPageToken?: string
  totalResults: number
}

function parseDuration(iso: string): string {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return '0:00'
  const h = parseInt(match[1] || '0')
  const m = parseInt(match[2] || '0')
  const s = parseInt(match[3] || '0')
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatViewCount(count: string): string {
  const n = parseInt(count || '0')
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export async function searchVideos(query: string, pageToken?: string): Promise<YouTubeSearchResult> {
  const apiKey = getApiKey()
  if (!apiKey) return { items: [], totalResults: 0 }

  try {
    const searchRes = await youtube.search.list({
      key: apiKey,
      q: query,
      part: ['snippet'],
      type: ['video'],
      maxResults: 20,
      pageToken: pageToken,
      regionCode: 'KR',
    })

    const videoIds = searchRes.data.items?.map(i => i.id?.videoId).filter(Boolean) as string[]

    if (!videoIds.length) return { items: [], nextPageToken: searchRes.data.nextPageToken ?? undefined, totalResults: 0 }

    const detailsRes = await youtube.videos.list({
      key: apiKey,
      id: videoIds,
      part: ['snippet', 'contentDetails', 'statistics'],
    })

    const items: YouTubeVideo[] = (detailsRes.data.items || []).map(v => ({
      id: v.id!,
      title: v.snippet?.title || '',
      description: v.snippet?.description || '',
      channelId: v.snippet?.channelId || '',
      channelTitle: v.snippet?.channelTitle || '',
      thumbnail: v.snippet?.thumbnails?.medium?.url || v.snippet?.thumbnails?.default?.url || '',
      duration: parseDuration(v.contentDetails?.duration || ''),
      viewCount: formatViewCount(v.statistics?.viewCount || '0'),
      publishedAt: v.snippet?.publishedAt || '',
      liveBroadcastContent: v.snippet?.liveBroadcastContent || '',
    }))

    return {
      items,
      nextPageToken: searchRes.data.nextPageToken ?? undefined,
      totalResults: searchRes.data.pageInfo?.totalResults ?? 0,
    }
  } catch (e) {
    console.error('YouTube searchVideos error:', e)
    return { items: [], totalResults: 0 }
  }
}

export async function searchChannels(query: string): Promise<YouTubeChannel[]> {
  const apiKey = getApiKey()
  if (!apiKey) return []

  try {
    const searchRes = await youtube.search.list({
      key: apiKey,
      q: query,
      part: ['snippet'],
      type: ['channel'],
      maxResults: 10,
      regionCode: 'KR',
    })

    const channelIds = searchRes.data.items?.map(i => i.id?.channelId).filter(Boolean) as string[]
    if (!channelIds.length) return []

    const detailsRes = await youtube.channels.list({
      key: apiKey,
      id: channelIds,
      part: ['snippet', 'statistics'],
    })

    return (detailsRes.data.items || []).map(c => ({
      id: c.id!,
      title: c.snippet?.title || '',
      description: c.snippet?.description || '',
      thumbnail: c.snippet?.thumbnails?.medium?.url || '',
      subscriberCount: formatViewCount(c.statistics?.subscriberCount || '0'),
      videoCount: c.statistics?.videoCount || '0',
      customUrl: c.snippet?.customUrl || undefined,
    }))
  } catch (e) {
    console.error('YouTube searchChannels error:', e)
    return []
  }
}

export async function getVideoDetails(videoId: string): Promise<YouTubeVideo | null> {
  const apiKey = getApiKey()
  if (!apiKey) return null

  try {
    const res = await youtube.videos.list({
      key: apiKey,
      id: [videoId],
      part: ['snippet', 'contentDetails', 'statistics'],
    })

    const v = res.data.items?.[0]
    if (!v) return null

    return {
      id: v.id!,
      title: v.snippet?.title || '',
      description: v.snippet?.description || '',
      channelId: v.snippet?.channelId || '',
      channelTitle: v.snippet?.channelTitle || '',
      thumbnail: v.snippet?.thumbnails?.maxres?.url || v.snippet?.thumbnails?.high?.url || '',
      duration: parseDuration(v.contentDetails?.duration || ''),
      viewCount: formatViewCount(v.statistics?.viewCount || '0'),
      publishedAt: v.snippet?.publishedAt || '',
    }
  } catch (e) {
    console.error('YouTube getVideoDetails error:', e)
    return null
  }
}

export async function getChannelDetails(channelId: string): Promise<YouTubeChannel | null> {
  const apiKey = getApiKey()
  if (!apiKey) return null

  try {
    const res = await youtube.channels.list({
      key: apiKey,
      id: [channelId],
      part: ['snippet', 'statistics', 'brandingSettings'],
    })

    const c = res.data.items?.[0]
    if (!c) return null

    return {
      id: c.id!,
      title: c.snippet?.title || '',
      description: c.snippet?.description || '',
      thumbnail: c.snippet?.thumbnails?.high?.url || '',
      subscriberCount: formatViewCount(c.statistics?.subscriberCount || '0'),
      videoCount: c.statistics?.videoCount || '0',
      customUrl: c.snippet?.customUrl || undefined,
    }
  } catch (e) {
    console.error('YouTube getChannelDetails error:', e)
    return null
  }
}

export async function getChannelVideos(channelId: string, pageToken?: string): Promise<YouTubeSearchResult> {
  const apiKey = getApiKey()
  if (!apiKey) return { items: [], totalResults: 0 }

  try {
    const searchRes = await youtube.search.list({
      key: apiKey,
      channelId,
      part: ['snippet'],
      type: ['video'],
      order: 'date',
      maxResults: 20,
      pageToken,
    })

    const videoIds = searchRes.data.items?.map(i => i.id?.videoId).filter(Boolean) as string[]
    if (!videoIds.length) return { items: [], nextPageToken: searchRes.data.nextPageToken ?? undefined, totalResults: 0 }

    const detailsRes = await youtube.videos.list({
      key: apiKey,
      id: videoIds,
      part: ['snippet', 'contentDetails', 'statistics'],
    })

    const items: YouTubeVideo[] = (detailsRes.data.items || []).map(v => ({
      id: v.id!,
      title: v.snippet?.title || '',
      description: v.snippet?.description || '',
      channelId: v.snippet?.channelId || '',
      channelTitle: v.snippet?.channelTitle || '',
      thumbnail: v.snippet?.thumbnails?.medium?.url || '',
      duration: parseDuration(v.contentDetails?.duration || ''),
      viewCount: formatViewCount(v.statistics?.viewCount || '0'),
      publishedAt: v.snippet?.publishedAt || '',
    }))

    return {
      items,
      nextPageToken: searchRes.data.nextPageToken ?? undefined,
      totalResults: searchRes.data.pageInfo?.totalResults ?? 0,
    }
  } catch (e) {
    console.error('YouTube getChannelVideos error:', e)
    return { items: [], totalResults: 0 }
  }
}

export async function getPlaylist(playlistId: string): Promise<{ id: string; title: string; description: string; itemCount: number } | null> {
  const apiKey = getApiKey()
  if (!apiKey) return null

  try {
    const res = await youtube.playlists.list({
      key: apiKey,
      id: [playlistId],
      part: ['snippet', 'contentDetails'],
    })

    const p = res.data.items?.[0]
    if (!p) return null

    return {
      id: p.id!,
      title: p.snippet?.title || '',
      description: p.snippet?.description || '',
      itemCount: p.contentDetails?.itemCount || 0,
    }
  } catch (e) {
    console.error('YouTube getPlaylist error:', e)
    return null
  }
}

export async function getPlaylistItems(playlistId: string, pageToken?: string): Promise<YouTubeSearchResult> {
  const apiKey = getApiKey()
  if (!apiKey) return { items: [], totalResults: 0 }

  try {
    const listRes = await youtube.playlistItems.list({
      key: apiKey,
      playlistId,
      part: ['snippet', 'contentDetails'],
      maxResults: 50,
      pageToken,
    })

    const videoIds = listRes.data.items?.map(i => i.contentDetails?.videoId).filter(Boolean) as string[]
    if (!videoIds.length) return { items: [], nextPageToken: listRes.data.nextPageToken ?? undefined, totalResults: 0 }

    const detailsRes = await youtube.videos.list({
      key: apiKey,
      id: videoIds,
      part: ['snippet', 'contentDetails', 'statistics'],
    })

    const items: YouTubeVideo[] = (detailsRes.data.items || []).map(v => ({
      id: v.id!,
      title: v.snippet?.title || '',
      description: v.snippet?.description || '',
      channelId: v.snippet?.channelId || '',
      channelTitle: v.snippet?.channelTitle || '',
      thumbnail: v.snippet?.thumbnails?.medium?.url || '',
      duration: parseDuration(v.contentDetails?.duration || ''),
      viewCount: formatViewCount(v.statistics?.viewCount || '0'),
      publishedAt: v.snippet?.publishedAt || '',
    }))

    return {
      items,
      nextPageToken: listRes.data.nextPageToken ?? undefined,
      totalResults: listRes.data.pageInfo?.totalResults ?? 0,
    }
  } catch (e) {
    console.error('YouTube getPlaylistItems error:', e)
    return { items: [], totalResults: 0 }
  }
}

export interface YouTubeComment {
  id: string
  authorName: string
  authorPhoto: string
  text: string
  likeCount: number
  publishedAt: string
}

export async function getVideoComments(videoId: string): Promise<YouTubeComment[]> {
  const apiKey = getApiKey()
  if (!apiKey) return []

  try {
    const res = await youtube.commentThreads.list({
      key: apiKey,
      videoId,
      part: ['snippet'],
      order: 'relevance',
      maxResults: 20,
    })

    return (res.data.items || []).map(t => {
      const c = t.snippet?.topLevelComment?.snippet
      return {
        id: t.id!,
        authorName: c?.authorDisplayName || '',
        authorPhoto: c?.authorProfileImageUrl || '',
        text: c?.textDisplay || '',
        likeCount: c?.likeCount || 0,
        publishedAt: c?.publishedAt || '',
      }
    })
  } catch (e) {
    console.error('YouTube getVideoComments error:', e)
    return []
  }
}

export async function getTrendingVideos(): Promise<YouTubeVideo[]> {
  const apiKey = getApiKey()
  if (!apiKey) return []

  try {
    const res = await youtube.videos.list({
      key: apiKey,
      chart: 'mostPopular',
      regionCode: 'KR',
      part: ['snippet', 'contentDetails', 'statistics'],
      maxResults: 24,
    })

    return (res.data.items || []).map(v => ({
      id: v.id!,
      title: v.snippet?.title || '',
      description: v.snippet?.description || '',
      channelId: v.snippet?.channelId || '',
      channelTitle: v.snippet?.channelTitle || '',
      thumbnail: v.snippet?.thumbnails?.medium?.url || '',
      duration: parseDuration(v.contentDetails?.duration || ''),
      viewCount: formatViewCount(v.statistics?.viewCount || '0'),
      publishedAt: v.snippet?.publishedAt || '',
    }))
  } catch (e) {
    console.error('YouTube getTrendingVideos error:', e)
    return []
  }
}
