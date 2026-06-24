/** Mirrors the server's EventWithMeta (Dates serialized to ISO strings over JSON). */
export interface EventItem {
  uid: string
  summary: string
  description: string | null
  startsAt: string
  endsAt: string | null
  location: string | null
  geo: string | null
  organizerName: string | null
  organizerEmail: string | null
  lumaUrl: string | null
  status: string | null
  saved: boolean
}
