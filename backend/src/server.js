import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { createStore, tokenCipher } from './store.js'
import { createGoogle } from './google.js'
import { createApp } from './app.js'

const root = fileURLToPath(new URL('../', import.meta.url))
const directory = resolve(root, 'data')
const store = createStore(resolve(directory, 'moodify.sqlite'))
const cipher = tokenCipher(directory, process.env.TOKEN_ENCRYPTION_KEY)
const origin = process.env.APP_ORIGIN || 'http://localhost:5173'
const google = createGoogle({ clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET, redirectUri: process.env.GOOGLE_REDIRECT_URI || `${origin}/api/google/callback` }, cipher)
const app = createApp({ store, google, origin, staticDirectory: resolve(root, '../frontend/dist') })
const server = app.listen(Number(process.env.PORT || 3001), '127.0.0.1', () => console.log(`Moodify API ready at http://localhost:${process.env.PORT || 3001}`))
function stop() { server.close(() => { store.db.close(); process.exit(0) }) }
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
