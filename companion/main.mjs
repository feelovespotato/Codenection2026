import { app, BrowserWindow, ipcMain, screen } from 'electron'
import { fileURLToPath } from 'node:url'

const source = fileURLToPath(new URL('../frontend/', import.meta.url))
let companionWindow
let drag

function createCompanionWindow() {
  const { workArea } = screen.getPrimaryDisplay()
  companionWindow = new BrowserWindow({
    width: 264,
    height: 196,
    x: workArea.x + workArea.width - 288,
    y: workArea.y + workArea.height - 230,
    transparent: true,
    frame: false,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: fileURLToPath(new URL('./preload.cjs', import.meta.url)),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  companionWindow.setAlwaysOnTop(true, 'screen-saver')
  companionWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  companionWindow.setIgnoreMouseEvents(true, { forward: true })
  companionWindow.on('closed', () => { companionWindow = null })

  const load = async () => {
    try {
      if (app.isPackaged) await companionWindow.loadFile(`${source}dist/companion.html`)
      else await companionWindow.loadURL('http://localhost:5173/companion.html')
    } catch {
      if (!companionWindow?.isDestroyed()) setTimeout(load, 750)
    }
  }
  load()
}

ipcMain.on('companion:interactive', (_event, interactive) => {
  if (companionWindow && !companionWindow.isDestroyed()) companionWindow.setIgnoreMouseEvents(!interactive, { forward: true })
})
ipcMain.on('companion:resize', (_event, controlsOpen) => {
  if (companionWindow && !companionWindow.isDestroyed()) companionWindow.setSize(264, controlsOpen ? 366 : 196)
})
ipcMain.on('companion:drag-start', (_event, point) => {
  if (!companionWindow || companionWindow.isDestroyed()) return
  const [x, y] = companionWindow.getPosition()
  drag = { startX: point.x, startY: point.y, x, y }
})
ipcMain.on('companion:drag-move', (_event, point) => {
  if (!drag || !companionWindow || companionWindow.isDestroyed()) return
  companionWindow.setPosition(drag.x + Math.round(point.x - drag.startX), drag.y + Math.round(point.y - drag.startY))
})
ipcMain.on('companion:drag-end', () => { drag = null })

app.whenReady().then(createCompanionWindow)
app.on('window-all-closed', () => app.quit())
