'use client'

import Link from 'next/link'
import Image from 'next/image'

interface ShortsCardProps {
  id: string
  title: string
  channelTitle: string
  thumbnail: string
  viewCount?: string
}

export default function ShortsCard({ id, title, channelTitle, thumbnail, viewCount }: ShortsCardProps) {
  return (
    <Link
      href={`/shorts/${id}`}
      className="flex-shrink-0 w-36 sm:w-40 group"
    >
      {/* Portrait thumbnail */}
      <div className="relative w-full aspect-[9/16] bg-[#1a1a1a] rounded-xl overflow-hidden mb-2">
        {thumbnail && (
          <Image
            src={thumbnail}
            alt={title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-200"
            sizes="160px"
          />
        )}
        {/* Play icon overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
          <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
        </div>
        {/* Shorts badge */}
        <div className="absolute top-2 left-2 bg-[#ff0000] text-white text-xs font-bold px-1.5 py-0.5 rounded">
          Shorts
        </div>
      </div>
      <p className="text-white text-xs font-medium line-clamp-2 leading-snug mb-0.5">{title}</p>
      <p className="text-gray-500 text-xs">{viewCount && `${viewCount}회`}</p>
    </Link>
  )
}
