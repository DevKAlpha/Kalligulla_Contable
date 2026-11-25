import type { NewsSource, NewsSourceConfig } from '../domain/news-source'
import { createRssSource } from './rss-source'

const MINUTE = 60_000

/*
 * Curated sources: central banks first, then established economic outlets for each currency.
 * Feeds checked on 2026-11-25. Banco de la República and the Bank of Korea publish no current RSS,
 * so COP and KRW rely on Colombian and Korean outlets.
 */
export const NEWS_SOURCES: readonly NewsSourceConfig[] = [
  { id: 'fed', name: 'Reserva Federal de EE. UU.', homepage: 'https://www.federalreserve.gov/newsevents/pressreleases.htm', url: 'https://www.federalreserve.gov/feeds/press_monetary.xml', lang: 'en', official: true, currencies: ['USD'], economyOnly: true, refreshMs: 5 * MINUTE },
  { id: 'ecb', name: 'Banco Central Europeo', homepage: 'https://www.ecb.europa.eu/press/html/index.en.html', url: 'https://www.ecb.europa.eu/rss/press.html', lang: 'en', official: true, currencies: ['EUR'], economyOnly: true, refreshMs: 5 * MINUTE },
  { id: 'fxstreet', name: 'FXStreet', homepage: 'https://www.fxstreet.es/news', url: 'https://www.fxstreet.es/rss/news', lang: 'es', official: false, currencies: [], economyOnly: false, refreshMs: 2 * MINUTE },
  { id: 'valora', name: 'Valora Analitik', homepage: 'https://www.valoraanalitik.com', url: 'https://www.valoraanalitik.com/feed/', lang: 'es', official: false, currencies: ['COP'], economyOnly: false, refreshMs: 2 * MINUTE, naiveOffset: '+00:00' },
  { id: 'portafolio', name: 'Portafolio', homepage: 'https://www.portafolio.co/economia', url: 'https://www.portafolio.co/rss/economia.xml', lang: 'es', official: false, currencies: ['COP'], economyOnly: false, refreshMs: 2 * MINUTE },
  { id: 'larepublica', name: 'La República', homepage: 'https://www.larepublica.co', url: 'https://www.larepublica.co/rss', lang: 'es', official: false, currencies: ['COP'], economyOnly: false, refreshMs: 2 * MINUTE },
  { id: 'eltiempo', name: 'El Tiempo', homepage: 'https://www.eltiempo.com/economia', url: 'https://www.eltiempo.com/rss/economia.xml', lang: 'es', official: false, currencies: ['COP'], economyOnly: false, refreshMs: 2 * MINUTE },
  { id: 'bloomberglinea', name: 'Bloomberg Línea', homepage: 'https://www.bloomberglinea.com', url: 'https://www.bloomberglinea.com/arc/outboundfeeds/rss/?outputType=xml', lang: 'es', official: false, currencies: [], economyOnly: false, refreshMs: 5 * MINUTE },
  { id: 'cnbc', name: 'CNBC Economy', homepage: 'https://www.cnbc.com/economy/', url: 'https://www.cnbc.com/id/20910258/device/rss/rss.html', lang: 'en', official: false, currencies: ['USD'], economyOnly: true, refreshMs: 2 * MINUTE },
  { id: 'marketwatch', name: 'MarketWatch', homepage: 'https://www.marketwatch.com', url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories', lang: 'en', official: false, currencies: [], economyOnly: false, refreshMs: 2 * MINUTE },
  { id: 'bbc', name: 'BBC Business', homepage: 'https://www.bbc.com/business', url: 'https://feeds.bbci.co.uk/news/business/rss.xml', lang: 'en', official: false, currencies: [], economyOnly: false, refreshMs: 2 * MINUTE },
  { id: 'yonhap', name: 'Yonhap', homepage: 'https://en.yna.co.kr/economy/index', url: 'https://en.yna.co.kr/RSS/news.xml', lang: 'en', official: false, currencies: ['KRW'], economyOnly: false, refreshMs: 2 * MINUTE },
  { id: 'koreaherald', name: 'The Korea Herald', homepage: 'https://www.koreaherald.com/list.php?ct=020000000000', url: 'https://www.koreaherald.com/rss/newsAll', lang: 'en', official: false, currencies: ['KRW'], economyOnly: false, refreshMs: 3 * MINUTE },
]

export function createDefaultNewsSources(fetcher?: typeof fetch): NewsSource[] {
  return NEWS_SOURCES.map((config) => createRssSource(config, fetcher))
}
