import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocalFirstAuth } from '../../hooks/useLocalFirstAuth'
import type { EventItem } from './types'

/**
 * Loads events from the API (with the current user's saved flag), exposes an
 * optimistic save toggle, and refetches when the feed re-syncs.
 */
export function useEvents(notify: (msg: string) => void) {
  const { user, getProfileJwt, setIsOnboardingModalOpen } = useLocalFirstAuth()
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)

  const did = user?.did

  const refetch = useCallback(async () => {
    try {
      const qs = did ? `?did=${encodeURIComponent(did)}` : ''
      const res = await fetch(`/api/events${qs}`)
      if (!res.ok) throw new Error(`events ${res.status}`)
      const data = (await res.json()) as { events: EventItem[] }
      setEvents(data.events)
    } catch (err) {
      console.error('Failed to load events:', err)
    } finally {
      setLoading(false)
    }
  }, [did])

  // Re-fetch when auth (did) changes so the saved flag reflects the user.
  useEffect(() => {
    refetch()
  }, [refetch])

  // Refetch when the feed re-syncs upstream.
  const refetchRef = useRef(refetch)
  refetchRef.current = refetch
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/ws`)
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'events-synced') {
          refetchRef.current()
        }
      } catch {
        /* ignore malformed frames */
      }
    }
    ws.onerror = () => {}
    return () => ws.close()
  }, [])

  // ---- optimistic actions -------------------------------------------------

  const patch = useCallback((uid: string, fn: (e: EventItem) => EventItem) => {
    setEvents((prev) => prev.map((e) => (e.uid === uid ? fn(e) : e)))
  }, [])

  const toggleSave = useCallback(
    async (uid: string) => {
      const jwt = await getProfileJwt()
      if (!jwt) {
        setIsOnboardingModalOpen(true)
        return
      }
      const current = events.find((e) => e.uid === uid)
      if (!current) return
      const on = !current.saved
      patch(uid, (e) => ({ ...e, saved: on }))
      notify(on ? 'Saved to your list' : 'Removed from saved')
      try {
        const res = await fetch(`/api/events/${on ? 'save' : 'unsave'}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profileJwt: jwt, uid }),
        })
        if (!res.ok) throw new Error('save failed')
      } catch {
        patch(uid, (e) => ({ ...e, saved: !on }))
        notify('Something went wrong')
      }
    },
    [events, getProfileJwt, notify, patch, setIsOnboardingModalOpen]
  )

  return { events, loading, refetch, toggleSave }
}
