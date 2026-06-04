import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'

const DB_PATH = '/root/yt-clone/opentube.db'
export const STORAGE_ROOT = '/root/yt-clone/storage'

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (_db) return _db
  _db = new Database(DB_PATH)
  _db.pragma('journal_mode = WAL')
  _db.pragma('foreign_keys = ON')
  initializeSchema(_db)
  return _db
}

function initializeSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      channel TEXT NOT NULL,
      channel_id TEXT,
      duration INTEGER DEFAULT 0,
      upload_date TEXT,
      description TEXT,
      thumbnail_path TEXT,
      video_path TEXT,
      captions_path TEXT,
      metadata_json TEXT,
      folder TEXT DEFAULT '기타',
      sha256 TEXT,
      downloaded_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS watch_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      video_id TEXT NOT NULL,
      title TEXT,
      channel TEXT,
      thumbnail TEXT,
      watch_time REAL DEFAULT 0,
      watched_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL DEFAULT '',
      channel_id TEXT NOT NULL,
      channel_name TEXT NOT NULL,
      channel_thumbnail TEXT,
      subscribed_at TEXT DEFAULT (datetime('now')),
      UNIQUE(session_id, channel_id)
    );

    CREATE TABLE IF NOT EXISTS playlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS playlist_videos (
      playlist_id INTEGER NOT NULL,
      video_id TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (playlist_id, video_id),
      FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS batch_downloads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      url TEXT NOT NULL,
      title TEXT,
      total INTEGER DEFAULT 0,
      completed INTEGER DEFAULT 0,
      status TEXT DEFAULT 'queued',
      folder TEXT DEFAULT '기타',
      started_at TEXT DEFAULT (datetime('now'))
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
      video_id UNINDEXED,
      title,
      description,
      channel,
      captions,
      content='videos',
      content_rowid='rowid'
    );

    CREATE TRIGGER IF NOT EXISTS videos_ai AFTER INSERT ON videos BEGIN
      INSERT INTO search_index(rowid, video_id, title, description, channel, captions)
      VALUES (new.rowid, new.id, new.title, COALESCE(new.description, ''), new.channel, '');
    END;

    CREATE TRIGGER IF NOT EXISTS videos_ad AFTER DELETE ON videos BEGIN
      INSERT INTO search_index(search_index, rowid, video_id, title, description, channel, captions)
      VALUES ('delete', old.rowid, old.id, old.title, COALESCE(old.description, ''), old.channel, '');
    END;

    CREATE TRIGGER IF NOT EXISTS videos_au AFTER UPDATE ON videos BEGIN
      INSERT INTO search_index(search_index, rowid, video_id, title, description, channel, captions)
      VALUES ('delete', old.rowid, old.id, old.title, COALESCE(old.description, ''), old.channel, '');
      INSERT INTO search_index(rowid, video_id, title, description, channel, captions)
      VALUES (new.rowid, new.id, new.title, COALESCE(new.description, ''), new.channel, '');
    END;

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      video_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      username TEXT NOT NULL,
      text TEXT NOT NULL,
      likes INTEGER DEFAULT 0,
      is_blocked INTEGER DEFAULT 0,
      is_reported INTEGER DEFAULT 0,
      report_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS comment_likes (
      comment_id INTEGER NOT NULL,
      session_id TEXT NOT NULL,
      PRIMARY KEY (comment_id, session_id)
    );

    CREATE TABLE IF NOT EXISTS video_likes (
      video_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('like', 'dislike')),
      PRIMARY KEY (video_id, session_id)
    );

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      comment_id INTEGER,
      video_id TEXT,
      session_id TEXT NOT NULL,
      reason TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS temp_streams (
      video_id TEXT PRIMARY KEY,
      file_path TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS blocked_sessions (
      session_id TEXT PRIMARY KEY,
      reason TEXT,
      blocked_at TEXT DEFAULT (datetime('now'))
    );
  `)

  // Run migrations to add new columns to existing DBs
  try { db.exec(`ALTER TABLE videos ADD COLUMN sha256 TEXT`) } catch { /* already exists */ }
  try { db.exec(`ALTER TABLE watch_history ADD COLUMN title TEXT`) } catch { /* already exists */ }
  try { db.exec(`ALTER TABLE watch_history ADD COLUMN channel TEXT`) } catch { /* already exists */ }
  try { db.exec(`ALTER TABLE watch_history ADD COLUMN thumbnail TEXT`) } catch { /* already exists */ }
  try { db.exec(`ALTER TABLE watch_history ADD COLUMN session_id TEXT NOT NULL DEFAULT ''`) } catch { /* already exists */ }

  // Migrate videos to composite PK (id, session_id) for per-session library isolation
  try {
    const videoCols = (db.prepare('PRAGMA table_info(videos)').all() as { name: string }[]).map(c => c.name)
    if (!videoCols.includes('session_id')) {
      db.pragma('foreign_keys = OFF')
      db.exec(`
        CREATE TABLE videos_tmp (
          id TEXT NOT NULL,
          session_id TEXT NOT NULL DEFAULT '',
          title TEXT NOT NULL,
          channel TEXT NOT NULL,
          channel_id TEXT,
          duration INTEGER DEFAULT 0,
          upload_date TEXT,
          description TEXT,
          thumbnail_path TEXT,
          video_path TEXT,
          captions_path TEXT,
          metadata_json TEXT,
          folder TEXT DEFAULT '기타',
          sha256 TEXT,
          downloaded_at TEXT DEFAULT (datetime('now')),
          PRIMARY KEY (id, session_id)
        );
        INSERT OR IGNORE INTO videos_tmp
          (id, session_id, title, channel, channel_id, duration, upload_date, description,
           thumbnail_path, video_path, captions_path, metadata_json, folder, sha256, downloaded_at)
          SELECT id, '', title, channel, channel_id, duration, upload_date, description,
                 thumbnail_path, video_path, captions_path, metadata_json, folder, sha256, downloaded_at
          FROM videos;
        DROP TABLE videos;
        ALTER TABLE videos_tmp RENAME TO videos;
      `)
      db.exec(`
        DROP TABLE IF EXISTS search_index;
        CREATE VIRTUAL TABLE search_index USING fts5(
          video_id UNINDEXED,
          title,
          description,
          channel,
          captions,
          content='videos',
          content_rowid='rowid'
        );
        INSERT INTO search_index(rowid, video_id, title, description, channel, captions)
          SELECT rowid, id, title, COALESCE(description, ''), channel, '' FROM videos;
        DROP TRIGGER IF EXISTS videos_ai;
        DROP TRIGGER IF EXISTS videos_ad;
        DROP TRIGGER IF EXISTS videos_au;
        CREATE TRIGGER videos_ai AFTER INSERT ON videos BEGIN
          INSERT INTO search_index(rowid, video_id, title, description, channel, captions)
          VALUES (new.rowid, new.id, new.title, COALESCE(new.description, ''), new.channel, '');
        END;
        CREATE TRIGGER videos_ad AFTER DELETE ON videos BEGIN
          INSERT INTO search_index(search_index, rowid, video_id, title, description, channel, captions)
          VALUES ('delete', old.rowid, old.id, old.title, COALESCE(old.description, ''), old.channel, '');
        END;
        CREATE TRIGGER videos_au AFTER UPDATE ON videos BEGIN
          INSERT INTO search_index(search_index, rowid, video_id, title, description, channel, captions)
          VALUES ('delete', old.rowid, old.id, old.title, COALESCE(old.description, ''), old.channel, '');
          INSERT INTO search_index(rowid, video_id, title, description, channel, captions)
          VALUES (new.rowid, new.id, new.title, COALESCE(new.description, ''), new.channel, '');
        END;
      `)
      db.pragma('foreign_keys = ON')
    }
  } catch (e) { console.error('videos session migration failed:', e) }

  // Migrate playlist_videos: remove FK on video_id (videos now has composite PK → mismatch)
  try {
    const fks = db.prepare('PRAGMA foreign_key_list(playlist_videos)').all() as { table: string }[]
    const hasVideosFk = fks.some(fk => fk.table === 'videos')
    if (hasVideosFk) {
      db.pragma('foreign_keys = OFF')
      db.exec(`
        CREATE TABLE playlist_videos_new (
          playlist_id INTEGER NOT NULL,
          video_id TEXT NOT NULL,
          position INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (playlist_id, video_id),
          FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
        );
        INSERT OR IGNORE INTO playlist_videos_new SELECT * FROM playlist_videos;
        DROP TABLE playlist_videos;
        ALTER TABLE playlist_videos_new RENAME TO playlist_videos;
      `)
      db.pragma('foreign_keys = ON')
    }
  } catch { /* already migrated */ }

  // Migrate subscriptions to per-session (old table had UNIQUE on channel_id only)
  try {
    const cols = (db.prepare(`PRAGMA table_info(subscriptions)`).all() as {name: string}[]).map(c => c.name)
    if (!cols.includes('session_id')) {
      db.pragma('foreign_keys = OFF')
      db.exec(`
        CREATE TABLE subscriptions_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT NOT NULL DEFAULT '',
          channel_id TEXT NOT NULL,
          channel_name TEXT NOT NULL,
          channel_thumbnail TEXT,
          subscribed_at TEXT DEFAULT (datetime('now')),
          UNIQUE(session_id, channel_id)
        );
        INSERT OR IGNORE INTO subscriptions_new (session_id, channel_id, channel_name, channel_thumbnail, subscribed_at)
          SELECT '', channel_id, channel_name, channel_thumbnail, subscribed_at FROM subscriptions;
        DROP TABLE subscriptions;
        ALTER TABLE subscriptions_new RENAME TO subscriptions;
      `)
      db.pragma('foreign_keys = ON')
    }
  } catch { /* already migrated */ }

  // Remove FK constraint on watch_history.video_id — history must record any video, not just downloaded ones
  try {
    const fks = db.prepare('PRAGMA foreign_key_list(watch_history)').all()
    if (fks.length > 0) {
      db.pragma('foreign_keys = OFF')
      db.exec(`
        CREATE TABLE watch_history_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          video_id TEXT NOT NULL,
          title TEXT,
          channel TEXT,
          thumbnail TEXT,
          watch_time REAL DEFAULT 0,
          watched_at TEXT DEFAULT (datetime('now'))
        );
        INSERT OR IGNORE INTO watch_history_new SELECT id, video_id, title, channel, thumbnail, watch_time, watched_at FROM watch_history;
        DROP TABLE watch_history;
        ALTER TABLE watch_history_new RENAME TO watch_history;
      `)
      db.pragma('foreign_keys = ON')
    }
  } catch { /* already migrated */ }
}

export const db = getDb()

// ─────────────────────────── Video helpers ────────────────────────────────────

export interface VideoRecord {
  id: string
  session_id: string
  title: string
  channel: string
  channel_id?: string
  duration: number
  upload_date?: string
  description?: string
  thumbnail_path?: string
  video_path?: string
  captions_path?: string
  metadata_json?: string
  folder: string
  sha256?: string
  downloaded_at: string
}

// sessionId optional: undefined = any session (for stream route), string = specific session
export function getVideo(id: string, sessionId?: string): VideoRecord | undefined {
  if (sessionId !== undefined) {
    return db.prepare('SELECT * FROM videos WHERE id = ? AND session_id = ?').get(id, sessionId) as VideoRecord | undefined
  }
  return db.prepare('SELECT * FROM videos WHERE id = ?').get(id) as VideoRecord | undefined
}

export function getAllVideos(folder?: string, search?: string, sort = 'downloaded_at', limit?: number, sessionId?: string): VideoRecord[] {
  const validSorts = ['downloaded_at', 'title', 'duration', 'upload_date']
  const orderBy = validSorts.includes(sort) ? sort : 'downloaded_at'
  const limitClause = limit ? `LIMIT ${limit}` : ''
  const sid = sessionId ?? ''

  if (search && search.trim()) {
    return db.prepare(`
      SELECT v.* FROM search_index si
      JOIN videos v ON v.rowid = si.rowid
      WHERE search_index MATCH ?
      AND v.session_id = ?
      ${folder ? 'AND v.folder = ?' : ''}
      ORDER BY v.${orderBy} DESC
      ${limitClause}
    `).all(folder ? [search, sid, folder] : [search, sid]) as VideoRecord[]
  }

  if (folder) {
    return db.prepare(`SELECT * FROM videos WHERE session_id = ? AND folder = ? ORDER BY ${orderBy} DESC ${limitClause}`).all(sid, folder) as VideoRecord[]
  }
  return db.prepare(`SELECT * FROM videos WHERE session_id = ? ORDER BY ${orderBy} DESC ${limitClause}`).all(sid) as VideoRecord[]
}

export function insertVideo(video: Omit<VideoRecord, 'downloaded_at' | 'session_id'>, sessionId = ''): void {
  db.prepare(`
    INSERT OR REPLACE INTO videos
    (id, session_id, title, channel, channel_id, duration, upload_date, description, thumbnail_path, video_path, captions_path, metadata_json, folder, sha256)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    video.id, sessionId, video.title, video.channel, video.channel_id ?? null,
    video.duration ?? 0, video.upload_date ?? null, video.description ?? null,
    video.thumbnail_path ?? null, video.video_path ?? null, video.captions_path ?? null,
    video.metadata_json ?? null, video.folder ?? '기타', video.sha256 ?? null
  )
}

