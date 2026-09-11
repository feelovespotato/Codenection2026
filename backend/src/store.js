import pg from 'pg'
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto'

const { Pool } = pg

const DEFAULT_USER = {
  zone: 'Asia/Kuala_Lumpur',
  events: [],
  checkins: [],
  revision: 0,
  proposals: [],
  google: null,
  recoverySessions: [],
}

export function createStore(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured.')
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 5,
  })

  async function init() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires BIGINT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS sessions_expires_idx
      ON sessions(expires);
    `)
  }

  async function get(id) {
    const result = await pool.query(
      'SELECT data FROM users WHERE id = $1',
      [id]
    )

    return result.rows[0]?.data || null
  }

  async function save(id, data) {
    await pool.query(
      `
      INSERT INTO users (id, data)
      VALUES ($1, $2::jsonb)
      ON CONFLICT (id)
      DO UPDATE SET data = EXCLUDED.data
      `,
      [id, JSON.stringify(data)]
    )
  }

  async function session(id) {
    const result = await pool.query(
      `
      SELECT user_id
      FROM sessions
      WHERE id = $1
        AND expires > $2
      `,
      [id, Date.now()]
    )

    return result.rows[0]?.user_id || null
  }

  async function createSession(id, userId) {
    const client = await pool.connect()

    try {
      await client.query('BEGIN')

      await client.query(
        'DELETE FROM sessions WHERE expires <= $1',
        [Date.now()]
      )

      await client.query(
        `
        INSERT INTO sessions (id, user_id, expires)
        VALUES ($1, $2, $3)
        ON CONFLICT (id)
        DO UPDATE SET
          user_id = EXCLUDED.user_id,
          expires = EXCLUDED.expires
        `,
        [id, userId, Date.now() + 30 * 86400000]
      )

      await client.query(
        `
        INSERT INTO users (id, data)
        VALUES ($1, $2::jsonb)
        ON CONFLICT (id) DO NOTHING
        `,
        [userId, JSON.stringify(DEFAULT_USER)]
      )

      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async function close() {
    await pool.end()
  }

  return {
    init,
    get,
    save,
    session,
    createSession,
    close,
  }
}

export function tokenCipher(_directory, providedKey) {
  if (!providedKey) {
    throw new Error('TOKEN_ENCRYPTION_KEY is not configured.')
  }

  const key = Buffer.from(providedKey.trim(), 'hex')

  if (key.length !== 32) {
    throw new Error(
      'TOKEN_ENCRYPTION_KEY must contain exactly 64 hexadecimal characters.'
    )
  }

  return {
    encrypt(value) {
      const iv = randomBytes(12)
      const cipher = createCipheriv('aes-256-gcm', key, iv)

      const encrypted = Buffer.concat([
        cipher.update(JSON.stringify(value)),
        cipher.final(),
      ])

      return Buffer.concat([
        iv,
        cipher.getAuthTag(),
        encrypted,
      ]).toString('base64')
    },

    decrypt(value) {
      const buffer = Buffer.from(value, 'base64')

      const decipher = createDecipheriv(
        'aes-256-gcm',
        key,
        buffer.subarray(0, 12)
      )

      decipher.setAuthTag(buffer.subarray(12, 28))

      return JSON.parse(
        Buffer.concat([
          decipher.update(buffer.subarray(28)),
          decipher.final(),
        ]).toString()
      )
    },
  }
}