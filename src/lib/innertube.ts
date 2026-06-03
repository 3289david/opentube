import https from 'https'
import http from 'http'
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'

const FFMPEG = '/usr/bin/ffmpeg'

interface ITFormat {
  itag: number
  mimeType: string
  bitrate: number
  width?: number
  height?: number
  contentLength?: string
  quality: string
  qualityLabel?: string
  url?: string
  audioSampleRate?: string
  audioChannels?: number
}

interface ITResponse {
  videoDetails?: {
    videoId: string
    title: string
    lengthSeconds: string
    viewCount: string
    author: string
    channelId?: string
    shortDescription?: string
    thumbnail?: { thumbnails: { url: string; width: number; height: number }[] }
  }
  streamingData?: {
    formats: ITFormat[]
    adaptiveFormats: ITFormat[]
    expiresInSeconds: string
  }
  playabilityStatus?: {
    status: string
    reason?: string
  }
}

async function callInnerTube(videoId: string): Promise<ITResponse> {
  const body = JSON.stringify({
    videoId,
    context: {
      client: {
        clientName: 'ANDROID_VR',
        clientVersion: '1.60.19',
        deviceMake: 'Oculus',
        deviceModel: 'Quest 3',
        androidSdkVersion: 32,
        osName: 'Android',
        osVersion: '12L',
        platform: 'MOBILE',
        hl: 'en',
        gl: 'US',
      }
    }
  })

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'www.youtube.com',
      path: '/youtubei/v1/player',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip',
        'X-YouTube-Client-Name': '28',
        'X-YouTube-Client-Version': '1.60.19',
      }
    }, (res) => {
      let data = ''
      res.on('data', d => data += d)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) } catch { reject(new Error('Bad InnerTube response')) }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

export interface StreamInfo {
  url: string
  contentLength?: number
  contentType: string
  videoUrl?: string
  audioUrl?: string
  hasAudio: boolean
}

export async function getStreamInfo(videoId: string): Promise<StreamInfo | null> {
  try {
    const data = await callInnerTube(videoId)

    if (!data.streamingData || data.playabilityStatus?.status === 'LOGIN_REQUIRED') {
      return null
    }

    const all = [
      ...(data.streamingData.formats || []),
      ...(data.streamingData.adaptiveFormats || []),
    ].filter(f => f.url)

    // Prefer combined mp4 (has both video and audio)
    const combined = all
      .filter(f => f.mimeType?.includes('video/mp4') && f.audioChannels)
      .sort((a, b) => (b.height || 0) - (a.height || 0))

    if (combined.length > 0) {
      const f = combined[0]
      return {
        url: f.url!,
        contentLength: f.contentLength ? parseInt(f.contentLength) : undefined,
        contentType: 'video/mp4',
        hasAudio: true,
      }
    }

    // Separate video + audio
    const videoFormats = all
      .filter(f => f.mimeType?.includes('video/mp4') && !f.audioChannels)
      .sort((a, b) => (b.height || 0) - (a.height || 0))

    const audioFormats = all
      .filter(f => f.mimeType?.includes('audio/mp4') || f.mimeType?.includes('audio/webm'))
      .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))

    if (videoFormats.length > 0 && audioFormats.length > 0) {
      return {
        url: videoFormats[0].url!,
        audioUrl: audioFormats[0].url!,
        contentType: 'video/mp4',
        hasAudio: false,
        contentLength: videoFormats[0].contentLength ? parseInt(videoFormats[0].contentLength) : undefined,
      }
    }

    if (videoFormats.length > 0) {
      return {
        url: videoFormats[0].url!,
        contentType: 'video/mp4',
        hasAudio: false,
        contentLength: videoFormats[0].contentLength ? parseInt(videoFormats[0].contentLength) : undefined,
      }
    }

    return null
  } catch (e) {
    console.error('getStreamInfo error:', e)
    return null
  }
}

