import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { STORAGE_ROOT } from '@/lib/db'

export interface SubtitleResult {
  startTime: number
  endTime: number
  text: string
  startFormatted: string
}

function parseVtt(content: string): { startTime: number; endTime: number; text: string }[] {
  const cues: { startTime: number; endTime: number; text: string }[] = []
  const blocks = content.split(/\n\n+/)
  for (const block of blocks) {
    const lines = block.trim().split('\n')
    const timeLine = lines.find(l => l.includes('-->'))
    if (!timeLine) continue
    const [startStr, endStr] = timeLine.split(' --> ')
    const parseTime = (t: string): number => {
      const clean = t.trim().split('.')[0]
      const parts = clean.split(':').map(Number)
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
      if (parts.length === 2) return parts[0] * 60 + parts[1]
      return 0
    }
    const textLines = lines.filter(l => !l.includes('-->') && !/^\d+$/.test(l.trim()) && l.trim() && !l.startsWith('WEBVTT'))
    const text = textLines.join(' ').replace(/<[^>]+>/g, '').trim()
    if (text) {
      cues.push({ startTime: parseTime(startStr), endTime: parseTime(endStr), text })
    }
  }
  return cues
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const videoId = searchParams.get('videoId')
  const query = searchParams.get('q')?.toLowerCase().trim()

  if (!videoId || !query) {
    return NextResponse.json({ results: [] })
  }

  const videoDir = path.join(STORAGE_ROOT, videoId)
  if (!fs.existsSync(videoDir)) {
    return NextResponse.json({ results: [], error: '영상이 다운로드되지 않았습니다' })
  }

  // Find VTT file
  let vttPath: string | null = null
  try {
    const files = fs.readdirSync(videoDir)
    // Prefer Korean subtitles, then English, then any
    const vttFile = files.find(f => f.endsWith('.ko.vtt')) ||
                    files.find(f => f.endsWith('.en.vtt')) ||
                    files.find(f => f.endsWith('.vtt'))
    if (vttFile) vttPath = path.join(videoDir, vttFile)
  } catch {
    return NextResponse.json({ results: [], error: '자막 파일을 찾을 수 없습니다' })
  }

  if (!vttPath) {
    return NextResponse.json({ results: [], error: '자막 파일이 없습니다. 영상을 다운로드할 때 자막이 포함되지 않았을 수 있습니다.' })
  }

  const content = fs.readFileSync(vttPath, 'utf-8')
  const cues = parseVtt(content)

  const results: SubtitleResult[] = cues
    .filter(c => c.text.toLowerCase().includes(query))
    .map(c => ({
      startTime: c.startTime,
      endTime: c.endTime,
      text: c.text,
      startFormatted: formatTime(c.startTime),
    }))

  return NextResponse.json({ results, total: results.length })
}
