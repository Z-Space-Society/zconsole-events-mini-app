import type { EventItem } from './types'
import { nowParts, partsOf, rangeText, venueLabel } from './utils'

interface Props {
  events: EventItem[]
  onOpen: (uid: string) => void
}

export function SavedScreen({ events, onOpen }: Props) {
  const now = nowParts()
  const todayKey = now.key

  const saved = events
    .filter((e) => e.saved && partsOf(e.startsAt).key >= todayKey)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))

  const todayItems = saved.filter((e) => partsOf(e.startsAt).key === todayKey)
  const laterItems = saved.filter((e) => partsOf(e.startsAt).key > todayKey)

  return (
    <>
      <div className="screen-head">
        <div className="eyebrow">Your list</div>
        <h1 className="screen-title">Saved</h1>
        <div className="screen-sub">
          {saved.length
            ? `${saved.length} ${saved.length === 1 ? 'event' : 'events'} you're tracking`
            : ''}
        </div>
      </div>

      {saved.length === 0 ? (
        <div className="empty">
          <div className="e-mark">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 4h12a1 1 0 011 1v15l-7-4-7 4V5a1 1 0 011-1z" />
            </svg>
          </div>
          <p>Nothing saved yet. Tap the bookmark on any event to keep it here.</p>
        </div>
      ) : (
        <>
          {todayItems.length > 0 && (
            <>
              <div className="group-label">Today</div>
              {todayItems.map((e) => (
                <SavedCard key={e.uid} event={e} onOpen={onOpen} now={now} />
              ))}
            </>
          )}
          {laterItems.length > 0 && (
            <>
              <div className="group-label">Coming up</div>
              {laterItems.map((e) => (
                <SavedCard key={e.uid} event={e} onOpen={onOpen} now={now} />
              ))}
            </>
          )}
        </>
      )}
    </>
  )
}

function SavedCard({
  event,
  onOpen,
  now,
}: {
  event: EventItem
  onOpen: (uid: string) => void
  now: ReturnType<typeof nowParts>
}) {
  const sp = partsOf(event.startsAt)
  const endMinutes = event.endsAt ? partsOf(event.endsAt).minutes : sp.minutes
  const past = sp.key === now.key && endMinutes <= now.minutes

  return (
    <div className={`scard${past ? ' past' : ''}`} onClick={() => onOpen(event.uid)}>
      <div className="when">
        <div className="w-day">{sp.dowShort}</div>
        <div className="w-num">{sp.d}</div>
        <div className="w-mon">{sp.monShort}</div>
      </div>
      <div className="sbody">
        <div className="where-label" style={{ marginBottom: 6 }}>
          {rangeText(event.startsAt, event.endsAt)}
        </div>
        <div className="card-title" style={{ margin: 0, fontSize: 16 }}>
          {event.summary}
        </div>
        <div className="card-meta" style={{ marginTop: 6 }}>
          <span>{venueLabel(event.location)}</span>
        </div>
      </div>
    </div>
  )
}
