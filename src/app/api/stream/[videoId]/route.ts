import { NextRequest, NextResponse } from 'next/server'
import { getVideo, addTempStream, getTempStream, cleanupExpiredStreams } from '@/lib/db'
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'

const TMP_STREAMS_DIR = '/tmp/ot-streams'
const YT_DLP = '/usr/local/bin/yt-dlp'
const FFMPEG = '/usr/bin/ffmpeg'

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

async function downloadWithYtdlp(videoId: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ensureDir(path.dirname(outputPath))
    const proc = spawn(YT_DLP, [
      '--ffmpeg-location', FFMPEG,
      '--js-runtimes', 'node:/usr/bin/node',
      '--extractor-args', 'youtube:player_client=android_vr,android',
      ...((() => { try { return require('fs').existsSync('/root/yt-clone/youtube-cookies.txt') ? ['--cookies', '/root/yt-clone/youtube-cookies.txt'] : [] } catch { return [] } })()),
      '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      '--merge-output-format', 'mp4',
      '--ignore-errors',
      '-o', outputPath,
      '--no-playlist',
      `https://www.youtube.com/watch?v=${videoId}`,
    ], { detached: true })
    proc.unref()
    proc.stderr.on('data', (d: Buffer) => console.error('stream yt-dlp:', d.toString()))
    proc.on('close', (code) => {
      if (code === 0 || (code === 1 && fs.existsSync(outputPath))) resolve()
      else reject(new Error(`yt-dlp exited with code ${code}`))
    })
    proc.on('error', reject)
  })
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const { videoId } = await params

  // Check if video is already downloaded locally
  const localVideo = getVideo(videoId)
  if (localVideo?.video_path && fs.existsSync(localVideo.video_path)) {
    const filename = path.basename(localVideo.video_path)
    const baseUrl = req.nextUrl.origin
    return NextResponse.redirect(`${baseUrl}/yt/api/storage/${videoId}/${encodeURIComponent(filename)}`)
  }

  // Check temp_streams table
  let streamEntry = getTempStream(videoId)

  if (!streamEntry) {
    // Start download
    const videoDir = path.join(TMP_STREAMS_DIR, videoId)
    const outputPath = path.join(videoDir, 'video.mp4')
    ensureDir(videoDir)

    try {
      await downloadWithYtdlp(videoId, outputPath)
    } catch (e) {
      console.error('Stream download error:', e)
      return NextResponse.json({ error: '스트리밍 다운로드에 실패했습니다' }, { status: 500 })
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
      .toISOString().replace('T', ' ').split('.')[0]
    addTempStream(videoId, outputPath, expiresAt)
    streamEntry = getTempStream(videoId)
  }

  if (!streamEntry || !fs.existsSync(streamEntry.file_path)) {
    return NextResponse.json({ error: '스트림 파일을 찾을 수 없습니다' }, { status: 404 })
  }

  const filePath = streamEntry.file_path
  const stat = fs.statSync(filePath)
  const fileSize = stat.size
  const rangeHeader = req.headers.get('range')

  if (rangeHeader) {
    const parts = rangeHeader.replace(/bytes=/, '').split('-')
    const start = parseInt(parts[0], 10)
    const end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + 1024 * 1024, fileSize - 1)
    const chunkSize = end - start + 1

    const stream = fs.createReadStream(filePath, { start, end })
    // Convert Node.js stream to Web ReadableStream
    const readableStream = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk) => controller.enqueue(chunk))
        stream.on('end', () => controller.close())
        stream.on('error', (err) => controller.error(err))
      },
      cancel() {
        stream.destroy()
      },
    })

    return new NextResponse(readableStream, {
      status: 206,
      headers: {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(chunkSize),
        'Content-Type': 'video/mp4',
      },
    })
  } else {
    const stream = fs.createReadStream(filePath)
    const readableStream = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk) => controller.enqueue(chunk))
        stream.on('end', () => controller.close())
        stream.on('error', (err) => controller.error(err))
      },
      cancel() {
        stream.destroy()
      },
    })

    return new NextResponse(readableStream, {
      status: 200,
      headers: {
        'Content-Length': String(fileSize),
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes',
      },
    })
  }
}
