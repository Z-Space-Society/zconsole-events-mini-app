import { useCallback, useEffect, useRef, useState } from 'react'
import { useEvents } from './useEvents'
import { UpcomingScreen } from './UpcomingScreen'
import { MonthScreen } from './MonthScreen'
import { SavedScreen } from './SavedScreen'
import { EventDetail } from './EventDetail'
import { IconBookmark, IconCalendar, IconList } from './ui'

type Screen = 'feed' | 'month' | 'saved'

export function EventsApp() {
  const [screen, setScreen] = useState<Screen>('feed')
  const [openUid, setOpenUid] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const notify = useCallback((msg: string) => {
    setToastMsg(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastMsg(null), 1900)
  }, [])
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])

  const { events, loading, toggleSave } = useEvents(notify)

  const openEvent = events.find((e) => e.uid === openUid) ?? null

  const openDetail = useCallback((uid: string) => {
    setOpenUid(uid)
    setDetailOpen(true)
  }, [])
  const closeDetail = useCallback(() => setDetailOpen(false), [])

  return (
    <div className="ev-root">
      <div className="device">
        <div className="app">
          <div className="topbar">
            <div className="brand">
              <div className="brand-mark" />
              <div className="brand-name">
                z-space <span>· events</span>
              </div>
            </div>
          </div>

          <div className="screens">
            <section className={`screen${screen === 'feed' ? ' is-active' : ''}`}>
              {loading ? (
                <div className="ev-loading">Loading events…</div>
              ) : (
                <UpcomingScreen events={events} onOpen={openDetail} onToggleSave={toggleSave} />
              )}
            </section>
            <section className={`screen${screen === 'month' ? ' is-active' : ''}`}>
              {!loading && (
                <MonthScreen
                  events={events}
                  onOpen={openDetail}
                  onToggleSave={toggleSave}
                  onGoUpcoming={() => setScreen('feed')}
                />
              )}
            </section>
            <section className={`screen${screen === 'saved' ? ' is-active' : ''}`}>
              {!loading && <SavedScreen events={events} onOpen={openDetail} />}
            </section>
          </div>

          <EventDetail
            event={openEvent}
            open={detailOpen}
            onClose={closeDetail}
            onToggleSave={toggleSave}
          />

          <div className={`toast${toastMsg ? ' show' : ''}`}>{toastMsg}</div>

          <nav className="nav">
            <button className={`navbtn${screen === 'feed' ? ' is-on' : ''}`} onClick={() => setScreen('feed')}>
              <IconList />
              Upcoming
            </button>
            <button className={`navbtn${screen === 'month' ? ' is-on' : ''}`} onClick={() => setScreen('month')}>
              <IconCalendar />
              This month
            </button>
            <button className={`navbtn${screen === 'saved' ? ' is-on' : ''}`} onClick={() => setScreen('saved')}>
              <IconBookmark />
              Saved
            </button>
          </nav>
        </div>
      </div>
    </div>
  )
}
