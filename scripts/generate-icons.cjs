const fs = require('node:fs')
const path = require('node:path')
const zlib = require('node:zlib')

/*
 * Kaligula icon (pixel "K" on a lime screen inside a dark bezel), drawn without dependencies.
 * Outputs the PWA PNGs and a multi-size Windows icon (16–256 px) used by the desktop app,
 * its installer and the uninstaller: small sizes as BMP entries (the format every Windows
 * component and NSIS read), 256 px as PNG.
 */

const outputDir = path.join(__dirname, '..', 'apps', 'web', 'public')
fs.mkdirSync(outputDir, { recursive: true })

const PALETTE = { ink: [21, 22, 28, 255], shell: [242, 238, 227, 255], lime: [198, 240, 90, 255] }
const LETTER = ['10001', '10010', '10100', '11000', '10100', '10010', '10001']

/** RGBA pixels, top row first. */
function drawIcon(size) {
  const pixels = Buffer.alloc(size * size * 4)
  const fill = (x1, y1, x2, y2, color) => {
    for (let y = y1; y < y2; y += 1) for (let x = x1; x < x2; x += 1) pixels.set(color, (y * size + x) * 4)
  }
  // Device shell, dark bezel and a lime screen holding a pixel K.
  fill(0, 0, size, size, PALETTE.shell)
  const bezel = Math.max(1, Math.floor(size * 0.1))
  fill(bezel, bezel, size - bezel, size - bezel, PALETTE.ink)
  const inset = Math.max(2, Math.floor(size * 0.17))
  fill(inset, inset, size - inset, size - inset, PALETTE.lime)
  const unit = Math.max(1, Math.floor(size * 0.075))
  const offsetX = Math.floor((size - unit * 5) / 2)
  const offsetY = Math.floor((size - unit * 7) / 2)
  LETTER.forEach((row, y) => [...row].forEach((cell, x) => {
    if (cell === '1') fill(offsetX + x * unit, offsetY + y * unit, offsetX + (x + 1) * unit, offsetY + (y + 1) * unit, PALETTE.ink)
  }))
  return pixels
}

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(name, data) {
  const type = Buffer.from(name)
  const output = Buffer.alloc(data.length + 12)
  output.writeUInt32BE(data.length, 0)
  type.copy(output, 4)
  data.copy(output, 8)
  output.writeUInt32BE(crc32(Buffer.concat([type, data])), data.length + 8)
  return output
}

function png(size) {
  const rgba = drawIcon(size)
  const rows = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y += 1) rgba.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8
  header[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', zlib.deflateSync(rows, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

/** 32-bit BMP icon entry: BITMAPINFOHEADER, BGRA pixels bottom-up, then an empty AND mask. */
function bmp(size) {
  const rgba = drawIcon(size)
  const maskRow = Math.ceil(size / 32) * 4
  const header = Buffer.alloc(40)
  header.writeUInt32LE(40, 0)
  header.writeInt32LE(size, 4)
  header.writeInt32LE(size * 2, 8)
  header.writeUInt16LE(1, 12)
  header.writeUInt16LE(32, 14)
  header.writeUInt32LE(size * size * 4 + maskRow * size, 20)
  const pixels = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const from = (y * size + x) * 4
      const to = ((size - 1 - y) * size + x) * 4
      pixels[to] = rgba[from + 2]
      pixels[to + 1] = rgba[from + 1]
      pixels[to + 2] = rgba[from]
      pixels[to + 3] = rgba[from + 3]
    }
  }
  return Buffer.concat([header, pixels, Buffer.alloc(maskRow * size)])
}

function ico(sizes) {
  const images = sizes.map((size) => (size >= 256 ? png(size) : bmp(size)))
  const header = Buffer.alloc(6)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(sizes.length, 4)
  let offset = 6 + sizes.length * 16
  const entries = sizes.map((size, index) => {
    const entry = Buffer.alloc(16)
    entry[0] = size >= 256 ? 0 : size
    entry[1] = size >= 256 ? 0 : size
    entry.writeUInt16LE(1, 4)
    entry.writeUInt16LE(32, 6)
    entry.writeUInt32LE(images[index].length, 8)
    entry.writeUInt32LE(offset, 12)
    offset += images[index].length
    return entry
  })
  return Buffer.concat([header, ...entries, ...images])
}

fs.writeFileSync(path.join(outputDir, 'icon-192.png'), png(192))
fs.writeFileSync(path.join(outputDir, 'icon-512.png'), png(512))
fs.writeFileSync(path.join(outputDir, 'kaligula.ico'), ico([16, 24, 32, 48, 64, 128, 256]))
console.log('Iconos generados en', path.relative(process.cwd(), outputDir))