export function deleteVideo(id: string, sessionId = ''): void {
  db.prepare('DELETE FROM videos WHERE id = ? AND session_id = ?').run(id, sessionId)
}

export function moveVideoToFolder(videoId: string, folder: string, sessionId = ''): void {
  db.prepare('UPDATE videos SET folder = ? WHERE id = ? AND session_id = ?').run(folder, videoId, sessionId)
}

export function updateVideoSha256(videoId: string, sha256: string, sessionId = ''): void {
  db.prepare('UPDATE videos SET sha256 = ? WHERE id = ? AND session_id = ?').run(sha256, videoId, sessionId)
}

export function findDuplicates(): { id: string; title: string; sha256: string; count: number }[] {
  return db.prepare(`
    SELECT id, title, sha256, COUNT(*) as count
    FROM videos
    WHERE sha256 IS NOT NULL
    GROUP BY sha256
    HAVING count > 1
    ORDER BY count DESC
  `).all() as { id: string; title: string; sha256: string; count: number }[]
}

export function computeAndStoreSha256(videoId: string, videoPath: string): string | null {
  try {
    const hash = crypto.createHash('sha256')
    const stream = fs.createReadStream(videoPath)
    let result = ''
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => {
      result = hash.digest('hex')
      updateVideoSha256(videoId, result)
    })
    return result
  } catch {
    return null
  }
}

