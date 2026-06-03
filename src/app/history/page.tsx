'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'

interface HistoryItem {
  video_id: string
  title?: string
  channel?: string
  thumbnail?: string
  watch_time: number
  watched_at: string
}

function formatWatchTime(seconds: number): string {
  if (!seconds || seconds < 1) return ''
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function groupByDate(items: HistoryItem[]): { label: string; items: HistoryItem[] }[] {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const thisWeek = new Date(today.getTime() - 6 * 86400000)
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const groups: Record<string, HistoryItem[]> = {
    '오늘': [],
    '어제': [],
    '이번 주': [],
    '이번 달': [],
    '더 이전': [],
  }

  for (const item of items) {
    const d = new Date(item.watched_at)
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    if (day >= today) groups['오늘'].push(item)
    else if (day >= yesterday) groups['어제'].push(item)
    else if (day >= thisWeek) groups['이번 주'].push(item)
    else if (day >= thisMonth) groups['이번 달'].push(item)
    else groups['더 이전'].push(item)
  }

  return Object.entries(groups)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }))
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return '방금 전'
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}일 전`
  return new Date(dateStr).toLocaleDateString('ko-KR')
}

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [filtered, setFiltered] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [clearing, setClearing] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch('/yt/api/watch-history?all=1')
      const data = await res.json()
      const items: HistoryItem[] = data.history || []
      setHistory(items)
      setFiltered(items)
    } catch {
      setHistory([])
      setFiltered([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadHistory() }, [loadHistory])

  useEffect(() => {
    if (!search.trim()) { setFiltered(history); return }
    const q = search.toLowerCase()
    setFiltered(history.filter(h =>
      h.title?.toLowerCase().includes(q) || h.channel?.toLowerCase().includes(q)
    ))
  }, [search, history])

  const removeItem = async (videoId: string) => {
    setRemoving(videoId)
    try {
      await fetch(`/yt/api/watch-history?videoId=${encodeURIComponent(videoId)}`, { method: 'DELETE' })
      setHistory(prev => prev.filter(h => h.video_id !== videoId))
    } finally {
      setRemoving(null)
    }
  }

  const clearAll = async () => {
    if (!confirm('시청 기록을 모두 삭제하시겠습니까?')) return
    setClearing(true)
    await fetch('/yt/api/watch-history', { method: 'DELETE' })
    setHistory([])
    setFiltered([])
    setClearing(false)
  }

  const groups = groupByDate(filtered)

  return (
    <div className="flex flex-col md:flex-row gap-0 h-full">
      {/* Left: History list */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-white">시청 기록</h1>
            {history.length > 0 && (
              <button
                onClick={clearAll}
                disabled={clearing}
                className="text-sm text-gray-400 hover:text-red-400 flex items-center gap-1.5 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-500/10"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                전체 삭제
              </button>
            )}
          </div>

          {/* Search */}
          {history.length > 0 && (
            <div className="relative mb-6">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="시청 기록 검색..."
                className="w-full bg-[#1a1a1a] border border-[#333] text-white pl-10 pr-4 py-2.5 rounded-xl text-sm focus:outline-none focus:border-[#ff0000] placeholder-gray-600"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          )}

          {/* Content */}
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse flex gap-4 p-3">
                  <div className="w-40 aspect-video bg-[#1a1a1a] rounded-xl flex-shrink-0" />
                  <div className="flex-1 pt-1">
                    <div className="h-4 bg-[#1a1a1a] rounded mb-2 w-4/5" />
                    <div className="h-3 bg-[#1a1a1a] rounded w-1/3 mb-1" />
                    <div className="h-3 bg-[#1a1a1a] rounded w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-gray-500">
              <svg className="w-20 h-20 mb-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xl font-medium mb-2">시청 기록이 없습니다</p>
              <p className="text-gray-600 text-sm mb-6">영상을 시청하면 여기에 자동으로 기록됩니다</p>
              <Link href="/" className="bg-[#ff0000] text-white px-6 py-2.5 rounded-full hover:bg-red-700 transition-colors text-sm font-medium">
                홈으로 가기
              </Link>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500">
              <svg className="w-12 h-12 mb-3 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p>"{search}" 에 대한 결과가 없습니다</p>
            </div>
          ) : (
            <div className="space-y-8">
              {groups.map(group => (
                <div key={group.label}>
                  <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">{group.label}</h2>
                  <div className="space-y-1">
                    {group.items.map(item => (
                      <div key={item.video_id} className="group flex gap-4 p-3 rounded-xl hover:bg-[#1a1a1a] transition-colors relative">
                        {/* Thumbnail */}
                        <Link href={`/watch/${item.video_id}`} className="flex-shrink-0">
                          <div className="relative w-40 aspect-video bg-[#111] rounded-xl overflow-hidden">
                            {item.thumbnail ? (
                              <Image src={item.thumbnail} alt={item.title || ''} fill className="object-cover" sizes="160px" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-700">
                                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                              </div>
                            )}
                            {item.watch_time > 0 && (
                              <div className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1 rounded font-medium">
                                {formatWatchTime(item.watch_time)}
                              </div>
                            )}
                          </div>
                        </Link>

                        {/* Info */}
                        <div className="flex-1 min-w-0 pt-1">
                          <Link href={`/watch/${item.video_id}`}>
                            <h3 className="text-white text-sm font-medium leading-snug line-clamp-2 hover:text-gray-200 mb-1.5">
                              {item.title || item.video_id}
                            </h3>
                          </Link>
                          {item.channel && (
                            <p className="text-gray-400 text-xs mb-1">{item.channel}</p>
                          )}
                          <p className="text-gray-600 text-xs">{relativeTime(item.watched_at)}</p>
                        </div>

                        {/* Remove button */}
                        <button
                          onClick={() => removeItem(item.video_id)}
                          disabled={removing === item.video_id}
                          className="flex-shrink-0 self-start mt-1 w-8 h-8 flex items-center justify-center text-gray-600 hover:text-white hover:bg-[#333] rounded-full transition-colors opacity-0 group-hover:opacity-100"
                          title="기록에서 삭제"
                        >
                          {removing === item.video_id ? (
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Stats panel */}
      {history.length > 0 && (
        <div className="hidden lg:block w-72 flex-shrink-0 border-l border-[#1a1a1a] p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">통계</h2>
          <div className="space-y-4">
            <div className="bg-[#1a1a1a] rounded-xl p-4">
              <p className="text-2xl font-bold text-white">{history.length}</p>
              <p className="text-gray-400 text-xs mt-0.5">시청한 영상</p>
            </div>
            <div className="bg-[#1a1a1a] rounded-xl p-4">
              <p className="text-2xl font-bold text-white">
                {Math.floor(history.reduce((s, h) => s + (h.watch_time || 0), 0) / 60)}분
              </p>
              <p className="text-gray-400 text-xs mt-0.5">총 시청 시간</p>
            </div>
            {history[0] && (
              <div className="bg-[#1a1a1a] rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-1">최근 시청</p>
                <p className="text-white text-sm font-medium line-clamp-2">{history[0].title || history[0].video_id}</p>
                <p className="text-gray-500 text-xs mt-1">{relativeTime(history[0].watched_at)}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
