import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { Readable } from 'stream'

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

  const relativePath = pathSegments.map(decodeURIComponent).join('/')
  if (relativePath.includes('..')) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const filePath = path.join(STORAGE_ROOT, relativePath)
  if (!filePath.startsWith(STORAGE_ROOT)) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return new NextResponse('Not Found', { status: 404 })
  }

  const ext = path.extname(filePath).toLowerCase()
  const mimeType = MIME_TYPES[ext] || 'application/octet-stream'
  const fileSize = fs.statSync(filePath).size
  const isDownload = new URL(req.url).searchParams.get('download') === '1'

  const baseHeaders: Record<string, string> = {
    'Content-Type': mimeType,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=31536000',
  }
  if (isDownload) {
    baseHeaders['Content-Disposition'] = `attachment; filename="${encodeURIComponent(path.basename(filePath))}"`
  }

  // Handle Range requests (required for video seeking)
  const rangeHeader = req.headers.get('range')
  if (rangeHeader) {
    const parts = rangeHeader.replace(/bytes=/, '').split('-')
    const start = parseInt(parts[0], 10)
    const end = parts[1] ? Math.min(parseInt(parts[1], 10), fileSize - 1) : fileSize - 1
    const chunkSize = end - start + 1

    const nodeStream = fs.createReadStream(filePath, { start, end })
    const webStream = Readable.toWeb(nodeStream) as ReadableStream

    return new NextResponse(webStream, {
      status: 206,
      headers: {
        ...baseHeaders,
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Content-Length': String(chunkSize),
      },
    })
  }

  // Full file — stream it (never readFileSync for large files)
  const nodeStream = fs.createReadStream(filePath)
  const webStream = Readable.toWeb(nodeStream) as ReadableStream

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      ...baseHeaders,
      'Content-Length': String(fileSize),
    },
  })
}
