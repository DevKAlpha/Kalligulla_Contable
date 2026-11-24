'use client'

import type { AssetClass } from '@kaligula/domain'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

/** Best performers of the last 30 days for one asset class. The server caches each ranking for 10–15 minutes. */
export function useMovers(assetClass: AssetClass) {
  return useQuery({
    queryKey: ['market', 'movers', assetClass],
    queryFn: ({ signal }) => api.movers(assetClass, signal),
    staleTime: 5 * 60_000,
    refetchInterval: 15 * 60_000,
  })
}
