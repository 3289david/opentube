import { NextResponse } from 'next/server'

const ALTCHA_HMAC_KEY = 'opentube-altcha-hmac-key-2026'

export async function GET() {
  try {
    const altchaLib = await import('altcha/lib')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createChallenge = (altchaLib as any).createChallenge
    const challenge = await createChallenge({
      hmacKey: ALTCHA_HMAC_KEY,
      maxNumber: 50000,
    })
    return NextResponse.json(challenge)
  } catch (e) {
    console.error('Altcha createChallenge error:', e)
    // Return a minimal challenge structure for graceful degradation
    return NextResponse.json({
      algorithm: 'SHA-256',
      challenge: Math.random().toString(36).slice(2),
      maxnumber: 50000,
      salt: Math.random().toString(36).slice(2),
      signature: '',
    })
  }
}
