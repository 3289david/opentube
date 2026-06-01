import { NextRequest, NextResponse } from 'next/server'
import { getAllVideos, deleteVideo, moveVideoToFolder, getStorageStats } from '@/lib/db'
import fs from 'fs'
import path from 'path'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const folder = searchParams.get('folder') || undefined
  const search = searchParams.get('search') || undefined
  const sort = searchParams.get('sort') || 'downloaded_at'
  const wantsStats = searchParams.get('stats') === '1'

  const videos = getAllVideos(folder, search, sort)
  const stats = wantsStats ? getStorageStats() : undefined

  return NextResponse.json({ videos, stats })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, videoId, folder } = body

    if (action === 'move' && videoId && folder) {
      moveVideoToFolder(videoId, folder)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const videoId = searchParams.get('videoId')

  if (!videoId) {
    return NextResponse.json({ error: 'videoId required' }, { status: 400 })
  }

  // Delete files
  const storageDir = path.join(process.cwd(), 'storage', videoId)
  if (fs.existsSync(storageDir)) {
    fs.rmSync(storageDir, { recursive: true, force: true })
  }

  // Delete from DB
  deleteVideo(videoId)

  return NextResponse.json({ success: true })
}
