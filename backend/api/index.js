import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

import { createStore, tokenCipher } from '../src/store.js'
import { createGoogle } from '../src/google.js'
import { createApp } from '../src/app.js'
import { createAI } from '../src/ai.js'

const root = fileURLToPath(new URL('../', import.meta.url))

// Vercel only allows temporary writable files in /tmp
const directory = '/tmp/moodify'

const store = createStore(resolve(directory, 'moodify.sqlite'))

const cipher = tokenCipher(
  directory,
  process.env.TOKEN_ENCRYPTION_KEY
)

const origin =
  process.env.APP_ORIGIN ||
  'https://moodify-frontend-kappa.vercel.app'

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
  staticDirectory: null,
})

export default app