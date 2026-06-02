'use client'

import { useState, useEffect, useCallback } from 'react'

interface BatchJob {
  id: number
  type: string
  url: string
  title?: string
  total: number
  completed: number
  status: string
  folder: string
  started_at: string
}

function detectUrlType(url: string): 'playlist' | 'channel' | 'url' {
  if (!url) return 'url'
  if (url.includes('playlist?list=') || url.includes('&list=')) return 'playlist'
  if (url.includes('/channel/') || url.includes('/c/') || url.includes('/user/') || url.includes('/@')) return 'channel'
  return 'url'
}

function extractIds(url: string): { playlistId?: string; channelId?: string } {
  const playlistMatch = url.match(/[?&]list=([^&]+)/)
  if (playlistMatch) return { playlistId: playlistMatch[1] }

  const channelMatch =
    url.match(/\/channel\/([^/?]+)/) ||
    url.match(/\/c\/([^/?]+)/) ||
    url.match(/\/user\/([^/?]+)/) ||
    url.match(/\/@([^/?]+)/)
  if (channelMatch) return { channelId: channelMatch[1] }

  return {}
}

const STATUS_LABELS: Record<string, string> = {
  queued: '대기 중',
  running: '진행 중',
  done: '완료',
  error: '오류',
}

const STATUS_COLORS: Record<string, string> = {
  queued: 'text-gray-400',
  running: 'text-blue-400',
  done: 'text-green-400',
  error: 'text-red-400',
}

export default function BatchPage() {
  const [url, setUrl] = useState('')
  const [folder, setFolder] = useState('기타')
  const [jobs, setJobs] = useState<BatchJob[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const detectedType = detectUrlType(url)

  const loadJobs = useCallback(async () => {
    try {
      const res = await fetch('/yt/api/batch-download')
      const data = await res.json()
      setJobs(data.jobs || [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    loadJobs()
    const interval = setInterval(loadJobs, 3000)
    return () => clearInterval(interval)
  }, [loadJobs])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!url.trim()) { setError('URL을 입력해주세요'); return }

    setSubmitting(true)
    try {
      const type = detectedType
      const ids = extractIds(url)

      const body: Record<string, string> = { type, folder, url }
      if (type === 'playlist' && ids.playlistId) body.playlistId = ids.playlistId
      if (type === 'channel' && ids.channelId) body.channelId = ids.channelId

      const res = await fetch('/yt/api/batch-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || '요청 실패')
        return
      }
      setUrl('')
      await loadJobs()
    } catch {
      setError('요청에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-white mb-6">일괄 다운로드</h1>

      {/* Input form */}
      <div className="bg-[#1a1a1a] border border-[#333] rounded-xl p-5 mb-6">
        <h2 className="text-white font-semibold mb-3">새 다운로드 추가</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">YouTube URL</label>
            <input
              type="text"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="영상 URL, 재생목록 URL, 채널 URL 모두 가능합니다"
              className="w-full bg-[#0f0f0f] border border-[#444] text-white px-4 py-3 rounded-lg text-sm focus:outline-none focus:border-[#ff0000] placeholder-gray-600"
            />
            {url && (
              <p className="text-xs text-gray-500 mt-1.5">
                감지된 유형:&nbsp;
                <span className="text-[#ff0000] font-medium">
                  {detectedType === 'playlist' ? '재생목록' : detectedType === 'channel' ? '채널' : '단일 영상'}
                </span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1.5">저장 폴더</label>
            <select
              value={folder}
              onChange={e => setFolder(e.target.value)}
              className="w-full bg-[#0f0f0f] border border-[#444] text-white px-4 py-3 rounded-lg text-sm focus:outline-none focus:border-[#ff0000]"
            >
              <option value="기타">기타</option>
              <option value="교육">교육</option>
              <option value="음악">음악</option>
              <option value="게임">게임</option>
              <option value="코딩">코딩</option>
              <option value="여행">여행</option>
              <option value="요리">요리</option>
              <option value="뉴스">뉴스</option>
              <option value="auto">자동 감지</option>
            </select>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 bg-[#ff0000] text-white px-6 py-2.5 rounded-lg hover:bg-red-700 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                시작 중...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                다운로드 시작
              </>
            )}
          </button>
        </form>
      </div>

      {/* Job list */}
      <div>
        <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
          진행 목록
          {jobs.some(j => j.status === 'running') && (
            <span className="inline-flex items-center gap-1 text-xs text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
              진행 중
            </span>
          )}
        </h2>

        {jobs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <p>다운로드 기록이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map(job => {
              const progress = job.total > 0 ? Math.round((job.completed / job.total) * 100) : 0
              return (
                <div key={job.id} className="bg-[#1a1a1a] border border-[#333] rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium line-clamp-1">
                        {job.title || job.url}
                      </p>
                      <p className="text-gray-500 text-xs mt-0.5">
                        {job.type === 'playlist' ? '재생목록' : job.type === 'channel' ? '채널' : '단일 영상'}
                        &nbsp;·&nbsp;{job.folder}&nbsp;·&nbsp;{new Date(job.started_at).toLocaleString('ko')}
                      </p>
                    </div>
                    <span className={`text-xs font-medium flex-shrink-0 ${STATUS_COLORS[job.status] || 'text-gray-400'}`}>
                      {STATUS_LABELS[job.status] || job.status}
                    </span>
                  </div>

                  {job.total > 0 && (
                    <>
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                        <span>{job.completed} / {job.total}개</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="w-full bg-[#333] rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${job.status === 'done' ? 'bg-green-500' : job.status === 'error' ? 'bg-red-500' : 'bg-[#ff0000]'}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </>
                  )}

                  {job.status === 'running' && job.total === 0 && (
                    <div className="w-full bg-[#333] rounded-full h-1.5">
                      <div className="h-1.5 rounded-full bg-[#ff0000] animate-pulse w-1/3" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
