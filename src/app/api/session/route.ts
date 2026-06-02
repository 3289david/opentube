import { NextRequest, NextResponse } from 'next/server'
import { createSession, verifySession, resetSession } from '@/lib/session'

// GET: returns current session or creates new one
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (token) {
    const payload = verifySession(token)
    if (payload) {
      return NextResponse.json({ token, session: payload })
    }
  }

  // Create new session
  const { token: newToken, payload } = createSession()
  return NextResponse.json({ token: newToken, session: payload })
}

// POST: restore session from provided token
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { token } = body

  if (!token) {
    return NextResponse.json({ error: 'token required' }, { status: 400 })
  }

  const payload = verifySession(token)
  if (!payload) {
    return NextResponse.json({ error: 'invalid token' }, { status: 401 })
  }

  return NextResponse.json({ token, session: payload })
}

// PUT: create fresh session (reset username)
export async function PUT(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (token) {
    const payload = verifySession(token)
    if (payload) {
      const { token: newToken, payload: newPayload } = resetSession(payload)
      return NextResponse.json({ token: newToken, session: newPayload })
    }
  }

  // Create brand new session
  const { token: newToken, payload } = createSession()
  return NextResponse.json({ token: newToken, session: payload })
}
