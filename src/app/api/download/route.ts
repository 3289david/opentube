import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { spawn } from 'child_process'
import fs from 'fs'
import { downloadProgress } from '@/lib/ytdlp'
import { getVideoMeta } from '@/lib/innertube'
import { insertVideo, getVideo } from '@/lib/db'

const STORAGE_ROOT = path.join(process.cwd(), 'storage')
const YT_DLP = '/usr/local/bin/yt-dlp'
const FFMPEG = '/usr/bin/ffmpeg'
const COOKIES = '/root/cookies.txt'
const FORMAT = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best'

function hasCookies(): boolean {
  return fs.existsSync(COOKIES)
}

function ytdlpDownload(videoId: string, outputDir: string, useTor: boolean): Promise<string> {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(outputDir, { recursive: true })
    const outputTemplate = path.join(outputDir, `${videoId}.%(ext)s`)
    const args: string[] = []

    if (hasCookies()) args.push('--cookies', COOKIES)
    if (useTor) {
      args.push('--proxy', 'socks5://127.0.0.1:9060')
      args.push('--extractor-args', 'youtube:player_client=android_vr,android')
    } else {
      args.push('--js-runtimes', 'node:/usr/bin/node')
      args.push('--remote-components', 'ejs:github')
    }

    args.push(
      '--ffmpeg-location', FFMPEG,
      '-f', FORMAT,
      '--merge-output-format', 'mp4',
      '--no-playlist',
      '-o', outputTemplate,
      `https://www.youtube.com/watch?v=${videoId}`,
    )

    const proc = spawn(YT_DLP, args)
    let lastPercent = 0
    proc.stdout.on('data', (d: Buffer) => {
      const m = d.toString().match(/(\d+\.?\d*)%/)
      if (m) {
        lastPercent = parseFloat(m[1])
        downloadProgress.set(videoId, { percent: Math.round(lastPercent), speed: '', eta: '', status: 'downloading' })
      }
    })
    proc.stderr.on('data', (d: Buffer) => {
      const msg = d.toString()
      if (!msg.includes('WARNING')) console.error('download yt-dlp:', msg.trim())
    })
    proc.on('close', (code) => {
      const mp4 = path.join(outputDir, `${videoId}.mp4`)
      if ((code === 0 || code === 1) && fs.existsSync(mp4)) resolve(mp4)
      else reject(new Error(`yt-dlp exited with code ${code}`))
    })
    proc.on('error', reject)
  })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const videoId = searchParams.get('videoId')

  if (!videoId) return NextResponse.json({ error: 'videoId required' }, { status: 400 })

  const progress = downloadProgress.get(videoId)
  if (!progress) {
    const existing = getVideo(videoId)
    if (existing) return NextResponse.json({ percent: 100, speed: '', eta: '', status: 'done' })
    return NextResponse.json({ percent: 0, speed: '', eta: '', status: 'idle' })
  }
  return NextResponse.json(progress)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { videoId, folder = '기타', playlistUrl } = body

    if (!videoId && !playlistUrl) {
      return NextResponse.json({ error: 'videoId or playlistUrl required' }, { status: 400 })
    }

    if (videoId) {
      const existing = getVideo(videoId)
      if (existing?.video_path) return NextResponse.json({ status: 'already_downloaded', videoId })

      const outputDir = path.join(STORAGE_ROOT, videoId)

      ;(async () => {
        try {
          downloadProgress.set(videoId, { percent: 0, speed: '', eta: '', status: 'downloading' })
          const meta = await getVideoMeta(videoId).catch(() => null)

          if (meta) {
            insertVideo({
              id: videoId, title: meta.title, channel: meta.author,
              channel_id: meta.channelId, duration: meta.duration,
              upload_date: '', description: meta.description?.slice(0, 2000),
              thumbnail_path: undefined, video_path: undefined,
              captions_path: undefined, metadata_json: undefined, folder,
            })
          }

          downloadProgress.set(videoId, { percent: 10, speed: '', eta: '', status: 'downloading' })

          // Primary: cookies
          let videoPath: string | null = null
          try {
            videoPath = await ytdlpDownload(videoId, outputDir, false)
          } catch (e) {
            console.error('cookies download failed, trying Tor:', e)
            videoPath = await ytdlpDownload(videoId, outputDir, true)
          }

          downloadProgress.set(videoId, { percent: 100, speed: '', eta: '', status: 'done' })
          insertVideo({
            id: videoId,
            title: meta?.title || `Video ${videoId}`,
            channel: meta?.author || '',
            channel_id: meta?.channelId || undefined,
            duration: meta?.duration || 0,
            upload_date: '',
            description: meta?.description?.slice(0, 2000) || undefined,
            thumbnail_path: undefined,
            video_path: videoPath,
            captions_path: undefined,
            metadata_json: undefined,
            folder,
          })
        } catch (err) {
          console.error('Download failed:', err)
          downloadProgress.set(videoId, { percent: 0, speed: '', eta: '', status: 'error', error: String(err) })
        }
      })()

      return NextResponse.json({ status: 'started', videoId })
    }

    return NextResponse.json({ status: 'started', playlistUrl })
  } catch (error) {
    console.error('Download POST error:', error)
    return NextResponse.json({ error: 'Failed to start download' }, { status: 500 })
  }
}
