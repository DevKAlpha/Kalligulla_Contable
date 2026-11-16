// electron-builder never copies folders named `node_modules` through extraResources.
// prepare-web hides them under another name and the afterPack hook restores them inside the packaged app.
const fs = require('node:fs')
const path = require('node:path')

const HIDDEN = '__node_modules__'

/** Windows antivirus/indexers briefly lock freshly copied folders (EPERM/EBUSY): retry with backoff. */
function renameWithRetry(from, to, attempts = 10) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      fs.renameSync(from, to)
      return
    } catch (error) {
      if (attempt >= attempts || !['EPERM', 'EBUSY', 'EACCES'].includes(error.code)) throw error
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250 * attempt)
    }
  }
}

/** Renames every `from` directory below `root` to `to`, deepest first. */
function renameAll(root, from, to) {
  if (!fs.existsSync(root)) return 0
  let count = 0
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const full = path.join(root, entry.name)
    count += renameAll(full, from, to)
    if (entry.name === from) {
      renameWithRetry(full, path.join(root, to))
      count += 1
    }
  }
  return count
}

module.exports = { HIDDEN, renameAll }
