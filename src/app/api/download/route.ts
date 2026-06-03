import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { downloadVideo, getVideoInfo, downloadProgress } from '@/lib/ytdlp'
import { downloadViaInnerTube, getVideoMeta } from '@/lib/innertube'
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

      // Get info and download in background (InnerTube first, yt-dlp fallback)
      ;(async () => {
        try {
          downloadProgress.set(videoId, { percent: 0, speed: '', eta: '', status: 'downloading' })

          // Try InnerTube download first (no bot detection)
          let videoPath: string | null = null
          let meta = await getVideoMeta(videoId).catch(() => null)

          if (meta) {
            insertVideo({
              id: videoId, title: meta.title, channel: meta.author,
              channel_id: meta.channelId, duration: meta.duration,
              upload_date: '', description: meta.description?.slice(0, 2000),
              thumbnail_path: undefined, video_path: undefined,
              captions_path: undefined, metadata_json: undefined, folder,
            })
          }

          downloadProgress.set(videoId, { percent: 30, speed: '', eta: '', status: 'downloading' })
          videoPath = await downloadViaInnerTube(videoId, outputDir).catch(() => null)

          if (videoPath) {
            downloadProgress.set(videoId, { percent: 100, speed: '', eta: '', status: 'done' })
            const finalMeta = meta || await getVideoMeta(videoId).catch(() => null)
            insertVideo({
              id: videoId,
              title: finalMeta?.title || `Video ${videoId}`,
              channel: finalMeta?.author || '',
              channel_id: finalMeta?.channelId || undefined,
              duration: finalMeta?.duration || 0,
              upload_date: '',
              description: finalMeta?.description?.slice(0, 2000) || undefined,
              thumbnail_path: undefined,
              video_path: videoPath,
              captions_path: undefined,
              metadata_json: undefined,
              folder,
            })
            return
          }

          // Fall back to yt-dlp
          downloadProgress.set(videoId, { percent: 0, speed: '', eta: '', status: 'downloading' })
          const result = await downloadVideo(videoId, outputDir)
          const info = await getVideoInfo(videoId).catch(() => null)
          insertVideo({
            id: videoId,
            title: info?.title || meta?.title || `Video ${videoId}`,
            channel: info?.channel || meta?.author || '',
            channel_id: info?.channel_id || meta?.channelId || undefined,
            duration: info?.duration || meta?.duration || 0,
            upload_date: info?.upload_date || undefined,
            description: (info?.description || meta?.description)?.slice(0, 2000) || undefined,
            thumbnail_path: result.thumbnailPath || undefined,
            video_path: result.videoPath || undefined,
            captions_path: result.captionsPath || undefined,
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
