import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DB_PATH = path.join(process.cwd(), 'opentube.db')

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
      downloaded_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS watch_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      video_id TEXT NOT NULL,
      watch_time REAL DEFAULT 0,
      watched_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT UNIQUE NOT NULL,
      channel_name TEXT NOT NULL,
      channel_thumbnail TEXT,
      subscribed_at TEXT DEFAULT (datetime('now'))
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
      FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
      FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
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
  `)
}

export const db = getDb()

// Video helpers
export interface VideoRecord {
  id: string
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
  downloaded_at: string
}

export function getVideo(id: string): VideoRecord | undefined {
  return db.prepare('SELECT * FROM videos WHERE id = ?').get(id) as VideoRecord | undefined
}

export function getAllVideos(folder?: string, search?: string, sort = 'downloaded_at'): VideoRecord[] {
  const validSorts = ['downloaded_at', 'title', 'duration', 'upload_date']
  const orderBy = validSorts.includes(sort) ? sort : 'downloaded_at'

  if (search && search.trim()) {
    const rows = db.prepare(`
      SELECT v.* FROM search_index si
      JOIN videos v ON v.id = si.video_id
      WHERE search_index MATCH ?
      ${folder ? 'AND v.folder = ?' : ''}
      ORDER BY v.${orderBy} DESC
    `).all(folder ? [search, folder] : [search]) as VideoRecord[]
    return rows
  }

  if (folder) {
    return db.prepare(`SELECT * FROM videos WHERE folder = ? ORDER BY ${orderBy} DESC`).all(folder) as VideoRecord[]
  }
  return db.prepare(`SELECT * FROM videos ORDER BY ${orderBy} DESC`).all() as VideoRecord[]
}

export function insertVideo(video: Omit<VideoRecord, 'downloaded_at'>): void {
  db.prepare(`
    INSERT OR REPLACE INTO videos
    (id, title, channel, channel_id, duration, upload_date, description, thumbnail_path, video_path, captions_path, metadata_json, folder)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    video.id, video.title, video.channel, video.channel_id ?? null,
    video.duration ?? 0, video.upload_date ?? null, video.description ?? null,
    video.thumbnail_path ?? null, video.video_path ?? null, video.captions_path ?? null,
    video.metadata_json ?? null, video.folder ?? '기타'
  )
}

export function deleteVideo(id: string): void {
  db.prepare('DELETE FROM videos WHERE id = ?').run(id)
}

export function moveVideoToFolder(videoId: string, folder: string): void {
  db.prepare('UPDATE videos SET folder = ? WHERE id = ?').run(folder, videoId)
}

// Watch history helpers
export interface WatchHistoryRecord {
  id: number
  video_id: string
  watch_time: number
  watched_at: string
}

export function getWatchPosition(videoId: string): number {
  const row = db.prepare(
    'SELECT watch_time FROM watch_history WHERE video_id = ? ORDER BY watched_at DESC LIMIT 1'
  ).get(videoId) as { watch_time: number } | undefined
  return row?.watch_time ?? 0
}

export function saveWatchPosition(videoId: string, watchTime: number): void {
  db.prepare(`
    INSERT INTO watch_history (video_id, watch_time) VALUES (?, ?)
  `).run(videoId, watchTime)
}

export function getRecentHistory(limit = 20): (WatchHistoryRecord & VideoRecord)[] {
  return db.prepare(`
    SELECT wh.*, v.title, v.channel, v.thumbnail_path, v.duration
    FROM watch_history wh
    LEFT JOIN videos v ON v.id = wh.video_id
    ORDER BY wh.watched_at DESC
    LIMIT ?
  `).all(limit) as (WatchHistoryRecord & VideoRecord)[]
}

// Subscription helpers
export interface SubscriptionRecord {
  id: number
  channel_id: string
  channel_name: string
  channel_thumbnail?: string
  subscribed_at: string
}

export function getSubscriptions(): SubscriptionRecord[] {
  return db.prepare('SELECT * FROM subscriptions ORDER BY channel_name ASC').all() as SubscriptionRecord[]
}

export function addSubscription(channelId: string, channelName: string, channelThumbnail?: string): void {
  db.prepare(`
    INSERT OR IGNORE INTO subscriptions (channel_id, channel_name, channel_thumbnail)
    VALUES (?, ?, ?)
  `).run(channelId, channelName, channelThumbnail ?? null)
}

export function removeSubscription(channelId: string): void {
  db.prepare('DELETE FROM subscriptions WHERE channel_id = ?').run(channelId)
}

export function isSubscribed(channelId: string): boolean {
  const row = db.prepare('SELECT id FROM subscriptions WHERE channel_id = ?').get(channelId)
  return !!row
}

// Storage stats
export function getStorageStats(): { videoCount: number; folderCounts: Record<string, number> } {
  const videoCount = (db.prepare('SELECT COUNT(*) as count FROM videos').get() as { count: number }).count
  const folderRows = db.prepare('SELECT folder, COUNT(*) as count FROM videos GROUP BY folder').all() as { folder: string; count: number }[]
  const folderCounts: Record<string, number> = {}
  for (const row of folderRows) {
    folderCounts[row.folder] = row.count
  }
  return { videoCount, folderCounts }
}
