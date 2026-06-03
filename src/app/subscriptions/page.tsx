'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import VideoCard from '@/components/VideoCard'

interface Subscription {
  id: number
  channel_id: string
  channel_name: string
  channel_thumbnail?: string
  subscribed_at: string
}

interface Video {
  id: string
  title: string
  channelTitle: string
  thumbnail: string
  duration: string
  viewCount?: string
  publishedAt?: string
}

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState<Subscription[]>([])
  const [feed, setFeed] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingFeed, setLoadingFeed] = useState(false)
  const [activeChannel, setActiveChannel] = useState<string | null>(null)

  useEffect(() => {
    fetch('/yt/api/subscriptions')
      .then(r => r.json())
      .then(d => {
        setSubs(d.subscriptions || [])
        if (d.subscriptions?.length > 0) {
          loadFeed(d.subscriptions)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const loadFeed = async (channels: Subscription[] = subs) => {
    setLoadingFeed(true)
    const allVideos: Video[] = []

    await Promise.all(
      channels.slice(0, 5).map(async (ch) => {
        try {
          const res = await fetch(`/yt/api/channel/${ch.channel_id}?videos=1`)
          const data = await res.json()
          allVideos.push(...(data.videos?.items || []).slice(0, 6))
        } catch { /* skip */ }
      })
    )

    // Sort by publishedAt
    allVideos.sort((a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime())
    setFeed(allVideos)
    setLoadingFeed(false)
  }

  const loadChannelVideos = async (channelId: string) => {
    setActiveChannel(channelId)
    setLoadingFeed(true)
    try {
      const res = await fetch(`/yt/api/channel/${channelId}?videos=1`)
      const data = await res.json()
      setFeed(data.videos?.items || [])
    } catch {
      setFeed([])
    } finally {
      setLoadingFeed(false)
    }
  }

  const unsubscribe = async (channelId: string) => {
    await fetch(`/yt/api/subscriptions?channelId=${channelId}`, { method: 'DELETE' })
    setSubs(prev => prev.filter(s => s.channel_id !== channelId))
    if (activeChannel === channelId) {
      setActiveChannel(null)
      loadFeed(subs.filter(s => s.channel_id !== channelId))
    }
  }

  if (loading) {
    return <div className="p-6 text-gray-400">로딩 중...</div>
  }

  if (subs.length === 0) {
    return (
      <div className="p-6 text-center py-20">
        <svg className="w-20 h-20 mx-auto mb-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        <p className="text-xl text-gray-400 mb-2">구독한 채널이 없습니다</p>
        <p className="text-gray-600 text-sm mb-4">채널 페이지에서 구독 버튼을 눌러보세요</p>
        <Link href="/" className="bg-[#ff0000] text-white px-6 py-2 rounded-full hover:bg-red-700 transition-colors">
          홈으로
        </Link>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6">구독</h1>

      {/* Channel list */}
      <div className="flex gap-3 mb-6 overflow-x-auto pb-2 scrollbar-hide">
        <button
          onClick={() => { setActiveChannel(null); loadFeed() }}
          className={`flex-shrink-0 px-4 py-2 rounded-full text-sm transition-colors ${
            !activeChannel ? 'bg-[#ff0000] text-white' : 'bg-[#1a1a1a] border border-[#333] text-gray-400 hover:text-white'
          }`}
        >
          전체
        </button>
        {subs.map(sub => (
          <button
            key={sub.channel_id}
            onClick={() => loadChannelVideos(sub.channel_id)}
            className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-colors ${
              activeChannel === sub.channel_id ? 'bg-[#ff0000] text-white' : 'bg-[#1a1a1a] border border-[#333] text-gray-400 hover:text-white'
            }`}
          >
            {sub.channel_thumbnail && (
              <Image src={sub.channel_thumbnail} alt={sub.channel_name} width={20} height={20} className="rounded-full" />
            )}
            {sub.channel_name}
          </button>
        ))}
      </div>

      {/* Subscribed channels management */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
        {subs.map(sub => (
          <div key={sub.channel_id} className="flex items-center gap-3 bg-[#1a1a1a] border border-[#333] rounded-xl p-3">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-[#333] flex-shrink-0">
              {sub.channel_thumbnail ? (
                <Image src={sub.channel_thumbnail} alt={sub.channel_name} width={40} height={40} className="object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white font-bold">
                  {sub.channel_name[0]}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <Link href={`/channel/${sub.channel_id}`} className="text-white text-sm font-medium hover:text-gray-200 block truncate">
                {sub.channel_name}
              </Link>
              <p className="text-gray-500 text-xs">{sub.subscribed_at.split('T')[0]} 구독</p>
            </div>
            <button
              onClick={() => unsubscribe(sub.channel_id)}
              className="text-xs bg-[#333] text-gray-400 hover:bg-[#444] hover:text-white px-2 py-1 rounded transition-colors flex-shrink-0"
            >
              구독 취소
            </button>
          </div>
        ))}
      </div>

      {/* Feed */}
      <h2 className="text-lg font-bold text-white mb-4">
        {activeChannel ? subs.find(s => s.channel_id === activeChannel)?.channel_name : '최신 업로드'}
      </h2>

      {loadingFeed ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-video bg-[#2a2a2a] rounded-xl mb-3" />
              <div className="h-4 bg-[#2a2a2a] rounded mb-2" />
              <div className="h-3 bg-[#2a2a2a] rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : feed.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {feed.map(v => (
            <VideoCard key={v.id} {...v} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <p>동영상이 없습니다</p>
        </div>
      )}
    </div>
  )
}
