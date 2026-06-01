'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import VideoCard from '@/components/VideoCard'
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

function HomeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const query = searchParams.get('q') || ''

  const [searchQuery, setSearchQuery] = useState(query)
  const [videos, setVideos] = useState<Video[]>([])
  const [localVideos, setLocalVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(false)
  const [hasApiKey, setHasApiKey] = useState(true)
  const [nextPageToken, setNextPageToken] = useState<string | undefined>()
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    // Load trending or local content
    if (!query) {
      loadTrending()
      loadLocalRecent()
    } else {
      setSearchQuery(query)
      performSearch(query)
    }
  }, [query])

  const loadTrending = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/trending')
      const data = await res.json()
      if (data.noApiKey) setHasApiKey(false)
      setVideos(data.videos || [])
    } catch {
      setVideos([])
    } finally {
      setLoading(false)
    }
  }

  const loadLocalRecent = async () => {
    try {
      const res = await fetch('/api/library?sort=downloaded_at&limit=8')
      const data = await res.json()
      setLocalVideos((data.videos || []).map((v: { id: string; title: string; channel: string; thumbnail_path: string; duration: number; downloaded_at: string }) => ({
        id: v.id,
        title: v.title,
        channelTitle: v.channel,
        thumbnail: v.thumbnail_path ? `/api/storage/${v.id}/${encodeURIComponent(v.thumbnail_path.split('/').pop() || '')}` : '',
        duration: v.duration ? formatDuration(v.duration) : '',
        publishedAt: v.downloaded_at,
        isDownloaded: true,
      })))
    } catch {
      // ignore
    }
  }

  const performSearch = async (q: string, pageToken?: string) => {
    if (!q.trim()) return
    if (pageToken) setLoadingMore(true)
    else setLoading(true)

    try {
      const url = `/api/search?q=${encodeURIComponent(q)}&type=video${pageToken ? `&pageToken=${pageToken}` : ''}`
      const res = await fetch(url)
      const data = await res.json()
      if (data.noApiKey) setHasApiKey(false)
      if (pageToken) {
        setVideos(prev => [...prev, ...(data.items || [])])
      } else {
        setVideos(data.items || [])
      }
      setNextPageToken(data.nextPageToken)
    } catch {
      setVideos([])
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/?q=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${m}:${String(s).padStart(2, '0')}`
  }

  return (
    <div className="p-6">
      {/* No API key banner */}
      {!hasApiKey && (
        <div className="mb-6 bg-yellow-900/30 border border-yellow-700/50 rounded-xl p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="text-yellow-400 font-medium text-sm">YouTube API 키가 설정되지 않았습니다</p>
            <p className="text-yellow-600 text-xs mt-1">
              <Link href="/settings" className="underline hover:text-yellow-400">설정</Link>에서 YouTube Data API v3 키를 입력하면 검색 및 트렌딩 기능을 사용할 수 있습니다.
            </p>
          </div>
        </div>
      )}

      {/* Hero Search (when no query) */}
      {!query && (
        <div className="text-center py-12 mb-8">
          <div className="flex justify-center mb-4">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
              <rect width="64" height="64" rx="16" fill="#ff0000" />
              <polygon points="24,18 52,32 24,46" fill="white" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">
            Open<span className="text-[#ff0000]">Tube</span>
          </h1>
          <p className="text-gray-400 text-lg mb-8">오프라인에서도 동작하는 YouTube 클론</p>

          <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="YouTube에서 검색..."
                className="flex-1 bg-[#222] border border-[#444] text-white px-6 py-4 rounded-full text-base focus:outline-none focus:border-[#ff0000] placeholder-gray-500"
              />
              <button
                type="submit"
                className="bg-[#ff0000] text-white px-8 py-4 rounded-full font-medium hover:bg-red-700 transition-colors"
              >
                검색
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Recent Downloads section */}
      {!query && localVideos.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">최근 다운로드</h2>
            <Link href="/library" className="text-sm text-[#ff0000] hover:underline">
              모두 보기
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {localVideos.map(v => (
              <VideoCard key={v.id} {...v} isDownloaded />
            ))}
          </div>
        </div>
      )}

      {/* Main content */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">
            {query ? `"${query}" 검색 결과` : '인기 동영상'}
          </h2>
          {query && (
            <button
              onClick={() => router.push('/')}
              className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              초기화
            </button>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-video bg-[#2a2a2a] rounded-xl mb-3" />
                <div className="h-4 bg-[#2a2a2a] rounded mb-2" />
                <div className="h-3 bg-[#2a2a2a] rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : videos.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {videos.map(v => (
                <VideoCard key={v.id} {...v} />
              ))}
            </div>
            {nextPageToken && (
              <div className="mt-8 text-center">
                <button
                  onClick={() => performSearch(query, nextPageToken)}
                  disabled={loadingMore}
                  className="bg-[#1a1a1a] border border-[#333] text-white px-8 py-3 rounded-full hover:bg-[#222] transition-colors disabled:opacity-50"
                >
                  {loadingMore ? '로드 중...' : '더 보기'}
                </button>
              </div>
            )}
          </>
        ) : (
          !loading && (
            <div className="text-center py-16 text-gray-500">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
              </svg>
              <p className="text-lg">동영상이 없습니다</p>
              <p className="text-sm mt-1">
                {query ? '다른 검색어를 시도해보세요' : 'YouTube API 키를 설정하면 인기 동영상을 볼 수 있습니다'}
              </p>
            </div>
          )
        )}
      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="p-6 text-gray-400">로딩 중...</div>}>
      <HomeContent />
    </Suspense>
  )
}
