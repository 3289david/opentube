'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

interface StorageInfo {
  videoCount: number
  folderCounts: Record<string, number>
}

const navItems = [
  { href: '/', label: '홈', icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )},
  { href: '/subscriptions', label: '구독', icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  )},
  { href: '/history', label: '시청 기록', icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )},
  { href: '/library', label: '라이브러리', icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  )},
  { href: '/batch', label: '배치 다운로드', icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  )},
  { href: '/settings', label: '설정', icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )},
]

export default function Sidebar() {
  const pathname = usePathname()
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null)

  useEffect(() => {
    fetch('/yt/api/library?stats=1')
      .then(r => r.json())
      .then(d => {
        if (d.stats) setStorageInfo(d.stats)
      })
      .catch(() => {})
  }, [])

  return (
    <aside className="w-56 flex-shrink-0 bg-[#111] border-r border-[#333] flex flex-col h-full">
      <nav className="flex-1 py-4">
        {navItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors border-l-2
              ${pathname === item.href
                ? 'bg-[#222] text-white border-[#ff0000]'
                : 'text-gray-400 border-transparent hover:bg-[#1a1a1a] hover:text-white'
              }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </Link>
        ))}

        <div className="border-t border-[#333] mt-2 pt-2">
          <p className="px-4 py-2 text-xs text-gray-500 uppercase tracking-wider">폴더</p>
          {['교육', '음악', '게임', '기타'].map(folder => (
            <Link
              key={folder}
              href={`/library?folder=${encodeURIComponent(folder)}`}
              className={`flex items-center justify-between px-4 py-2.5 text-sm transition-colors border-l-2
                ${pathname === '/library' ? 'text-gray-300 border-transparent hover:bg-[#1a1a1a] hover:text-white' : 'text-gray-400 border-transparent hover:bg-[#1a1a1a] hover:text-white'}`}
            >
              <span>{folder}</span>
              {storageInfo?.folderCounts[folder] !== undefined && (
                <span className="bg-[#333] text-gray-400 text-xs px-2 py-0.5 rounded-full">
                  {storageInfo.folderCounts[folder]}
                </span>
              )}
            </Link>
          ))}
        </div>
      </nav>

      {/* Storage usage */}
      {storageInfo && (
        <div className="p-4 border-t border-[#333]">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
            <span>저장된 영상</span>
            <span>{storageInfo.videoCount}개</span>
          </div>
          <div className="w-full bg-[#333] rounded-full h-1.5">
            <div
              className="bg-[#ff0000] h-1.5 rounded-full"
              style={{ width: `${Math.min(100, (storageInfo.videoCount / 100) * 100)}%` }}
            />
          </div>
        </div>
      )}
    </aside>
  )
}
