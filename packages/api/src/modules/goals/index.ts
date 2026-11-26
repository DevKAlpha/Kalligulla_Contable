import type { DatabaseHandle } from '@kaligula/db'
import { createDrizzleGoalRepository, createGoalService, goalRoutes } from './goals'

export function createGoalsModule(database: Pick<DatabaseHandle, 'db' | 'tables'>, clock: () => Date) {
  return goalRoutes(createGoalService(createDrizzleGoalRepository(database), clock))
}
