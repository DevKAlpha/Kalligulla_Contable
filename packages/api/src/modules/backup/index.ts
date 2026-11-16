import type { Database } from '@kaligula/db'
import { backupRoutes, createDrizzleSnapshotStore } from './backup'

export function createBackupModule(db: Database, clock: () => Date) {
  return backupRoutes(createDrizzleSnapshotStore(db), clock)
}