// Auto-categorize folder based on title keywords
export function autoDetectFolder(title: string): string {
  const t = title.toLowerCase()
  if (/강의|강좌|tutorial|course|학습|공부|수업|교육|lecture|lesson|배우/.test(t)) return '교육'
  if (/music|노래|음악|song|mv|뮤직|album|playlist|cover|acoustic|remix|가사/.test(t)) return '음악'
  if (/game|게임|gaming|gameplay|playthrough|minecraft|roblox|롤|lol|valorant|스팀|steam/.test(t)) return '게임'
  if (/코딩|coding|programming|개발|developer|python|javascript|react|node|docker|git/.test(t)) return '코딩'
  if (/요리|recipe|cooking|먹방|mukbang|food|맛집|restaurant|chef/.test(t)) return '요리'
  if (/vlog|일상|여행|travel|tour|trip|여행기|vacation|여행|abroad/.test(t)) return '여행'
  if (/뉴스|news|이슈|경제|politics|사회|세계|breaking/.test(t)) return '뉴스'
  return '기타'
}

// ─────────────────────────── Watch history ────────────────────────────────────

export interface WatchHistoryRecord {
  id: number
  video_id: string
  title?: string
  channel?: string
  thumbnail?: string
  watch_time: number
  watched_at: string
}

