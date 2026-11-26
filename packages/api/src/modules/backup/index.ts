import type { DatabaseHandle } from '@kaligula/db'
import { backupRoutes, createDrizzleSnapshotStore } from './backup'

export function createBackupModule(database: Pick<DatabaseHandle, 'db' | 'tables'>, clock: () => Date) {
  return backupRoutes(createDrizzleSnapshotStore(database), clock)
}
