import { NextResponse } from 'next/server'
import { db, STORAGE_ROOT, updateVideoSha256 } from '@/lib/db'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

function computeSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const stream = fs.createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

export async function GET() {
  // Compute SHA256 for videos that don't have it yet
  const videosWithoutHash = db.prepare(
    'SELECT id, video_path FROM videos WHERE sha256 IS NULL AND video_path IS NOT NULL'
  ).all() as { id: string; video_path: string }[]

  for (const v of videosWithoutHash) {
    const absPath = v.video_path.startsWith('/') ? v.video_path : path.join(STORAGE_ROOT, v.video_path)
    if (fs.existsSync(absPath)) {
      try {
        const hash = await computeSha256(absPath)
        updateVideoSha256(v.id, hash)
      } catch { /* skip */ }
    }
  }

  // Find duplicates by sha256
  const duplicates = db.prepare(`
    SELECT sha256, GROUP_CONCAT(id) as ids, GROUP_CONCAT(title, '|||') as titles, COUNT(*) as count
    FROM videos
    WHERE sha256 IS NOT NULL
    GROUP BY sha256
    HAVING count > 1
  `).all() as { sha256: string; ids: string; titles: string; count: number }[]

  const result = duplicates.map(d => ({
    sha256: d.sha256,
    count: d.count,
    videos: d.ids.split(',').map((id, i) => ({
      id,
      title: d.titles.split('|||')[i] || id,
    })),
  }))

  return NextResponse.json({ duplicates: result, scanned: videosWithoutHash.length })
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const keepId = searchParams.get('keep')
  const sha256 = searchParams.get('sha256')

  if (!keepId || !sha256) {
    return NextResponse.json({ error: 'keep and sha256 required' }, { status: 400 })
  }

  const toDelete = db.prepare(
    'SELECT id, video_path, thumbnail_path FROM videos WHERE sha256 = ? AND id != ?'
  ).all(sha256, keepId) as { id: string; video_path?: string; thumbnail_path?: string }[]

  for (const v of toDelete) {
    // Delete files
    const videoDir = path.join(STORAGE_ROOT, v.id)
    if (fs.existsSync(videoDir)) {
      fs.rmSync(videoDir, { recursive: true, force: true })
    }
    db.prepare('DELETE FROM videos WHERE id = ?').run(v.id)
  }

  return NextResponse.json({ deleted: toDelete.length })
}