export function getWatchPosition(videoId: string, sessionId = ''): number {
  const row = db.prepare(
    'SELECT watch_time FROM watch_history WHERE video_id = ? AND session_id = ? ORDER BY watched_at DESC LIMIT 1'
  ).get(videoId, sessionId) as { watch_time: number } | undefined
  return row?.watch_time ?? 0
}

export function saveWatchPosition(videoId: string, watchTime: number, meta?: { title?: string; channel?: string; thumbnail?: string }, sessionId = ''): void {
  db.prepare(`
    INSERT INTO watch_history (video_id, watch_time, title, channel, thumbnail, session_id) VALUES (?, ?, ?, ?, ?, ?)
  `).run(videoId, watchTime, meta?.title ?? null, meta?.channel ?? null, meta?.thumbnail ?? null, sessionId)
}

export function getRecentHistory(limit = 30, sessionId = ''): WatchHistoryRecord[] {
  return db.prepare(`
    SELECT DISTINCT video_id,
      FIRST_VALUE(title) OVER (PARTITION BY video_id ORDER BY watched_at DESC) as title,
      FIRST_VALUE(channel) OVER (PARTITION BY video_id ORDER BY watched_at DESC) as channel,
      FIRST_VALUE(thumbnail) OVER (PARTITION BY video_id ORDER BY watched_at DESC) as thumbnail,
      MAX(watch_time) as watch_time,
      MAX(watched_at) as watched_at
    FROM watch_history
    WHERE session_id = ?
    GROUP BY video_id
    ORDER BY MAX(watched_at) DESC
    LIMIT ?
  `).all(sessionId, limit) as WatchHistoryRecord[]
}

