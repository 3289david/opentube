'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import VideoCard from '@/components/VideoCard'
import Image from 'next/image'

interface ChannelData {
  id: string
  title: string
  description: string
  thumbnail: string
  subscriberCount: string
  videoCount: string
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

export default function ChannelPage() {
  const params = useParams()
  const channelId = params.channelId as string

  const [channel, setChannel] = useState<ChannelData | null>(null)
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [nextPageToken, setNextPageToken] = useState<string | undefined>()
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    loadChannel()
    checkSubscription()
  }, [channelId])

  const loadChannel = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/yt/api/channel/${channelId}`)
      const data = await res.json()
      setChannel(data.channel)
      setVideos(data.videos || [])
      setNextPageToken(data.nextPageToken)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  const getToken = () => JSON.parse(localStorage.getItem('ot_session') || '{}')?.token || ''

  const checkSubscription = async () => {
    try {
      const token = getToken()
      const res = await fetch(`/yt/api/subscriptions?sessionToken=${encodeURIComponent(token)}`)
      const data = await res.json()
      setIsSubscribed((data.subscriptions || []).some((s: { channel_id: string }) => s.channel_id === channelId))
    } catch { }
  }

  const toggleSubscribe = async () => {
    const token = getToken()
    if (isSubscribed) {
      await fetch(`/yt/api/subscriptions?channelId=${channelId}&sessionToken=${encodeURIComponent(token)}`, { method: 'DELETE' })
      setIsSubscribed(false)
    } else {
      await fetch('/yt/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId,
          channelName: channel?.title || '',
          channelThumbnail: channel?.thumbnail || '',
          sessionToken: token,
        }),
      })
      setIsSubscribed(true)
    }
  }

  const loadMore = async () => {
    if (!nextPageToken) return
    setLoadingMore(true)
    try {
      const res = await fetch(`/yt/api/channel/${channelId}?pageToken=${nextPageToken}`)
      const data = await res.json()
      setVideos(prev => [...prev, ...(data.videos || [])])
      setNextPageToken(data.nextPageToken)
    } catch { }
    finally {
      setLoadingMore(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 animate-pulse">
        <div className="h-48 bg-[#1a1a1a] rounded-xl mb-6" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-video bg-[#1a1a1a] rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Channel banner */}
      <div className="bg-gradient-to-r from-[#1a1a1a] to-[#111] h-32 sm:h-48" />

      <div className="px-6 pb-6">
        {/* Channel header */}
        <div className="flex flex-wrap items-end gap-4 -mt-8 mb-6">
          <div className="w-20 h-20 rounded-full bg-[#333] border-4 border-[#0f0f0f] overflow-hidden flex-shrink-0">
            {channel?.thumbnail && (
              <Image src={channel.thumbnail} alt={channel.title} width={80} height={80} className="w-full h-full object-cover" />
            )}
          </div>
          <div className="flex-1 min-w-0 mb-2">
            <h1 className="text-2xl font-bold text-white mb-1">{channel?.title}</h1>
            <p className="text-gray-400 text-sm">
              구독자 {channel?.subscriberCount} • 동영상 {channel?.videoCount}개
            </p>
          </div>
          <button
            onClick={toggleSubscribe}
            className={`px-6 py-2.5 rounded-full font-medium transition-colors text-sm ${
              isSubscribed
                ? 'bg-[#333] text-gray-300 hover:bg-[#444]'
                : 'bg-white text-black hover:bg-gray-200'
            }`}
          >
            {isSubscribed ? '구독 중' : '구독'}
          </button>
        </div>

        {/* Description */}
        {channel?.description && (
          <div className="bg-[#1a1a1a] rounded-xl p-4 mb-6">
            <p className="text-gray-300 text-sm line-clamp-3">{channel.description}</p>
          </div>
        )}

        {/* Videos */}
        <h2 className="text-xl font-bold text-white mb-4">동영상</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {videos.map(v => (
            <VideoCard key={v.id} {...v} />
          ))}
        </div>

        {nextPageToken && (
          <div className="mt-8 text-center">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="bg-[#1a1a1a] border border-[#333] text-white px-8 py-3 rounded-full hover:bg-[#222] transition-colors disabled:opacity-50"
            >
              {loadingMore ? '로드 중...' : '더 보기'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
