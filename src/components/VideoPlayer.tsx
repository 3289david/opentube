'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

interface VideoPlayerProps {
  videoId: string
  src?: string
  captionsSrc?: string
  onTimeUpdate?: (time: number) => void
  autoResumePosition?: number
}

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3]

export default function VideoPlayer({ videoId, src, captionsSrc, onTimeUpdate, autoResumePosition }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [showControls, setShowControls] = useState(true)
  const [showSpeedMenu, setShowSpeedMenu] = useState(false)
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const formatTime = (s: number): string => {
    if (!s || isNaN(s)) return '0:00'
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = Math.floor(s % 60)
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  const resetControlsTimer = useCallback(() => {
    setShowControls(true)
    if (controlsTimer.current) clearTimeout(controlsTimer.current)
    controlsTimer.current = setTimeout(() => setShowControls(false), 3000)
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const onLoaded = () => {
      setDuration(video.duration)
      if (autoResumePosition && autoResumePosition > 0) {
        video.currentTime = autoResumePosition
      }
    }
    const onTimeUpd = () => {
      setCurrentTime(video.currentTime)
      onTimeUpdate?.(video.currentTime)
      if (video.currentTime > 5) {
        localStorage.setItem(`ot_pos_${videoId}`, String(video.currentTime))
      }
    }
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)

    video.addEventListener('loadedmetadata', onLoaded)
    video.addEventListener('timeupdate', onTimeUpd)
    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)

    return () => {
      video.removeEventListener('loadedmetadata', onLoaded)
      video.removeEventListener('timeupdate', onTimeUpd)
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
    }
  }, [videoId, autoResumePosition, onTimeUpdate])

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      const video = videoRef.current
      if (!video) return
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      if (e.code === 'Space') { e.preventDefault(); video.paused ? video.play() : video.pause() }
      if (e.code === 'ArrowLeft') video.currentTime = Math.max(0, video.currentTime - 10)
      if (e.code === 'ArrowRight') video.currentTime = Math.min(video.duration, video.currentTime + 10)
      if (e.code === 'ArrowUp') { video.volume = Math.min(1, video.volume + 0.1); setVolume(video.volume) }
      if (e.code === 'ArrowDown') { video.volume = Math.max(0, video.volume - 0.1); setVolume(video.volume) }
    }
    document.addEventListener('keydown', handleKeydown)
    return () => document.removeEventListener('keydown', handleKeydown)
  }, [])

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return
    video.paused ? video.play() : video.pause()
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = parseFloat(e.target.value)
    setCurrentTime(video.currentTime)
  }

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current
    if (!video) return
    const v = parseFloat(e.target.value)
    video.volume = v
    setVolume(v)
    setMuted(v === 0)
  }

  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setMuted(video.muted)
  }

  const changeSpeed = (s: number) => {
    const video = videoRef.current
    if (!video) return
    video.playbackRate = s
    setSpeed(s)
    setShowSpeedMenu(false)
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  if (!src) {
    return (
      <div className="aspect-video bg-[#0a0a0a] rounded-xl flex flex-col items-center justify-center gap-4 border border-[#333]">
        <svg className="w-16 h-16 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
        </svg>
        <p className="text-gray-400 text-sm">다운로드된 영상이 없습니다</p>
        <p className="text-gray-600 text-xs">다운로드 버튼을 눌러 영상을 저장하세요</p>
      </div>
    )
  }

  return (
    <div
      className="relative aspect-video bg-black rounded-xl overflow-hidden group"
      onMouseMove={resetControlsTimer}
      onMouseLeave={() => { if (playing) setShowControls(false) }}
    >
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full"
        onClick={togglePlay}
      >
        {captionsSrc && (
          <track kind="subtitles" src={captionsSrc} label="자막" default />
        )}
      </video>

      {/* Controls overlay */}
      <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent transition-opacity duration-300 ${showControls || !playing ? 'opacity-100' : 'opacity-0'}`}>
        {/* Center play button */}
        <button
          onClick={togglePlay}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/50 rounded-full p-4 hover:bg-black/70 transition-colors"
        >
          {playing ? (
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
            </svg>
          ) : (
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          )}
        </button>

        {/* Bottom controls */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          {/* Progress bar */}
          <div className="mb-3">
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1 appearance-none bg-gray-600 rounded-full cursor-pointer"
              style={{ background: `linear-gradient(to right, #ff0000 ${progress}%, #555 ${progress}%)` }}
            />
          </div>

          <div className="flex items-center gap-3">
            {/* Play/Pause */}
            <button onClick={togglePlay} className="text-white hover:text-gray-200">
              {playing ? (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
              ) : (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              )}
            </button>

            {/* Volume */}
            <div className="flex items-center gap-2">
              <button onClick={toggleMute} className="text-white hover:text-gray-200">
                {muted || volume === 0 ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={handleVolume}
                className="w-20 h-1 appearance-none bg-gray-600 rounded-full cursor-pointer hidden sm:block"
              />
            </div>

            {/* Time */}
            <span className="text-white text-sm font-mono">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            {/* Speed */}
            <div className="relative ml-auto">
              <button
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                className="text-white text-sm bg-black/50 px-2 py-1 rounded hover:bg-black/70"
              >
                {speed}x
              </button>
              {showSpeedMenu && (
                <div className="absolute bottom-full right-0 mb-1 bg-[#1a1a1a] border border-[#333] rounded-lg overflow-hidden">
                  {SPEEDS.map(s => (
                    <button
                      key={s}
                      onClick={() => changeSpeed(s)}
                      className={`block w-full px-4 py-1.5 text-sm text-left hover:bg-[#333] transition-colors
                        ${s === speed ? 'text-[#ff0000]' : 'text-white'}`}
                    >
                      {s}x {s === 1 ? '(기본)' : ''}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
