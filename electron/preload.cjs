const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('kaligulaDesktop', {
  platform: process.platform,
  desktop: true,
})