function httpGet(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const doGet = (u: string, redirects = 0) => {
      if (redirects > 5) { reject(new Error('Too many redirects')); return }
      const file = fs.createWriteStream(dest)
      const lib = u.startsWith('https') ? https : http
      lib.get(u, { headers: { 'User-Agent': 'com.google.android.apps.youtube.vr.oculus/1.60.19' } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          file.close()
          fs.unlinkSync(dest)
          doGet(res.headers.location!, redirects + 1)
          return
        }
        if (res.statusCode !== 200) {
          file.close()
          reject(new Error(`HTTP ${res.statusCode}`))
          return
        }
        res.pipe(file)
        file.on('finish', () => file.close(() => resolve()))
        file.on('error', reject)
      }).on('error', reject)
    }
    doGet(url)
  })
}

function mergeAV(videoPath: string, audioPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Use aac codec for webm audio, copy for m4a
    const audioCodec = audioPath.endsWith('.webm') ? 'aac' : 'copy'
    const proc = spawn(FFMPEG, [
      '-y', '-i', videoPath, '-i', audioPath,
      '-c:v', 'copy', '-c:a', audioCodec,
      '-movflags', 'faststart', outputPath,
    ])
    proc.stderr.on('data', () => {})
    proc.on('close', code => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg exit ${code}`))
    })
    proc.on('error', reject)
  })
}

export async function downloadViaInnerTube(videoId: string, outputDir: string, maxHeight = 99999): Promise<string | null> {
  fs.mkdirSync(outputDir, { recursive: true })

  const data = await callInnerTube(videoId)
  if (!data.streamingData || data.playabilityStatus?.status === 'LOGIN_REQUIRED') return null

  const all = [
    ...(data.streamingData.formats || []),
    ...(data.streamingData.adaptiveFormats || []),
  ].filter(f => f.url)

  // For downloads, prefer best quality video+audio (separate then merge)
  const videoFormats = all
    .filter(f => f.mimeType?.includes('video/mp4') && !f.audioChannels && (f.height || 0) <= maxHeight)
    .sort((a, b) => (b.height || 0) - (a.height || 0))
  const audioFormats = all
    .filter(f => f.mimeType?.includes('audio/mp4') || f.mimeType?.includes('audio/webm'))
    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))

  const finalPath = path.join(outputDir, `${videoId}.mp4`)

  if (videoFormats.length > 0 && audioFormats.length > 0) {
    const audioExt = audioFormats[0].mimeType?.includes('webm') ? 'webm' : 'm4a'
    const videoPath = path.join(outputDir, `${videoId}_video.mp4`)
    const audioPath = path.join(outputDir, `${videoId}_audio.${audioExt}`)
    await Promise.all([
      httpGet(videoFormats[0].url!, videoPath),
      httpGet(audioFormats[0].url!, audioPath),
    ])
    await mergeAV(videoPath, audioPath, finalPath)
    if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath)
    if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath)
    return finalPath
  }

  // Fallback: combined format (lower quality)
  const combined = all.filter(f => f.mimeType?.includes('video/mp4') && f.audioChannels)
    .sort((a, b) => (b.height || 0) - (a.height || 0))
  if (combined.length > 0) {
    await httpGet(combined[0].url!, finalPath)
    return finalPath
  }

  return null
}

export interface VideoMeta {
  title: string
  channelId: string
  author: string
  duration: number
  viewCount: number
  description: string
  thumbnail: string
}

export async function getVideoMeta(videoId: string): Promise<VideoMeta | null> {
  try {
    const data = await callInnerTube(videoId)
    const d = data.videoDetails
    if (!d) return null
    return {
      title: d.title || '',
      channelId: d.channelId || '',
      author: d.author || '',
      duration: parseInt(d.lengthSeconds || '0'),
      viewCount: parseInt(d.viewCount || '0'),
      description: d.shortDescription || '',
      thumbnail: d.thumbnail?.thumbnails?.slice(-1)[0]?.url || '',
    }
  } catch {
    return null
  }
}
