import { NextRequest, NextResponse } from 'next/server'
import { exportLibraryHtml, exportVideoAsZip, exportVideoAsHtml } from '@/lib/export'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') || 'html'
  const videoId = searchParams.get('videoId')

  try {
    if (type === 'html' && !videoId) {
      // Export full library as HTML
      const htmlBuffer = await exportLibraryHtml()
      return new NextResponse(htmlBuffer as unknown as BodyInit, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': 'attachment; filename="opentube-library.html"',
        },
      })
    }

    if (type === 'html' && videoId) {
      // Pass storage base URL so the HTML can reference the video via server (avoids huge base64)
      const origin = new URL(req.url).origin
      const html = exportVideoAsHtml(videoId, `${origin}/yt/api/storage`)
      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `attachment; filename="${videoId}.html"`,
        },
      })
    }

    if (type === 'zip' && videoId) {
      const zipStream = exportVideoAsZip(videoId)

      const chunks: Buffer[] = []
      await new Promise<void>((resolve, reject) => {
        zipStream.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)))
        zipStream.on('end', resolve)
        zipStream.on('error', reject)
      })

      const buffer = Buffer.concat(chunks)
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${videoId}.zip"`,
        },
      })
    }

    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
