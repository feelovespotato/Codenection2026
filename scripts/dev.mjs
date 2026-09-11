import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
const npmCli = process.env.npm_execpath
if (!npmCli) throw new Error('Start this script with npm run dev.')
const children = ['backend', 'frontend'].map(workspace => spawn(process.execPath, [npmCli, 'run', 'dev'], {
  cwd: resolve(workspace), stdio: 'inherit', windowsHide: true,
}))
children.push(spawn(process.execPath, [npmCli, 'run', 'companion'], {
  cwd: resolve('.'), stdio: 'inherit', windowsHide: true,
}))
let closing = false
function stop(code = 0) {
  if (closing) return
  closing = true
  for (const child of children) {
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true })
    else child.kill('SIGTERM')
  }
  process.exitCode = code
}
for (const child of children) child.on('exit', code => stop(code ?? 1))
process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())
