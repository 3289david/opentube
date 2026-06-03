'use client'

import { useEffect, useState } from 'react'

interface DownloadProgressProps {
  videoId: string
  onComplete?: () => void
  onCancel?: () => void
}

interface Progress {
  percent: number
  speed: string
  eta: string
  status: 'downloading' | 'processing' | 'done' | 'error'
  error?: string
}

export default function DownloadProgress({ videoId, onComplete, onCancel }: DownloadProgressProps) {
  const [progress, setProgress] = useState<Progress>({ percent: 0, speed: '', eta: '', status: 'downloading' })
  const [cancelled, setCancelled] = useState(false)

  useEffect(() => {
    if (cancelled) return

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/yt/api/download?videoId=${videoId}`)
        if (!res.ok) return
        const data: Progress = await res.json()
        setProgress(data)
        if (data.status === 'done') {
          clearInterval(interval)
          onComplete?.()
        }
        if (data.status === 'error') {
          clearInterval(interval)
        }
      } catch {
        // ignore network errors during polling
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [videoId, cancelled, onComplete])

  const handleCancel = () => {
    setCancelled(true)
    onCancel?.()
  }

  const statusLabel = {
    downloading: '다운로드 중',
    processing: '처리 중',
    done: '완료',
    error: '오류',
  }[progress.status]

  const statusColor = {
    downloading: 'text-blue-400',
    processing: 'text-yellow-400',
    done: 'text-green-400',
    error: 'text-red-400',
  }[progress.status]

  return (
    <div className="bg-[#1a1a1a] border border-[#333] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {progress.status === 'downloading' || progress.status === 'processing' ? (
            <svg className="w-4 h-4 text-[#ff0000] animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          ) : progress.status === 'done' ? (
            <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          <span className={`text-sm font-medium ${statusColor}`}>{statusLabel}</span>
        </div>
        <div className="flex items-center gap-3">
          {progress.speed && (
            <span className="text-xs text-gray-400">{progress.speed}</span>
          )}
          {progress.eta && progress.status === 'downloading' && (
            <span className="text-xs text-gray-500">남은 시간: {progress.eta}</span>
          )}
          {(progress.status === 'downloading' || progress.status === 'processing') && (
            <button
              onClick={handleCancel}
              className="text-xs text-gray-400 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-red-500/10"
            >
              취소
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-[#333] rounded-full h-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            progress.status === 'done' ? 'bg-green-500' :
            progress.status === 'error' ? 'bg-red-500' :
            progress.status === 'processing' ? 'bg-yellow-500 animate-pulse' :
            'bg-[#ff0000]'
          }`}
          style={{ width: `${progress.percent}%` }}
        />
      </div>

      <div className="flex justify-between mt-1">
        <span className="text-xs text-gray-500">{Math.round(progress.percent)}%</span>
        {progress.error && (
          <span className="text-xs text-red-400">{progress.error}</span>
        )}
      </div>
    </div>
  )
}
