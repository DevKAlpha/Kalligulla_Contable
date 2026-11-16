const { app, BrowserWindow, shell, utilityProcess } = require('electron')
const path = require('node:path')

const isDevelopment = !app.isPackaged
const DEV_URL = 'http://127.0.0.1:3000'
/**
 * Fixed port on purpose: localStorage is scoped to the origin, so changing the port
 * would make previously saved data invisible.
 */
const PORT = 47821
const HOST = '127.0.0.1'

let server = null

async function waitForServer(url, timeoutMs = 45000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${url}/api/health`)
      if (response.ok) return
    } catch {
      /* server still booting */
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error('El servidor local de Kaligula no respondió a tiempo.')
}

async function startEmbeddedServer() {
  const serverPath = path.join(process.resourcesPath, 'web', 'apps', 'web', 'server.js')
  server = utilityProcess.fork(serverPath, [], {
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(PORT),
      HOSTNAME: HOST,
      // Embedded PostgreSQL (PGlite) database, kept in the user's profile folder.
      KALIGULA_DATA_DIR: path.join(app.getPath('userData'), 'database'),
    },
    stdio: 'inherit',
    serviceName: 'kaligula-web',
  })
  const url = `http://${HOST}:${PORT}`
  await waitForServer(url)
  return url
}

async function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 380,
    minHeight: 660,
    backgroundColor: '#e6e2d6',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  window.once('ready-to-show', () => window.show())
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url)
    return { action: 'deny' }
  })
  // Never navigate the app window away from the local origin.
  window.webContents.on('will-navigate', (event, url) => {
    const allowed = isDevelopment ? DEV_URL : `http://${HOST}:${PORT}`
    if (!url.startsWith(allowed)) event.preventDefault()
  })

  const url = isDevelopment ? DEV_URL : await startEmbeddedServer()
  await window.loadURL(url)
}

app.whenReady().then(() => {
  createWindow().catch((error) => {
    console.error(error)
    app.quit()
  })
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  server?.kill()
  server = null
})
