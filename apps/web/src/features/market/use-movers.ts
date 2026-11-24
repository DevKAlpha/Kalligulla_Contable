'use client'

import type { AssetClass } from '@kaligula/domain'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

/**
 * Best performers of the last 30 days for one asset class.
 * Live sources (Alpaca) are refreshed every minute; the others every 15 minutes, matching the server cache.
 */
export function useMovers(assetClass: AssetClass) {
  return useQuery({
    queryKey: ['market', 'movers', assetClass],
    queryFn: ({ signal }) => api.movers(assetClass, signal),
    staleTime: 60_000,
    refetchInterval: (query) => (query.state.data?.source.realtime ? 60_000 : 15 * 60_000),
  })
}
