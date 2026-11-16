import { profileInputSchema, type ProfileDto } from '@kaligula/contracts'
import { profiles, type Database } from '@kaligula/db'
import { normalizeProfile } from '@kaligula/domain'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { readJson, type AppEnv } from '../../shared/http'

/** Port */
export interface ProfileRepository {
  get(owner: string): Promise<ProfileDto>
  save(owner: string, profile: ProfileDto, now: Date): Promise<void>
}

/** Drizzle adapter */
export function createProfileRepository(db: Database): ProfileRepository {
  return {
    async get(owner) {
      const [row] = await db.select({ name: profiles.name }).from(profiles).where(eq(profiles.ownerId, owner))
      return { name: row?.name ?? '' }
    },
    async save(owner, profile, now) {
      await db.insert(profiles)
        .values({ ownerId: owner, name: profile.name, createdAt: now, updatedAt: now })
        .onConflictDoUpdate({ target: profiles.ownerId, set: { name: profile.name, updatedAt: now } })
    },
  }
}

/** HTTP */
export function profileRoutes(repository: ProfileRepository, clock: () => Date) {
  return new Hono<AppEnv>()
    .get('/', async (c) => c.json(await repository.get(c.var.owner)))
    .put('/', async (c) => {
      const profile = normalizeProfile(await readJson(c, profileInputSchema))
      await repository.save(c.var.owner, profile, clock())
      return c.json(profile)
    })
}
