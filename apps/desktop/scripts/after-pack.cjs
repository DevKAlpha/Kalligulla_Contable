const path = require('node:path')
const { HIDDEN, renameAll } = require('./node-modules-rename.cjs')

/** electron-builder afterPack hook: restores the standalone server's node_modules folders. */
exports.default = async function afterPack(context) {
  const resources = context.electronPlatformName === 'darwin'
    ? path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`, 'Contents', 'Resources')
    : path.join(context.appOutDir, 'resources')
  const restored = renameAll(path.join(resources, 'web'), HIDDEN, 'node_modules')
  console.log(`  • restored ${restored} node_modules folders in packaged web server`)
}
