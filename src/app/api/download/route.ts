import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { downloadVideo, getVideoInfo, downloadProgress } from '@/lib/ytdlp'
import { insertVideo, getVideo } from '@/lib/db'

const STORAGE_ROOT = path.join(process.cwd(), 'storage')

// GET - check download status/progress
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const videoId = searchParams.get('videoId')

  if (!videoId) {
    return NextResponse.json({ error: 'videoId required' }, { status: 400 })
  }

  const progress = downloadProgress.get(videoId)
  if (!progress) {
    // Check if already in DB
    const existing = getVideo(videoId)
    if (existing) {
      return NextResponse.json({ percent: 100, speed: '', eta: '', status: 'done' })
    }
    return NextResponse.json({ percent: 0, speed: '', eta: '', status: 'idle' })
  }

  return NextResponse.json(progress)
}

// POST - start download
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { videoId, folder = '기타', playlistUrl, type } = body

    if (!videoId && !playlistUrl) {
      return NextResponse.json({ error: 'videoId or playlistUrl required' }, { status: 400 })
    }

    if (videoId) {
      // Check if already downloaded
      const existing = getVideo(videoId)
      if (existing?.video_path) {
        return NextResponse.json({ status: 'already_downloaded', videoId })
      }

      // Start download in background
      const outputDir = path.join(STORAGE_ROOT, videoId)

      // Get basic info first for immediate DB entry
      getVideoInfo(videoId).then(async (info) => {
        if (info) {
          insertVideo({
            id: videoId,
            title: info.title,
            channel: info.channel,
            channel_id: info.channel_id,
            duration: info.duration,
            upload_date: info.upload_date,
            description: info.description?.slice(0, 2000),
            thumbnail_path: undefined,
            video_path: undefined,
            captions_path: undefined,
            metadata_json: undefined,
            folder,
          })
        }
      }).catch(() => {})

      // Download in background
      downloadVideo(videoId, outputDir).then(async (result) => {
        // Update DB with file paths
        const info = await getVideoInfo(videoId).catch(() => null)
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
          metadata_json: undefined,
          folder,
        })
      }).catch((err) => {
        console.error('Download failed:', err)
      })

      return NextResponse.json({ status: 'started', videoId })
    }

    return NextResponse.json({ status: 'started', playlistUrl })
  } catch (error) {
    console.error('Download POST error:', error)
    return NextResponse.json({ error: 'Failed to start download' }, { status: 500 })
  }
}
