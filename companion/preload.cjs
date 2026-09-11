const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('companionDesktop', {
  setInteractive: interactive => ipcRenderer.send('companion:interactive', Boolean(interactive)),
  setControlsOpen: open => ipcRenderer.send('companion:resize', Boolean(open)),
  startDrag: point => ipcRenderer.send('companion:drag-start', point),
  moveDrag: point => ipcRenderer.send('companion:drag-move', point),
  endDrag: () => ipcRenderer.send('companion:drag-end'),
})
