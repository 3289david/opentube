import jwt from 'jsonwebtoken'
import nodeCrypto from 'crypto'

const JWT_SECRET = 'opentube-secret-2026-krlkr-jwt-signing-key'

function generateUuid(): string {
  return nodeCrypto.randomUUID()
}

const ADJECTIVES = [
  '행복한', '빠른', '느린', '용감한', '현명한', '귀여운', '강한', '부드러운',
  '차가운', '따뜻한', '밝은', '어두운', '조용한', '시끄러운', '날쌘', '무거운',
  '가벼운', '높은', '낮은', '넓은', '좁은', '깊은', '얕은', '맑은', '흐린',
  '달콤한', '쓴', '신선한', '오래된', '새로운', '고요한', '활발한', '예쁜',
  '멋진', '재미난', '신나는', '슬픈', '기쁜', '웃긴', '졸린', '배고픈',
  '배부른', '목마른', '피곤한', '상쾌한', '청명한', '흥겨운', '화려한',
]

const NOUNS = [
  '고양이', '강아지', '독수리', '토끼', '곰', '늑대', '여우', '사자',
  '호랑이', '코끼리', '기린', '펭귄', '부엉이', '다람쥐', '수달', '돌고래',
  '고래', '상어', '나비', '벌', '개구리', '거북이', '공룡', '두더지',
  '하마', '낙타', '캥거루', '코알라', '너구리', '원숭이', '앵무새', '올빼미',
  '홍학', '공작', '매', '까치', '비둘기', '제비', '참새', '두루미',
  '장미', '국화', '해바라기', '튤립', '백합', '유리', '달', '별',
  '구름', '바람', '비', '눈', '불꽃', '파도', '산', '강',
]

export function generateUsername(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]
  return adj + noun
}

export interface SessionPayload {
  sessionId: string
  username: string
  createdAt: string
}

export function createSession(): { token: string; payload: SessionPayload } {
  const payload: SessionPayload = {
    sessionId: generateUuid(),
    username: generateUsername(),
    createdAt: new Date().toISOString(),
  }
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '365d' })
  return { token, payload }
}

export function verifySession(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as SessionPayload
    return decoded
  } catch {
    return null
  }
}

export function resetSession(oldPayload: SessionPayload): { token: string; payload: SessionPayload } {
  const payload: SessionPayload = {
    sessionId: oldPayload.sessionId,
    username: generateUsername(),
    createdAt: new Date().toISOString(),
  }
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '365d' })
  return { token, payload }
}
