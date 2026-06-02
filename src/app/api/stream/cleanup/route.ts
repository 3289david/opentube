import { NextResponse } from 'next/server'
import { cleanupExpiredStreams } from '@/lib/db'

export async function GET() {
  cleanupExpiredStreams()
  return NextResponse.json({ success: true, message: 'Expired streams cleaned up' })
}
