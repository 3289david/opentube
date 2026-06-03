'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import VideoCard from '@/components/VideoCard'

interface PlaylistInfo {
  id: string
  title: string
  description: string
  itemCount: number
}

interface Video {
  id: string
  title: string
  channelTitle: string
  thumbnail: string
  duration: string
  viewCount: string
  publishedAt: string
}

export default function PlaylistPage() {
  const params = useParams()
  const playlistId = params.playlistId as string

  const [playlist, setPlaylist] = useState<PlaylistInfo | null>(null)
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [nextPageToken, setNextPageToken] = useState<string | undefined>()

  useEffect(() => {
    loadPlaylist()
  }, [playlistId])

  const loadPlaylist = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/yt/api/search?playlistId=${playlistId}&type=playlist`)
      const data = await res.json()
      setPlaylist(data.playlist)
      setVideos(data.items || [])
      setNextPageToken(data.nextPageToken)
    } catch { }
    finally {
      setLoading(false)
    }
  }

  const downloadAll = async () => {
    setDownloading(true)
    try {
      await fetch('/yt/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playlistUrl: `https://www.youtube.com/playlist?list=${playlistId}`,
          type: 'playlist',
        }),
      })
      alert('플레이리스트 다운로드가 시작되었습니다')
    } catch {
      alert('다운로드 시작 실패')
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 animate-pulse">
        <div className="h-32 bg-[#1a1a1a] rounded-xl mb-6" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-video bg-[#1a1a1a] rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Playlist header */}
      <div className="bg-[#1a1a1a] border border-[#333] rounded-2xl p-6 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-[#ff0000]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h8M4 18h8" />
              </svg>
              <span className="text-gray-400 text-sm">플레이리스트</span>
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">{playlist?.title}</h1>
            <p className="text-gray-400 text-sm">{playlist?.itemCount}개 동영상</p>
            {playlist?.description && (
              <p className="text-gray-400 text-sm mt-2 line-clamp-2">{playlist.description}</p>
            )}
          </div>
          <button
            onClick={downloadAll}
            disabled={downloading}
            className="flex items-center gap-2 bg-[#ff0000] text-white px-5 py-2.5 rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {downloading ? '시작 중...' : '전체 다운로드'}
          </button>
        </div>
      </div>

      {/* Videos grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {videos.map((v, i) => (
          <div key={v.id} className="relative">
            <div className="absolute top-2 left-2 z-10 bg-black/80 text-white text-xs px-2 py-0.5 rounded">
              {i + 1}
            </div>
            <VideoCard {...v} />
          </div>
        ))}
      </div>
    </div>
  )
}
