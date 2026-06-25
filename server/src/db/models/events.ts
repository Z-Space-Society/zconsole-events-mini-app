/**
 * Event model - sync from the external Z-Space feed.
 */

import { eq, asc, sql } from 'drizzle-orm'
import type { Database } from '../client.js'
import { events, appMeta, type Event } from '../schema.js'

// Re-export types
export type { Event }

/** Upstream events feed. */
export const EXTERNAL_EVENTS_URL = 'https://zeevents.z-space.workers.dev/events'
/** Don't re-fetch the upstream more than once per this window. */
const SYNC_TTL_MS = 5 * 60 * 1000

/** Shape of a single record from the upstream feed. */
interface ExternalEvent {
  summary?: string
  uid?: string
  start?: { date?: string }
  end?: { date?: string }
  location?: string
  description?: string
  geo?: string
  organizer?: { name?: string; email?: string }
  status?: string
}

// ---------------------------------------------------------------------------
// app_meta helpers
// ---------------------------------------------------------------------------

async function getMeta(db: Database, key: string): Promise<string | undefined> {
  const [row] = await db.select().from(appMeta).where(eq(appMeta.key, key)).limit(1)
  return row?.value ?? undefined
}

async function setMeta(db: Database, key: string, value: string): Promise<void> {
  await db
    .insert(appMeta)
    .values({ key, value })
    .onConflictDoUpdate({ target: appMeta.key, set: { value: sql`excluded.value` } })
}

// ---------------------------------------------------------------------------
// sync
// ---------------------------------------------------------------------------

async function sha256(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function parseLumaUrl(description?: string): string | null {
  if (!description) return null
  const match = description.match(/https:\/\/luma\.com\/[A-Za-z0-9]+/)
  return match ? match[0] : null
}

function toDate(iso?: string): Date | null {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Fetch the upstream feed at most once per TTL. Only upserts when the upstream
 * payload hash changed, and only touches individual rows whose content changed.
 * Returns true when D1 event rows actually changed.
 */
export async function syncEventsIfStale(db: Database): Promise<boolean> {
  const lastSyncedAt = Number(await getMeta(db, 'events_synced_at')) || 0
  if (Date.now() - lastSyncedAt < SYNC_TTL_MS) {
    return false
  }

  let raw: string
  try {
    const res = await fetch(EXTERNAL_EVENTS_URL, { headers: { accept: 'application/json' } })
    if (!res.ok) throw new Error(`upstream ${res.status}`)
    raw = await res.text()
  } catch (err) {
    console.error('Event sync fetch failed:', err)
    return false
  }

  // Mark synced regardless so we honour the TTL even on no-op fetches.
  await setMeta(db, 'events_synced_at', String(Date.now()))

  const hash = await sha256(raw)
  if (hash === (await getMeta(db, 'events_hash'))) {
    return false
  }

  let parsed: ExternalEvent[]
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    console.error('Event sync parse failed:', err)
    return false
  }

  for (const ext of parsed) {
    if (!ext.uid || !ext.summary) continue
    const startsAt = toDate(ext.start?.date)
    if (!startsAt) continue

    const row = {
      uid: ext.uid,
      summary: ext.summary,
      description: ext.description ?? null,
      startsAt,
      endsAt: toDate(ext.end?.date),
      location: ext.location ?? null,
      geo: ext.geo ?? null,
      organizerName: ext.organizer?.name ?? null,
      organizerEmail: ext.organizer?.email ?? null,
      lumaUrl: parseLumaUrl(ext.description),
      status: ext.status ?? null,
    }
    const contentHash = await sha256(JSON.stringify(row))

    await db
      .insert(events)
      .values({ ...row, contentHash, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: events.uid,
        // Only write when the per-event content actually changed.
        setWhere: sql`${events.contentHash} is null or ${events.contentHash} != ${contentHash}`,
        set: {
          summary: sql`excluded.summary`,
          description: sql`excluded.description`,
          startsAt: sql`excluded.starts_at`,
          endsAt: sql`excluded.ends_at`,
          location: sql`excluded.location`,
          geo: sql`excluded.geo`,
          organizerName: sql`excluded.organizer_name`,
          organizerEmail: sql`excluded.organizer_email`,
          lumaUrl: sql`excluded.luma_url`,
          status: sql`excluded.status`,
          contentHash: sql`excluded.content_hash`,
          updatedAt: sql`excluded.updated_at`,
        },
      })
  }

  await setMeta(db, 'events_hash', hash)
  // Upstream payload hash changed → treat as changed (worth notifying clients).
  return true
}

// ---------------------------------------------------------------------------
// manual (admin-added) events
// ---------------------------------------------------------------------------

/** Fields for a manually-added event (e.g. a private Luma event). */
export interface ManualEventInput {
  uid: string
  summary: string
  description: string | null
  startsAt: Date
  endsAt: Date | null
  location: string | null
  geo: string | null
  organizerName: string | null
  lumaUrl: string | null
  status: string | null
}

/**
 * Insert or update a manually-added event. Keyed on uid (the Luma event api id),
 * so re-adding the same URL updates the existing row instead of duplicating.
 */
export async function addManualEvent(db: Database, input: ManualEventInput): Promise<Event> {
  const row = {
    uid: input.uid,
    summary: input.summary,
    description: input.description,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    location: input.location,
    geo: input.geo,
    organizerName: input.organizerName,
    organizerEmail: null,
    lumaUrl: input.lumaUrl,
    status: input.status,
    source: 'manual' as const,
  }
  const contentHash = await sha256(JSON.stringify(row))

  const [event] = await db
    .insert(events)
    .values({ ...row, contentHash, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: events.uid,
      set: {
        summary: sql`excluded.summary`,
        description: sql`excluded.description`,
        startsAt: sql`excluded.starts_at`,
        endsAt: sql`excluded.ends_at`,
        location: sql`excluded.location`,
        geo: sql`excluded.geo`,
        organizerName: sql`excluded.organizer_name`,
        lumaUrl: sql`excluded.luma_url`,
        status: sql`excluded.status`,
        source: sql`excluded.source`,
        contentHash: sql`excluded.content_hash`,
        updatedAt: sql`excluded.updated_at`,
      },
    })
    .returning()

  return event
}

/**
 * Delete a manually-added event by uid. Only removes rows where source = 'manual'
 * so feed-synced events can never be deleted. Returns true when a row was removed.
 */
export async function deleteManualEvent(db: Database, uid: string): Promise<boolean> {
  const deleted = await db
    .delete(events)
    .where(sql`${events.uid} = ${uid} and ${events.source} = 'manual'`)
    .returning({ uid: events.uid })
  return deleted.length > 0
}

// ---------------------------------------------------------------------------
// queries
// ---------------------------------------------------------------------------

/** Return all events ordered by start time. */
export async function getEvents(db: Database): Promise<Event[]> {
  return db.select().from(events).orderBy(asc(events.startsAt))
}
