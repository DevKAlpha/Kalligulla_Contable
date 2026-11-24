'use client'

import type { CategoryDto, GoalInput, MovementDto, MovementInput, MovementPage } from '@kaligula/contracts'
import type { FinanceSnapshot, MovementType } from '@kaligula/domain'
import {
  keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient,
  type InfiniteData, type QueryClient,
} from '@tanstack/react-query'
import { useMemo } from 'react'
import { api } from '@/lib/api-client'

export const queryKeys = {
  profile: ['profile'] as const,
  categories: ['categories'] as const,
  movements: ['movements'] as const,
  overview: ['overview'] as const,
  comparison: ['comparison'] as const,
  goals: ['goals'] as const,
  health: ['health'] as const,
}

export interface MovementFilters {
  types?: readonly MovementType[]
  categoryId?: string
  from?: string
  to?: string
  q?: string
}

/** Everything derived from movements: lists, totals and category usage counts. */
function invalidateLedger(client: QueryClient) {
  return Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.movements }),
    client.invalidateQueries({ queryKey: queryKeys.overview }),
    client.invalidateQueries({ queryKey: queryKeys.comparison }),
    client.invalidateQueries({ queryKey: queryKeys.categories }),
  ])
}

/* ---------- Reads ---------- */

export function useProfile() {
  return useQuery({ queryKey: queryKeys.profile, queryFn: ({ signal }) => api.getProfile(signal) })
}

export function useCategories() {
  return useQuery({ queryKey: queryKeys.categories, queryFn: ({ signal }) => api.listCategories(signal) })
}

/** Categories of one or more types, system ("Otro") last. */
export function useCategoriesOf(types: readonly MovementType[]) {
  const query = useCategories()
  const key = types.join(',')
  const items = useMemo(
    () => (query.data ?? []).filter((category) => types.includes(category.type)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands for `types`
    [query.data, key],
  )
  return { ...query, items }
}

export function useOverview() {
  return useQuery({ queryKey: queryKeys.overview, queryFn: ({ signal }) => api.overview(signal) })
}

/** Two months side by side; keeps showing the previous result while a new pair loads. */
export function useComparison(base: string, target: string) {
  return useQuery({
    queryKey: [...queryKeys.comparison, base, target],
    queryFn: ({ signal }) => api.comparison(base, target, signal),
    placeholderData: keepPreviousData,
  })
}

export function useGoals() {
  return useQuery({ queryKey: queryKeys.goals, queryFn: ({ signal }) => api.listGoals(signal) })
}

export function useHealth() {
  return useQuery({ queryKey: queryKeys.health, queryFn: ({ signal }) => api.health(signal), refetchInterval: 30_000, retry: false })
}

/** Paginated movement list ("Cargar más"). */
export function useMovementPages(filters: MovementFilters, pageSize = 30) {
  const query = useInfiniteQuery({
    queryKey: [...queryKeys.movements, filters, pageSize],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => api.listMovements({
      type: filters.types?.join(','),
      categoryId: filters.categoryId,
      from: filters.from,
      to: filters.to,
      q: filters.q,
      limit: pageSize,
      offset: pageParam,
    }, signal),
    getNextPageParam: (last) => (last.offset + last.items.length < last.total ? last.offset + last.items.length : undefined),
  })
  const items = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data])
  const total = query.data?.pages[0]?.total ?? 0
  return { ...query, items, total }
}

/* ---------- Writes ---------- */

export function useSaveMovement() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: MovementInput }) => (id ? api.updateMovement(id, input) : api.createMovement(input)),
    onSuccess: () => invalidateLedger(client),
  })
}

type MovementPages = InfiniteData<MovementPage, number>

/** Deletes optimistically so the row disappears at once; rolls back if the server refuses. */
export function useDeleteMovement() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (movement: MovementDto) => api.deleteMovement(movement.id),
    onMutate: async (movement) => {
      await client.cancelQueries({ queryKey: queryKeys.movements })
      const previous = client.getQueriesData<MovementPages>({ queryKey: queryKeys.movements })
      client.setQueriesData<MovementPages>({ queryKey: queryKeys.movements }, (data) => {
        if (!data) return data
        const present = data.pages.some((page) => page.items.some((item) => item.id === movement.id))
        if (!present) return data
        return {
          ...data,
          pages: data.pages.map((page) => ({ ...page, total: page.total - 1, items: page.items.filter((item) => item.id !== movement.id) })),
        }
      })
      return { previous }
    },
    onError: (_error, _movement, context) => {
      context?.previous.forEach(([key, data]) => client.setQueryData(key, data))
    },
    onSettled: () => invalidateLedger(client),
  })
}

/**
 * "Undo" for a deletion: recreates the movement with its original id.
 * A plain function (not a hook) because it runs from a toast, after the deleted row has unmounted.
 */
export async function restoreMovement(client: QueryClient, movement: MovementDto): Promise<MovementDto> {
  try {
    return await api.createMovement({
      id: movement.id,
      type: movement.type,
      description: movement.description,
      categoryId: movement.categoryId,
      amountMinor: movement.amountMinor,
      occurredOn: movement.occurredOn,
      note: movement.note,
    })
  } finally {
    await invalidateLedger(client)
  }
}

export function useCreateCategory() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: api.createCategory,
    onSuccess: (category) => {
      client.setQueryData<CategoryDto[]>(queryKeys.categories, (items) => (items ? [...items, category] : items))
      return client.invalidateQueries({ queryKey: queryKeys.categories })
    },
  })
}

export function useRenameCategory() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.renameCategory(id, name),
    onSuccess: () => invalidateLedger(client),
  })
}

export function useDeleteCategory() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteCategory(id),
    onSuccess: () => invalidateLedger(client),
  })
}

export function useSaveGoal() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: GoalInput }) => (id ? api.updateGoal(id, input) : api.createGoal(input)),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.goals }),
  })
}

export function useDeleteGoal() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteGoal(id),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.goals }),
  })
}

export function useSaveProfile() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api.saveProfile(name),
    onSuccess: (profile) => client.setQueryData(queryKeys.profile, profile),
  })
}

export function useRestoreBackup() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (snapshot: FinanceSnapshot) => api.restoreBackup(snapshot),
    onSuccess: () => client.invalidateQueries(),
  })
}
