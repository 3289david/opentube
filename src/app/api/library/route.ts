import { NextRequest, NextResponse } from 'next/server'
import { getAllVideos, deleteVideo, moveVideoToFolder, getStorageStats } from '@/lib/db'
import { verifySession } from '@/lib/session'
import fs from 'fs'

const STORAGE_ROOT = '/root/yt-clone/storage'

function getSessionId(req: NextRequest): string {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : req.nextUrl.searchParams.get('sessionToken') || ''
  if (!token) return ''
  const payload = verifySession(token)
  return payload?.sessionId ?? ''
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const folder = searchParams.get('folder') || undefined
  const search = searchParams.get('search') || undefined
  const sort = searchParams.get('sort') || 'downloaded_at'
  const wantsStats = searchParams.get('stats') === '1'
  const sessionId = getSessionId(req)

  const videos = getAllVideos(folder, search, sort, undefined, sessionId)
  const stats = wantsStats ? getStorageStats(sessionId) : undefined

  return NextResponse.json({ videos, stats })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, videoId, folder, sessionToken } = body
    const token = sessionToken || req.headers.get('authorization')?.replace('Bearer ', '') || ''
    const payload = token ? verifySession(token) : null
    const sessionId = payload?.sessionId ?? ''

    if (action === 'move' && videoId && folder) {
      moveVideoToFolder(videoId, folder, sessionId)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const videoId = searchParams.get('videoId')
  const sessionId = getSessionId(req)

  if (!videoId) {
    return NextResponse.json({ error: 'videoId required' }, { status: 400 })
  }

  // Delete files (shared storage — only delete if no other session has this video)
  const storageDir = `${STORAGE_ROOT}/${videoId}`
  if (fs.existsSync(storageDir)) {
    fs.rmSync(storageDir, { recursive: true, force: true })
  }

  deleteVideo(videoId, sessionId)

  return NextResponse.json({ success: true })
}
