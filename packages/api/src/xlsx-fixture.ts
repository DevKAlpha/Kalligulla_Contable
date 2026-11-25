import type { Cell } from '@kaligula/domain'

/*
 * Builds small .xlsx files for tests: ZIP container (stored or deflated) with workbook, relationships,
 * shared strings and one worksheet per sheet. Strings go to the shared table; numbers stay numeric.
 */

const encoder = new TextEncoder()
const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const column = (index: number) => {
  let name = ''
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name
  return name
}

async function deflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function zip(files: { name: string; text: string }[], compress: boolean): Promise<Uint8Array> {
  const locals: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const file of files) {
    const name = encoder.encode(file.name)
    const raw = encoder.encode(file.text)
    const data = compress ? await deflateRaw(raw) : raw
    const local = new Uint8Array(30 + name.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(8, compress ? 8 : 0, true)
    lv.setUint32(18, data.length, true)
    lv.setUint32(22, raw.length, true)
    lv.setUint16(26, name.length, true)
    local.set(name, 30)
    const entry = new Uint8Array(46 + name.length)
    const cv = new DataView(entry.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(10, compress ? 8 : 0, true)
    cv.setUint32(20, data.length, true)
    cv.setUint32(24, raw.length, true)
    cv.setUint16(28, name.length, true)
    cv.setUint32(42, offset, true)
    entry.set(name, 46)
    locals.push(local, data)
    central.push(entry)
    offset += local.length + data.length
  }
  const size = central.reduce((total, part) => total + part.length, 0)
  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, files.length, true)
  ev.setUint16(10, files.length, true)
  ev.setUint32(12, size, true)
  ev.setUint32(16, offset, true)
  const parts = [...locals, ...central, end]
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0))
  let at = 0
  for (const part of parts) {
    out.set(part, at)
    at += part.length
  }
  return out
}

export async function buildXlsx(sheets: { name: string; rows: Cell[][] }[], options: { compress?: boolean } = {}): Promise<Uint8Array> {
  const strings: string[] = []
  const indexOf = (text: string) => {
    let at = strings.indexOf(text)
    if (at === -1) at = strings.push(text) - 1
    return at
  }
  const sheetXml = (rows: Cell[][]) => `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((row, r) => `<row r="${r + 1}">${row.map((cell, c) => {
    if (cell === null || cell === '') return ''
    const ref = `${column(c)}${r + 1}`
    if (typeof cell === 'number') return `<c r="${ref}"><v>${cell}</v></c>`
    if (typeof cell === 'boolean') return `<c r="${ref}" t="b"><v>${cell ? 1 : 0}</v></c>`
    return `<c r="${ref}" t="s"><v>${indexOf(cell)}</v></c>`
  }).join('')}</row>`).join('')}</sheetData></worksheet>`
  const worksheets = sheets.map((sheet, index) => ({ name: `xl/worksheets/sheet${index + 1}.xml`, text: sheetXml(sheet.rows) }))
  return zip([
    { name: '[Content_Types].xml', text: '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>' },
    {
      name: 'xl/workbook.xml',
      text: `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((sheet, index) => `<sheet name="${escape(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('')}</sheets></workbook>`,
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      text: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('')}</Relationships>`,
    },
    ...worksheets,
    {
      name: 'xl/sharedStrings.xml',
      text: `<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${strings.map((text) => `<si><t xml:space="preserve">${escape(text)}</t></si>`).join('')}</sst>`,
    },
  ], options.compress ?? true)
}

export const toBase64 = (bytes: Uint8Array) => btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''))

/** XTB-like workbook: Closed Positions, Open Positions (preamble, summary, header, symbol and lot rows), Cash Operations. */
export function xtbWorkbookSheets(account: number, lots: { id: number; ticker: string; name: string; volume: number; open: number; current: number }[], currency = 'USD') {
  const rows: Cell[][] = []
  for (const ticker of [...new Set(lots.map((lot) => lot.ticker))]) {
    const own = lots.filter((lot) => lot.ticker === ticker)
    rows.push(['Investment Plans', own[0].name, ticker, ticker.endsWith('.US') ? 'STC' : 'ETF', '', own.reduce((t, l) => t + l.volume, 0), '', '', '', '', '', '', '', '', ''])
    for (const lot of own) {
      rows.push(['Investment Plans', String(lot.id), ticker, '', 'BUY', lot.volume, lot.volume * lot.current, lot.current, lot.open, '2026-03-02 14:30:00', '', '', '', '', lot.volume * (lot.current - lot.open)])
    }
  }
  return [
    { name: 'Closed Positions', rows: [['Account number', account], ['Closed Positions'], ['Instrument', 'Ticker', 'Type', 'Volume', 'Open Price', 'Open Time (UTC)', 'Close Price', 'Close Time (UTC)', 'Position ID']] },
    {
      name: 'Open Positions',
      rows: [
        ['Account number', account],
        ['Open Positions'],
        ['Data as of report generated', '2026-11-20 09:00:00'],
        ['Product', 'Metric', 'Amount', 'Currency'],
        ['Investment Plans', 'Open position value', 1, currency],
        ['Product', 'Instrument/Position', 'Ticker', 'Category', 'Type', 'Volume', 'Value', 'Current price', 'Open price', 'Open time (UTC)', 'Stop Loss', 'Take Profit', 'Net Profit %', 'Net Profit', 'Gross Profit'],
        ...rows,
      ] as Cell[][],
    },
    { name: 'Cash Operations', rows: [['Account number', account], ['Type', 'Instrument', 'Ticker', 'Time', 'Amount', 'ID']] },
  ]
}
