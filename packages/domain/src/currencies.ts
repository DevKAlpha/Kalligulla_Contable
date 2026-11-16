/** Foreign currencies shown against the Colombian peso. Add a code here to track another one. */
export const FX_WATCHLIST = [
  { code: 'USD', name: 'Dólar estadounidense', symbol: 'US$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'KRW', name: 'Won surcoreano', symbol: '₩' },
] as const

export type FxCurrency = (typeof FX_WATCHLIST)[number]['code']
export const FX_CODES = FX_WATCHLIST.map((currency) => currency.code) as unknown as readonly [FxCurrency, ...FxCurrency[]]
