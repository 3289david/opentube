import { NextRequest, NextResponse } from 'next/server'
import { createBatchDownload, updateBatchDownload, getBatchDownloads, insertVideo, autoDetectFolder } from '@/lib/db'
import { downloadVideo, getVideoInfo } from '@/lib/ytdlp'
import { getPlaylistItems, getPlaylist, getChannelVideos, getChannelDetails } from '@/lib/youtube'
import path from 'path'
import { STORAGE_ROOT } from '@/lib/db'

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
        const result = await downloadVideo(videoId, outputDir)
        const info = await getVideoInfo(videoId)
        const detectedFolder = folder === 'auto' ? autoDetectFolder(info?.title || '') : folder
        insertVideo({
          id: videoId,
          title: info?.title || `Video ${videoId}`,
          channel: info?.channel || '',
          channel_id: info?.channel_id || undefined,
          duration: info?.duration || 0,
          upload_date: info?.upload_date || undefined,
          description: info?.description?.slice(0, 2000) || undefined,
          thumbnail_path: result.thumbnailPath || undefined,
          video_path: result.videoPath || undefined,
          captions_path: result.captionsPath || undefined,
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
        const result = await downloadVideo(videoId, outputDir)
        const info = await getVideoInfo(videoId)
        const detectedFolder = folder === 'auto' ? autoDetectFolder(info?.title || '') : folder
        insertVideo({
          id: videoId,
          title: info?.title || `Video ${videoId}`,
          channel: info?.channel || '',
          channel_id: info?.channel_id || undefined,
          duration: info?.duration || 0,
          upload_date: info?.upload_date || undefined,
          description: info?.description?.slice(0, 2000) || undefined,
          thumbnail_path: result.thumbnailPath || undefined,
          video_path: result.videoPath || undefined,
          captions_path: result.captionsPath || undefined,
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
    const result = await downloadVideo(videoId, outputDir)
    const info = await getVideoInfo(videoId)
    const detectedFolder = folder === 'auto' ? autoDetectFolder(info?.title || '') : folder
    insertVideo({
      id: videoId,
      title: info?.title || `Video ${videoId}`,
      channel: info?.channel || '',
      channel_id: info?.channel_id || undefined,
      duration: info?.duration || 0,
      upload_date: info?.upload_date || undefined,
      description: info?.description?.slice(0, 2000) || undefined,
      thumbnail_path: result.thumbnailPath || undefined,
      video_path: result.videoPath || undefined,
      captions_path: result.captionsPath || undefined,
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
