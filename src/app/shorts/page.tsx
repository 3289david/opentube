'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'

interface Short {
  id: string
  title: string
  channelTitle: string
  channelId: string
  thumbnail: string
  viewCount?: string
}

export default function ShortsPage() {
  const [shorts, setShorts] = useState<Short[]>([])
  const [nextPageToken, setNextPageToken] = useState<string | undefined>()
  const [loading, setLoading] = useState(true)
  const [activeIndex, setActiveIndex] = useState(0)
  const [muted, setMuted] = useState(true)
  const [liked, setLiked] = useState<Record<string, boolean>>({})
  const [sessionToken, setSessionToken] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const loadingMoreRef = useRef(false)
  const nextPageTokenRef = useRef<string | undefined>(undefined)
  const regionRef = useRef('KR')

  useEffect(() => {
    const r = localStorage.getItem('ot_region') || 'KR'
    regionRef.current = r
    loadShorts(r)
    const token = JSON.parse(localStorage.getItem('ot_session') || '{}')?.token || ''
    setSessionToken(token)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep ref in sync so loadMore never has a stale closure
  useEffect(() => { nextPageTokenRef.current = nextPageToken }, [nextPageToken])

  // Detect active short via IntersectionObserver on the container
  // Re-runs whenever the shorts list changes so newly added items are observed
  useEffect(() => {
    const container = containerRef.current
    if (!container || shorts.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const idx = parseInt((entry.target as HTMLElement).dataset.idx ?? '0', 10)
            setActiveIndex(idx)
          }
        })
      },
      { root: container, threshold: 0.6 }
    )

    const items = container.querySelectorAll('[data-idx]')
    items.forEach(item => observer.observe(item))
    return () => observer.disconnect()
  }, [shorts])

  // Infinite scroll — sentinel inside the same scroll container
  useEffect(() => {
    const container = containerRef.current
    const sentinel = sentinelRef.current
    if (!container || !sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMoreRef.current && nextPageTokenRef.current) {
          loadMore()
        }
      },
      { root: container, threshold: 0.1 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shorts]) // re-attach after new items are appended

  const loadShorts = async (reg = regionRef.current) => {
    setLoading(true)
    try {
      const res = await fetch(`/yt/api/trending?type=shorts&region=${reg}`)
      const data = await res.json()
      setShorts(data.items || [])
      setNextPageToken(data.nextPageToken)
    } catch {
      setShorts([])
    } finally {
      setLoading(false)
    }
  }

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !nextPageTokenRef.current) return
    loadingMoreRef.current = true
    try {
      const res = await fetch(`/yt/api/trending?type=shorts&pageToken=${nextPageTokenRef.current}&region=${regionRef.current}`)
      const data = await res.json()
      setShorts(prev => [...prev, ...(data.items || [])])
      setNextPageToken(data.nextPageToken)
    } finally {
      loadingMoreRef.current = false
    }
  }, [])

  const scrollTo = (idx: number) => {
    const container = containerRef.current
    if (!container) return
    container.scrollTo({ top: idx * container.clientHeight, behavior: 'smooth' })
  }

  // Save to watch history when a short becomes active
  useEffect(() => {
    const short = shorts[activeIndex]
    if (!short) return
    fetch('/yt/api/watch-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoId: short.id,
        watchTime: 0,
        title: short.title,
        channel: short.channelTitle,
        thumbnail: short.thumbnail,
        sessionToken,
      }),
    }).catch(() => {})
  }, [activeIndex, shorts])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-black">
        <div className="animate-spin w-10 h-10 border-4 border-[#ff0000] border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="relative h-full bg-black overflow-hidden">
      {/* Up / Down navigation */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-3 pointer-events-auto">
        <button
          onClick={() => scrollTo(activeIndex - 1)}
          disabled={activeIndex === 0}
          className="w-10 h-10 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white disabled:opacity-0 transition-all"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <button
          onClick={() => scrollTo(activeIndex + 1)}
          disabled={activeIndex >= shorts.length - 1}
          className="w-10 h-10 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white disabled:opacity-0 transition-all"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Progress dots (right side) */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1 z-30">
        {shorts.slice(Math.max(0, activeIndex - 3), activeIndex + 4).map((_, i) => {
          const realIdx = Math.max(0, activeIndex - 3) + i
          return (
            <button
              key={realIdx}
              onClick={() => scrollTo(realIdx)}
              className={`rounded-full transition-all ${realIdx === activeIndex ? 'w-1.5 h-6 bg-white' : 'w-1 h-1.5 bg-white/40'}`}
            />
          )
        })}
      </div>

      {/* Snap-scroll container */}
      <div
        ref={containerRef}
        className="h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
        style={{ scrollSnapType: 'y mandatory' }}
      >
        {shorts.map((short, idx) => (
          <div
            key={short.id}
            data-idx={idx}
            className="h-full w-full snap-start snap-always relative flex items-stretch"
            style={{ scrollSnapAlign: 'start' }}
          >
            {/* Central video column — max 400px portrait */}
            <div className="flex-1 relative flex items-center justify-center bg-black">
              {/* Swipe capture strip: top and bottom dark bars capture scroll events on desktop */}
              <div className="absolute inset-x-0 top-0 h-10 z-20" />
              <div className="absolute inset-x-0 bottom-0 h-24 z-20" />

              <div className="relative w-full h-full max-w-sm mx-auto">
                {idx === activeIndex ? (
                  /* key forces iframe reload when mute toggles */
                  <iframe
                    key={`${short.id}-${muted ? 'm' : 'u'}`}
                    src={`https://www.youtube.com/embed/${short.id}?autoplay=1&mute=${muted ? 1 : 0}&loop=1&playlist=${short.id}&rel=0&modestbranding=1&controls=1`}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title={short.title}
                  />
                ) : (
                  <button
                    className="w-full h-full relative block"
                    onClick={() => scrollTo(idx)}
                    aria-label={short.title}
                  >
                    <Image
                      src={short.thumbnail}
                      alt={short.title}
                      fill
                      className="object-cover"
                      sizes="400px"
                    />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                      </div>
                    </div>
                  </button>
                )}

                {/* Bottom info overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-4 pb-6 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-10 pointer-events-none">
                  <p className="text-white text-sm font-semibold line-clamp-2 mb-1">{short.title}</p>
                  <Link
                    href={`/channel/${short.channelId}`}
                    className="text-gray-300 text-xs hover:underline pointer-events-auto"
                  >
                    @{short.channelTitle}
                  </Link>
                  {short.viewCount && (
                    <p className="text-gray-400 text-xs mt-0.5">조회수 {short.viewCount}회</p>
                  )}
                </div>
              </div>
            </div>

            {/* Right action panel */}
            <div className="flex flex-col items-center justify-end gap-5 pb-24 pr-4 z-30 flex-shrink-0 w-16">
              {/* Like */}
              <button
                onClick={() => setLiked(prev => ({ ...prev, [short.id]: !prev[short.id] }))}
                className="flex flex-col items-center gap-1"
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${liked[short.id] ? 'bg-[#ff0000]' : 'bg-white/10 backdrop-blur-sm'}`}>
                  <svg className="w-6 h-6 text-white" fill={liked[short.id] ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </div>
                <span className="text-white text-xs">좋아요</span>
              </button>

              {/* Comment — opens watch page */}
              <Link href={`/watch/${short.id}`} className="flex flex-col items-center gap-1">
                <div className="w-12 h-12 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <span className="text-white text-xs">댓글</span>
              </Link>

              {/* Share */}
              <button
                onClick={() => navigator.clipboard?.writeText(`https://youtube.com/shorts/${short.id}`)}
                className="flex flex-col items-center gap-1"
              >
                <div className="w-12 h-12 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                </div>
                <span className="text-white text-xs">공유</span>
              </button>

              {/* Download (go to watch page) */}
              <Link href={`/watch/${short.id}`} className="flex flex-col items-center gap-1">
                <div className="w-12 h-12 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </div>
                <span className="text-white text-xs">저장</span>
              </Link>

              {/* Mute toggle */}
              <button onClick={() => setMuted(m => !m)} className="flex flex-col items-center gap-1">
                <div className="w-12 h-12 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center">
                  {muted ? (
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                    </svg>
                  ) : (
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
                    </svg>
                  )}
                </div>
                <span className="text-white text-xs">{muted ? '음소거' : '소리'}</span>
              </button>
            </div>
          </div>
        ))}

        {/* Infinite scroll sentinel — NOT a snap target */}
        <div ref={sentinelRef} className="h-2 flex-shrink-0" />
      </div>
    </div>
  )
}