export function clearHistory(sessionId = ''): void {
  db.prepare('DELETE FROM watch_history WHERE session_id = ?').run(sessionId)
}

// ─────────────────────────── Subscriptions ────────────────────────────────────

export interface SubscriptionRecord {
  id: number
  channel_id: string
  channel_name: string
  channel_thumbnail?: string
  subscribed_at: string
}

export function getSubscriptions(sessionId = ''): SubscriptionRecord[] {
  return db.prepare('SELECT * FROM subscriptions WHERE session_id = ? ORDER BY channel_name ASC').all(sessionId) as SubscriptionRecord[]
}

export function addSubscription(channelId: string, channelName: string, sessionId = '', channelThumbnail?: string): void {
  db.prepare(`
    INSERT OR IGNORE INTO subscriptions (session_id, channel_id, channel_name, channel_thumbnail)
    VALUES (?, ?, ?, ?)
  `).run(sessionId, channelId, channelName, channelThumbnail ?? null)
}

export function removeSubscription(channelId: string, sessionId = ''): void {
  db.prepare('DELETE FROM subscriptions WHERE channel_id = ? AND session_id = ?').run(channelId, sessionId)
}

export function isSubscribed(channelId: string, sessionId = ''): boolean {
  return !!db.prepare('SELECT id FROM subscriptions WHERE channel_id = ? AND session_id = ?').get(channelId, sessionId)
}

// ─────────────────────────── Batch downloads ──────────────────────────────────

export interface BatchDownload {
  id: number
  type: string
  url: string
  title?: string
  total: number
  completed: number
  status: string
  folder: string
  started_at: string
}

export function createBatchDownload(type: string, url: string, folder: string, title?: string): number {
  const result = db.prepare(`
    INSERT INTO batch_downloads (type, url, folder, title) VALUES (?, ?, ?, ?)
  `).run(type, url, folder, title ?? null)
  return result.lastInsertRowid as number
}

