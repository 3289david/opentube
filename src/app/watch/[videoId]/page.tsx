'use client'

import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import VideoPlayer from '@/components/VideoPlayer'
import VideoCard from '@/components/VideoCard'
import DownloadProgress from '@/components/DownloadProgress'
import Link from 'next/link'
import Image from 'next/image'

interface VideoData {
  id: string
  title: string
  channel: string
  channelId?: string
  duration: string
  uploadDate?: string
  description?: string
  thumbnailPath?: string
  videoPath?: string
  captionsPath?: string
  viewCount?: string
  publishedAt?: string
  isLocal?: boolean
}

interface Comment {
  id: string
  authorName: string
  authorPhoto: string
  text: string
  likeCount: number
  publishedAt: string
}

interface RelatedVideo {
  id: string
  title: string
  channelTitle: string
  thumbnail: string
  duration: string
  viewCount?: string
  publishedAt?: string
}

export default function WatchPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const videoId = params.videoId as string

  const [video, setVideo] = useState<VideoData | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [related, setRelated] = useState<RelatedVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [downloadStarted, setDownloadStarted] = useState(false)
  const [resumePosition, setResumePosition] = useState(0)
  const [selectedFolder, setSelectedFolder] = useState('기타')
  const [descExpanded, setDescExpanded] = useState(false)
  const [showComments, setShowComments] = useState(true)

  useEffect(() => {
    loadVideo()
    loadComments()
    loadRelated()
    loadResumePosition()
  }, [videoId])

  const loadVideo = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/video/${videoId}`)
      const data = await res.json()
      setVideo(data)
    } catch {
      setVideo(null)
    } finally {
      setLoading(false)
    }
  }

  const loadComments = async () => {
    try {
      const res = await fetch(`/api/video/${videoId}?comments=1`)
      const data = await res.json()
      setComments(data.comments || [])
    } catch {
      setComments([])
    }
  }

  const loadRelated = async () => {
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(video?.title || videoId)}&type=video`)
      const data = await res.json()
      setRelated((data.items || []).filter((v: RelatedVideo) => v.id !== videoId).slice(0, 15))
    } catch {
      setRelated([])
    }
  }

  const loadResumePosition = async () => {
    // Try local storage first
    const stored = localStorage.getItem(`ot_pos_${videoId}`)
    if (stored) {
      setResumePosition(parseFloat(stored))
      return
    }
    // Then API
    try {
      const res = await fetch(`/api/watch-history?videoId=${videoId}`)
      const data = await res.json()
      if (data.watchTime > 0) setResumePosition(data.watchTime)
    } catch {
      // ignore
    }
  }

  const handleTimeUpdate = async (time: number) => {
    localStorage.setItem(`ot_pos_${videoId}`, String(time))
    // Save to server every 10 seconds
    if (Math.floor(time) % 10 === 0 && time > 5) {
      try {
        await fetch('/api/watch-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId, watchTime: time }),
        })
      } catch { }
    }
  }

  const startDownload = async () => {
    setDownloading(true)
    setDownloadStarted(true)
    try {
      await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, folder: selectedFolder }),
      })
    } catch {
      setDownloading(false)
    }
  }

  const getVideoSrc = (): string | undefined => {
    if (!video?.videoPath) return undefined
    const filename = video.videoPath.split('/').pop()
    return `/api/storage/${videoId}/${encodeURIComponent(filename || '')}`
  }

  const getCaptionsSrc = (): string | undefined => {
    if (!video?.captionsPath) return undefined
    const filename = video.captionsPath.split('/').pop()
    return `/api/storage/${videoId}/${encodeURIComponent(filename || '')}`
  }

  if (loading) {
    return (
      <div className="p-6 animate-pulse">
        <div className="aspect-video bg-[#1a1a1a] rounded-xl mb-6" />
        <div className="h-6 bg-[#1a1a1a] rounded mb-3 w-3/4" />
        <div className="h-4 bg-[#1a1a1a] rounded mb-2 w-1/2" />
      </div>
    )
  }

  const videoSrc = getVideoSrc()
  const captionsSrc = getCaptionsSrc()

  return (
    <div className="flex gap-0 lg:gap-6 p-4 lg:p-6">
      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Player */}
        <div className="mb-4">
          {videoSrc ? (
            <VideoPlayer
              videoId={videoId}
              src={videoSrc}
              captionsSrc={captionsSrc}
              onTimeUpdate={handleTimeUpdate}
              autoResumePosition={resumePosition}
            />
          ) : (
            <div className="aspect-video bg-[#0a0a0a] rounded-xl flex flex-col items-center justify-center gap-4 border border-[#333]">
              <svg className="w-16 h-16 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <p className="text-gray-400">영상이 다운로드되지 않았습니다</p>
              {video?.thumbnailPath && (
                <Image
                  src={`/api/storage/${videoId}/${video.thumbnailPath.split('/').pop()}`}
                  alt={video.title || ''}
                  width={320}
                  height={180}
                  className="absolute opacity-20 object-cover w-full h-full"
                />
              )}
            </div>
          )}
        </div>

        {/* Video info */}
        {video && (
          <>
            <h1 className="text-xl font-bold text-white mb-2">{video.title}</h1>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#333] rounded-full flex items-center justify-center text-white font-bold">
                  {video.channel?.[0]?.toUpperCase()}
                </div>
                <div>
                  <Link
                    href={`/channel/${video.channelId || ''}`}
                    className="text-white font-medium hover:text-gray-200"
                  >
                    {video.channel}
                  </Link>
                  {video.uploadDate && (
                    <p className="text-gray-400 text-sm">{video.uploadDate}</p>
                  )}
                </div>
              </div>

              {/* Download section */}
              <div className="flex items-center gap-2">
                {!video.isLocal && !downloadStarted && (
                  <>
                    <select
                      value={selectedFolder}
                      onChange={(e) => setSelectedFolder(e.target.value)}
                      className="bg-[#1a1a1a] border border-[#333] text-white px-3 py-2 rounded-lg text-sm"
                    >
                      <option value="기타">기타</option>
                      <option value="교육">교육</option>
                      <option value="음악">음악</option>
                      <option value="게임">게임</option>
                    </select>
                    <button
                      onClick={startDownload}
                      className="flex items-center gap-2 bg-[#ff0000] text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors font-medium text-sm"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      다운로드
                    </button>
                  </>
                )}
                {video.isLocal && (
                  <div className="flex items-center gap-2 text-green-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm">다운로드됨</span>
                  </div>
                )}
              </div>
            </div>

            {/* Download progress */}
            {downloadStarted && (
              <div className="mb-4">
                <DownloadProgress
                  videoId={videoId}
                  onComplete={() => {
                    setDownloading(false)
                    loadVideo()
                  }}
                  onCancel={() => {
                    setDownloading(false)
                    setDownloadStarted(false)
                  }}
                />
              </div>
            )}

            {/* Description */}
            {video.description && (
              <div className="bg-[#1a1a1a] rounded-xl p-4 mb-6">
                <p
                  className={`text-gray-300 text-sm leading-relaxed whitespace-pre-wrap ${!descExpanded ? 'line-clamp-3' : ''}`}
                >
                  {video.description}
                </p>
                {video.description.length > 200 && (
                  <button
                    onClick={() => setDescExpanded(!descExpanded)}
                    className="text-sm text-gray-400 hover:text-white mt-2 transition-colors"
                  >
                    {descExpanded ? '접기' : '더 보기'}
                  </button>
                )}
              </div>
            )}

            {/* Comments */}
            {comments.length > 0 && (
              <div>
                <button
                  onClick={() => setShowComments(!showComments)}
                  className="flex items-center gap-2 text-white font-semibold mb-4 hover:text-gray-200"
                >
                  <span>댓글 {comments.length}개</span>
                  <svg className={`w-4 h-4 transition-transform ${showComments ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showComments && (
                  <div className="space-y-4">
                    {comments.map(c => (
                      <div key={c.id} className="flex gap-3">
                        <div className="w-8 h-8 bg-[#333] rounded-full flex-shrink-0 overflow-hidden">
                          {c.authorPhoto && (
                            <Image src={c.authorPhoto} alt={c.authorName} width={32} height={32} className="w-full h-full object-cover" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-white">{c.authorName}</span>
                            <span className="text-xs text-gray-500">{c.publishedAt?.split('T')[0]}</span>
                          </div>
                          <p className="text-gray-300 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: c.text }} />
                          {c.likeCount > 0 && (
                            <div className="flex items-center gap-1 mt-1">
                              <svg className="w-3 h-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                              </svg>
                              <span className="text-xs text-gray-500">{c.likeCount}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Sidebar - related videos */}
      <div className="hidden lg:block w-80 flex-shrink-0">
        <h3 className="text-white font-semibold mb-4">관련 동영상</h3>
        <div className="space-y-3">
          {related.map(v => (
            <Link key={v.id} href={`/watch/${v.id}`} className="flex gap-3 group">
              <div className="relative w-40 aspect-video bg-[#1a1a1a] rounded-lg overflow-hidden flex-shrink-0">
                {v.thumbnail && (
                  <Image src={v.thumbnail} alt={v.title} fill className="object-cover" sizes="160px" />
                )}
                {v.duration && (
                  <div className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1 rounded">
                    {v.duration}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium line-clamp-2 group-hover:text-gray-200">
                  {v.title}
                </p>
                <p className="text-gray-400 text-xs mt-1">{v.channelTitle}</p>
                {v.viewCount && <p className="text-gray-500 text-xs">{v.viewCount}회</p>}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
