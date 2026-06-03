'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import VideoPlayer from '@/components/VideoPlayer'
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
  thumbnail?: string
}

interface Comment {
  id: string
  commentId?: number
  authorName: string
  authorPhoto: string
  text: string
  likeCount: number
  publishedAt: string
  isLocal?: boolean
  userLiked?: boolean
  sessionId?: string
}

interface RelatedVideo {
  id: string
  title: string
  channelTitle: string
  thumbnail: string
  duration: string
  viewCount?: string
}

interface Session {
  sessionId: string
  username: string
  createdAt: string
}

export default function WatchPage() {
  const params = useParams()
  const videoId = params.videoId as string

  const [video, setVideo] = useState<VideoData | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [related, setRelated] = useState<RelatedVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [downloadStarted, setDownloadStarted] = useState(false)
  const [resumePosition, setResumePosition] = useState(0)
  const [selectedFolder, setSelectedFolder] = useState('기타')
  const [descExpanded, setDescExpanded] = useState(false)
  const [showComments, setShowComments] = useState(true)

  // Session
  const [session, setSession] = useState<Session | null>(null)
  const [sessionToken, setSessionToken] = useState<string | null>(null)

  // Likes
  const [likes, setLikes] = useState(0)
  const [dislikes, setDislikes] = useState(0)
  const [userLike, setUserLike] = useState<'like' | 'dislike' | null>(null)

  // Subscription
  const [isSubscribed, setIsSubscribed] = useState(false)

  // Comment form
  const [commentText, setCommentText] = useState('')
  const [commentSubmitting, setCommentSubmitting] = useState(false)
  const [commentError, setCommentError] = useState('')
  const altchaRef = useRef<HTMLElement | null>(null)

  // Streaming
  const [useStream, setUseStream] = useState(false)

  // Subtitle search
  const [subtitleQuery, setSubtitleQuery] = useState('')
  const [subtitleResults, setSubtitleResults] = useState<{ time: number; text: string }[]>([])

  useEffect(() => {
    loadSession()
    loadVideo()
    loadResumePosition()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId])

  useEffect(() => {
    if (sessionToken !== null) {
      loadComments()
      loadLikes()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, sessionToken])

  useEffect(() => {
    if (video?.channelId) {
      checkSubscription(video.channelId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video?.channelId])

  const loadSession = async () => {
    const stored = localStorage.getItem('ot_session')
    let token: string | null = null
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        token = parsed.token
      } catch { /* */ }
    }

    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    const res = await fetch('/yt/api/session', { headers })
    const data = await res.json()
    setSession(data.session)
    setSessionToken(data.token)
    localStorage.setItem('ot_session', JSON.stringify({ token: data.token }))
  }

  const loadVideo = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/yt/api/video/${videoId}`)
      const data = await res.json()
      setVideo(data)
      // Load related videos using actual title for better results
      loadRelated(data?.title)
      // Save watch history immediately so iframe videos appear in history
      // Use localStorage directly — sessionToken state may still be null here
      if (data?.title) {
        const token = JSON.parse(localStorage.getItem('ot_session') || '{}')?.token || ''
        fetch('/yt/api/watch-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoId,
            watchTime: 0,
            title: data.title,
            channel: data.channel,
            thumbnail: data.thumbnail,
            sessionToken: token,
          }),
        }).catch(() => {})
      }
    } catch {
      setVideo(null)
    } finally {
      setLoading(false)
    }
  }

  const loadComments = async () => {
    try {
      const url = sessionToken
        ? `/yt/api/comments?videoId=${videoId}&sessionToken=${encodeURIComponent(sessionToken)}`
        : `/yt/api/comments?videoId=${videoId}`
      const res = await fetch(url)
      const data = await res.json()
      setComments(data.comments || [])
    } catch {
      setComments([])
    }
  }

  const loadLikes = async () => {
    try {
      const url = sessionToken
        ? `/yt/api/likes?videoId=${videoId}&sessionToken=${encodeURIComponent(sessionToken)}`
        : `/yt/api/likes?videoId=${videoId}`
      const res = await fetch(url)
      const data = await res.json()
      setLikes(data.likes || 0)
      setDislikes(data.dislikes || 0)
      setUserLike(data.userLike || null)
    } catch { /* */ }
  }

  const loadRelated = async (title?: string) => {
    try {
      const region = localStorage.getItem('ot_region') || 'KR'
      const q = title || videoId
      const res = await fetch(`/yt/api/search?q=${encodeURIComponent(q)}&type=video&region=${region}`)
      const data = await res.json()
      setRelated((data.items || []).filter((v: RelatedVideo) => v.id !== videoId).slice(0, 15))
    } catch {
      setRelated([])
    }
  }

  const loadResumePosition = async () => {
    const stored = localStorage.getItem(`ot_pos_${videoId}`)
    if (stored) { setResumePosition(parseFloat(stored)); return }
    try {
      const token = sessionToken || JSON.parse(localStorage.getItem('ot_session') || '{}')?.token || ''
      const res = await fetch(`/yt/api/watch-history?videoId=${videoId}&sessionToken=${encodeURIComponent(token)}`)
      const data = await res.json()
      if (data.watchTime > 0) setResumePosition(data.watchTime)
    } catch { /* */ }
  }

  const checkSubscription = async (channelId: string) => {
    try {
      const token = sessionToken || JSON.parse(localStorage.getItem('ot_session') || '{}')?.token || ''
      const res = await fetch(`/yt/api/subscriptions?sessionToken=${encodeURIComponent(token)}`)
      const data = await res.json()
      const subs: { channel_id: string }[] = data.subscriptions || []
      setIsSubscribed(subs.some(s => s.channel_id === channelId))
    } catch { /* */ }
  }

  const handleTimeUpdate = async (time: number) => {
    localStorage.setItem(`ot_pos_${videoId}`, String(time))
    if (Math.floor(time) % 10 === 0 && time > 5) {
      try {
        const token = sessionToken || JSON.parse(localStorage.getItem('ot_session') || '{}')?.token || ''
        await fetch('/yt/api/watch-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoId,
            watchTime: time,
            title: video?.title,
            channel: video?.channel,
            thumbnail: video?.thumbnail,
            sessionToken: token,
          }),
        })
      } catch { /* */ }
    }
  }

  const startDownload = async () => {
    setDownloadStarted(true)
    try {
      await fetch('/yt/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, folder: selectedFolder }),
      })
    } catch {
      setDownloadStarted(false)
    }
  }

  const handleLike = async (type: 'like' | 'dislike') => {
    if (!sessionToken) return
    const newType = userLike === type ? 'none' : type
    try {
      const res = await fetch('/yt/api/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, type: newType, sessionToken }),
      })
      const data = await res.json()
      setLikes(data.likes)
      setDislikes(data.dislikes)
      setUserLike(data.userLike)
    } catch { /* */ }
  }

  const handleSubscribe = async () => {
    if (!video?.channelId) return
    if (isSubscribed) {
      await fetch(`/yt/api/subscriptions?channelId=${encodeURIComponent(video.channelId)}&sessionToken=${encodeURIComponent(sessionToken || '')}`, {
        method: 'DELETE',
      })
      setIsSubscribed(false)
    } else {
      await fetch('/yt/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: video.channelId, channelName: video.channel, sessionToken }),
      })
      setIsSubscribed(true)
    }
  }

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentText.trim() || !sessionToken) return
    setCommentSubmitting(true)
    setCommentError('')

    let altchaPayload: string | null = null
    if (altchaRef.current) {
      try {
        // @ts-expect-error - altcha custom element
        altchaPayload = altchaRef.current?.value || null
      } catch { /* */ }
    }

    try {
      const res = await fetch('/yt/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId,
          text: commentText.trim(),
          sessionToken,
          altchaPayload,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setCommentError(data.error || '댓글 작성에 실패했습니다')
        return
      }
      setCommentText('')
      setComments(prev => [data, ...prev])
    } catch {
      setCommentError('댓글 작성에 실패했습니다')
    } finally {
      setCommentSubmitting(false)
    }
  }

  const handleCommentLike = async (commentId: number) => {
    if (!sessionToken) return
    try {
      const res = await fetch('/yt/api/comments/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId, sessionToken }),
      })
      const data = await res.json()
      setComments(prev => prev.map(c => {
        if (c.commentId === commentId) {
          return { ...c, likeCount: data.liked ? c.likeCount + 1 : Math.max(0, c.likeCount - 1), userLiked: data.liked }
        }
        return c
      }))
    } catch { /* */ }
  }

  const handleCommentReport = async (commentId: number) => {
    if (!sessionToken) return
    if (!confirm('이 댓글을 신고하시겠습니까?')) return
    await fetch('/yt/api/comments/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commentId, reason: '부적절한 내용', sessionToken }),
    })
  }

  const handleSubtitleSearch = async () => {
    if (!subtitleQuery.trim() || !video?.isLocal) return
    try {
      const res = await fetch(`/yt/api/subtitle-search?videoId=${videoId}&q=${encodeURIComponent(subtitleQuery)}`)
      const data = await res.json()
      setSubtitleResults(data.results || [])
    } catch {
      setSubtitleResults([])
    }
  }

  const getVideoSrc = (): string | undefined => {
    if (!video?.videoPath) return undefined
    const filename = video.videoPath.split('/').pop()
    return `/yt/api/storage/${videoId}/${encodeURIComponent(filename || '')}`
  }

  const getCaptionsSrc = (): string | undefined => {
    if (!video?.captionsPath) return undefined
    const filename = video.captionsPath.split('/').pop()
    return `/yt/api/storage/${videoId}/${encodeURIComponent(filename || '')}`
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
          ) : useStream ? (
            <div className="aspect-video bg-black rounded-xl overflow-hidden">
              <video
                controls
                className="w-full h-full"
                src={`/yt/api/stream/${videoId}`}
                onError={() => setUseStream(false)}
              />
            </div>
          ) : (
            <div className="aspect-video bg-black rounded-xl overflow-hidden relative">
              <iframe
                className="w-full h-full"
                src={`https://www.youtube.com/embed/${videoId}?rel=0&autoplay=1`}
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                title={video?.title || ''}
              />
              <button
                onClick={() => setUseStream(true)}
                className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg hover:bg-black/80 transition-colors text-xs z-10"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                서버 스트리밍
              </button>
            </div>
          )}
        </div>

        {/* Video info */}
        {video && (
          <>
            <h1 className="text-xl font-bold text-white mb-3">{video.title}</h1>

            {/* Meta row */}
            {(video.viewCount || video.publishedAt || video.uploadDate) && (
              <div className="flex gap-4 text-sm text-gray-400 mb-3">
                {video.viewCount && <span>조회수 {video.viewCount}회</span>}
                {(video.publishedAt || video.uploadDate) && (
                  <span>{(video.publishedAt || video.uploadDate)?.split('T')[0]}</span>
                )}
              </div>
            )}

            {/* Like/dislike + subscribe + download */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#333] rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                  {video.channel?.[0]?.toUpperCase()}
                </div>
                <div>
                  <Link href={`/channel/${video.channelId || ''}`} className="text-white font-medium hover:text-gray-200">
                    {video.channel}
                  </Link>
                  {video.uploadDate && (
                    <p className="text-gray-400 text-sm">{video.uploadDate}</p>
                  )}
                </div>
                {video.channelId && (
                  <button
                    onClick={handleSubscribe}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      isSubscribed
                        ? 'bg-[#333] text-gray-300 hover:bg-[#444]'
                        : 'bg-white text-black hover:bg-gray-200'
                    }`}
                  >
                    {isSubscribed ? '구독 중' : '구독'}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Like/Dislike */}
                <div className="flex rounded-full bg-[#1a1a1a] border border-[#333] overflow-hidden">
                  <button
                    onClick={() => handleLike('like')}
                    className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors border-r border-[#333] ${
                      userLike === 'like' ? 'text-blue-400 bg-blue-400/10' : 'text-gray-300 hover:bg-[#222]'
                    }`}
                  >
                    <svg className="w-4 h-4" fill={userLike === 'like' ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                    </svg>
                    {likes > 0 && <span>{likes}</span>}
                  </button>
                  <button
                    onClick={() => handleLike('dislike')}
                    className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors ${
                      userLike === 'dislike' ? 'text-red-400 bg-red-400/10' : 'text-gray-300 hover:bg-[#222]'
                    }`}
                  >
                    <svg className="w-4 h-4" fill={userLike === 'dislike' ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                    </svg>
                    {dislikes > 0 && <span>{dislikes}</span>}
                  </button>
                </div>

                {/* Download section */}
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
                  onComplete={() => { loadVideo() }}
                  onCancel={() => { setDownloadStarted(false) }}
                />
              </div>
            )}

            {/* Description */}
            {video.description && (
              <div className="bg-[#1a1a1a] rounded-xl p-4 mb-6">
                <p className={`text-gray-300 text-sm leading-relaxed whitespace-pre-wrap ${!descExpanded ? 'line-clamp-3' : ''}`}>
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

            {/* Subtitle search (local only) */}
            {video.isLocal && video.captionsPath && (
              <div className="bg-[#1a1a1a] rounded-xl p-4 mb-6">
                <h3 className="text-white font-semibold mb-3 text-sm">자막 검색</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={subtitleQuery}
                    onChange={e => setSubtitleQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSubtitleSearch()}
                    placeholder="자막에서 검색..."
                    className="flex-1 bg-[#0f0f0f] border border-[#444] text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-[#ff0000] placeholder-gray-600"
                  />
                  <button
                    onClick={handleSubtitleSearch}
                    className="px-4 py-2 bg-[#333] text-white rounded-lg hover:bg-[#444] transition-colors text-sm"
                  >
                    검색
                  </button>
                </div>
                {subtitleResults.length > 0 && (
                  <div className="mt-3 space-y-1 max-h-40 overflow-y-auto">
                    {subtitleResults.map((r, i) => (
                      <div key={i} className="text-xs text-gray-300 bg-[#111] rounded px-3 py-2">
                        <span className="text-gray-500 mr-2">{Math.floor(r.time / 60)}:{String(Math.floor(r.time % 60)).padStart(2, '0')}</span>
                        {r.text}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Comments section */}
            <div className="mb-6">
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
                <>
                  {/* Comment form */}
                  <div className="bg-[#1a1a1a] rounded-xl p-4 mb-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 bg-[#ff0000] rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {session?.username?.[0] || '?'}
                      </div>
                      <span className="text-gray-300 text-sm font-medium">{session?.username || '로딩 중...'}</span>
                    </div>
                    <form onSubmit={handleCommentSubmit} className="space-y-3">
                      <textarea
                        value={commentText}
                        onChange={e => setCommentText(e.target.value)}
                        placeholder="댓글을 입력하세요..."
                        rows={3}
                        className="w-full bg-[#0f0f0f] border border-[#444] text-white px-4 py-3 rounded-lg text-sm focus:outline-none focus:border-[#ff0000] placeholder-gray-600 resize-none"
                      />
                      {/* Altcha widget */}
                      <div>
                        {/* @ts-expect-error - custom element */}
                        <altcha-widget
                          ref={altchaRef}
                          challengeurl="/yt/api/altcha"
                          hidelogo
                          hidefooter
                          style={{ colorBase: '#1a1a1a', colorBorder: '#444', colorText: '#aaa' }}
                        />
                      </div>
                      {commentError && <p className="text-red-400 text-xs">{commentError}</p>}
                      <button
                        type="submit"
                        disabled={commentSubmitting || !commentText.trim()}
                        className="px-5 py-2 bg-[#ff0000] text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {commentSubmitting ? '전송 중...' : '댓글 달기'}
                      </button>
                    </form>
                  </div>

                  {/* Comments list */}
                  <div className="space-y-4">
                    {comments.map(c => (
                      <div key={c.id} className="flex gap-3">
                        <div className="w-8 h-8 bg-[#333] rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center text-xs font-bold text-white">
                          {c.authorPhoto ? (
                            <Image src={c.authorPhoto} alt={c.authorName} width={32} height={32} className="w-full h-full object-cover" />
                          ) : (
                            c.authorName?.[0]?.toUpperCase()
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-sm font-medium text-white">{c.authorName}</span>
                            {c.isLocal && (
                              <span className="text-xs bg-[#333] text-gray-400 px-1.5 py-0.5 rounded">로컬</span>
                            )}
                            <span className="text-xs text-gray-500">{c.publishedAt?.split('T')[0]}</span>
                          </div>
                          <p className="text-gray-300 text-sm leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: c.text }}
                          />
                          <div className="flex items-center gap-3 mt-1.5">
                            {c.isLocal && c.commentId && (
                              <button
                                onClick={() => handleCommentLike(c.commentId!)}
                                className={`flex items-center gap-1 text-xs transition-colors ${c.userLiked ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
                              >
                                <svg className="w-3.5 h-3.5" fill={c.userLiked ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                                </svg>
                                {c.likeCount > 0 && c.likeCount}
                              </button>
                            )}
                            {!c.isLocal && c.likeCount > 0 && (
                              <div className="flex items-center gap-1 text-xs text-gray-500">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                                </svg>
                                {c.likeCount}
                              </div>
                            )}
                            {c.isLocal && c.commentId && (
                              <button
                                onClick={() => handleCommentReport(c.commentId!)}
                                className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
                              >
                                신고
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {comments.length === 0 && (
                      <p className="text-gray-500 text-sm">첫 번째 댓글을 남겨보세요!</p>
                    )}
                  </div>
                </>
              )}
            </div>
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

      {/* Altcha CDN script */}
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <script src="https://cdn.jsdelivr.net/npm/altcha/dist/altcha.min.js" async defer />
    </div>
  )
}
