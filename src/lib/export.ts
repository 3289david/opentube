// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ZipArchive } = require('archiver') as { ZipArchive: new (opts?: object) => import('archiver').Archiver }
import fs from 'fs'
import path from 'path'
import { getAllVideos, getVideo, VideoRecord } from './db'

const STORAGE_ROOT = path.join(process.cwd(), 'storage')

function getVideoStorageDir(videoId: string): string {
  return path.join(STORAGE_ROOT, videoId)
}

function readFileAsBase64(filePath: string | null | undefined): string {
  if (!filePath || !fs.existsSync(filePath)) return ''
  return fs.readFileSync(filePath).toString('base64')
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  const map: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.mkv': 'video/x-matroska',
    '.webm': 'video/webm',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.vtt': 'text/vtt',
    '.srt': 'text/plain',
  }
  return map[ext] || 'application/octet-stream'
}

export function exportVideoAsZip(videoId: string): import('archiver').Archiver {
  const video = getVideo(videoId)
  if (!video) throw new Error('Video not found')

  const archive = new ZipArchive({ zlib: { level: 6 } })

  const dir = getVideoStorageDir(videoId)

  // Add video file
  if (video.video_path && fs.existsSync(video.video_path)) {
    archive.file(video.video_path, { name: 'video' + path.extname(video.video_path) })
  }
  // Add thumbnail
  if (video.thumbnail_path && fs.existsSync(video.thumbnail_path)) {
    archive.file(video.thumbnail_path, { name: 'thumbnail' + path.extname(video.thumbnail_path) })
  }
  // Add captions
  if (video.captions_path && fs.existsSync(video.captions_path)) {
    archive.file(video.captions_path, { name: 'captions' + path.extname(video.captions_path) })
  }

  // Add metadata JSON
  const metadata = {
    id: video.id,
    title: video.title,
    channel: video.channel,
    channel_id: video.channel_id,
    duration: video.duration,
    upload_date: video.upload_date,
    description: video.description,
    folder: video.folder,
    downloaded_at: video.downloaded_at,
  }
  archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' })

  // Add offline HTML player
  archive.append(generateSingleVideoHtml(video), { name: 'index.html' })

  archive.finalize()
  return archive
}

export function exportVideoAsHtml(videoId: string): string {
  const video = getVideo(videoId)
  if (!video) throw new Error('Video not found')
  return generateSingleVideoHtml(video)
}

