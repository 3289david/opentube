'use client'

import { useState, useEffect } from 'react'

interface Session {
  sessionId: string
  username: string
  createdAt: string
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function SettingsPage() {
  const [quality, setQuality] = useState('best')
  const [saved, setSaved] = useState(false)
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isPwaInstalled, setIsPwaInstalled] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showRestoreInput, setShowRestoreInput] = useState(false)
  const [restoreToken, setRestoreToken] = useState('')
  const [restoreError, setRestoreError] = useState('')
  const [restoreSuccess, setRestoreSuccess] = useState(false)


  useEffect(() => {
    setQuality(localStorage.getItem('download_quality') || 'best')
    setIsPwaInstalled(window.matchMedia('(display-mode: standalone)').matches)

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredInstallPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // Load or create session
    loadSession()

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const loadSession = async () => {
    const stored = localStorage.getItem('ot_session')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        const res = await fetch('/yt/api/session', {
          headers: { 'Authorization': `Bearer ${parsed.token}` },
        })
        const data = await res.json()
        setSession(data.session)
        setSessionToken(data.token)
        localStorage.setItem('ot_session', JSON.stringify({ token: data.token }))
        return
      } catch { /* fall through to create new */ }
    }

    // Create new session
    const res = await fetch('/yt/api/session')
    const data = await res.json()
    setSession(data.session)
    setSessionToken(data.token)
    localStorage.setItem('ot_session', JSON.stringify({ token: data.token }))
  }

  const handleSaveQuality = () => {
    localStorage.setItem('download_quality', quality)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleInstallPwa = async () => {
    if (!deferredInstallPrompt) return
    await deferredInstallPrompt.prompt()
    const result = await deferredInstallPrompt.userChoice
    if (result.outcome === 'accepted') {
      setIsPwaInstalled(true)
      setDeferredInstallPrompt(null)
    }
  }

  const handleCopySession = async () => {
    if (!sessionToken) return
    await navigator.clipboard.writeText(sessionToken)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRestoreSession = async () => {
    if (!restoreToken.trim()) return
    setRestoreError('')
    setRestoreSuccess(false)
    try {
      const res = await fetch('/yt/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: restoreToken.trim() }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setRestoreError('유효하지 않은 세션 코드입니다')
        return
      }
      setSession(data.session)
      setSessionToken(data.token)
      localStorage.setItem('ot_session', JSON.stringify({ token: data.token }))
      setRestoreToken('')
      setShowRestoreInput(false)
      setRestoreSuccess(true)
      setTimeout(() => {
        setRestoreSuccess(false)
        window.location.reload()
      }, 1500)
    } catch {
      setRestoreError('복원에 실패했습니다. 다시 시도해주세요')
    }
  }

  const handleResetSession = async () => {
    if (!confirm('새 닉네임을 받으시겠습니까?')) return
    const res = await fetch('/yt/api/session', {
      method: 'PUT',
      headers: sessionToken ? { 'Authorization': `Bearer ${sessionToken}` } : {},
    })
    const data = await res.json()
    setSession(data.session)
    setSessionToken(data.token)
    localStorage.setItem('ot_session', JSON.stringify({ token: data.token }))
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-6">설정</h1>

      {/* PWA Install */}
      <div className="bg-[#1a1a1a] border border-[#333] rounded-xl p-6 mb-4">
        <h2 className="text-white font-semibold text-lg mb-2">앱으로 설치하기</h2>
        <p className="text-gray-400 text-sm mb-5">
          OpenTube를 기기에 설치하면 바로가기로 빠르게 접속할 수 있어요!
        </p>
        {isPwaInstalled ? (
          <div className="flex items-center gap-2 text-green-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-medium">이미 설치되어 있어요</span>
          </div>
        ) : (
          <button
            onClick={handleInstallPwa}
            disabled={!deferredInstallPrompt}
            className="bg-[#ff0000] text-white px-8 py-3 rounded-xl hover:bg-red-700 transition-colors font-semibold text-base disabled:opacity-40 disabled:cursor-not-allowed"
          >
            설치하기
          </button>
        )}
        {!deferredInstallPrompt && !isPwaInstalled && (
          <p className="text-gray-500 text-xs mt-3">
            이미 설치되어 있거나 현재 브라우저에서 지원하지 않습니다.
          </p>
        )}
      </div>

      {/* Session */}
      <div className="bg-[#1a1a1a] border border-[#333] rounded-xl p-6 mb-4">
        <h2 className="text-white font-semibold text-lg mb-2">내 세션</h2>
        <p className="text-gray-400 text-sm mb-4">
          닉네임은 익명으로 자동 생성됩니다. 다른 기기에서 같은 계정을 쓰려면 세션 코드를 복사해 붙여넣으세요.
        </p>

        {session ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 bg-[#111] rounded-lg px-4 py-3">
              <div className="w-9 h-9 bg-[#ff0000] rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {session.username[0]}
              </div>
              <div>
                <p className="text-white font-semibold">{session.username}</p>
                <p className="text-gray-500 text-xs">내 닉네임</p>
              </div>
              <button
                onClick={handleResetSession}
                className="ml-auto text-xs text-gray-500 hover:text-white transition-colors border border-[#333] px-3 py-1.5 rounded-lg"
              >
                닉네임 바꾸기
              </button>
            </div>

            <div className="flex gap-3 flex-wrap">
              <button
                onClick={handleCopySession}
                className="flex items-center gap-2 bg-[#333] text-white px-4 py-2.5 rounded-lg hover:bg-[#444] transition-colors text-sm font-medium"
              >
                {copied ? (
                  <>
                    <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    복사됨!
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    내 세션 코드 복사
                  </>
                )}
              </button>
              <button
                onClick={() => { setShowRestoreInput(!showRestoreInput); setRestoreError('') }}
                className="flex items-center gap-2 bg-[#333] text-white px-4 py-2.5 rounded-lg hover:bg-[#444] transition-colors text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                세션 바꾸기
              </button>
            </div>

            {restoreSuccess && (
              <div className="flex items-center gap-2 text-green-400 text-sm">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                세션이 복원되었습니다!
              </div>
            )}

            {showRestoreInput && (
              <div className="bg-[#111] rounded-lg p-4 space-y-3">
                <p className="text-sm text-gray-400">전환할 세션 코드를 붙여넣으세요. 다른 기기 또는 다른 계정의 코드를 입력하면 해당 세션으로 바뀝니다:</p>
                <input
                  type="text"
                  value={restoreToken}
                  onChange={e => setRestoreToken(e.target.value)}
                  placeholder="세션 코드 붙여넣기..."
                  className="w-full bg-[#0f0f0f] border border-[#444] text-white px-4 py-2.5 rounded-lg text-sm focus:outline-none focus:border-[#ff0000] font-mono"
                />
                {restoreError && <p className="text-red-400 text-xs">{restoreError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={handleRestoreSession}
                    className="bg-[#ff0000] text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                  >
                    복원하기
                  </button>
                  <button
                    onClick={() => { setShowRestoreInput(false); setRestoreError(''); setRestoreToken('') }}
                    className="bg-[#333] text-gray-300 px-4 py-2 rounded-lg hover:bg-[#444] transition-colors text-sm"
                  >
                    취소
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="animate-pulse">
            <div className="h-12 bg-[#111] rounded-lg" />
          </div>
        )}
      </div>

      {/* Download Quality */}
      <div className="bg-[#1a1a1a] border border-[#333] rounded-xl p-6 mb-4">
        <h2 className="text-white font-semibold text-lg mb-2">다운로드 화질</h2>
        <p className="text-gray-400 text-sm mb-4">영상을 저장할 때 사용할 화질을 선택하세요.</p>
        <select
          value={quality}
          onChange={(e) => setQuality(e.target.value)}
          className="w-full bg-[#0f0f0f] border border-[#444] text-white px-4 py-3 rounded-lg text-sm focus:outline-none focus:border-[#ff0000]"
        >
          <option value="best">최고 화질 — 4K/1080p, 용량이 커요</option>
          <option value="1080p">1080p — 고화질</option>
          <option value="720p">720p — 권장 (용량과 화질 균형)</option>
          <option value="480p">480p — 보통 화질</option>
          <option value="360p">360p — 용량 작음</option>
          <option value="audio">오디오만 — MP3로 저장</option>
        </select>
        <button
          onClick={handleSaveQuality}
          className={`mt-4 px-6 py-2.5 rounded-lg font-medium transition-all text-sm ${
            saved ? 'bg-green-600 text-white' : 'bg-[#ff0000] text-white hover:bg-red-700'
          }`}
        >
          {saved ? '✓ 저장됨' : '저장'}
        </button>
      </div>

      {/* App info */}
      <div className="bg-[#1a1a1a] border border-[#333] rounded-xl p-6">
        <h2 className="text-white font-semibold text-lg mb-3">OpenTube 정보</h2>
        <div className="space-y-3 text-sm text-gray-400">
          <div className="flex justify-between items-center">
            <span>버전</span>
            <span className="text-white font-medium">1.0.0</span>
          </div>
          <div className="flex justify-between items-center">
            <span>스택</span>
            <span className="text-white">Next.js, SQLite</span>
          </div>
          <div className="flex justify-between items-center">
            <span>주소</span>
            <a href="https://krl.kr/yt" target="_blank" rel="noopener noreferrer" className="text-[#ff0000] hover:underline">
              krl.kr/yt
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
