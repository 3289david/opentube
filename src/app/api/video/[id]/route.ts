import { NextRequest, NextResponse } from 'next/server'
import { getVideo, getVideoLikes, getUserVideoLike } from '@/lib/db'
import { getVideoDetails, getVideoComments } from '@/lib/youtube'
import { verifySession } from '@/lib/session'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const wantsComments = searchParams.get('comments') === '1'
  const wantsLikes = searchParams.get('likes') === '1'
  const sessionToken = searchParams.get('sessionToken')

  const session = sessionToken ? verifySession(sessionToken) : null
  const sessionId = session?.sessionId ?? ''

  // Check local DB for this session's download
  const localVideo = getVideo(id, sessionId)

  if (wantsComments) {
    const comments = await getVideoComments(id).catch(() => [])
    return NextResponse.json({ comments })
  }

  if (wantsLikes) {
    const { likes, dislikes } = getVideoLikes(id)
    let userLike: 'like' | 'dislike' | null = null
    if (session) userLike = getUserVideoLike(id, sessionId)
    return NextResponse.json({ likes, dislikes, userLike })
  }

  if (localVideo) {
    return NextResponse.json({
      id: localVideo.id,
      title: localVideo.title,
      channel: localVideo.channel,
      channelId: localVideo.channel_id,
      duration: localVideo.duration ? formatDuration(localVideo.duration) : '',
      uploadDate: localVideo.upload_date,
      description: localVideo.description,
      thumbnailPath: localVideo.thumbnail_path,
      videoPath: localVideo.video_path,
      captionsPath: localVideo.captions_path,
      isLocal: true,
    })
  }

  // Fallback to YouTube API
  try {
    const ytVideo = await getVideoDetails(id)
    if (ytVideo) {
      return NextResponse.json({
        id: ytVideo.id,
        title: ytVideo.title,
        channel: ytVideo.channelTitle,
        channelId: ytVideo.channelId,
        duration: ytVideo.duration,
        uploadDate: ytVideo.publishedAt?.split('T')[0],
        description: ytVideo.description,
        thumbnail: ytVideo.thumbnail,
        viewCount: ytVideo.viewCount,
        isLocal: false,
      })
    }
  } catch {
    // ignore YouTube API errors
  }

  return NextResponse.json({ id, title: `Video ${id}`, channel: '', isLocal: false })
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}
