'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import VideoCard from '@/components/VideoCard'
import ShortsCard from '@/components/ShortsCard'
import Link from 'next/link'

interface Video {
  id: string
  title: string
  channelTitle: string
  thumbnail: string
  duration: string
  viewCount?: string
  publishedAt?: string
  isDownloaded?: boolean
}

const CATEGORIES = ['전체', '음악', '게임', '뉴스', '스포츠', '코딩', '요리', '여행', '교육', '엔터']

const REGIONS = [
  { code: 'KR', label: '한국', flag: '🇰🇷' },
  { code: 'US', label: '미국', flag: '🇺🇸' },
  { code: 'JP', label: '일본', flag: '🇯🇵' },
  { code: 'TW', label: '대만', flag: '🇹🇼' },
  { code: 'GB', label: '영국', flag: '🇬🇧' },
  { code: 'DE', label: '독일', flag: '🇩🇪' },
  { code: 'FR', label: '프랑스', flag: '🇫🇷' },
  { code: 'IN', label: '인도', flag: '🇮🇳' },
  { code: 'BR', label: '브라질', flag: '🇧🇷' },
  { code: 'AU', label: '호주', flag: '🇦🇺' },
  { code: 'CA', label: '캐나다', flag: '🇨🇦' },
  { code: 'MX', label: '멕시코', flag: '🇲🇽' },
  { code: 'ID', label: '인도네시아', flag: '🇮🇩' },
  { code: 'TH', label: '태국', flag: '🇹🇭' },
  { code: 'VN', label: '베트남', flag: '🇻🇳' },
  { code: 'PH', label: '필리핀', flag: '🇵🇭' },
  { code: 'SG', label: '싱가포르', flag: '🇸🇬' },
  { code: 'RU', label: '러시아', flag: '🇷🇺' },
  { code: 'IT', label: '이탈리아', flag: '🇮🇹' },
  { code: 'ES', label: '스페인', flag: '🇪🇸' },
]

function detectRegion(): string {
  if (typeof localStorage === 'undefined') return 'KR'
  const stored = localStorage.getItem('ot_region')
  if (stored) return stored
  const lang = typeof navigator !== 'undefined' ? navigator.language : 'ko'
  const map: Record<string, string> = {
    ko: 'KR', ja: 'JP', zh: 'TW', en: 'US', de: 'DE', fr: 'FR',
    pt: 'BR', es: 'ES', it: 'IT', ru: 'RU', hi: 'IN', th: 'TH',
    vi: 'VN', id: 'ID', tl: 'PH',
  }
  return map[lang.split('-')[0]] || 'KR'
}

function HomeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const query = searchParams.get('q') || ''
  const tab = searchParams.get('tab') || 'video'

  const [searchQuery, setSearchQuery] = useState(query)
  const [activeCategory, setActiveCategory] = useState('전체')
  const [activeTab, setActiveTab] = useState(tab)
  const [region, setRegion] = useState('KR')
  const [regionReady, setRegionReady] = useState(false)

  const [videos, setVideos] = useState<Video[]>([])
  const [shorts, setShorts] = useState<Video[]>([])
  const [localVideos, setLocalVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [nextPageToken, setNextPageToken] = useState<string | undefined>()
  const [isPersonalized, setIsPersonalized] = useState(false)

  const sentinelRef = useRef<HTMLDivElement>(null)
  const loadingMoreRef = useRef(false)

  // Init region from localStorage on client
  useEffect(() => {
    const r = detectRegion()
    setRegion(r)
    setRegionReady(true)
  }, [])

  // Load home when region is ready (and no search query)
  useEffect(() => {
    if (!regionReady || query) return
    setVideos([])
    setNextPageToken(undefined)
    loadHome('전체', undefined, region)
    loadShorts(region)
    loadLocalRecent()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionReady, region])

  // Load search results when query changes
  useEffect(() => {
    if (!query) return
    setSearchQuery(query)
    setActiveTab(tab)
    runSearch(query, undefined, tab)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, tab])

  // IntersectionObserver — auto load more
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMoreRef.current && nextPageToken) {
          fetchMore()
        }
      },
      { rootMargin: '400px' }
    )
    if (sentinelRef.current) observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextPageToken])

  // ── Data fetchers ────────────────────────────────────────────────────────────
  const loadHome = async (category: string, pageToken?: string, reg = region) => {
    if (!pageToken) setLoading(true)
    try {
      if (category === '전체') {
        let sessionToken: string | null = null
        try {
          const stored = localStorage.getItem('ot_session')
          if (stored) sessionToken = JSON.parse(stored).token
        } catch { /* */ }
        const recUrl = `/yt/api/recommendations?region=${reg}${sessionToken ? `&sessionToken=${encodeURIComponent(sessionToken)}` : ''}${pageToken ? `&pageToken=${pageToken}` : ''}`
        const res = await fetch(recUrl)
        const data = await res.json()
        const items: Video[] = data.items || []
        if (pageToken) setVideos(prev => [...prev, ...items])
        else setVideos(items)
        setNextPageToken(data.nextPageToken)
        setIsPersonalized(data.isPersonalized ?? false)
      } else {
        const url = `/yt/api/trending?type=category&category=${encodeURIComponent(category)}&region=${reg}${pageToken ? `&pageToken=${pageToken}` : ''}`
        const res = await fetch(url)
        const data = await res.json()
        const items: Video[] = data.videos || data.items || []
        if (pageToken) setVideos(prev => [...prev, ...items])
        else setVideos(items)
        setNextPageToken(data.nextPageToken)
        setIsPersonalized(false)
      }
    } catch {
      if (!pageToken) setVideos([])
    } finally {
      setLoading(false)
    }
  }

  const loadShorts = async (reg = region) => {
    try {
      const res = await fetch(`/yt/api/trending?type=shorts&region=${reg}`)
      const data = await res.json()
      setShorts((data.items || []).slice(0, 12))
    } catch { setShorts([]) }
  }

  const loadLocalRecent = async () => {
    try {
      const res = await fetch('/yt/api/library?sort=downloaded_at&limit=8')
      const data = await res.json()
      setLocalVideos((data.videos || []).map((v: { id: string; title: string; channel: string; thumbnail_path: string; duration: number; downloaded_at: string }) => ({
        id: v.id,
        title: v.title,
        channelTitle: v.channel,
        thumbnail: v.thumbnail_path ? `/yt/api/storage/${v.id}/${encodeURIComponent(v.thumbnail_path.split('/').pop() || '')}` : '',
        duration: formatDuration(v.duration),
        publishedAt: v.downloaded_at,
        isDownloaded: true,
      })))
    } catch { /* ignore */ }
  }

  const runSearch = async (q: string, pageToken?: string, type = activeTab) => {
    if (!q.trim()) return
    if (pageToken) setLoadingMore(true)
    else setLoading(true)
    try {
      const res = await fetch(`/yt/api/search?q=${encodeURIComponent(q)}&type=${type}&region=${region}${pageToken ? `&pageToken=${pageToken}` : ''}`)
      const data = await res.json()
      const items: Video[] = data.items || []
      if (pageToken) setVideos(prev => [...prev, ...items])
      else setVideos(items)
      setNextPageToken(data.nextPageToken)
    } catch {
      if (!pageToken) setVideos([])
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  const fetchMore = useCallback(async () => {
    if (loadingMoreRef.current || !nextPageToken) return
    loadingMoreRef.current = true
    setLoadingMore(true)
    try {
      if (query) await runSearch(query, nextPageToken, activeTab)
      else await loadHome(activeCategory, nextPageToken)
    } finally {
      loadingMoreRef.current = false
      setLoadingMore(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextPageToken, query, activeCategory, activeTab, region])

  const switchCategory = (cat: string) => {
    setActiveCategory(cat)
    setVideos([])
    setNextPageToken(undefined)
    loadHome(cat)
  }

  const switchRegion = (r: string) => {
    if (r === region) return
    localStorage.setItem('ot_region', r)
    setRegion(r)
    setActiveCategory('전체')
    setVideos([])
    setNextPageToken(undefined)
    loadHome('전체', undefined, r)
    loadShorts(r)
  }

  const switchTab = (t: string) => {
    setActiveTab(t)
    if (query) {
      setVideos([])
      setNextPageToken(undefined)
      router.push(`/?q=${encodeURIComponent(query)}&tab=${t}`)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/?q=${encodeURIComponent(searchQuery.trim())}&tab=${activeTab}`)
    }
  }

  function formatDuration(seconds: number): string {
    if (!seconds) return ''
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${m}:${String(s).padStart(2, '0')}`
  }

  const isSearchMode = !!query
  const currentRegion = REGIONS.find(r => r.code === region)

  return (
    <div className="flex flex-col min-h-full">

      {/* ── Hero search (no query) ─────────────────────────────────────── */}
      {!isSearchMode && (
        <div className="text-center pt-10 pb-6 px-6">
          <div className="flex justify-center mb-3">
            <svg width="48" height="48" viewBox="0 0 64 64" fill="none">
              <rect width="64" height="64" rx="14" fill="#ff0000" />
              <polygon points="24,18 52,32 24,46" fill="white" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">
            Open<span className="text-[#ff0000]">Tube</span>
          </h1>
          <p className="text-gray-500 text-sm mb-6">오프라인에서도 동작하는 YouTube 클론</p>
          <form onSubmit={handleSearch} className="max-w-xl mx-auto">
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="YouTube에서 검색..."
                className="flex-1 bg-[#222] border border-[#444] text-white px-5 py-3.5 rounded-full text-sm focus:outline-none focus:border-[#ff0000] placeholder-gray-500"
              />
              <button type="submit" className="bg-[#ff0000] text-white px-6 py-3.5 rounded-full font-medium hover:bg-red-700 transition-colors text-sm">
                검색
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Region selector (no query) ─────────────────────────────────── */}
      {!isSearchMode && (
        <div className="flex gap-1.5 px-4 pb-2 overflow-x-auto scrollbar-hide flex-shrink-0">
          {REGIONS.map(r => (
            <button
              key={r.code}
              onClick={() => switchRegion(r.code)}
              className={`flex-shrink-0 flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                region === r.code
                  ? 'bg-[#ff0000] text-white'
                  : 'bg-[#1a1a1a] text-gray-400 hover:bg-[#2a2a2a] hover:text-white border border-[#333]'
              }`}
            >
              <span>{r.flag}</span>
              <span className="hidden sm:inline">{r.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Category chips (no query) ──────────────────────────────────── */}
      {!isSearchMode && (
        <div className="flex gap-2 px-4 pb-4 overflow-x-auto scrollbar-hide flex-shrink-0">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => switchCategory(cat)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeCategory === cat
                  ? 'bg-white text-black'
                  : 'bg-[#272727] text-gray-300 hover:bg-[#3d3d3d]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* ── Search tabs (query mode) ───────────────────────────────────── */}
      {isSearchMode && (
        <div className="flex gap-1 px-4 pt-4 border-b border-[#333] flex-shrink-0">
          {[{ key: 'video', label: '동영상' }, { key: 'channel', label: '채널' }].map(t => (
            <button
              key={t.key}
              onClick={() => switchTab(t.key)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === t.key ? 'border-[#ff0000] text-white' : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
          <button onClick={() => router.push('/')} className="ml-auto mb-1 text-xs text-gray-500 hover:text-white flex items-center gap-1 px-2">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            초기화
          </button>
        </div>
      )}

      <div className="flex-1 px-4 pb-6">

        {/* ── Recent downloads ──────────────────────────────────────────── */}
        {!isSearchMode && localVideos.length > 0 && (
          <div className="mb-6 mt-2">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-white">최근 다운로드</h2>
              <Link href="/library" className="text-xs text-[#ff0000] hover:underline">모두 보기</Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
              {localVideos.map(v => <VideoCard key={v.id} {...v} isDownloaded />)}
            </div>
          </div>
        )}

        {/* ── Shorts row ────────────────────────────────────────────────── */}
        {!isSearchMode && shorts.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-[#ff0000] rounded flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                </div>
                <h2 className="text-base font-bold text-white">Shorts</h2>
              </div>
              <Link href="/shorts" className="text-xs text-[#ff0000] hover:underline">모두 보기</Link>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {shorts.map(s => (
                <ShortsCard
                  key={s.id}
                  id={s.id}
                  title={s.title}
                  channelTitle={s.channelTitle}
                  thumbnail={s.thumbnail}
                  viewCount={s.viewCount}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Section title ─────────────────────────────────────────────── */}
        {!loading && (
          <h2 className="text-base font-bold text-white mb-4">
            {isSearchMode
              ? `"${query}" 검색 결과`
              : activeCategory === '전체'
                ? isPersonalized
                  ? '✨ 추천 영상'
                  : `🔥 인기 동영상 ${currentRegion ? `· ${currentRegion.flag} ${currentRegion.label}` : ''}`
                : activeCategory}
          </h2>
        )}

        {/* ── Video grid ────────────────────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 16 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-video bg-[#272727] rounded-xl mb-3" />
                <div className="flex gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#272727] flex-shrink-0" />
                  <div className="flex-1">
                    <div className="h-3.5 bg-[#272727] rounded mb-2 w-4/5" />
                    <div className="h-3 bg-[#272727] rounded w-3/5" />
                    <div className="h-3 bg-[#272727] rounded w-2/5 mt-1" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : videos.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {videos.map(v => <VideoCard key={v.id} {...v} />)}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <svg className="w-16 h-16 mb-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-lg">결과가 없습니다</p>
            <p className="text-sm mt-1">다른 검색어를 시도해보세요</p>
          </div>
        )}

        {/* ── Infinite scroll sentinel ───────────────────────────────────── */}
        <div ref={sentinelRef} className="h-1 mt-4" />

        {loadingMore && (
          <div className="flex justify-center py-8">
            <div className="flex gap-2 items-center text-gray-400">
              <div className="w-5 h-5 border-2 border-[#ff0000] border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">로드 중...</span>
            </div>
          </div>
        )}

        {!nextPageToken && videos.length > 0 && !loadingMore && (
          <p className="text-center text-gray-600 text-xs py-6">모든 영상을 불러왔습니다</p>
        )}
      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full">
        <div className="w-10 h-10 border-4 border-[#ff0000] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <HomeContent />
    </Suspense>
  )
}
