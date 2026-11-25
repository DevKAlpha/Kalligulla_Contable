/*
 * Dependency-free RSS 2.0 / Atom reader. Feeds are untrusted input: everything is reduced to plain
 * text (no HTML ever reaches the client) and only http(s) links are kept.
 */

export interface ParsedEntry {
  title: string
  link: string
  summary: string
  published: string | null
}

const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', uuml: 'ü',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ntilde: 'Ñ', Uuml: 'Ü',
  iquest: '¿', iexcl: '¡', laquo: '«', raquo: '»', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’',
  mdash: '—', ndash: '–', hellip: '…', euro: '€', deg: '°', middot: '·', bull: '•',
}

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const code = entity[1] === 'x' || entity[1] === 'X' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10)
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : ''
    }
    return NAMED[entity] ?? NAMED[entity.toLowerCase()] ?? match
  })
}

/** CDATA, entities and HTML markup (sometimes double-encoded inside descriptions) to plain text. */
export function toPlainText(raw: string): string {
  let text = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  for (let pass = 0; pass < 2; pass += 1) {
    text = decodeEntities(text)
      .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
  }
  return text.replace(/\s+/g, ' ').trim()
}

function element(block: string, name: string): string | null {
  const match = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i').exec(block)
  return match ? match[1] : null
}

function safeLink(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(decodeEntities(value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')).trim())
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

function entryLink(block: string): string | null {
  // Atom: <link rel="alternate" href="..."/> (or a link without rel).
  for (const match of block.matchAll(/<link\b([^>]*?)\/?>/gi)) {
    const attributes = match[1]
    const href = /\bhref="([^"]*)"/i.exec(attributes)?.[1]
    const rel = /\brel="([^"]*)"/i.exec(attributes)?.[1]
    if (href && (!rel || rel === 'alternate')) return safeLink(href)
  }
  const permalink = /<guid\b[^>]*isPermaLink="true"[^>]*>([\s\S]*?)<\/guid>/i.exec(block)?.[1]
  return safeLink(element(block, 'link')) ?? safeLink(permalink)
}

export function parseFeed(xml: string): ParsedEntry[] {
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? []
  const entries: ParsedEntry[] = []
  for (const block of blocks) {
    const title = toPlainText(element(block, 'title') ?? '')
    const link = entryLink(block)
    if (!title || !link) continue
    const summary = toPlainText(element(block, 'description') ?? element(block, 'summary') ?? element(block, 'content') ?? element(block, 'content:encoded') ?? '')
    const published = element(block, 'pubDate') ?? element(block, 'published') ?? element(block, 'dc:date') ?? element(block, 'updated')
    entries.push({ title, link, summary: summary === title ? '' : summary, published: published ? toPlainText(published) : null })
  }
  return entries
}

/** RFC 822 / ISO dates; a date without zone ("2026-11-25 17:40:00") uses the source's offset. */
export function parseFeedDate(raw: string | null, naiveOffset = '+00:00'): Date | null {
  if (!raw) return null
  const text = raw.trim()
  const naive = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)$/.exec(text)
  const time = Date.parse(naive ? `${naive[1]}T${naive[2]}${naiveOffset}` : text)
  return Number.isFinite(time) ? new Date(time) : null
}
