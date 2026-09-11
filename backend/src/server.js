import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

import { createStore, tokenCipher } from './store.js'
import { createGoogle } from './google.js'
import { createApp } from './app.js'
import { createAI } from './ai.js'

const root = fileURLToPath(new URL('../', import.meta.url))

// Use Neon/Postgres instead of SQLite
const store = createStore(process.env.DATABASE_URL)

// Create tables if they do not exist
await store.init()

const cipher = tokenCipher(
  null,
  process.env.TOKEN_ENCRYPTION_KEY
)

const origin =
  process.env.APP_ORIGIN ||
  'http://localhost:5173'

const google = createGoogle(
  {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri:
      process.env.GOOGLE_REDIRECT_URI ||
      `${origin}/api/google/callback`,
  },
  cipher
)

const ai = createAI()

const app = createApp({
  store,
  google,
  ai,
  origin,
  staticDirectory: resolve(root, '../frontend/dist'),
})

const port = Number(process.env.PORT || 3001)

const server = app.listen(
  port,
  '127.0.0.1',
  () => {
    console.log(`Moodify API ready at http://localhost:${port}`)
  }
)

async function stop() {
  server.close(async () => {
    await store.close()
    process.exit(0)
  })
}

process.on('SIGINT', stop)
process.on('SIGTERM', stop)