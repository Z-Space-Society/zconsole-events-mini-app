import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useEvents } from './useEvents'
import { EventDetail } from './EventDetail'
import { IconBookmark, IconCalendar, IconList } from './ui'
import type { EventsOutletContext } from './types'

export function EventsApp() {
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

  const navClass = ({ isActive }: { isActive: boolean }) => `navbtn${isActive ? ' is-on' : ''}`

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
            <section className="screen is-active">
              {loading ? (
                <div className="ev-loading">Loading events…</div>
              ) : (
                <Outlet
                  context={{ events, onOpen: openDetail, onToggleSave: toggleSave } satisfies EventsOutletContext}
                />
              )}
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
            <NavLink to="/" end className={navClass}>
              <IconList />
              Upcoming
            </NavLink>
            <NavLink to="/month" className={navClass}>
              <IconCalendar />
              This month
            </NavLink>
            <NavLink to="/saved" className={navClass}>
              <IconBookmark />
              Saved
            </NavLink>
          </nav>
        </div>
      </div>
    </div>
  )
}
