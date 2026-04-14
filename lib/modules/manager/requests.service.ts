import * as repo from './requests.repository'

export type PendingRequest = {
  id: string                       // 'claim-{n}' | 'flag-{n}'
  type: 'share_request' | 'repeat_client_flag'
  booking_id: number
  booking_reference: string
  client_name: string
  requester: string                // claimant name / handling staff name
  submitted_at: string
  summary: string
}

export async function getPendingManagerRequests(): Promise<PendingRequest[]> {
  const [claims, flags] = await Promise.all([
    repo.getPendingClaims(),
    repo.getPendingRepeatFlags(),
  ])

  const claimRequests: PendingRequest[] = claims.map(c => ({
    id: `claim-${c.id}`,
    type: 'share_request',
    booking_id: c.booking_id,
    booking_reference: c.bookings?.booking_reference ?? '—',
    client_name: c.bookings?.deals?.clients
      ? `${c.bookings.deals.clients.first_name} ${c.bookings.deals.clients.last_name}`
      : '—',
    requester: c.claimant?.name ?? 'Unknown',
    submitted_at: c.created_at,
    summary: c.reason,
  }))

  const flagRequests: PendingRequest[] = flags.map(f => ({
    id: `flag-${f.id}`,
    type: 'repeat_client_flag',
    booking_id: f.booking_id,
    booking_reference: f.bookings?.booking_reference ?? '—',
    client_name: f.bookings?.deals?.clients
      ? `${f.bookings.deals.clients.first_name} ${f.bookings.deals.clients.last_name}`
      : '—',
    requester: f.handling_staff?.name ?? 'Unknown',
    submitted_at: f.flagged_at,
    summary: f.original_staff?.name
      ? `Original owner: ${f.original_staff.name}`
      : 'Repeat client — no original owner on record',
  }))

  return [...claimRequests, ...flagRequests].sort(
    (a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
  )
}
