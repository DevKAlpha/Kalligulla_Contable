import { describe, expect, it } from 'vitest'
import { classifyNews, headlineKey, newsId, summarize } from './news'

describe('classifyNews', () => {
  it('tags currencies from central banks, rates and markets in Spanish and English', () => {
    expect(classifyNews('La Reserva Federal (Fed) podría subir las tasas en diciembre').currencies).toEqual(['USD'])
    expect(classifyNews('El Banco de la República mantuvo su tasa de interés; el peso colombiano se apreció').currencies).toEqual(['COP'])
    expect(classifyNews('ECB keeps rates unchanged as euro area inflation cools')).toMatchObject({ currencies: ['EUR'], topics: expect.arrayContaining(['monetary', 'inflation']) })
    expect(classifyNews('Korean won weakens to 1,450 per dollar as KOSPI slides').currencies).toEqual(['KRW'])
    expect(classifyNews('Dólar en Colombia hoy: la TRM baja por petróleo').currencies).toEqual(['COP', 'USD'])
  })

  it('needs an economic topic before tagging a country', () => {
    expect(classifyNews('FM Cho asks Omani counterpart to keep backing Cheonghae unit, Korea says').relevant).toBe(false)
    expect(classifyNews('South Korea exports rise for a third month on chip demand')).toMatchObject({ currencies: ['KRW'], topics: ['trade'] })
    expect(classifyNews('Selección Colombia gana en Barranquilla').relevant).toBe(false)
    expect(classifyNews('Colombia: déficit fiscal sube al 6 % del PIB')).toMatchObject({ currencies: ['COP'], relevant: true })
  })

  it('does not confuse the verb "won" or compound "dollar" phrases with currencies', () => {
    expect(classifyNews('Team won the final in Seoul').currencies).toEqual([])
    expect(classifyNews('The won fell against the dollar').currencies).toEqual(['USD', 'KRW'])
  })

  it('keeps world context (oil, China, tariffs) as global even with no currency named', () => {
    expect(classifyNews('Oil jumps 4% after OPEC+ surprise cut')).toMatchObject({ currencies: [], global: true, relevant: true })
    expect(classifyNews('UK retailer reports lower profits').relevant).toBe(false)
  })

  it('applies source hints: official releases and economy sections', () => {
    expect(classifyNews('Minutes of the Board discount rate meetings', { currencies: ['USD'], official: true }).currencies).toEqual(['USD'])
    expect(classifyNews('Pensiones: lo que cambia en 2027', { currencies: ['COP'], economyOnly: true })).toMatchObject({ currencies: ['COP'], relevant: true })
    expect(classifyNews('Clínicas recibirían menos recursos', { currencies: ['COP'] }).relevant).toBe(false)
    expect(classifyNews('Trabajo no remunerado representó 24 % del PIB de México', { currencies: ['COP'] })).toMatchObject({ currencies: [], relevant: false })
    expect(classifyNews('Deuda pública de Colombia subió al 62 % del PIB', { currencies: ['COP'] }).currencies).toEqual(['COP'])
    expect(classifyNews('N. Korea closes office over sanctions').currencies).toEqual([])
    expect(classifyNews('Samsung invests 210 mln euros in Austrian chipmaker').currencies).toEqual([])
  })
})

describe('news helpers', () => {
  it('summarizes at a word boundary', () => {
    expect(summarize('  uno   dos tres  ')).toBe('uno dos tres')
    expect(summarize('palabra '.repeat(60), 30)).toBe('palabra palabra palabra…')
  })

  it('identifies a story by its link without tracking parameters', () => {
    expect(newsId('https://www.site.com/a/b?utm_source=x#top')).toBe(newsId('https://site.com/a/b'))
    expect(newsId('https://site.com/a?id=1')).not.toBe(newsId('https://site.com/a?id=2'))
    expect(headlineKey('¡Dólar  sube!')).toBe(headlineKey('dolar sube'))
  })
})
