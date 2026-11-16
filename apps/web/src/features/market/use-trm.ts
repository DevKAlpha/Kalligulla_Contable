'use client'

import { trmQuoteSchema, type TrmQuote } from '@kaligula/contracts'
import { useEffect, useState } from 'react'

type TrmState = { status: 'loading' } | { status: 'ready'; quote: TrmQuote } | { status: 'error' }

const REFRESH_MS = 30 * 60_000

/** Official TRM from our own API (`/api/market/trm`), refreshed every 30 minutes. */
export function useTrm(): TrmState {
  const [state, setState] = useState<TrmState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const response = await fetch('/api/market/trm', { headers: { accept: 'application/json' } })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const quote = trmQuoteSchema.parse(await response.json())
        if (!cancelled) setState({ status: 'ready', quote })
      } catch {
        if (!cancelled) setState((previous) => (previous.status === 'ready' ? previous : { status: 'error' }))
      }
    }
    void load()
    const timer = window.setInterval(load, REFRESH_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  return state
}
