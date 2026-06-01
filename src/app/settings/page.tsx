'use client'

import { useState, useEffect } from 'react'

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('')
  const [storagePath, setStoragePath] = useState('./storage')
  const [quality, setQuality] = useState('best')
  const [saved, setSaved] = useState(false)
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<Event | null>(null)
  const [isPwaInstalled, setIsPwaInstalled] = useState(false)

  useEffect(() => {
    setApiKey(localStorage.getItem('yt_api_key') || '')
    setStoragePath(localStorage.getItem('storage_path') || './storage')
    setQuality(localStorage.getItem('download_quality') || 'best')
    setIsPwaInstalled(window.matchMedia('(display-mode: standalone)').matches)

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredInstallPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleSave = () => {
    localStorage.setItem('yt_api_key', apiKey)
    localStorage.setItem('storage_path', storagePath)
    localStorage.setItem('download_quality', quality)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleInstallPwa = async () => {
    if (!deferredInstallPrompt) return
    const promptEvent = deferredInstallPrompt as BeforeInstallPromptEvent
    await promptEvent.prompt()
    const result = await promptEvent.userChoice
    if (result.outcome === 'accepted') {
      setIsPwaInstalled(true)
      setDeferredInstallPrompt(null)
    }
  }

  const registerSw = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(() => {
        alert('서비스 워커가 등록되었습니다!')
      }).catch((e) => {
        alert('서비스 워커 등록 실패: ' + e.message)
      })
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-6">설정</h1>

      {/* API Key */}
      <div className="bg-[#1a1a1a] border border-[#333] rounded-xl p-5 mb-4">
        <h2 className="text-white font-semibold mb-1">YouTube API 키</h2>
        <p className="text-gray-400 text-sm mb-4">
          YouTube Data API v3 키를 입력하면 검색, 트렌딩, 채널 정보를 가져올 수 있습니다.
          <a
            href="https://console.cloud.google.com/apis/credentials"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#ff0000] ml-1 hover:underline"
          >
            Google Cloud Console에서 발급
          </a>
        </p>
        <div className="flex gap-2">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="AIza..."
            className="flex-1 bg-[#0f0f0f] border border-[#444] text-white px-4 py-2.5 rounded-lg text-sm focus:outline-none focus:border-[#ff0000] font-mono"
          />
          <button
            onClick={() => setApiKey('')}
            className="px-3 py-2 bg-[#333] rounded-lg text-gray-400 hover:text-white text-sm"
            title="지우기"
          >
            ✕
          </button>
        </div>
        {!apiKey && (
          <p className="text-yellow-500 text-xs mt-2">
            API 키 없이는 오프라인(로컬 라이브러리)으로만 사용 가능합니다.
          </p>
        )}
      </div>

      {/* Storage Path */}
      <div className="bg-[#1a1a1a] border border-[#333] rounded-xl p-5 mb-4">
        <h2 className="text-white font-semibold mb-1">저장 경로</h2>
        <p className="text-gray-400 text-sm mb-3">다운로드된 파일이 저장될 경로입니다.</p>
        <input
          type="text"
          value={storagePath}
          onChange={(e) => setStoragePath(e.target.value)}
          className="w-full bg-[#0f0f0f] border border-[#444] text-white px-4 py-2.5 rounded-lg text-sm focus:outline-none focus:border-[#ff0000] font-mono"
        />
        <p className="text-gray-600 text-xs mt-1">현재 서버: /root/yt-clone/storage/{'{videoId}/'}</p>
      </div>

      {/* Download Quality */}
      <div className="bg-[#1a1a1a] border border-[#333] rounded-xl p-5 mb-4">
        <h2 className="text-white font-semibold mb-1">다운로드 화질</h2>
        <p className="text-gray-400 text-sm mb-3">yt-dlp 다운로드 시 사용할 화질 설정입니다.</p>
        <select
          value={quality}
          onChange={(e) => setQuality(e.target.value)}
          className="w-full bg-[#0f0f0f] border border-[#444] text-white px-4 py-2.5 rounded-lg text-sm focus:outline-none focus:border-[#ff0000]"
        >
          <option value="best">최고 화질 (4K/1080p, 용량 큼)</option>
          <option value="1080p">1080p</option>
          <option value="720p">720p (권장)</option>
          <option value="480p">480p</option>
          <option value="360p">360p (용량 작음)</option>
          <option value="audio">오디오만 (MP3)</option>
        </select>
      </div>

      {/* PWA */}
      <div className="bg-[#1a1a1a] border border-[#333] rounded-xl p-5 mb-4">
        <h2 className="text-white font-semibold mb-1">PWA (오프라인 앱)</h2>
        <p className="text-gray-400 text-sm mb-4">
          OpenTube를 앱으로 설치하면 오프라인에서도 사용할 수 있습니다.
        </p>
        <div className="flex gap-3">
          {isPwaInstalled ? (
            <div className="flex items-center gap-2 text-green-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm">이미 설치됨</span>
            </div>
          ) : (
            <button
              onClick={handleInstallPwa}
              disabled={!deferredInstallPrompt}
              className="bg-[#ff0000] text-white px-5 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              앱으로 설치
            </button>
          )}
          <button
            onClick={registerSw}
            className="bg-[#333] text-gray-300 px-5 py-2 rounded-lg hover:bg-[#444] transition-colors text-sm"
          >
            서비스 워커 등록
          </button>
        </div>
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        className={`w-full py-3 rounded-xl font-medium transition-all text-sm ${
          saved
            ? 'bg-green-600 text-white'
            : 'bg-[#ff0000] text-white hover:bg-red-700'
        }`}
      >
        {saved ? '✓ 저장됨' : '설정 저장'}
      </button>

      {/* Info */}
      <div className="mt-6 bg-[#1a1a1a] border border-[#333] rounded-xl p-5">
        <h2 className="text-white font-semibold mb-3">OpenTube 정보</h2>
        <div className="space-y-2 text-sm text-gray-400">
          <div className="flex justify-between">
            <span>버전</span>
            <span className="text-white">1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span>스택</span>
            <span className="text-white">Next.js 15, SQLite, yt-dlp</span>
          </div>
          <div className="flex justify-between">
            <span>데이터베이스</span>
            <span className="text-white font-mono text-xs">/root/yt-clone/opentube.db</span>
          </div>
        </div>
      </div>
    </div>
  )
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
