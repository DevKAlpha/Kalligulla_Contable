import type { Database } from '@kaligula/db'
import { createDrizzleGoalRepository, createGoalService, goalRoutes } from './goals'

export function createGoalsModule(db: Database, clock: () => Date) {
  return goalRoutes(createGoalService(createDrizzleGoalRepository(db), clock))
}
