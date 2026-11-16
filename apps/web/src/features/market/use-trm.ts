'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

const THIRTY_MINUTES = 30 * 60_000

/** Official TRM (published once a day) from our own API, shared by every component that shows it. */
export function useTrm() {
  return useQuery({
    queryKey: ['market', 'trm'],
    queryFn: ({ signal }) => api.trm(signal),
    staleTime: THIRTY_MINUTES,
    refetchInterval: THIRTY_MINUTES,
    retry: 1,
  })
}
