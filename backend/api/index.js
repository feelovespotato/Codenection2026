import { createStore, tokenCipher } from '../src/store.js'
import { createGoogle } from '../src/google.js'
import { createApp } from '../src/app.js'
import { createAI } from '../src/ai.js'

// Neon/Postgres
const store = createStore(process.env.DATABASE_URL)

// Create required tables when the function starts
await store.init()

const cipher = tokenCipher(
  null,
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

// Simple backend root check
app.get('/', (_req, res) => {
  res.json({
    service: 'Moodify API',
    health: '/api/health',
  })
})

// Avoid favicon 500
app.get('/favicon.ico', (_req, res) => {
  res.status(204).end()
})

export default app