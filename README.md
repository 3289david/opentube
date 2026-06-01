# OpenTube (오픈튜브)

오프라인에서도 동작하는 YouTube 클론 앱입니다.

## 기능

- YouTube 영상 검색 및 시청
- yt-dlp를 이용한 영상 다운로드
- 오프라인 라이브러리 (다운로드된 영상 관리)
- 폴더 조직화 (교육, 음악, 게임, 기타)
- 오프라인 HTML 라이브러리 내보내기 (핵심 기능)
- 재생 위치 저장/복원
- PWA 지원 (앱으로 설치 가능)

## 설치 방법

### 1. 환경 설정

```bash
cp .env.local.example .env.local
```

`.env.local` 파일에 YouTube API 키를 입력하세요:
```
YOUTUBE_API_KEY=your_youtube_api_key_here
```

### 2. yt-dlp 설치

```bash
pip3 install yt-dlp
```

### 3. 의존성 설치 및 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000` 으로 접속하세요.

### 4. 프로덕션 빌드

```bash
npm run build
npm start
```

## Docker로 실행

```bash
docker-compose up -d
```

## 핵심 기능: 오프라인 HTML 라이브러리

라이브러리 페이지에서 **"오프라인 HTML 내보내기"** 버튼을 클릭하면:
- 다운로드된 모든 영상 정보가 포함된 단일 HTML 파일 생성
- 인터넷 없이 브라우저에서 바로 재생 가능
- 검색/필터 기능 내장
- 한국어 UI

## 환경 변수

| 변수 | 설명 |
|------|------|
| `YOUTUBE_API_KEY` | YouTube Data API v3 키 |
| `NEXT_PUBLIC_APP_NAME` | 앱 이름 (기본: OpenTube) |
| `STORAGE_PATH` | 다운로드 저장 경로 |

## 기술 스택

- **프론트엔드**: Next.js 15 (App Router), TypeScript, Tailwind CSS
- **백엔드**: Next.js API Routes
- **데이터베이스**: SQLite (better-sqlite3)
- **다운로더**: yt-dlp
- **YouTube API**: googleapis

## 파일 구조

```
storage/
  {videoId}/
    {videoId}.mp4        # 영상 파일
    {videoId}.jpg        # 썸네일
    {videoId}.ko.vtt     # 자막
    {videoId}.info.json  # 메타데이터

opentube.db              # SQLite 데이터베이스
```
