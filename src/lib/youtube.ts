import { google } from 'googleapis'

const youtube = google.youtube('v3')

const YOUTUBE_API_KEY = 'AIzaSyBcTJHDdslZmIrm6txfMSVY4oU5kzfL3KQ'

function getApiKey(): string {
  return YOUTUBE_API_KEY
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

const REGION_LANGUAGE: Record<string, string> = {
  KR: 'ko', JP: 'ja', TW: 'zh-Hant', CN: 'zh-Hans',
  US: 'en', GB: 'en', AU: 'en', CA: 'en', NZ: 'en',
  DE: 'de', AT: 'de', CH: 'de',
  FR: 'fr', BE: 'fr',
  IN: 'hi', BD: 'bn',
  BR: 'pt', PT: 'pt',
  MX: 'es', ES: 'es', AR: 'es', CO: 'es', CL: 'es',
  IT: 'it', RU: 'ru', TH: 'th', VN: 'vi', ID: 'id',
  PH: 'tl', MY: 'ms', SG: 'en', NL: 'nl', PL: 'pl',
  TR: 'tr', SA: 'ar', AE: 'ar', EG: 'ar',
}

const SHORTS_QUERY: Record<string, string> = {
  KR: '쇼츠 한국',
  JP: 'ショート 日本',
  TW: '台灣 短片',
  CN: '中国 短视频',
  TH: 'ไทย ชอร์ต',
  VN: 'Việt Nam shorts',
  IN: 'India shorts hindi',
  ID: 'Indonesia shorts',
  DE: 'Deutschland shorts',
  FR: 'France shorts',
  BR: 'Brasil shorts',
  MX: 'México shorts',
  RU: 'Россия shorts',
  TR: 'Türkiye shorts',
  SA: 'عربي shorts',
}

const TRENDING_QUERY: Record<string, string> = {
  ko: '한국 인기 동영상',
  ja: '日本 人気 動画',
  'zh-Hant': '台灣 熱門 影片',
  'zh-Hans': '中国 热门 视频',
  hi: 'India popular video hindi',
  pt: 'Brasil popular vídeos',
  es: 'popular videos español',
  de: 'Deutschland beliebte Videos',
  fr: 'France vidéos populaires',
  ru: 'Россия популярные видео',
  tr: 'Türkiye popüler video',
  ar: 'عربي فيديو شعبي',
  th: 'ไทย วิดีโอยอดนิยม',
  vi: 'Việt Nam video phổ biến',
  id: 'Indonesia video populer',
  tl: 'Pilipinas popular video',
  ms: 'Malaysia video popular',
  nl: 'Nederland populaire video',
  pl: 'Polska popularne wideo',
  it: 'Italia video popolari',
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

// Script ranges for hard filtering — returns true if title contains target-language characters
const SCRIPT_REGEX: Record<string, RegExp> = {
  ko: /[가-힯ᄀ-ᇿㄱ-ㆎ]/,
  ja: /[぀-ゟ゠-ヿ一-鿿]/,
  'zh-Hant': /[一-鿿㐀-䶿]/,
  'zh-Hans': /[一-鿿㐀-䶿]/,
  th: /[฀-๿]/,
  ar: /[؀-ۿ]/,
  ru: /[Ѐ-ӿ]/,
  hi: /[ऀ-ॿ]/,
  tr: /[ğşıöüçĞŞİÖÜÇ]/,
}

function hasTargetScript(title: string, lang?: string): boolean {
  if (!lang || lang === 'en') return true
  const re = SCRIPT_REGEX[lang]
  if (!re) return true
  return re.test(title)
}

// Ensure query has language-native terms so YouTube returns language-filtered results
function localizeQuery(q: string, lang?: string, regionCode?: string): string {
  if (!lang || lang === 'en') return q
  const trendingTerm = TRENDING_QUERY[lang]
  if (!trendingTerm) return q
  // If query already contains target-script chars, leave it alone
  const re = SCRIPT_REGEX[lang]
  if (re && re.test(q)) return q
  // Prepend region keyword so YouTube favors target language even for Latin queries
  const prefix = regionCode === 'KR' ? '한국' : regionCode === 'JP' ? '日本' : regionCode === 'TW' ? '台灣' : ''
  return prefix ? `${prefix} ${q}` : q
}

export async function searchVideos(query: string, pageToken?: string, regionCode = 'KR'): Promise<YouTubeSearchResult> {
  const apiKey = getApiKey()

  const lang = REGION_LANGUAGE[regionCode]
  try {
    const searchRes = await youtube.search.list({
      key: apiKey,
      q: query,
      part: ['snippet'],
      type: ['video'],
      maxResults: 20,
      pageToken: pageToken,
      regionCode,
      ...(lang ? { relevanceLanguage: lang } : {}),
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

export async function getTrendingVideos(regionCode = 'KR', pageToken?: string): Promise<{ items: YouTubeVideo[], nextPageToken?: string }> {
  const apiKey = getApiKey()
  const lang = REGION_LANGUAGE[regionCode]
  const trendingQuery = lang ? TRENDING_QUERY[lang] : undefined

  // For regions with a non-English language, use search.list + relevanceLanguage
  // because videos.list chart=mostPopular doesn't support relevanceLanguage
  if (trendingQuery && lang !== 'en') {
    try {
      const searchRes = await youtube.search.list({
        key: apiKey,
        q: trendingQuery,
        part: ['snippet'],
        type: ['video'],
        order: 'viewCount',
        regionCode,
        relevanceLanguage: lang,
        maxResults: 24,
        pageToken,
        videoDuration: 'medium',
        safeSearch: 'none',
      })

      const videoIds = searchRes.data.items?.map(i => i.id?.videoId).filter(Boolean) as string[]
      if (!videoIds.length) return { items: [] }

      const detailsRes = await youtube.videos.list({
        key: apiKey,
        id: videoIds,
        part: ['snippet', 'contentDetails', 'statistics'],
      })

      const allItems: YouTubeVideo[] = (detailsRes.data.items || []).map(v => ({
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
      // Hard-filter: drop titles that don't contain target-language script
      const items = allItems.filter(v => hasTargetScript(v.title, lang))
      return { items: items.length >= 4 ? items : allItems, nextPageToken: searchRes.data.nextPageToken ?? undefined }
    } catch (e) {
      console.error('YouTube getTrendingVideos (search) error:', e)
    }
  }

  // English regions or fallback: use chart mostPopular
  try {
    const res = await youtube.videos.list({
      key: apiKey,
      chart: 'mostPopular',
      regionCode,
      part: ['snippet', 'contentDetails', 'statistics'],
      maxResults: 24,
      pageToken,
    })

    const items = (res.data.items || []).map(v => ({
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
    return { items, nextPageToken: res.data.nextPageToken ?? undefined }
  } catch (e) {
    console.error('YouTube getTrendingVideos error:', e)
    return { items: [] }
  }
}

export async function getShorts(pageToken?: string, regionCode = 'KR'): Promise<YouTubeSearchResult> {
  const apiKey = getApiKey()
  const lang = REGION_LANGUAGE[regionCode]
  const q = SHORTS_QUERY[regionCode] || '#Shorts'
  try {
    const searchRes = await youtube.search.list({
      key: apiKey,
      q,
      part: ['snippet'],
      type: ['video'],
      videoDuration: 'short',
      order: 'viewCount',
      regionCode,
      ...(lang ? { relevanceLanguage: lang } : {}),
      maxResults: 20,
      pageToken,
    })

    const videoIds = searchRes.data.items?.map(i => i.id?.videoId).filter(Boolean) as string[]
    if (!videoIds.length) return { items: [], nextPageToken: undefined, totalResults: 0 }

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
      thumbnail: v.snippet?.thumbnails?.high?.url || v.snippet?.thumbnails?.medium?.url || '',
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
    console.error('YouTube getShorts error:', e)
    return { items: [], totalResults: 0 }
  }
}

export async function getVideosByCategory(category: string, pageToken?: string, regionCode = 'KR'): Promise<YouTubeSearchResult> {
  const apiKey = getApiKey()
  const lang = REGION_LANGUAGE[regionCode]

  // Korean-primary queries; other regions fall back to English/mixed
  const categoryQueriesKO: Record<string, string> = {
    '음악': '음악 한국 노래',
    '게임': '게임 한국 플레이',
    '뉴스': '한국 뉴스 시사',
    '스포츠': '한국 스포츠',
    '코딩': '한국 개발 프로그래밍',
    '요리': '한국 요리 레시피',
    '여행': '한국 여행 브이로그',
    '교육': '한국 강의 교육',
    '엔터': '한국 예능 재미',
  }
  const categoryQueriesEN: Record<string, string> = {
    '음악': 'music popular songs',
    '게임': 'gaming popular',
    '뉴스': 'news today',
    '스포츠': 'sports highlights',
    '코딩': 'coding tutorial programming',
    '요리': 'cooking recipe',
    '여행': 'travel vlog',
    '교육': 'education tutorial',
    '엔터': 'entertainment funny',
  }

  const rawQ = category
  const q = lang === 'ko'
    ? (categoryQueriesKO[category] || `한국 ${rawQ}`)
    : lang && lang !== 'en'
      ? localizeQuery(categoryQueriesEN[category] || rawQ, lang, regionCode)
      : (categoryQueriesEN[category] || rawQ)

  try {
    const searchRes = await youtube.search.list({
      key: apiKey,
      q,
      part: ['snippet'],
      type: ['video'],
      order: 'viewCount',
      regionCode,
      ...(lang ? { relevanceLanguage: lang } : {}),
      maxResults: 20,
      pageToken,
      videoDuration: 'medium',
    })

    const videoIds = searchRes.data.items?.map(i => i.id?.videoId).filter(Boolean) as string[]
    if (!videoIds.length) return { items: [], nextPageToken: undefined, totalResults: 0 }

    const detailsRes = await youtube.videos.list({
      key: apiKey,
      id: videoIds,
      part: ['snippet', 'contentDetails', 'statistics'],
    })

    const allItems: YouTubeVideo[] = (detailsRes.data.items || []).map(v => ({
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

    const items = lang !== 'en' ? allItems.filter(v => hasTargetScript(v.title, lang)) : allItems

    return {
      items: items.length >= 4 ? items : allItems,
      nextPageToken: searchRes.data.nextPageToken ?? undefined,
      totalResults: searchRes.data.pageInfo?.totalResults ?? 0,
    }
  } catch (e) {
    console.error('YouTube getVideosByCategory error:', e)
    return { items: [], totalResults: 0 }
  }
}

// Build a personalized feed from topics + channel IDs + trending
export async function getRecommendedFeed(
  topics: string[],          // keywords extracted from watch history / likes
  channelIds: string[],      // subscribed channel IDs
  regionCode = 'KR',
  pageToken?: string
): Promise<YouTubeSearchResult> {
  const apiKey = getApiKey()

  try {
    const seen = new Set<string>()
    const allItems: YouTubeVideo[] = []

    const lang = REGION_LANGUAGE[regionCode]
    // Fetch topic-based search results (up to 3 queries, 8 results each)
    const querySlice = topics.slice(0, 3)
    const topicPromises = querySlice.map(q =>
      youtube.search.list({
        key: apiKey,
        q: localizeQuery(q, lang, regionCode),
        part: ['snippet'],
        type: ['video'],
        maxResults: 8,
        regionCode,
        ...(lang ? { relevanceLanguage: lang } : {}),
        pageToken,
        order: 'relevance',
      }).catch(() => null)
    )

    // Fetch recent videos from subscribed channels (up to 2 channels)
    const chanSlice = channelIds.slice(0, 2)
    const chanPromises = chanSlice.map(channelId =>
      youtube.search.list({
        key: apiKey,
        channelId,
        part: ['snippet'],
        type: ['video'],
        maxResults: 4,
        order: 'date',
      }).catch(() => null)
    )

    const results = await Promise.all([...topicPromises, ...chanPromises])
    const videoIds: string[] = []
    let nextToken: string | undefined

    for (const res of results) {
      if (!res) continue
      if (!nextToken && res.data.nextPageToken) nextToken = res.data.nextPageToken
      for (const item of res.data.items || []) {
        const id = item.id?.videoId
        if (id && !seen.has(id)) { seen.add(id); videoIds.push(id) }
      }
    }

    if (!videoIds.length) {
      return getTrendingVideos(regionCode).then(result => ({
        items: result.items,
        nextPageToken: result.nextPageToken,
        totalResults: result.items.length,
      }))
    }

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

    // Post-filter: remove videos whose titles don't contain target-language script
    const filtered = lang !== 'en' ? items.filter(v => hasTargetScript(v.title, lang)) : items
    const finalItems = filtered.length >= 4 ? filtered : items

    // Shuffle for variety
    for (let i = finalItems.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [finalItems[i], finalItems[j]] = [finalItems[j], finalItems[i]]
    }

    return { items: finalItems, nextPageToken: nextToken, totalResults: allItems.length }
  } catch (e) {
    console.error('getRecommendedFeed error:', e)
    return { items: [], totalResults: 0 }
  }
}
