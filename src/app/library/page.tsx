'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

interface LibraryVideo {
  id: string
  title: string
  channel: string
  duration: number
  upload_date?: string
  thumbnail_path?: string
  video_path?: string
  folder: string
  downloaded_at: string
}

interface Stats {
  videoCount: number
  folderCounts: Record<string, number>
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function LibraryContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const folderParam = searchParams.get('folder') || ''

  const [videos, setVideos] = useState<LibraryVideo[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('downloaded_at')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set())
  const [exporting, setExporting] = useState(false)
  const [activeFolder, setActiveFolder] = useState(folderParam)

  useEffect(() => {
    setActiveFolder(folderParam)
    loadLibrary(folderParam, search, sort)
  }, [folderParam])

  const loadLibrary = async (folder = activeFolder, q = search, s = sort) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ sort: s, stats: '1' })
      if (folder) params.set('folder', folder)
      if (q) params.set('search', q)
      const res = await fetch(`/yt/api/library?${params}`)
      const data = await res.json()
      setVideos(data.videos || [])
      if (data.stats) setStats(data.stats)
    } catch {
      setVideos([])
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (q: string) => {
    setSearch(q)
    loadLibrary(activeFolder, q, sort)
  }

  const handleSort = (s: string) => {
    setSort(s)
    loadLibrary(activeFolder, search, s)
  }

  const handleFolder = (f: string) => {
    setActiveFolder(f)
    if (f) router.push(`/library?folder=${encodeURIComponent(f)}`)
    else router.push('/library')
    loadLibrary(f, search, sort)
  }

  const handleDelete = async (videoId: string) => {
    if (!confirm('이 영상을 삭제하시겠습니까?')) return
    await fetch(`/yt/api/library?videoId=${videoId}`, { method: 'DELETE' })
    setVideos(prev => prev.filter(v => v.id !== videoId))
    setSelectedVideos(prev => { const s = new Set(prev); s.delete(videoId); return s })
  }

  const handleMoveFolder = async (videoId: string, folder: string) => {
    await fetch('/yt/api/library', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'move', videoId, folder }),
    })
    loadLibrary()
  }

  const toggleSelect = (id: string) => {
    setSelectedVideos(prev => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id)
      else s.add(id)
      return s
    })
  }

  const exportLibraryHtml = async () => {
    setExporting(true)
    try {
      const res = await fetch('/yt/api/library/export?type=html')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'opentube-library.html'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert('내보내기 실패')
    } finally {
      setExporting(false)
    }
  }

  const exportVideoZip = async (videoId: string) => {
    const res = await fetch(`/yt/api/library/export?type=zip&videoId=${videoId}`)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${videoId}.zip`
    a.click()
    URL.revokeObjectURL(url)
  }

  const folders = ['교육', '음악', '게임', '기타']

  const getThumbnailSrc = (v: LibraryVideo): string => {
    if (!v.thumbnail_path) return ''
    const filename = v.thumbnail_path.split('/').pop() || ''
    return `/api/storage/${v.id}/${encodeURIComponent(filename)}`
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-white">라이브러리</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={exportLibraryHtml}
            disabled={exporting}
            className="flex items-center gap-2 bg-[#ff0000] text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors font-medium text-sm disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {exporting ? '생성 중...' : '오프라인 HTML 내보내기'}
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-[#1a1a1a] border border-[#333] rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-[#ff0000]">{stats.videoCount}</div>
            <div className="text-gray-400 text-sm mt-1">전체 영상</div>
          </div>
          {folders.map(f => (
            <div key={f} className="bg-[#1a1a1a] border border-[#333] rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-white">{stats.folderCounts[f] || 0}</div>
              <div className="text-gray-400 text-sm mt-1">{f}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Folder filter */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => handleFolder('')}
            className={`px-4 py-1.5 rounded-full text-sm transition-colors ${!activeFolder ? 'bg-[#ff0000] text-white' : 'bg-[#1a1a1a] border border-[#333] text-gray-400 hover:text-white'}`}
          >
            전체
          </button>
          {folders.map(f => (
            <button
              key={f}
              onClick={() => handleFolder(f)}
              className={`px-4 py-1.5 rounded-full text-sm transition-colors ${activeFolder === f ? 'bg-[#ff0000] text-white' : 'bg-[#1a1a1a] border border-[#333] text-gray-400 hover:text-white'}`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex-1 min-w-48">
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="다운로드된 영상 검색..."
            className="w-full bg-[#1a1a1a] border border-[#333] text-white px-4 py-2 rounded-lg text-sm focus:outline-none focus:border-[#ff0000] placeholder-gray-500"
          />
        </div>

        {/* Sort */}
        <select
          value={sort}
          onChange={(e) => handleSort(e.target.value)}
          className="bg-[#1a1a1a] border border-[#333] text-white px-3 py-2 rounded-lg text-sm"
        >
          <option value="downloaded_at">최근 다운로드순</option>
          <option value="title">제목순</option>
          <option value="duration">재생 시간순</option>
          <option value="upload_date">업로드 날짜순</option>
        </select>

        {/* View mode */}
        <div className="flex border border-[#333] rounded-lg overflow-hidden">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-[#ff0000] text-white' : 'bg-[#1a1a1a] text-gray-400 hover:text-white'}`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
              <path d="M1 2a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2zm5 0a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V2zm5 0a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V2zM1 7a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V7zm5 0a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7zm5 0a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V7z"/>
            </svg>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-[#ff0000] text-white' : 'bg-[#1a1a1a] text-gray-400 hover:text-white'}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Videos */}
      {loading ? (
        <div className={viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4' : 'space-y-3'}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-[#1a1a1a] rounded-xl p-4 h-48" />
          ))}
        </div>
      ) : videos.length === 0 ? (
        <div className="text-center py-20">
          <svg className="w-20 h-20 mx-auto mb-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <p className="text-xl text-gray-400 mb-2">다운로드된 영상이 없습니다</p>
          <p className="text-gray-600 text-sm mb-4">홈에서 영상을 검색하고 다운로드해보세요</p>
          <Link href="/" className="bg-[#ff0000] text-white px-6 py-2 rounded-full hover:bg-red-700 transition-colors">
            홈으로
          </Link>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {videos.map(v => (
            <div key={v.id} className="group relative">
              <Link href={`/watch/${v.id}`} className="block">
                <div className="relative aspect-video bg-[#1a1a1a] rounded-xl overflow-hidden mb-3">
                  {v.thumbnail_path && (
                    <Image
                      src={getThumbnailSrc(v)}
                      alt={v.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-200"
                      sizes="(max-width: 640px) 50vw, 25vw"
                    />
                  )}
                  {v.duration > 0 && (
                    <div className="absolute bottom-2 right-2 bg-black/85 text-white text-xs px-1.5 py-0.5 rounded">
                      {formatDuration(v.duration)}
                    </div>
                  )}
                  <div className="absolute top-2 left-2 bg-green-600/90 text-white text-xs px-1.5 py-0.5 rounded">
                    ✓ 로컬
                  </div>
                  {/* Actions on hover */}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.preventDefault(); exportVideoZip(v.id) }}
                      className="bg-black/70 p-1.5 rounded-lg hover:bg-black text-white"
                      title="ZIP 내보내기"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => { e.preventDefault(); handleDelete(v.id) }}
                      className="bg-black/70 p-1.5 rounded-lg hover:bg-red-600 text-white"
                      title="삭제"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
                <h3 className="text-white text-sm font-medium line-clamp-2 mb-1">{v.title}</h3>
                <p className="text-gray-400 text-xs">{v.channel}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-gray-600 text-xs">{v.folder}</span>
                </div>
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {videos.map(v => (
            <div key={v.id} className="flex items-center gap-4 bg-[#1a1a1a] border border-[#333] rounded-xl p-3 hover:bg-[#222] transition-colors group">
              <Link href={`/watch/${v.id}`} className="flex items-center gap-4 flex-1 min-w-0">
                <div className="relative w-32 aspect-video bg-[#0a0a0a] rounded-lg overflow-hidden flex-shrink-0">
                  {v.thumbnail_path && (
                    <Image src={getThumbnailSrc(v)} alt={v.title} fill className="object-cover" sizes="128px" />
                  )}
                  {v.duration > 0 && (
                    <div className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1 rounded">
                      {formatDuration(v.duration)}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white text-sm font-medium mb-1 line-clamp-1">{v.title}</h3>
                  <p className="text-gray-400 text-xs">{v.channel}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs bg-[#333] text-gray-400 px-2 py-0.5 rounded">{v.folder}</span>
                    <span className="text-xs text-gray-600">{v.downloaded_at?.split('T')[0]}</span>
                  </div>
                </div>
              </Link>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <select
                  value={v.folder}
                  onChange={(e) => handleMoveFolder(v.id, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-[#333] text-white text-xs px-2 py-1 rounded border border-[#444]"
                >
                  {folders.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <button
                  onClick={() => exportVideoZip(v.id)}
                  className="text-gray-400 hover:text-white p-1 rounded transition-colors"
                  title="ZIP 내보내기"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(v.id)}
                  className="text-gray-400 hover:text-red-400 p-1 rounded transition-colors"
                  title="삭제"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function LibraryPage() {
  return (
    <Suspense fallback={<div className="p-6 text-gray-400">로딩 중...</div>}>
      <LibraryContent />
    </Suspense>
  )
}
