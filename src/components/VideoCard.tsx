'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'

interface VideoCardProps {
  id: string
  title: string
  channelTitle: string
  thumbnail: string
  duration: string
  viewCount?: string
  publishedAt?: string
  isDownloaded?: boolean
  onDownload?: (id: string) => void
}

function formatRelativeDate(dateStr: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return dateStr
  const now = new Date()
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (diff < 60) return '방금 전'
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`
  if (diff < 2592000) return `${Math.floor(diff / 86400)}일 전`
  if (diff < 31536000) return `${Math.floor(diff / 2592000)}개월 전`
  return `${Math.floor(diff / 31536000)}년 전`
}

export default function VideoCard({
  id, title, channelTitle, thumbnail, duration,
  viewCount, publishedAt, isDownloaded, onDownload,
}: VideoCardProps) {
  const [downloading, setDownloading] = useState(false)
  const [downloaded, setDownloaded] = useState(isDownloaded || false)
  const [botBlocked, setBotBlocked] = useState(false)
  const [imgError, setImgError] = useState(false)

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (downloaded || downloading) return
    setDownloading(true)
    try {
      const res = await fetch('/yt/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: id }),
      })
      if (!res.ok) { setDownloading(false); return }

      // Poll until done or error
      const poll = setInterval(async () => {
        try {
          const p = await fetch(`/yt/api/download?videoId=${id}`)
          const data = await p.json()
          if (data.status === 'done') {
            clearInterval(poll)
            setDownloaded(true)
            setDownloading(false)
            onDownload?.(id)
          } else if (data.status === 'bot_blocked') {
            clearInterval(poll)
            setDownloading(false)
            setBotBlocked(true)
          } else if (data.status === 'error') {
            clearInterval(poll)
            setDownloading(false)
          }
        } catch { /* keep polling */ }
      }, 3000)

      // Safety timeout: stop polling after 10 minutes
      setTimeout(() => { clearInterval(poll); setDownloading(false) }, 600000)
    } catch {
      setDownloading(false)
    }
  }

  return (
    <div className="group relative">
      <Link href={`/watch/${id}`} className="block">
        {/* Thumbnail */}
        <div className="relative aspect-video bg-[#1a1a1a] rounded-xl overflow-hidden mb-3">
          {thumbnail && !imgError ? (
            <Image
              src={thumbnail}
              alt={title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-200"
              onError={() => setImgError(true)}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-600">
              <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
          )}
          {/* Duration badge */}
          {duration && (
            <div className="absolute bottom-2 right-2 bg-black/85 text-white text-xs font-medium px-1.5 py-0.5 rounded">
              {duration}
            </div>
          )}
          {/* Download overlay button */}
          {botBlocked ? (
            <Link
              href={`/watch/${id}`}
              onClick={e => e.stopPropagation()}
              className="absolute top-2 right-2 p-2 rounded-full bg-yellow-500/90 opacity-100 flex items-center justify-center"
              title="봇 차단 - 임시 스트리밍으로 시청"
            >
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </Link>
          ) : (
            <button
              onClick={handleDownload}
              className={`absolute top-2 right-2 p-2 rounded-full transition-all
                ${downloaded ? 'bg-green-600 opacity-100' : 'bg-black/70 opacity-0 group-hover:opacity-100 hover:bg-[#ff0000]'}
                ${downloading ? 'opacity-100 animate-pulse' : ''}`}
              title={downloaded ? '다운로드됨' : '다운로드'}
            >
              {downloaded ? (
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : downloading ? (
                <svg className="w-4 h-4 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              ) : (
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              )}
            </button>
          )}
        </div>

        {/* Info */}
        <div className="px-1">
          <h3 className="text-white text-sm font-medium leading-tight line-clamp-2 mb-1 group-hover:text-gray-100">
            {title}
          </h3>
          <p className="text-gray-400 text-xs hover:text-gray-300 transition-colors">
            {channelTitle}
          </p>
          {(viewCount || publishedAt) && (
            <p className="text-gray-500 text-xs mt-0.5">
              {viewCount && <span>{viewCount}회</span>}
              {viewCount && publishedAt && <span> • </span>}
              {publishedAt && <span>{formatRelativeDate(publishedAt)}</span>}
            </p>
          )}
        </div>
      </Link>
    </div>
  )
}
