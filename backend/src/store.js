import { DatabaseSync } from 'node:sqlite'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto'

export function createStore(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const db = new DatabaseSync(path)
  db.exec(`PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires INTEGER NOT NULL);
  `)
  const get = id => {
    const row = db.prepare('SELECT data FROM users WHERE id = ?').get(id)
    return row ? JSON.parse(row.data) : null
  }
  const save = (id, data) => db.prepare('INSERT OR REPLACE INTO users VALUES (?, ?)').run(id, JSON.stringify(data))
  return {
    db, get, save,
    session(id) { return db.prepare('SELECT user_id FROM sessions WHERE id = ? AND expires > ?').get(id, Date.now())?.user_id },
    createSession(id, userId) {
      db.prepare('DELETE FROM sessions WHERE expires <= ?').run(Date.now())
      db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(id, userId, Date.now() + 30 * 86400000)
      save(userId, { zone: 'Asia/Kuala_Lumpur', events: [], checkins: [], revision: 0, proposals: [], google: null })
    },
  }
}
export function tokenCipher(directory, providedKey) {
  mkdirSync(directory, { recursive: true })
  const keyPath = join(directory, 'token.key')
  if (!providedKey && !existsSync(keyPath)) writeFileSync(keyPath, randomBytes(32).toString('hex'), { mode: 0o600 })
  const key = Buffer.from(providedKey || readFileSync(keyPath, 'utf8').trim(), 'hex')
  if (key.length !== 32) throw new Error('TOKEN_ENCRYPTION_KEY must contain 64 hex characters.')
  return {
    encrypt(value) {
      const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv)
      const encrypted = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()])
      return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64')
    },
    decrypt(value) {
      const buffer = Buffer.from(value, 'base64'), cipher = createDecipheriv('aes-256-gcm', key, buffer.subarray(0, 12))
      cipher.setAuthTag(buffer.subarray(12, 28))
      return JSON.parse(Buffer.concat([cipher.update(buffer.subarray(28)), cipher.final()]).toString())
    },
  }
}
