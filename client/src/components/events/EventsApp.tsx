import { useCallback, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useEvents } from './useEvents'
import { EventDetail } from './EventDetail'
import { IconCalendar, IconList } from './ui'
import type { EventsOutletContext } from './types'

export function EventsApp() {
  const [openUid, setOpenUid] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const { events, loading } = useEvents()

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
              {/* <div className="brand-mark" /> */}
              <div className="brand-name">
                z-space <span>· events</span>
              </div>
            </div>

            <nav className="nav">
              <NavLink to="/" end className={navClass}>
                <IconList />
                Upcoming
              </NavLink>
              <NavLink to="/month" className={navClass}>
                <IconCalendar />
                This month
              </NavLink>
            </nav>
          </div>

          <div className="screens">
            <section className="screen is-active">
              {loading ? (
                <div className="ev-loading">Loading events…</div>
              ) : (
                <Outlet
                  context={{ events, onOpen: openDetail } satisfies EventsOutletContext}
                />
              )}
            </section>
          </div>

          <EventDetail
            event={openEvent}
            open={detailOpen}
            onClose={closeDetail}
          />
        </div>
      </div>
    </div>
  )
}
