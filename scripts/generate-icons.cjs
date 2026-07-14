const fs = require('node:fs')
const path = require('node:path')
const zlib = require('node:zlib')

const outputDir = path.join(__dirname, '..', 'public')
fs.mkdirSync(outputDir, { recursive: true })

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
  const chunk = Buffer.concat([type, data])
  const output = Buffer.alloc(data.length + 12)
  output.writeUInt32BE(data.length, 0)
  type.copy(output, 4)
  data.copy(output, 8)
  output.writeUInt32BE(crc32(chunk), data.length + 8)
  return output
}

function createIcon(size) {
  const pixels = Buffer.alloc((size * 4 + 1) * size)
  const palette = {
    ink: [24, 26, 33, 255], lime: [201, 239, 92, 255], pink: [255, 82, 111, 255], cyan: [48, 197, 215, 255],
  }
  const setPixel = (x, y, color) => {
    const index = y * (size * 4 + 1) + 1 + x * 4
    pixels.set(color, index)
  }
  const fill = (x1, y1, x2, y2, color) => {
    for (let y = y1; y < y2; y += 1) for (let x = x1; x < x2; x += 1) setPixel(x, y, color)
  }

  fill(0, 0, size, size, palette.ink)
  fill(0, 0, Math.ceil(size * 0.09), size, palette.pink)
  fill(Math.floor(size * 0.91), 0, size, size, palette.cyan)
  const inset = Math.floor(size * 0.19)
  fill(inset, inset, size - inset, size - inset, palette.lime)

  const letter = ['10001', '10010', '10100', '11000', '10100', '10010', '10001']
  const unit = Math.floor(size * 0.075)
  const width = unit * 5
  const height = unit * 7
  const offsetX = Math.floor((size - width) / 2)
  const offsetY = Math.floor((size - height) / 2)
  letter.forEach((row, y) => [...row].forEach((cell, x) => {
    if (cell === '1') fill(offsetX + x * unit, offsetY + y * unit, offsetX + (x + 1) * unit, offsetY + (y + 1) * unit, palette.ink)
  }))

  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8
  header[9] = 6
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([
    signature,
    pngChunk('IHDR', header),
    pngChunk('IDAT', zlib.deflateSync(pixels, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

const icon192 = createIcon(192)
const icon512 = createIcon(512)
const icon256 = createIcon(256)
fs.writeFileSync(path.join(outputDir, 'icon-192.png'), icon192)
fs.writeFileSync(path.join(outputDir, 'icon-512.png'), icon512)

const icoHeader = Buffer.alloc(6)
icoHeader.writeUInt16LE(0, 0)
icoHeader.writeUInt16LE(1, 2)
icoHeader.writeUInt16LE(1, 4)
const icoEntry = Buffer.alloc(16)
icoEntry[0] = 0
icoEntry[1] = 0
icoEntry.writeUInt16LE(1, 4)
icoEntry.writeUInt16LE(32, 6)
icoEntry.writeUInt32LE(icon256.length, 8)
icoEntry.writeUInt32LE(22, 12)
fs.writeFileSync(path.join(outputDir, 'kaligula.ico'), Buffer.concat([icoHeader, icoEntry, icon256]))

console.log('Kaligula icons generated in public/')
