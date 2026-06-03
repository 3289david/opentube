import { NextRequest, NextResponse } from 'next/server'
import { getVideo, addTempStream, getTempStream } from '@/lib/db'
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'

const TMP_STREAMS_DIR = '/tmp/ot-streams'
const YT_DLP = '/usr/local/bin/yt-dlp'
const FFMPEG = '/usr/bin/ffmpeg'
const COOKIES = '/root/cookies.txt'
const FORMAT = 'bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/best[ext=mp4][height<=1080]/best'

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function hasCookies(): boolean {
  return fs.existsSync(COOKIES)
}

// Primary: yt-dlp with cookies
function downloadWithCookies(videoId: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ensureDir(path.dirname(outputPath))
    const proc = spawn(YT_DLP, [
      '--cookies', COOKIES,
      '--js-runtimes', 'node:/usr/bin/node',
      '--remote-components', 'ejs:github',
      '--ffmpeg-location', FFMPEG,
      '-f', FORMAT,
      '--merge-output-format', 'mp4',
      '--no-playlist',
      '-o', outputPath,
      `https://www.youtube.com/watch?v=${videoId}`,
    ], { detached: true })
    proc.unref()
    proc.stderr.on('data', (d: Buffer) => {
      const msg = d.toString()
      if (!msg.includes('WARNING')) console.error('yt-dlp:', msg.trim())
    })
    proc.on('close', (code) => {
      if (code === 0 || (code === 1 && fs.existsSync(outputPath))) resolve()
      else reject(new Error(`yt-dlp exited with code ${code}`))
    })
    proc.on('error', reject)
  })
}

// Fallback: yt-dlp through Tor proxy
function downloadWithTor(videoId: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ensureDir(path.dirname(outputPath))
    const args = [
      '--proxy', 'socks5://127.0.0.1:9060',
      '--extractor-args', 'youtube:player_client=android_vr,android',
      '--ffmpeg-location', FFMPEG,
      '-f', FORMAT,
      '--merge-output-format', 'mp4',
      '--no-playlist',
      '-o', outputPath,
      `https://www.youtube.com/watch?v=${videoId}`,
    ]
    if (hasCookies()) args.unshift('--cookies', COOKIES)
    const proc = spawn(YT_DLP, args, { detached: true })
    proc.unref()
    proc.stderr.on('data', (d: Buffer) => {
      const msg = d.toString()
      if (!msg.includes('WARNING')) console.error('yt-dlp tor:', msg.trim())
    })
    proc.on('close', (code) => {
      if (code === 0 || (code === 1 && fs.existsSync(outputPath))) resolve()
      else reject(new Error(`yt-dlp tor exited with code ${code}`))
    })
    proc.on('error', reject)
  })
}

function serveFile(filePath: string, req: NextRequest): NextResponse {
  const stat = fs.statSync(filePath)
  const fileSize = stat.size
  const rangeHeader = req.headers.get('range')

  if (rangeHeader) {
    const parts = rangeHeader.replace(/bytes=/, '').split('-')
    const start = parseInt(parts[0], 10)
    const end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + 2 * 1024 * 1024, fileSize - 1)
    const chunkSize = end - start + 1
    const stream = fs.createReadStream(filePath, { start, end })
    const readable = new ReadableStream({
      start(controller) {
        stream.on('data', chunk => controller.enqueue(chunk))
        stream.on('end', () => controller.close())
        stream.on('error', err => controller.error(err))
      },
      cancel() { stream.destroy() },
    })
    return new NextResponse(readable, {
      status: 206,
      headers: {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(chunkSize),
        'Content-Type': 'video/mp4',
      },
    })
  }

  const stream = fs.createReadStream(filePath)
  const readable = new ReadableStream({
    start(controller) {
      stream.on('data', chunk => controller.enqueue(chunk))
      stream.on('end', () => controller.close())
      stream.on('error', err => controller.error(err))
    },
    cancel() { stream.destroy() },
  })
  return new NextResponse(readable, {
    status: 200,
    headers: {
      'Content-Length': String(fileSize),
      'Content-Type': 'video/mp4',
      'Accept-Ranges': 'bytes',
    },
  })
}

function saveTemp(videoId: string, filePath: string) {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toISOString().replace('T', ' ').split('.')[0]
  addTempStream(videoId, filePath, expiresAt)
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const { videoId } = await params

  // 1. Serve locally downloaded video (permanent storage)
  const localVideo = getVideo(videoId)
  if (localVideo?.video_path && fs.existsSync(localVideo.video_path)) {
    const filename = path.basename(localVideo.video_path)
    return NextResponse.redirect(`${req.nextUrl.origin}/yt/api/storage/${videoId}/${encodeURIComponent(filename)}`)
  }

  // 2. Serve from temp stream cache
  const streamEntry = getTempStream(videoId)
  if (streamEntry && fs.existsSync(streamEntry.file_path)) {
    return serveFile(streamEntry.file_path, req)
  }

  const videoDir = path.join(TMP_STREAMS_DIR, videoId)
  const outputPath = path.join(videoDir, 'video.mp4')
  ensureDir(videoDir)

  // 3. Primary: yt-dlp with cookies
  if (hasCookies()) {
    try {
      await downloadWithCookies(videoId, outputPath)
      if (fs.existsSync(outputPath)) {
        saveTemp(videoId, outputPath)
        return serveFile(outputPath, req)
      }
    } catch (e) {
      console.error('cookies download failed, trying Tor:', e)
    }
  }

  // 4. Fallback: yt-dlp through Tor
  try {
    await downloadWithTor(videoId, outputPath)
    if (fs.existsSync(outputPath)) {
      saveTemp(videoId, outputPath)
      return serveFile(outputPath, req)
    }
  } catch (e) {
    console.error('Tor download failed:', e)
  }

  return NextResponse.json({ error: '스트리밍에 실패했습니다' }, { status: 500 })
}
