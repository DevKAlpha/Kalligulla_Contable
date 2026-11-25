import type { Cell, SheetRows } from '@kaligula/domain'

/*
 * Minimal, dependency-free .xlsx reader: enough for broker statements (values, shared strings, inline strings).
 * Uses only web-standard APIs (DecompressionStream, TextDecoder), so it runs on Node, Bun and browsers.
 * Untrusted input: entry count and decompressed size are capped to stop zip bombs.
 */

export class XlsxError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'XlsxError'
  }
}

export interface XlsxLimits {
  maxEntries: number
  /** Total decompressed bytes allowed for the parts we read. */
  maxBytes: number
}

const DEFAULT_LIMITS: XlsxLimits = { maxEntries: 500, maxBytes: 50 * 1024 * 1024 }

interface ZipEntry {
  name: string
  method: number
  compressedSize: number
  size: number
  offset: number
}

function readEntries(data: Uint8Array, limits: XlsxLimits): Map<string, ZipEntry> {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  // End of central directory: last 22 bytes plus an optional comment of up to 64 KB.
  let end = -1
  for (let at = data.length - 22; at >= Math.max(0, data.length - 22 - 0xffff); at -= 1) {
    if (view.getUint32(at, true) === 0x06054b50) {
      end = at
      break
    }
  }
  if (end === -1) throw new XlsxError('El archivo no es un Excel (.xlsx) válido.')
  const count = view.getUint16(end + 10, true)
  let at = view.getUint32(end + 16, true)
  if (count > limits.maxEntries) throw new XlsxError('El archivo tiene demasiadas partes.')
  const entries = new Map<string, ZipEntry>()
  const decoder = new TextDecoder()
  for (let index = 0; index < count; index += 1) {
    if (at + 46 > data.length || view.getUint32(at, true) !== 0x02014b50) throw new XlsxError('El archivo Excel está dañado.')
    const method = view.getUint16(at + 10, true)
    const compressedSize = view.getUint32(at + 20, true)
    const size = view.getUint32(at + 24, true)
    const nameLength = view.getUint16(at + 28, true)
    const extraLength = view.getUint16(at + 30, true)
    const commentLength = view.getUint16(at + 32, true)
    const offset = view.getUint32(at + 42, true)
    if (compressedSize === 0xffffffff || size === 0xffffffff) throw new XlsxError('Archivo Excel demasiado grande.')
    const name = decoder.decode(data.subarray(at + 46, at + 46 + nameLength))
    entries.set(name.replace(/^\//, ''), { name, method, compressedSize, size, offset })
    at += 46 + nameLength + extraLength + commentLength
  }
  return entries
}

async function inflate(bytes: Uint8Array, budget: { left: number }): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    total += value.byteLength
    budget.left -= value.byteLength
    if (budget.left < 0) {
      await reader.cancel()
      throw new XlsxError('El archivo Excel descomprimido es demasiado grande.')
    }
    chunks.push(value)
  }
  const out = new Uint8Array(total)
  let position = 0
  for (const chunk of chunks) {
    out.set(chunk, position)
    position += chunk.byteLength
  }
  return out
}

async function readText(data: Uint8Array, entry: ZipEntry, budget: { left: number }): Promise<string> {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  if (view.getUint32(entry.offset, true) !== 0x04034b50) throw new XlsxError('El archivo Excel está dañado.')
  const start = entry.offset + 30 + view.getUint16(entry.offset + 26, true) + view.getUint16(entry.offset + 28, true)
  const raw = data.subarray(start, start + entry.compressedSize)
  let bytes: Uint8Array
  if (entry.method === 0) {
    budget.left -= raw.byteLength
    if (budget.left < 0) throw new XlsxError('El archivo Excel descomprimido es demasiado grande.')
    bytes = raw
  } else if (entry.method === 8) {
    bytes = await inflate(raw, budget)
  } else {
    throw new XlsxError('El archivo Excel usa una compresión no soportada.')
  }
  return new TextDecoder().decode(bytes)
}

