import { NextRequest, NextResponse } from 'next/server'
import { createBatchDownload, updateBatchDownload, getBatchDownloads, insertVideo, autoDetectFolder } from '@/lib/db'
import { getVideoMeta } from '@/lib/innertube'
import { getPlaylistItems, getPlaylist, getChannelVideos, getChannelDetails } from '@/lib/youtube'
import path from 'path'
import fs from 'fs'
import { spawn } from 'child_process'
import { STORAGE_ROOT } from '@/lib/db'

const YT_DLP = '/usr/local/bin/yt-dlp'
const FFMPEG = '/usr/bin/ffmpeg'
const COOKIES = '/root/cookies.txt'
const FORMAT = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best'

function hasCookies() { return fs.existsSync(COOKIES) }

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
    args.push('--ffmpeg-location', FFMPEG, '-f', FORMAT, '--merge-output-format', 'mp4', '--no-playlist', '-o', outputTemplate, `https://www.youtube.com/watch?v=${videoId}`)
    const proc = spawn(YT_DLP, args)
    proc.stderr.on('data', (d: Buffer) => { const msg = d.toString(); if (!msg.includes('WARNING')) console.error('batch yt-dlp:', msg.trim()) })
    proc.on('close', (code) => {
      const mp4 = path.join(outputDir, `${videoId}.mp4`)
      if ((code === 0 || code === 1) && fs.existsSync(mp4)) resolve(mp4)
      else reject(new Error(`yt-dlp exited ${code}`))
    })
    proc.on('error', reject)
  })
}

async function downloadVideo(videoId: string, outputDir: string): Promise<string> {
  try { return await ytdlpDownload(videoId, outputDir, false) }
  catch { return ytdlpDownload(videoId, outputDir, true) }
}

// In-memory queue to avoid double starts
const activeJobs = new Set<number>()