function generateSingleVideoHtml(video: VideoRecord): string {
  const thumbnailBase64 = readFileAsBase64(video.thumbnail_path)
  const thumbnailSrc = thumbnailBase64
    ? `data:image/jpeg;base64,${thumbnailBase64}`
    : ''

  const metadataJson = video.metadata_json ? JSON.parse(video.metadata_json) : {}
  const durationStr = video.duration ? formatDuration(video.duration) : ''

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(video.title)} - OpenTube</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#0f0f0f;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-height:100vh}
  .header{background:#111;padding:12px 24px;display:flex;align-items:center;gap:12px;border-bottom:1px solid #333}
  .logo{color:#ff0000;font-size:24px;font-weight:700;text-decoration:none}
  .logo span{color:#fff}
  .container{max-width:1200px;margin:0 auto;padding:24px}
  .player-wrap{background:#000;border-radius:12px;overflow:hidden;aspect-ratio:16/9;position:relative}
  video{width:100%;height:100%;display:block}
  .info{margin-top:20px}
  .title{font-size:20px;font-weight:600;margin-bottom:8px}
  .meta{color:#aaa;font-size:14px;display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px}
  .channel{font-size:16px;font-weight:500;color:#ccc}
  .desc{color:#aaa;font-size:14px;line-height:1.6;white-space:pre-wrap;margin-top:12px;padding:16px;background:#1a1a1a;border-radius:8px}
  .badge{background:#333;padding:4px 10px;border-radius:4px;font-size:12px}
  .controls{display:flex;gap:12px;margin-top:12px;align-items:center}
  select{background:#333;color:#fff;border:none;padding:6px 12px;border-radius:6px;cursor:pointer}
  .offline-badge{background:#1a1a1a;border:1px solid #333;color:#aaa;padding:6px 14px;border-radius:6px;font-size:12px}
</style>
</head>
<body>
<div class="header">
  <div class="logo">&#9654; Open<span>Tube</span></div>
  <span style="color:#aaa;font-size:12px">오프라인 플레이어</span>
</div>
<div class="container">
  <div class="player-wrap">
    <video id="player" controls preload="metadata"
      ${video.video_path ? `src="${path.basename(video.video_path)}"` : ''}>
      ${video.captions_path ? `<track kind="subtitles" src="${path.basename(video.captions_path)}" label="자막">` : ''}
      브라우저가 비디오를 지원하지 않습니다.
    </video>
  </div>
  <div class="controls">
    <label style="color:#aaa;font-size:13px">재생 속도:</label>
    <select id="speedSelect" onchange="document.getElementById('player').playbackRate=parseFloat(this.value)">
      <option value="0.25">0.25x</option>
      <option value="0.5">0.5x</option>
      <option value="0.75">0.75x</option>
      <option value="1" selected>1x</option>
      <option value="1.25">1.25x</option>
      <option value="1.5">1.5x</option>
      <option value="2">2x</option>
      <option value="3">3x</option>
    </select>
    <span class="offline-badge">오프라인</span>
  </div>
  <div class="info">
    <div class="title">${escapeHtml(video.title)}</div>
    <div class="meta">
      ${durationStr ? `<span class="badge">${durationStr}</span>` : ''}
      ${video.upload_date ? `<span>업로드: ${video.upload_date}</span>` : ''}
      ${video.folder ? `<span>폴더: ${escapeHtml(video.folder)}</span>` : ''}
    </div>
    <div class="channel">${escapeHtml(video.channel)}</div>
    ${video.description ? `<div class="desc">${escapeHtml(video.description.slice(0, 500))}${video.description.length > 500 ? '...' : ''}</div>` : ''}
  </div>
</div>
<script>
  const player = document.getElementById('player');
  const key = 'ot_pos_${video.id}';
  const saved = localStorage.getItem(key);
  if (saved) { player.addEventListener('loadedmetadata', () => { player.currentTime = parseFloat(saved); }); }
  player.addEventListener('timeupdate', () => { localStorage.setItem(key, player.currentTime); });
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.code === 'Space') { e.preventDefault(); player.paused ? player.play() : player.pause(); }
    if (e.code === 'ArrowLeft') player.currentTime = Math.max(0, player.currentTime - 10);
    if (e.code === 'ArrowRight') player.currentTime = Math.min(player.duration, player.currentTime + 10);
  });
</script>
</body>
</html>`
}

export async function exportLibraryHtml(): Promise<Buffer> {
  const videos = getAllVideos()

  // Build video cards with base64 thumbnails
  const videoCards = await Promise.all(videos.map(async (v) => {
    const thumbBase64 = readFileAsBase64(v.thumbnail_path)
    const thumbSrc = thumbBase64 ? `data:image/jpeg;base64,${thumbBase64}` : ''
    const videoFile = v.video_path ? path.basename(v.video_path) : ''
    const captionsFile = v.captions_path ? path.basename(v.captions_path) : ''
    const durationStr = v.duration ? formatDuration(v.duration) : ''

    return {
      id: v.id,
      title: v.title,
      channel: v.channel,
      folder: v.folder,
      duration: durationStr,
      upload_date: v.upload_date || '',
      description: (v.description || '').slice(0, 300),
      thumbSrc,
      videoFile,
      captionsFile,
      downloaded_at: v.downloaded_at,
    }
  }))

  const videosJson = JSON.stringify(videoCards)

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>OpenTube 오프라인 라이브러리</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  :root{--bg:#0f0f0f;--card:#1a1a1a;--border:#333;--accent:#ff0000;--text:#fff;--subtext:#aaa}
  body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-height:100vh}

  /* Header */
  .header{background:#111;padding:12px 24px;display:flex;align-items:center;gap:16px;border-bottom:1px solid var(--border);position:sticky;top:0;z-index:100}
  .logo{color:var(--accent);font-size:22px;font-weight:700;display:flex;align-items:center;gap:6px;cursor:pointer}
  .logo-text span{color:var(--text)}
  .search-wrap{flex:1;max-width:500px;position:relative}
  .search-input{width:100%;background:#333;border:1px solid var(--border);color:var(--text);padding:8px 16px;border-radius:24px;font-size:14px;outline:none;transition:border-color 0.2s}
  .search-input:focus{border-color:var(--accent)}
  .header-info{color:var(--subtext);font-size:13px;margin-left:auto;white-space:nowrap}

  /* Layout */
  .layout{display:flex;min-height:calc(100vh - 57px)}
  .sidebar{width:220px;background:#111;border-right:1px solid var(--border);padding:16px 0;flex-shrink:0}
  .sidebar-item{display:flex;align-items:center;gap:10px;padding:10px 20px;cursor:pointer;color:var(--subtext);font-size:14px;transition:all 0.15s;border-left:3px solid transparent}
  .sidebar-item:hover,.sidebar-item.active{background:#222;color:var(--text);border-left-color:var(--accent)}
  .sidebar-icon{font-size:18px;width:24px;text-align:center}
  .sidebar-divider{border:none;border-top:1px solid var(--border);margin:8px 0}
  .folder-count{margin-left:auto;background:#333;padding:2px 8px;border-radius:10px;font-size:11px}
  .main{flex:1;padding:24px;overflow-y:auto}

  /* Filters */
  .filters{display:flex;gap:12px;align-items:center;margin-bottom:20px;flex-wrap:wrap}
  .filter-btn{background:var(--card);border:1px solid var(--border);color:var(--subtext);padding:6px 14px;border-radius:20px;cursor:pointer;font-size:13px;transition:all 0.15s}
  .filter-btn:hover,.filter-btn.active{background:var(--accent);border-color:var(--accent);color:#fff}
  .sort-select{background:var(--card);border:1px solid var(--border);color:var(--text);padding:6px 12px;border-radius:8px;font-size:13px;cursor:pointer;margin-left:auto}

  /* Grid */
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}
  .video-card{background:var(--card);border-radius:12px;overflow:hidden;cursor:pointer;transition:transform 0.2s,box-shadow 0.2s;border:1px solid transparent}
  .video-card:hover{transform:translateY(-3px);box-shadow:0 8px 24px rgba(0,0,0,0.4);border-color:var(--border)}
  .video-card.playing{border-color:var(--accent)}
  .thumb-wrap{position:relative;aspect-ratio:16/9;overflow:hidden;background:#000}
  .thumb-wrap img{width:100%;height:100%;object-fit:cover;display:block}
  .thumb-placeholder{width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#1a1a1a;color:#555;font-size:32px}
  .duration-badge{position:absolute;bottom:6px;right:6px;background:rgba(0,0,0,0.85);color:#fff;padding:2px 6px;border-radius:4px;font-size:12px;font-weight:500}
  .card-info{padding:12px}
  .card-title{font-size:14px;font-weight:600;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:6px}
  .card-channel{color:var(--subtext);font-size:13px}
  .card-meta{color:#666;font-size:12px;margin-top:4px;display:flex;gap:8px;flex-wrap:wrap}
  .folder-tag{background:#333;padding:2px 8px;border-radius:4px;font-size:11px;color:var(--subtext)}

  /* Player Modal */
  .modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:1000;flex-direction:column}
  .modal.open{display:flex}
  .modal-header{background:#111;padding:12px 20px;display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--border)}
  .modal-title{font-size:15px;font-weight:600;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .modal-close{background:none;border:none;color:var(--subtext);font-size:24px;cursor:pointer;padding:4px 8px;border-radius:6px;line-height:1;transition:color 0.15s}
  .modal-close:hover{color:var(--text)}
  .modal-body{display:flex;flex:1;overflow:hidden}
  .player-section{flex:1;display:flex;flex-direction:column;padding:20px;gap:12px;overflow-y:auto}
  .player-container{background:#000;border-radius:12px;overflow:hidden;aspect-ratio:16/9}
  .player-container video{width:100%;height:100%;display:block}
  .player-controls{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
  .speed-select{background:#333;color:var(--text);border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:13px}
  .offline-tag{background:var(--card);border:1px solid var(--border);color:var(--subtext);padding:5px 12px;border-radius:6px;font-size:12px}
  .video-info-panel{background:var(--card);border-radius:10px;padding:16px}
  .vi-title{font-size:17px;font-weight:700;margin-bottom:8px}
  .vi-channel{font-size:14px;color:#ccc;margin-bottom:6px}
  .vi-meta{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px}
  .vi-meta span{color:var(--subtext);font-size:13px}
  .vi-desc{color:var(--subtext);font-size:13px;line-height:1.6;white-space:pre-wrap;max-height:120px;overflow-y:auto}
  .info-sidebar{width:320px;background:#111;border-left:1px solid var(--border);padding:16px;overflow-y:auto;flex-shrink:0}
  .sidebar-title{font-size:14px;font-weight:600;margin-bottom:12px;color:var(--subtext)}
  .related-card{display:flex;gap:10px;padding:8px 0;cursor:pointer;border-bottom:1px solid #222}
  .related-card:hover{background:#1a1a1a}
  .related-thumb{width:120px;aspect-ratio:16/9;object-fit:cover;border-radius:6px;background:#000;flex-shrink:0}
  .related-info{flex:1;overflow:hidden}
  .related-title{font-size:13px;font-weight:500;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .related-channel{font-size:12px;color:var(--subtext);margin-top:4px}

  /* Empty state */
  .empty{text-align:center;padding:80px 20px;color:var(--subtext)}
  .empty-icon{font-size:64px;margin-bottom:16px}
  .empty-text{font-size:18px;margin-bottom:8px;color:var(--text)}
  .empty-sub{font-size:14px}

  /* Stats bar */
  .stats-bar{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px 16px;margin-bottom:20px;display:flex;gap:20px;flex-wrap:wrap}
  .stat{display:flex;flex-direction:column;align-items:center}
  .stat-num{font-size:22px;font-weight:700;color:var(--accent)}
  .stat-label{font-size:12px;color:var(--subtext)}

  /* Responsive */
  @media(max-width:768px){
    .sidebar{display:none}
    .info-sidebar{display:none}
    .grid{grid-template-columns:repeat(auto-fill,minmax(160px,1fr))}
    .modal-body{flex-direction:column}
  }
</style>
</head>
<body>

<div class="header">
  <div class="logo" onclick="closeModal()">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill="#ff0000"/><polygon points="9,7 19,12 9,17" fill="white"/></svg>
    <div class="logo-text">Open<span>Tube</span></div>
  </div>
  <div class="search-wrap">
    <input class="search-input" type="text" id="searchInput" placeholder="다운로드된 영상 검색..." oninput="filterVideos()">
  </div>
  <div class="header-info" id="headerInfo"></div>
</div>

<div class="layout">
  <div class="sidebar">
    <div class="sidebar-item active" onclick="filterByFolder(null, this)" data-folder="">
      <span class="sidebar-icon">🏠</span>
      <span>전체 보기</span>
      <span class="folder-count" id="countAll"></span>
    </div>
    <hr class="sidebar-divider">
    <div class="sidebar-item" onclick="filterByFolder('교육', this)" data-folder="교육">
      <span class="sidebar-icon">📚</span><span>교육</span>
      <span class="folder-count" id="count-교육"></span>
    </div>
    <div class="sidebar-item" onclick="filterByFolder('음악', this)" data-folder="음악">
      <span class="sidebar-icon">🎵</span><span>음악</span>
      <span class="folder-count" id="count-음악"></span>
    </div>
    <div class="sidebar-item" onclick="filterByFolder('게임', this)" data-folder="게임">
      <span class="sidebar-icon">🎮</span><span>게임</span>
      <span class="folder-count" id="count-게임"></span>
    </div>
    <div class="sidebar-item" onclick="filterByFolder('기타', this)" data-folder="기타">
      <span class="sidebar-icon">📁</span><span>기타</span>
      <span class="folder-count" id="count-기타"></span>
    </div>
  </div>

  <div class="main">
    <div class="stats-bar" id="statsBar"></div>

    <div class="filters">
      <span style="color:var(--subtext);font-size:13px">정렬:</span>
      <select class="sort-select" id="sortSelect" onchange="renderGrid()">
        <option value="downloaded_at">다운로드 날짜</option>
        <option value="title">제목</option>
        <option value="duration">재생 시간</option>
        <option value="upload_date">업로드 날짜</option>
      </select>
    </div>

    <div class="grid" id="videoGrid"></div>
    <div class="empty" id="emptyState" style="display:none">
      <div class="empty-icon">📭</div>
      <div class="empty-text">영상이 없습니다</div>
      <div class="empty-sub">검색어를 바꾸거나 다른 폴더를 선택해보세요</div>
    </div>
  </div>
</div>

<!-- Player Modal -->
<div class="modal" id="playerModal">
  <div class="modal-header">
    <button class="modal-close" onclick="closeModal()">✕</button>
    <div class="modal-title" id="modalTitle"></div>
  </div>
  <div class="modal-body">
    <div class="player-section">
      <div class="player-container">
        <video id="mainPlayer" controls preload="metadata"></video>
      </div>
      <div class="player-controls">
        <label style="color:var(--subtext);font-size:13px">재생 속도:</label>
        <select class="speed-select" id="speedSelect" onchange="setSpeed(this.value)">
          <option value="0.25">0.25x</option>
          <option value="0.5">0.5x</option>
          <option value="0.75">0.75x</option>
          <option value="1" selected>1x (기본)</option>
          <option value="1.25">1.25x</option>
          <option value="1.5">1.5x</option>
          <option value="2">2x</option>
          <option value="3">3x</option>
        </select>
        <span class="offline-tag">📴 오프라인</span>
      </div>
      <div class="video-info-panel" id="videoInfoPanel"></div>
    </div>
    <div class="info-sidebar">
      <div class="sidebar-title">관련 영상</div>
      <div id="relatedVideos"></div>
    </div>
  </div>
</div>

<script>
const VIDEOS = ${videosJson};
let currentFolder = null;
let currentVideoId = null;

function init() {
  updateCounts();
  updateStats();
  renderGrid();
  document.addEventListener('keydown', handleKeydown);
}

function updateCounts() {
  const total = VIDEOS.length;
  document.getElementById('countAll').textContent = total;
  document.getElementById('headerInfo').textContent = '총 ' + total + '개 영상';
  const folders = ['교육','음악','게임','기타'];
  folders.forEach(f => {
    const el = document.getElementById('count-' + f);
    if (el) el.textContent = VIDEOS.filter(v => v.folder === f).length;
  });
}

function updateStats() {
  const total = VIDEOS.length;
  const folders = [...new Set(VIDEOS.map(v => v.folder))].length;
  document.getElementById('statsBar').innerHTML =
    stat(total, '총 영상') + stat(folders, '폴더') +
    stat(VIDEOS.filter(v => v.videoFile).length, '재생 가능');
}

function stat(n, label) {
  return '<div class="stat"><div class="stat-num">' + n + '</div><div class="stat-label">' + label + '</div></div>';
}

function getFiltered() {
  const q = document.getElementById('searchInput').value.toLowerCase().trim();
  const sort = document.getElementById('sortSelect').value;
  let list = [...VIDEOS];
  if (currentFolder) list = list.filter(v => v.folder === currentFolder);
  if (q) list = list.filter(v => v.title.toLowerCase().includes(q) || v.channel.toLowerCase().includes(q));
  list.sort((a, b) => {
    if (sort === 'title') return a.title.localeCompare(b.title, 'ko');
    if (sort === 'duration') return (parseInt(b.duration) || 0) - (parseInt(a.duration) || 0);
    if (sort === 'upload_date') return (b.upload_date || '').localeCompare(a.upload_date || '');
    return (b.downloaded_at || '').localeCompare(a.downloaded_at || '');
  });
  return list;
}

function filterVideos() { renderGrid(); }

function filterByFolder(folder, el) {
  currentFolder = folder;
  document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
  if (el) el.classList.add('active');
  renderGrid();
}

function renderGrid() {
  const list = getFiltered();
  const grid = document.getElementById('videoGrid');
  const empty = document.getElementById('emptyState');
  if (!list.length) { grid.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  grid.innerHTML = list.map(v => cardHtml(v)).join('');
}

function cardHtml(v) {
  const thumb = v.thumbSrc
    ? '<img src="' + v.thumbSrc + '" alt="" loading="lazy">'
    : '<div class="thumb-placeholder">▶</div>';
  return '<div class="video-card" id="card-' + v.id + '" onclick="playVideo(\'' + v.id + '\')">' +
    '<div class="thumb-wrap">' + thumb +
    (v.duration ? '<div class="duration-badge">' + v.duration + '</div>' : '') +
    '</div><div class="card-info">' +
    '<div class="card-title">' + esc(v.title) + '</div>' +
    '<div class="card-channel">' + esc(v.channel) + '</div>' +
    '<div class="card-meta">' +
    (v.upload_date ? '<span>' + v.upload_date + '</span>' : '') +
    '<span class="folder-tag">' + esc(v.folder) + '</span>' +
    (v.videoFile ? '<span style="color:#4caf50">✓ 재생 가능</span>' : '<span style="color:#f44">⚠ 파일 없음</span>') +
    '</div></div></div>';
}

function playVideo(id) {
  const v = VIDEOS.find(x => x.id === id);
  if (!v) return;
  currentVideoId = id;
  document.querySelectorAll('.video-card').forEach(c => c.classList.remove('playing'));
  const card = document.getElementById('card-' + id);
  if (card) card.classList.add('playing');
  const player = document.getElementById('mainPlayer');
  player.src = '';
  if (v.videoFile) player.src = v.videoFile;
  if (v.captionsFile) {
    player.innerHTML = '<track kind="subtitles" src="' + v.captionsFile + '" label="자막">';
  }
  const saved = localStorage.getItem('ot_pos_' + id);
  if (saved) {
    player.addEventListener('loadedmetadata', function onLoad() {
      player.currentTime = parseFloat(saved);
      player.removeEventListener('loadedmetadata', onLoad);
    });
  }
  player.addEventListener('timeupdate', () => {
    if (player.currentTime > 5) localStorage.setItem('ot_pos_' + id, player.currentTime);
  });
  document.getElementById('modalTitle').textContent = v.title;
  document.getElementById('videoInfoPanel').innerHTML =
    '<div class="vi-title">' + esc(v.title) + '</div>' +
    '<div class="vi-channel">' + esc(v.channel) + '</div>' +
    '<div class="vi-meta">' +
    (v.duration ? '<span>⏱ ' + v.duration + '</span>' : '') +
    (v.upload_date ? '<span>📅 ' + v.upload_date + '</span>' : '') +
    '<span class="folder-tag">' + esc(v.folder) + '</span>' +
    '</div>' +
    (v.description ? '<div class="vi-desc">' + esc(v.description) + '</div>' : '');
  const related = VIDEOS.filter(x => x.id !== id && (x.channel === v.channel || x.folder === v.folder)).slice(0, 10);
  document.getElementById('relatedVideos').innerHTML = related.map(r =>
    '<div class="related-card" onclick="playVideo(\'' + r.id + '\')">' +
    (r.thumbSrc ? '<img class="related-thumb" src="' + r.thumbSrc + '" loading="lazy">' : '<div class="related-thumb" style="background:#222;display:flex;align-items:center;justify-content:center">▶</div>') +
    '<div class="related-info"><div class="related-title">' + esc(r.title) + '</div><div class="related-channel">' + esc(r.channel) + '</div></div>' +
    '</div>'
  ).join('');
  document.getElementById('playerModal').classList.add('open');
  if (v.videoFile) setTimeout(() => player.play().catch(() => {}), 300);
}

function closeModal() {
  const player = document.getElementById('mainPlayer');
  player.pause();
  player.src = '';
  document.getElementById('playerModal').classList.remove('open');
  currentVideoId = null;
  document.querySelectorAll('.video-card').forEach(c => c.classList.remove('playing'));
}

function setSpeed(val) {
  document.getElementById('mainPlayer').playbackRate = parseFloat(val);
}

function handleKeydown(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  const modal = document.getElementById('playerModal');
  if (!modal.classList.contains('open')) return;
  const player = document.getElementById('mainPlayer');
  if (e.code === 'Space') { e.preventDefault(); player.paused ? player.play() : player.pause(); }
  if (e.code === 'ArrowLeft') player.currentTime = Math.max(0, player.currentTime - 10);
  if (e.code === 'ArrowRight') player.currentTime = Math.min(player.duration || 0, player.currentTime + 10);
  if (e.code === 'Escape') closeModal();
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

init();
</script>
</body>
</html>`

  return Buffer.from(html, 'utf-8')
}

function escapeHtml(s: string): string {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}