function decodeXml(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|lt|gt|amp|quot|apos);/gi, (_, entity: string) => {
    const lower = entity.toLowerCase()
    if (lower === 'lt') return '<'
    if (lower === 'gt') return '>'
    if (lower === 'amp') return '&'
    if (lower === 'quot') return '"'
    if (lower === 'apos') return "'"
    const code = lower.startsWith('#x') ? parseInt(lower.slice(2), 16) : parseInt(lower.slice(1), 10)
    return Number.isFinite(code) ? String.fromCodePoint(code) : ''
  })
}

const attribute = (attributes: string, name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(attributes)?.[1]

/** Text of every <t> run inside an element (rich text is split in runs). */
function runs(xml: string): string {
  let result = ''
  for (const match of xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>|<t\b[^>]*\/>/g)) result += decodeXml(match[1] ?? '')
  return result
}

function columnNumber(reference: string): number {
  let column = 0
  for (const char of reference.replace(/\d+/g, '')) column = column * 26 + (char.charCodeAt(0) - 64)
  return column - 1
}

function parseSheet(xml: string, shared: readonly string[]): Cell[][] {
  const rows: Cell[][] = []
  for (const rowMatch of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const rowNumber = Number(attribute(rowMatch[1], 'r')) || rows.length + 1
    const row: Cell[] = []
    for (const cellMatch of (rowMatch[2] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attributes = cellMatch[1]
      const body = cellMatch[2] ?? ''
      const reference = attribute(attributes, 'r')
      const column = reference ? columnNumber(reference) : row.length
      const type = attribute(attributes, 't')
      const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1]
      let value: Cell = null
      if (type === 's') value = raw === undefined ? null : shared[Number(raw)] ?? null
      else if (type === 'inlineStr') value = runs(body)
      else if (type === 'str' || type === 'e') value = raw === undefined ? null : decodeXml(raw)
      else if (type === 'b') value = raw === '1'
      else if (raw !== undefined) {
        const number = Number(raw)
        value = Number.isFinite(number) ? number : decodeXml(raw)
      }
      row[column] = value
    }
    rows[rowNumber - 1] = Array.from(row, (cell) => cell ?? null)
  }
  return Array.from(rows, (row) => row ?? [])
}

/** Reads every worksheet of an .xlsx file as rows of cell values, in workbook order. */
export async function readXlsx(data: Uint8Array, limits: XlsxLimits = DEFAULT_LIMITS): Promise<SheetRows[]> {
  const entries = readEntries(data, limits)
  const budget = { left: limits.maxBytes }
  const text = async (name: string) => {
    const entry = entries.get(name)
    return entry ? readText(data, entry, budget) : null
  }

  const workbook = await text('xl/workbook.xml')
  if (!workbook) throw new XlsxError('El archivo no es un libro de Excel (.xlsx).')
  const rels = (await text('xl/_rels/workbook.xml.rels')) ?? ''
  const targets = new Map<string, string>()
  for (const match of rels.matchAll(/<Relationship\b([^>]*?)\/?>/g)) {
    const id = attribute(match[1], 'Id')
    const target = attribute(match[1], 'Target')
    if (id && target) targets.set(id, target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`)
  }

  const sharedXml = (await text('xl/sharedStrings.xml')) ?? ''
  const shared = [...sharedXml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((match) => runs(match[1]))

  const sheets: SheetRows[] = []
  for (const match of workbook.matchAll(/<sheet\b([^>]*?)\/?>/g)) {
    const name = decodeXml(attribute(match[1], 'name') ?? `Hoja ${sheets.length + 1}`)
    const id = attribute(match[1], 'r:id')
    const path = id ? targets.get(id) : undefined
    const xml = path ? await text(path) : null
    if (xml) sheets.push({ name, rows: parseSheet(xml, shared) })
  }
  if (sheets.length === 0) throw new XlsxError('El libro de Excel no tiene hojas legibles.')
  return sheets
}