export async function GET() {
  const jobs = getBatchDownloads()
  return NextResponse.json({ jobs })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { type, url, playlistId, channelId, folder = '기타' } = body

  if (!type) return NextResponse.json({ error: 'type required' }, { status: 400 })

  let jobId: number

  if (type === 'playlist' && playlistId) {
    jobId = createBatchDownload('playlist', playlistId, folder)
    runPlaylistDownload(jobId, playlistId, folder).catch(console.error)
    return NextResponse.json({ jobId, status: 'started' })
  }

  if (type === 'channel' && channelId) {
    jobId = createBatchDownload('channel', channelId, folder)
    runChannelDownload(jobId, channelId, folder).catch(console.error)
    return NextResponse.json({ jobId, status: 'started' })
  }

  if (type === 'url' && url) {
    jobId = createBatchDownload('url', url, folder)
    runUrlDownload(jobId, url, folder).catch(console.error)
    return NextResponse.json({ jobId, status: 'started' })
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
}

async function runPlaylistDownload(jobId: number, playlistId: string, folder: string) {
  if (activeJobs.has(jobId)) return
  activeJobs.add(jobId)

  try {
    updateBatchDownload(jobId, { status: 'running', title: `플레이리스트 ${playlistId}` })

    // Get all playlist items (paginated)
    let pageToken: string | undefined
    const videoIds: string[] = []
    do {
      const result = await getPlaylistItems(playlistId, pageToken)
      videoIds.push(...result.items.map(v => v.id))
      pageToken = result.nextPageToken
    } while (pageToken)

    updateBatchDownload(jobId, { total: videoIds.length, title: `플레이리스트 (${videoIds.length}개)` })

    // Try to get playlist title
    const playlist = await getPlaylist(playlistId)
    if (playlist?.title) updateBatchDownload(jobId, { title: playlist.title })

    let completed = 0
    for (const videoId of videoIds) {
      const outputDir = path.join(STORAGE_ROOT, videoId)
      try {
        const meta = await getVideoMeta(videoId).catch(() => null)
        const videoPath = await downloadVideo(videoId, outputDir)
        const detectedFolder = folder === 'auto' ? autoDetectFolder(meta?.title || '') : folder
        insertVideo({
          id: videoId,
          title: meta?.title || `Video ${videoId}`,
          channel: meta?.author || '',
          channel_id: meta?.channelId || undefined,
          duration: meta?.duration || 0,
          upload_date: undefined,
          description: meta?.description?.slice(0, 2000) || undefined,
          thumbnail_path: undefined,
          video_path: videoPath || undefined,
          captions_path: undefined,
          folder: detectedFolder,
        })
      } catch (e) {
        console.error(`Playlist video ${videoId} failed:`, e)
      }
      completed++
      updateBatchDownload(jobId, { completed })
    }

    updateBatchDownload(jobId, { status: 'done' })
  } catch (e) {
    console.error('Playlist download error:', e)
    updateBatchDownload(jobId, { status: 'error' })
  } finally {
    activeJobs.delete(jobId)
  }
}

async function runChannelDownload(jobId: number, channelId: string, folder: string) {
  if (activeJobs.has(jobId)) return
  activeJobs.add(jobId)

  try {
    updateBatchDownload(jobId, { status: 'running' })

    const channel = await getChannelDetails(channelId)
    if (channel) updateBatchDownload(jobId, { title: `${channel.title} (채널 전체)` })

    // Get all channel videos
    let pageToken: string | undefined
    const videoIds: string[] = []
    do {
      const result = await getChannelVideos(channelId, pageToken)
      videoIds.push(...result.items.map(v => v.id))
      pageToken = result.nextPageToken
    } while (pageToken)

    updateBatchDownload(jobId, { total: videoIds.length })

    let completed = 0
    for (const videoId of videoIds) {
      const outputDir = path.join(STORAGE_ROOT, videoId)
      try {
        const meta = await getVideoMeta(videoId).catch(() => null)
        const videoPath = await downloadVideo(videoId, outputDir)
        const detectedFolder = folder === 'auto' ? autoDetectFolder(meta?.title || '') : folder
        insertVideo({
          id: videoId,
          title: meta?.title || `Video ${videoId}`,
          channel: meta?.author || '',
          channel_id: meta?.channelId || undefined,
          duration: meta?.duration || 0,
          upload_date: undefined,
          description: meta?.description?.slice(0, 2000) || undefined,
          thumbnail_path: undefined,
          video_path: videoPath || undefined,
          captions_path: undefined,
          folder: detectedFolder,
        })
      } catch (e) {
        console.error(`Channel video ${videoId} failed:`, e)
      }
      completed++
      updateBatchDownload(jobId, { completed })
    }

    updateBatchDownload(jobId, { status: 'done' })
  } catch (e) {
    console.error('Channel download error:', e)
    updateBatchDownload(jobId, { status: 'error' })
  } finally {
    activeJobs.delete(jobId)
  }
}

async function runUrlDownload(jobId: number, url: string, folder: string) {
  if (activeJobs.has(jobId)) return
  activeJobs.add(jobId)

  try {
    updateBatchDownload(jobId, { status: 'running', total: 1 })
    // Extract video ID from URL
    const match = url.match(/[?&]v=([^&]+)/) || url.match(/youtu\.be\/([^?]+)/)
    const videoId = match?.[1]
    if (!videoId) throw new Error('Invalid YouTube URL')

    const outputDir = path.join(STORAGE_ROOT, videoId)
    const meta = await getVideoMeta(videoId).catch(() => null)
    const videoPath = await downloadVideo(videoId, outputDir)
    const detectedFolder = folder === 'auto' ? autoDetectFolder(meta?.title || '') : folder
    insertVideo({
      id: videoId,
      title: meta?.title || `Video ${videoId}`,
      channel: meta?.author || '',
      channel_id: meta?.channelId || undefined,
      duration: meta?.duration || 0,
      upload_date: undefined,
      description: meta?.description?.slice(0, 2000) || undefined,
      thumbnail_path: undefined,
      video_path: videoPath || undefined,
      captions_path: undefined,
      folder: detectedFolder,
    })
    updateBatchDownload(jobId, { status: 'done', completed: 1 })
  } catch (e) {
    console.error('URL download error:', e)
    updateBatchDownload(jobId, { status: 'error' })
  } finally {
    activeJobs.delete(jobId)
  }
}