export function updateBatchDownload(id: number, updates: Partial<Pick<BatchDownload, 'total' | 'completed' | 'status' | 'title'>>): void {
  const sets: string[] = []
  const vals: unknown[] = []
  if (updates.total !== undefined) { sets.push('total = ?'); vals.push(updates.total) }
  if (updates.completed !== undefined) { sets.push('completed = ?'); vals.push(updates.completed) }
  if (updates.status !== undefined) { sets.push('status = ?'); vals.push(updates.status) }
  if (updates.title !== undefined) { sets.push('title = ?'); vals.push(updates.title) }
  if (!sets.length) return
  vals.push(id)
  db.prepare(`UPDATE batch_downloads SET ${sets.join(', ')} WHERE id = ?`).run(...vals)
}

export function getBatchDownloads(): BatchDownload[] {
  return db.prepare('SELECT * FROM batch_downloads ORDER BY started_at DESC LIMIT 50').all() as BatchDownload[]
}

// ─────────────────────────── Storage stats ────────────────────────────────────

export function getStorageStats(sessionId = ''): { videoCount: number; folderCounts: Record<string, number>; storagePath: string } {
  const videoCount = (db.prepare('SELECT COUNT(*) as count FROM videos WHERE session_id = ?').get(sessionId) as { count: number }).count
  const folderRows = db.prepare('SELECT folder, COUNT(*) as count FROM videos WHERE session_id = ? GROUP BY folder').all(sessionId) as { folder: string; count: number }[]
  const folderCounts: Record<string, number> = {}
  for (const row of folderRows) folderCounts[row.folder] = row.count
  return { videoCount, folderCounts, storagePath: STORAGE_ROOT }
}

// ─────────────────────────── Comments ────────────────────────────────────────

export interface CommentRecord {
  id: number
  video_id: string
  session_id: string
  username: string
  text: string
  likes: number
  is_blocked: number
  is_reported: number
  report_count: number
  created_at: string
  user_liked?: number
}

export function insertComment(videoId: string, sessionId: string, username: string, text: string): number {
  const result = db.prepare(`
    INSERT INTO comments (video_id, session_id, username, text) VALUES (?, ?, ?, ?)
  `).run(videoId, sessionId, username, text)
  return result.lastInsertRowid as number
}

