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

function HomeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const query = searchParams.get('q') || ''
  const tab = searchParams.get('tab') || 'video'

  const [searchQuery, setSearchQuery] = useState(query)
  const [activeCategory, setActiveCategory] = useState('전체')
  const [activeTab, setActiveTab] = useState(tab)

  const [videos, setVideos] = useState<Video[]>([])
  const [shorts, setShorts] = useState<Video[]>([])
  const [localVideos, setLocalVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [nextPageToken, setNextPageToken] = useState<string | undefined>()

  const sentinelRef = useRef<HTMLDivElement>(null)
  const loadingMoreRef = useRef(false)

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (query) {
      setSearchQuery(query)
      setActiveTab(tab)
      runSearch(query, undefined, tab)
    } else {
      loadHome('전체')
      loadShorts()
      loadLocalRecent()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, tab])

  // ── IntersectionObserver — auto load more ───────────────────────────────────
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMoreRef.current && nextPageToken) {
          fetchMore()
        }
      },
      { rootMargin: '400px' }   // trigger 400px before bottom
    )
    if (sentinelRef.current) observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextPageToken])

  // ── Data fetchers ────────────────────────────────────────────────────────────
  const loadHome = async (category: string, pageToken?: string) => {
    if (!pageToken) setLoading(true)
    try {
      let url: string
      if (category === '전체') {
        url = '/yt/api/trending'
      } else {
        url = `/yt/api/trending?type=category&category=${encodeURIComponent(category)}${pageToken ? `&pageToken=${pageToken}` : ''}`
      }
      const res = await fetch(url)
      const data = await res.json()
      const items: Video[] = data.videos || data.items || []
      if (pageToken) {
        setVideos(prev => [...prev, ...items])
      } else {
        setVideos(items)
      }
      setNextPageToken(data.nextPageToken)
    } catch {
      if (!pageToken) setVideos([])
    } finally {
      setLoading(false)
    }
  }

  const loadShorts = async () => {
    try {
      const res = await fetch('/yt/api/trending?type=shorts')
      const data = await res.json()
      setShorts((data.items || []).slice(0, 12))
    } catch {
      setShorts([])
    }
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
      const res = await fetch(`/yt/api/search?q=${encodeURIComponent(q)}&type=${type}${pageToken ? `&pageToken=${pageToken}` : ''}`)
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
      if (query) {
        await runSearch(query, nextPageToken, activeTab)
      } else {
        await loadHome(activeCategory, nextPageToken)
      }
    } finally {
      loadingMoreRef.current = false
      setLoadingMore(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextPageToken, query, activeCategory, activeTab])

  const switchCategory = (cat: string) => {
    setActiveCategory(cat)
    setVideos([])
    setNextPageToken(undefined)
    loadHome(cat)
  }

  const switchTab = (t: string) => {
    setActiveTab(t)
    if (query) {
      setVideos([])
      setNextPageToken(undefined)
      router.push(`/yt?q=${encodeURIComponent(query)}&tab=${t}`)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/yt?q=${encodeURIComponent(searchQuery.trim())}&tab=${activeTab}`)
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
          <button onClick={() => router.push('/yt')} className="ml-auto mb-1 text-xs text-gray-500 hover:text-white flex items-center gap-1 px-2">
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
              <Link href="/yt/library" className="text-xs text-[#ff0000] hover:underline">모두 보기</Link>
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
              <Link href="/yt/shorts" className="text-xs text-[#ff0000] hover:underline">모두 보기</Link>
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
            {isSearchMode ? `"${query}" 검색 결과` : activeCategory === '전체' ? '인기 동영상' : activeCategory}
          </h2>
        )}

        {/* ── Video grid ────────────────────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 20 }).map((_, i) => (
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
        ) : !loading && (
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

        {/* ── Loading more indicator ─────────────────────────────────────── */}
        {loadingMore && (
          <div className="flex justify-center py-8">
            <div className="flex gap-2 items-center text-gray-400">
              <div className="w-5 h-5 border-2 border-[#ff0000] border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">로드 중...</span>
            </div>
          </div>
        )}

        {/* ── End of results ─────────────────────────────────────────────── */}
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
