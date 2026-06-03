import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'

const YT_DLP = '/usr/local/bin/yt-dlp'
const FFMPEG = '/usr/bin/ffmpeg'
const STORAGE_ROOT = path.join(process.cwd(), 'storage')

export interface DownloadResult {
  videoPath: string | null
  thumbnailPath: string | null
  captionsPath: string | null
  metadataPath: string | null
}

export interface DownloadProgress {
  percent: number
  speed: string
  eta: string
  status: 'downloading' | 'processing' | 'done' | 'error'
  error?: string
}

// In-memory progress store
export const downloadProgress = new Map<string, DownloadProgress>()

function ensureStorageDir(videoId: string): string {
  const dir = path.join(STORAGE_ROOT, videoId)
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function findFile(dir: string, extensions: string[]): string | null {
  try {
    const files = fs.readdirSync(dir)
    for (const ext of extensions) {
      const found = files.find(f => f.endsWith(ext))
      if (found) return path.join(dir, found)
    }
  } catch {
    // ignore
  }
  return null
}

export async function downloadVideo(videoId: string, outputDir?: string): Promise<DownloadResult> {
  const dir = outputDir || path.join(STORAGE_ROOT, videoId)
  fs.mkdirSync(dir, { recursive: true })
  const url = `https://www.youtube.com/watch?v=${videoId}`

  downloadProgress.set(videoId, { percent: 0, speed: '', eta: '', status: 'downloading' })

  return new Promise((resolve, reject) => {
    const args = [
      '--ffmpeg-location', FFMPEG,
      '--js-runtimes', 'node:/usr/bin/node',
      '--extractor-args', 'youtube:player_client=android,web',
      '--format', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      '--merge-output-format', 'mp4',
      '--write-thumbnail',
      '--convert-thumbnails', 'jpg',
      '--write-subs',
      '--write-auto-subs',
      '--sub-langs', 'ko,en',
      '--write-info-json',
      '--ignore-errors',
      '--output', path.join(dir, '%(id)s.%(ext)s'),
      '--no-playlist',
      url,
    ]

    const proc = spawn(YT_DLP, args, { cwd: dir, detached: true })

    proc.stdout.on('data', (data: Buffer) => {
      const line = data.toString()
      // Parse progress: [download]  45.2% of 123.45MiB at 1.23MiB/s ETA 00:05
      const progressMatch = line.match(/\[download\]\s+([\d.]+)%.*?at\s+([\d.]+\w+\/s).*?ETA\s+(\S+)/)
      if (progressMatch) {
        downloadProgress.set(videoId, {
          percent: parseFloat(progressMatch[1]),
          speed: progressMatch[2],
          eta: progressMatch[3],
          status: 'downloading',
        })
      }
      if (line.includes('[Merger]') || line.includes('Merging formats')) {
        downloadProgress.set(videoId, { percent: 99, speed: '', eta: '', status: 'processing' })
      }
    })

    proc.stderr.on('data', (data: Buffer) => {
      console.error('yt-dlp stderr:', data.toString())
    })

    proc.on('close', (code) => {
      if (code !== 0) {
        downloadProgress.set(videoId, { percent: 0, speed: '', eta: '', status: 'error', error: `yt-dlp exited with code ${code}` })
        reject(new Error(`yt-dlp exited with code ${code}`))
        return
      }

      downloadProgress.set(videoId, { percent: 100, speed: '', eta: '', status: 'done' })

      const videoPath = findFile(dir, ['.mp4', '.mkv', '.webm'])
      const thumbnailPath = findFile(dir, ['.jpg', '.jpeg', '.webp', '.png'])
      const captionsPath = findFile(dir, ['.vtt', '.srt'])
      const metadataPath = findFile(dir, ['.info.json'])

      resolve({ videoPath, thumbnailPath, captionsPath, metadataPath })
    })

    proc.on('error', (err) => {
      downloadProgress.set(videoId, { percent: 0, speed: '', eta: '', status: 'error', error: err.message })
      reject(err)
    })
  })
}

export interface VideoInfo {
  id: string
  title: string
  channel: string
  channel_id: string
  duration: number
  upload_date: string
  description: string
  thumbnail: string
  view_count: number
  webpage_url: string
}

export async function getVideoInfo(videoId: string): Promise<VideoInfo | null> {
  return new Promise((resolve) => {
    const url = `https://www.youtube.com/watch?v=${videoId}`
    const proc = spawn(YT_DLP, [
      '--js-runtimes', 'node:/usr/bin/node',
      '--extractor-args', 'youtube:player_client=android,web',
      '--dump-json', '--no-playlist', url,
    ])

    let output = ''
    proc.stdout.on('data', (data: Buffer) => { output += data.toString() })
    proc.on('close', (code) => {
      if (code !== 0 || !output.trim()) { resolve(null); return }
      try {
        const info = JSON.parse(output)
        resolve({
          id: info.id,
          title: info.title,
          channel: info.uploader || info.channel,
          channel_id: info.uploader_id || info.channel_id,
          duration: info.duration || 0,
          upload_date: info.upload_date || '',
          description: info.description || '',
          thumbnail: info.thumbnail || '',
          view_count: info.view_count || 0,
          webpage_url: info.webpage_url || url,
        })
      } catch {
        resolve(null)
      }
    })
    proc.on('error', () => resolve(null))
  })
}

export async function downloadPlaylist(playlistUrl: string, outputDir: string): Promise<void> {
  fs.mkdirSync(outputDir, { recursive: true })

  return new Promise((resolve, reject) => {
    const args = [
      '--ffmpeg-location', FFMPEG,
      '--js-runtimes', 'node:/usr/bin/node',
      '--extractor-args', 'youtube:player_client=android,web',
      '--format', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      '--merge-output-format', 'mp4',
      '--write-thumbnail',
      '--convert-thumbnails', 'jpg',
      '--write-subs',
      '--write-auto-subs',
      '--sub-langs', 'ko,en',
      '--write-info-json',
      '--ignore-errors',
      '--output', path.join(outputDir, '%(playlist_index)s-%(id)s/%(id)s.%(ext)s'),
      '--yes-playlist',
      playlistUrl,
    ]

    const proc = spawn(YT_DLP, args)
    proc.stdout.on('data', (d: Buffer) => console.log('playlist:', d.toString()))
    proc.stderr.on('data', (d: Buffer) => console.error('playlist err:', d.toString()))
    proc.on('close', (code) => {
      if (code !== 0) reject(new Error(`yt-dlp playlist exited with code ${code}`))
      else resolve()
    })
    proc.on('error', reject)
  })
}

export async function downloadChannel(channelUrl: string, outputDir: string): Promise<void> {
  fs.mkdirSync(outputDir, { recursive: true })

  return new Promise((resolve, reject) => {
    const args = [
      '--ffmpeg-location', FFMPEG,
      '--js-runtimes', 'node:/usr/bin/node',
      '--extractor-args', 'youtube:player_client=android,web',
      '--format', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      '--merge-output-format', 'mp4',
      '--write-thumbnail',
      '--convert-thumbnails', 'jpg',
      '--write-info-json',
      '--ignore-errors',
      '--output', path.join(outputDir, '%(uploader)s/%(id)s/%(id)s.%(ext)s'),
      channelUrl,
    ]

    const proc = spawn(YT_DLP, args)
    proc.stdout.on('data', (d: Buffer) => console.log('channel:', d.toString()))
    proc.stderr.on('data', (d: Buffer) => console.error('channel err:', d.toString()))
    proc.on('close', (code) => {
      if (code !== 0) reject(new Error(`yt-dlp channel exited with code ${code}`))
      else resolve()
    })
    proc.on('error', reject)
  })
}