export function getComments(videoId: string, sessionId?: string): CommentRecord[] {
  if (sessionId) {
    return db.prepare(`
      SELECT c.*,
        (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id) as likes,
        (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id AND session_id = ?) as user_liked
      FROM comments c
      WHERE c.video_id = ? AND c.is_blocked = 0
      ORDER BY c.created_at DESC
    `).all(sessionId, videoId) as CommentRecord[]
  }
  return db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id) as likes
    FROM comments c
    WHERE c.video_id = ? AND c.is_blocked = 0
    ORDER BY c.created_at DESC
  `).all(videoId) as CommentRecord[]
}

export function blockComment(commentId: number): void {
  db.prepare('UPDATE comments SET is_blocked = 1 WHERE id = ?').run(commentId)
}

export function reportComment(commentId: number, sessionId: string, reason: string): void {
  // Insert report record
  db.prepare(`
    INSERT OR IGNORE INTO reports (comment_id, session_id, reason) VALUES (?, ?, ?)
  `).run(commentId, sessionId, reason)
  // Increment report count
  db.prepare('UPDATE comments SET report_count = report_count + 1, is_reported = 1 WHERE id = ?').run(commentId)
  // Auto-block if 3+ reports
  const row = db.prepare('SELECT report_count FROM comments WHERE id = ?').get(commentId) as { report_count: number } | undefined
  if (row && row.report_count >= 3) {
    blockComment(commentId)
  }
}

export function likeComment(commentId: number, sessionId: string): { liked: boolean } {
  const existing = db.prepare('SELECT 1 FROM comment_likes WHERE comment_id = ? AND session_id = ?').get(commentId, sessionId)
  if (existing) {
    db.prepare('DELETE FROM comment_likes WHERE comment_id = ? AND session_id = ?').run(commentId, sessionId)
    return { liked: false }
  } else {
    db.prepare('INSERT OR IGNORE INTO comment_likes (comment_id, session_id) VALUES (?, ?)').run(commentId, sessionId)
    return { liked: true }
  }
}

// ─────────────────────────── Video Likes ─────────────────────────────────────

export function getVideoLikes(videoId: string): { likes: number; dislikes: number } {
  const likes = (db.prepare(`SELECT COUNT(*) as count FROM video_likes WHERE video_id = ? AND type = 'like'`).get(videoId) as { count: number }).count
  const dislikes = (db.prepare(`SELECT COUNT(*) as count FROM video_likes WHERE video_id = ? AND type = 'dislike'`).get(videoId) as { count: number }).count
  return { likes, dislikes }
}

export function setVideoLike(videoId: string, sessionId: string, type: 'like' | 'dislike'): void {
  db.prepare(`
    INSERT OR REPLACE INTO video_likes (video_id, session_id, type) VALUES (?, ?, ?)
  `).run(videoId, sessionId, type)
}

export function removeVideoLike(videoId: string, sessionId: string): void {
  db.prepare('DELETE FROM video_likes WHERE video_id = ? AND session_id = ?').run(videoId, sessionId)
}

export function getUserVideoLike(videoId: string, sessionId: string): 'like' | 'dislike' | null {
  const row = db.prepare('SELECT type FROM video_likes WHERE video_id = ? AND session_id = ?').get(videoId, sessionId) as { type: string } | undefined
  return (row?.type as 'like' | 'dislike') ?? null
}

// ─────────────────────────── Temp Streams ────────────────────────────────────

export function addTempStream(videoId: string, filePath: string, expiresAt: string): void {
  db.prepare(`
    INSERT OR REPLACE INTO temp_streams (video_id, file_path, expires_at) VALUES (?, ?, ?)
  `).run(videoId, filePath, expiresAt)
}

export function getTempStream(videoId: string): { file_path: string; expires_at: string } | null {
  const row = db.prepare(`
    SELECT file_path, expires_at FROM temp_streams
    WHERE video_id = ? AND expires_at > datetime('now')
  `).get(videoId) as { file_path: string; expires_at: string } | undefined
  return row ?? null
}

export function resetSession(sessionId: string): { deletedVideos: number; storageDeleted: string[] } {
  db.pragma('foreign_keys = OFF')
  const storageDeleted: string[] = []
  try {
    // Collect video storage paths before deleting
    const videoRows = db.prepare('SELECT video_path FROM videos WHERE session_id = ?').all(sessionId) as { video_path: string | null }[]
    for (const row of videoRows) {
      if (row.video_path) {
        const dir = path.dirname(row.video_path)
        if (fs.existsSync(dir)) {
          try { fs.rmSync(dir, { recursive: true, force: true }); storageDeleted.push(dir) } catch { /* ignore */ }
        }
      }
    }

    const deletedVideos = (db.prepare('DELETE FROM videos WHERE session_id = ?').run(sessionId)).changes
    db.prepare('DELETE FROM watch_history WHERE session_id = ?').run(sessionId)
    db.prepare('DELETE FROM subscriptions WHERE session_id = ?').run(sessionId)
    db.prepare('DELETE FROM video_likes WHERE session_id = ?').run(sessionId)
    db.prepare(`
      DELETE FROM comment_likes WHERE comment_id IN (
        SELECT id FROM comments WHERE session_id = ?
      )
    `).run(sessionId)
    db.prepare('DELETE FROM comments WHERE session_id = ?').run(sessionId)
    db.prepare('DELETE FROM batch_downloads').run()
    return { deletedVideos, storageDeleted }
  } finally {
    db.pragma('foreign_keys = ON')
  }
}

export function cleanupExpiredStreams(): void {
  const expired = db.prepare(`
    SELECT file_path FROM temp_streams WHERE expires_at <= datetime('now')
  `).all() as { file_path: string }[]

  for (const row of expired) {
    try {
      const dir = path.dirname(row.file_path)
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true })
      }
    } catch {
      // ignore cleanup errors
    }
  }

  db.prepare(`DELETE FROM temp_streams WHERE expires_at <= datetime('now')`).run()
}
