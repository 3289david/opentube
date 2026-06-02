'use client'

import { useState, useEffect } from 'react'
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

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
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
  const [loading, setLoading] = useState(true)
  const [clearing, setClearing] = useState(false)

  useEffect(() => {
    fetch('/yt/api/watch-history?all=1')
      .then(r => r.json())
      .then(d => setHistory(d.history || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const clearHistory = async () => {
    if (!confirm('시청 기록을 모두 삭제하시겠습니까?')) return
    setClearing(true)
    await fetch('/yt/api/watch-history', { method: 'DELETE' })
    setHistory([])
    setClearing(false)
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">시청 기록</h1>
        {history.length > 0 && (
          <button
            onClick={clearHistory}
            disabled={clearing}
            className="text-sm text-gray-400 hover:text-red-400 flex items-center gap-1.5 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            기록 삭제
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse flex gap-4 bg-[#1a1a1a] rounded-xl p-3">
              <div className="w-36 aspect-video bg-[#2a2a2a] rounded-lg flex-shrink-0" />
              <div className="flex-1">
                <div className="h-4 bg-[#2a2a2a] rounded mb-2 w-3/4" />
                <div className="h-3 bg-[#2a2a2a] rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : history.length === 0 ? (
        <div className="text-center py-20">
          <svg className="w-20 h-20 mx-auto mb-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xl text-gray-400 mb-2">시청 기록이 없습니다</p>
          <p className="text-gray-600 text-sm mb-4">영상을 시청하면 여기에 기록됩니다</p>
          <Link href="/yt" className="bg-[#ff0000] text-white px-6 py-2 rounded-full hover:bg-red-700 transition-colors">
            홈으로
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {history.map((item) => (
            <Link
              key={item.video_id}
              href={`/yt/watch/${item.video_id}`}
              className="flex gap-4 bg-[#1a1a1a] border border-[#333] rounded-xl p-3 hover:bg-[#222] transition-colors group"
            >
              <div className="relative w-36 aspect-video bg-[#0a0a0a] rounded-lg overflow-hidden flex-shrink-0">
                {item.thumbnail ? (
                  <Image src={item.thumbnail} alt={item.title || ''} fill className="object-cover" sizes="144px" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </div>
                )}
                {item.watch_time > 0 && (
                  <div className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1 rounded">
                    {formatTime(item.watch_time)}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-white text-sm font-medium line-clamp-2 group-hover:text-gray-200 mb-1">
                  {item.title || item.video_id}
                </h3>
                {item.channel && (
                  <p className="text-gray-400 text-xs mb-1">{item.channel}</p>
                )}
                <p className="text-gray-600 text-xs">{relativeTime(item.watched_at)}</p>
              </div>
              <div className="flex items-center">
                <svg className="w-4 h-4 text-gray-600 group-hover:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
