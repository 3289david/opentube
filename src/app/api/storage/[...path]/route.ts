import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const STORAGE_ROOT = '/root/yt-clone/storage'

const MIME_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.mkv': 'video/x-matroska',
  '.webm': 'video/webm',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.vtt': 'text/vtt',
  '.srt': 'text/plain',
  '.json': 'application/json',
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params

  // Safety: prevent path traversal
  const relativePath = pathSegments.map(decodeURIComponent).join('/')
  if (relativePath.includes('..')) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const filePath = path.join(STORAGE_ROOT, relativePath)

  // Ensure the resolved path is within storage root
  if (!filePath.startsWith(STORAGE_ROOT)) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return new NextResponse('Not Found', { status: 404 })
  }

  const ext = path.extname(filePath).toLowerCase()
  const mimeType = MIME_TYPES[ext] || 'application/octet-stream'
  const stat = fs.statSync(filePath)
  const fileSize = stat.size

  // Handle range requests for video streaming
  const rangeHeader = req.headers.get('range')
  if (rangeHeader && mimeType.startsWith('video/')) {
    const parts = rangeHeader.replace(/bytes=/, '').split('-')
    const start = parseInt(parts[0], 10)
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
    const chunkSize = end - start + 1

    const stream = fs.createReadStream(filePath, { start, end })
    const readable = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk) => controller.enqueue(chunk))
        stream.on('end', () => controller.close())
        stream.on('error', (err) => controller.error(err))
      },
    })

    return new NextResponse(readable, {
      status: 206,
      headers: {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(chunkSize),
        'Content-Type': mimeType,
      },
    })
  }

  // Full file
  const fileBuffer = fs.readFileSync(filePath)
  const isDownload = new URL(req.url).searchParams.get('download') === '1'
  const headers: Record<string, string> = {
    'Content-Type': mimeType,
    'Content-Length': String(fileSize),
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=31536000',
  }
  if (isDownload) {
    headers['Content-Disposition'] = `attachment; filename="${encodeURIComponent(path.basename(filePath))}"`
  }
  return new NextResponse(fileBuffer, { headers })
}
