const TOXIC_WORDS: string[] = [
  // Korean profanity
  '씨발', '시발', '씨바', '시바', 'ㅅㅂ',
  '개새끼', '개새기', '개색기', 'ㄱㅅㄲ',
  '미친', '미친놈', '미친년', 'ㅁㅊ',
  '병신', '병신새끼', 'ㅂㅅ',
  '꺼져', '꺼지', '꺼지라',
  '죽어', '죽어라', '죽어버려', '뒤져', '뒤지라',
  '멍청이', '멍청한', '멍청',
  '바보', '바보새끼',
  '찐따', '찐따새끼',
  '저능아',
  '창녀', '창녀새끼',
  '매춘부',
  '걸레', '걸레년',
  '보지', 'ㅂㅈ',
  '자지', 'ㅈㅈ',
  '씹', '씹새끼', '씹년', '씹놈', 'ㅆ',
  '지랄', '지랄하네', '지랄염병',
  '개같은', '개같아', '개같이',
  '닥쳐', '닥치라',
  '존나', '존내', 'ㅈㄴ',
  '개좃', '개좆',
  '좆', '좆같', 'ㅈ같',
  '엿먹어', '엿이나',
  '느개비', '느그애비',
  '애미', '어미',
  '씨팔', '씨팔놈',
  '개소리', '개소리하지마',
  '개년', '개놈',
  '썅', '쌍년', '쌍놈',
  '잡년', '잡놈',
  '이지랄', '지랄염',
  '꼴통', '찐빠',
  '돌아이', '돌대가리',
  '쓰레기같은',
  // Spam patterns
  '카지노', '도박사이트', '불법사이트',
  '홍보', '광고합니다', '무료나눔',
]

// Normalize text for comparison
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[!@#$%^&*()_+\-=\[\]{}|;':",.<>?\/\\]/g, '')
}

export function containsToxicContent(text: string): { isToxic: boolean; reason?: string } {
  const normalized = normalize(text)
  for (const word of TOXIC_WORDS) {
    const normalizedWord = normalize(word)
    if (normalized.includes(normalizedWord)) {
      return { isToxic: true, reason: 'inappropriate_content' }
    }
  }
  return { isToxic: false }
}

export function sanitizeText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
