import * as repo from './deal.repository'
import { buildFieldAuditEntries, logAuditEntries } from '@/lib/audit'
import { isManager, type StaffUser } from '@/lib/access'
import { replaceBookingCommissions, insertRepeatFlag } from '@/lib/modules/bookings/booking.repository'

export type CelebrationMilestone = {
  tier: 'bronze' | 'silver' | 'gold'
  label: string
  color: string
  target: number
  bonus: number
  reachedTotal: number
}

export type ExistingBookingResult = {
  alreadyBooked: true
  bookingReference: string
}

export type CreatedBookingResult = {
  bookingRef: string
  value: number
  profit: number
  clientName: string
  hotel: string
  consultantName: string | null
  milestone: CelebrationMilestone | null
}

export type MarkBookedResult = ExistingBookingResult | CreatedBookingResult

const PROFIT_TIERS = [
  { tier: 'gold', label: 'Gold Target Hit', color: '#f59e0b', targetKey: 'profit_target_gold', bonusKey: 'bonus_gold' },
  { tier: 'silver', label: 'Silver Target Hit', color: '#cbd5e1', targetKey: 'profit_target_silver', bonusKey: 'bonus_silver' },
  { tier: 'bronze', label: 'Bronze Target Hit', color: '#cd7f32', targetKey: 'profit_target_bronze', bonusKey: 'bonus_bronze' },
] as const

const BOOKING_TASKS = [
  { key: 'deposit_received', name: 'Deposit received', category: 'Financial', sort: 1 },
  { key: 'balance_due_set', name: 'Balance due date set', category: 'Financial', sort: 2 },
  { key: 'balance_received', name: 'Balance received', category: 'Financial', sort: 3 },
  { key: 'final_costing', name: 'Final costing confirmed', category: 'Financial', sort: 4 },
  { key: 'flights_ticketed', name: 'Flights ticketed', category: 'Flights', sort: 5 },
  { key: 'etickets_sent', name: 'E-tickets sent to client', category: 'Flights', sort: 6 },
  { key: 'hotel_confirmation', name: 'Hotel confirmation received', category: 'Accommodation', sort: 7 },
  { key: 'special_requests', name: 'Special requests confirmed', category: 'Accommodation', sort: 8 },
  { key: 'transfer_confirmation', name: 'Transfers confirmed', category: 'Transfers', sort: 9 },
  { key: 'booking_confirmation', name: 'Booking confirmation sent', category: 'Documents', sort: 10 },
  { key: 'travel_docs', name: 'Travel documents issued', category: 'Documents', sort: 11 },
  { key: 'atol_certificate', name: 'ATOL certificate issued', category: 'Documents', sort: 12 },
  { key: 'predeparture_call', name: 'Pre-departure contact made', category: 'Pre-Departure', sort: 13 },
  { key: 'review_requested', name: 'Post-trip review requested', category: 'Post-Trip', sort: 14 },
  { key: 'rebook_conversation', name: 'Re-book conversation started', category: 'Post-Trip', sort: 15 },
] as const

export function bestQuoteProfit(quotes: repo.Quote[] | undefined): number {
  if (!quotes || quotes.length === 0) return 0
  const sentQuotes = quotes
    .filter(quote => quote.sent_to_client)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  const bestQuote = sentQuotes[0] || [...quotes].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
  return Number(bestQuote?.profit || 0)
}

export async function resolveCelebrationMilestone(staffId: number | null, addedProfit: number): Promise<CelebrationMilestone | null> {
  if (!staffId || addedProfit <= 0) return null

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

  const targetRow = await repo.getMonthlyTargets(now.getMonth() + 1, now.getFullYear())
  if (!targetRow) return null

  const monthlyBookings = await repo.getConfirmedBookingsWithQuotes(staffId, monthStart.toISOString(), monthEnd.toISOString())
  const currentProfit = monthlyBookings.reduce((sum, booking) => {
    return sum + bestQuoteProfit(booking.deals?.quotes)
  }, 0)

  const reachedTotal = currentProfit + addedProfit

  for (const tier of PROFIT_TIERS) {
    const target = Number(targetRow[tier.targetKey] || 0)
    if (!target) continue
    if (currentProfit < target && reachedTotal >= target) {
      return {
        tier: tier.tier,
        label: tier.label,
        color: tier.color,
        target,
        bonus: Number(targetRow[tier.bonusKey] || 0),
        reachedTotal,
      }
    }
  }

  return null
}

export async function fetchDeals() {
  return repo.getAllDeals()
}

export async function fetchPipelineDeals() {
  return repo.getActivePipelineDeals()
}

export async function searchPipelineClients(query: string) {
  if (!query.trim()) return []
  return repo.searchClients(query.trim())
}

export async function fetchDealById(id: number | string) {
  return repo.getDealById(id)
}

export async function reopenDeal(deal: { id: number; title: string }) {
  await repo.updateDeal(deal.id, { stage: 'NEW_LEAD', lost_reason: null })
  await repo.insertActivity({ deal_id: deal.id, activity_type: 'STAGE_CHANGE', notes: 'Deal reopened — moved back to New Lead' })
}

export async function changeStage(dealId: number, newStage: string) {
  await repo.updateDeal(dealId, { stage: newStage })
  await repo.insertActivity({ deal_id: dealId, activity_type: 'STAGE_CHANGE', notes: `Moved to ${newStage}` })
}

export async function logActivity(dealId: number, activityType: string, notes: string) {
  await repo.insertActivity({ deal_id: dealId, activity_type: activityType, notes })
}

export async function saveNextAction(dealId: number, nextActivityType: string | null, nextActivityAt: string | null) {
  await repo.updateDeal(dealId, {
    next_activity_type: nextActivityType || null,
    next_activity_at: nextActivityAt ? new Date(nextActivityAt).toISOString() : null,
  })
}

export async function markQuoteSent(deal: { id: number; stage: string | undefined }, quoteId: number) {
  await repo.updateQuoteSent(quoteId)
  await repo.insertActivity({ deal_id: deal.id, activity_type: 'QUOTE_SENT', notes: 'Quote sent to client' })

  // Auto-create follow-up sequences (Day 2, 5, 10)
  const existingSequences = await repo.getFollowUpSequencesByDeal(deal.id)
  if (!existingSequences || existingSequences.length === 0) {
    const now = new Date()
    const sequences = [2, 5, 10].map(day => {
      const scheduled = new Date(now)
      scheduled.setDate(scheduled.getDate() + day)
      scheduled.setHours(9, 0, 0, 0)
      return { deal_id: deal.id, sequence_day: day, status: 'pending', scheduled_for: scheduled.toISOString() }
    })
    await repo.insertFollowUpSequences(sequences)
  }

  if (deal.stage === 'NEW_LEAD') {
    await repo.updateDeal(deal.id, { stage: 'QUOTE_SENT' })
    await repo.insertActivity({ deal_id: deal.id, activity_type: 'STAGE_CHANGE', notes: 'Moved to Quote Sent' })
  }
}

export async function deleteQuote(dealId: number, quoteId: number) {
  await repo.deleteQuote(quoteId)
  await repo.insertActivity({ deal_id: dealId, activity_type: 'QUOTE_CREATED', notes: `Quote #${quoteId} deleted` })
}

export function isExistingBookingResult(result: MarkBookedResult): result is ExistingBookingResult {
  return 'alreadyBooked' in result
}

export async function markBooked(
  deal: repo.Deal,
  staffUsers: StaffUser[],
  currentStaff: StaffUser | null = null,
): Promise<MarkBookedResult> {
  const existing = await repo.getBookingsByDealId(deal.id)
  if (existing.length > 0) {
    return { alreadyBooked: true, bookingReference: existing[0].booking_reference }
  }

  const { data: seqData, error: seqError } = await repo.executeNextBookingRef()
  if (seqError) throw new Error(seqError.message || 'Failed to generate booking reference')

  const bookingRef = seqData || `${133610 + Math.floor(Math.random() * 100)}`
  let balanceDueDate = null
  if (deal.departure_date) {
    const dep = new Date(deal.departure_date)
    balanceDueDate = new Date(dep.getTime() - 84 * 86400000).toISOString().split('T')[0]
  }

  const topQuote = (deal.quotes || []).sort((a, b) => (b.profit || 0) - (a.profit || 0))[0]
  const consultantId = deal.staff_id || deal.clients?.owner_staff_id || currentStaff?.id || null
  const milestone = await resolveCelebrationMilestone(consultantId, Number(topQuote?.profit || 0))

  const { data: booking, error: bookingError } = await repo.insertBooking({
    deal_id: deal.id,
    booking_reference: bookingRef,
    departure_date: deal.departure_date,
    status: 'CONFIRMED',
    balance_due_date: balanceDueDate,
    deposit_received: false,
    staff_id: consultantId,
  })
  if (bookingError || !booking) throw new Error(bookingError?.message || 'Failed to create booking')

  if (consultantId) {
    await replaceBookingCommissions(booking.id, [{
      booking_id: booking.id,
      staff_id: consultantId,
      share_percent: 100,
      is_primary: true,
    }])
  }

  // Auto-detect repeat client: flag if the client has an existing owner and the
  // booking is assigned to a different consultant. No ownership change is made —
  // this only creates a flag for manager review.
  const clientOwnerId = deal.clients?.owner_staff_id ?? null
  if (
    deal.clients?.id &&
    clientOwnerId !== null &&
    consultantId !== null &&
    consultantId !== clientOwnerId
  ) {
    await insertRepeatFlag({
      client_id: deal.clients.id,
      booking_id: booking.id,
      original_staff_id: clientOwnerId,
      handling_staff_id: consultantId,
    })
  }

  await repo.insertBookingTasks(BOOKING_TASKS.map(t => ({
    booking_id: booking.id,
    task_name: t.name,
    task_key: t.key,
    category: t.category,
    sort_order: t.sort,
    is_done: false,
  })))

  if (deal.clients) {
    const c = deal.clients
    await repo.insertBookingPassenger({
      booking_id: booking.id,
      title: 'Mr/Mrs',
      first_name: c.first_name,
      last_name: c.last_name,
      date_of_birth: c.date_of_birth || null,
      passenger_type: 'Adult',
      is_lead: true,
    })
  }

  await repo.updateDeal(deal.id, { stage: 'BOOKED' })
  await repo.insertActivity({ deal_id: deal.id, activity_type: 'BOOKING_CREATED', notes: `Booking confirmed — Ref: ${bookingRef}` })

  const clientName = deal.clients ? `${deal.clients.first_name} ${deal.clients.last_name}` : deal.title
  const topHotel = topQuote?.hotel || ''
  const consultantName = staffUsers.find(staff => staff.id === consultantId)?.name || null

  return {
    bookingRef,
    value: deal.deal_value || 0,
    profit: topQuote?.profit || 0,
    clientName,
    hotel: topHotel,
    consultantName,
    milestone,
  }
}

export async function markLost(dealId: number, lostReason: string) {
  await repo.updateDeal(dealId, { stage: 'LOST', lost_reason: lostReason.trim() })
  await repo.insertActivity({ deal_id: dealId, activity_type: 'STAGE_CHANGE', notes: `Deal lost — ${lostReason.trim()}` })
}

export async function saveOwnership(
  deal: repo.Deal,
  currentStaff: StaffUser | null,
  nextStaffId: number,
  bookingTargets: { id: number; staff_id: number | null }[] = [],
  client?: { id?: number; owner_staff_id?: number | null },
) {
  if (!deal || !currentStaff || !isManager(currentStaff)) {
    throw new Error('Unauthorized to reassign ownership')
  }

  const auditEntries = [
    ...(client && client.id
      ? buildFieldAuditEntries({
          entityType: 'client',
          entityId: client.id,
          performedBy: currentStaff,
          action: 'ownership_reassigned',
          before: { owner_staff_id: client.owner_staff_id ?? null },
          after: { owner_staff_id: nextStaffId },
          fields: ['owner_staff_id'],
          notes: `Ownership reassigned from deal ${deal.id}`,
        })
      : []),
    ...buildFieldAuditEntries({
      entityType: 'deal',
      entityId: deal.id,
      performedBy: currentStaff,
      action: 'ownership_reassigned',
      before: { staff_id: deal.staff_id ?? null },
      after: { staff_id: nextStaffId },
      fields: ['staff_id'],
      notes: 'Deal ownership realigned',
    }),
    ...bookingTargets.flatMap(booking =>
      buildFieldAuditEntries({
        entityType: 'booking',
        entityId: booking.id,
        performedBy: currentStaff,
        action: 'ownership_reassigned',
        before: { staff_id: booking.staff_id ?? null },
        after: { staff_id: nextStaffId },
        fields: ['staff_id'],
        notes: `Inherited from deal ${deal.id}`,
      })
    ),
  ]

  if (auditEntries.length === 0) {
    return { updated: false }
  }

  if (client && client.id && client.owner_staff_id !== nextStaffId) {
    const { error } = await repo.updateClientOwner(client.id, nextStaffId)
    if (error) throw new Error(error.message || 'Failed update client owner')
  }

  if (deal.staff_id !== nextStaffId) {
    const { error } = await repo.updateDeal(deal.id, { staff_id: nextStaffId })
    if (error) throw new Error(error.message || 'Failed update deal owner')
  }

  if (bookingTargets.length > 0) {
    const { error } = await repo.updateBookingStaff(bookingTargets.map(b => b.id), nextStaffId)
    if (error) throw new Error(error.message || 'Failed update booking owner')
  }

  await logAuditEntries(auditEntries)

  return { updated: true }
}

// ── PIPELINE MANAGEMENT ────────────────────────────────────
export type DealSignals = {
  daysUntilDeparture: number | null
  isOverdue: boolean
  overdueBy: number
  daysUntilActivity: number | null
  temp: 'hot' | 'warm' | 'cold' | 'frozen'
  valueTier: null | 'whale' | 'high'
}

export function calculateDealSignals(deal: repo.Deal, renderTime: number = Date.now()): DealSignals {
  let daysUntilDeparture: number | null = null
  if (deal.departure_date) {
    daysUntilDeparture = Math.ceil(
      (new Date(deal.departure_date + 'T12:00').getTime() - renderTime) / 86400000
    )
  }

  let isOverdue = false, overdueBy = 0, daysUntilActivity: number | null = null
  if (deal.next_activity_at) {
    const diff = (new Date(deal.next_activity_at).getTime() - renderTime) / 86400000
    if (diff < 0) { isOverdue = true; overdueBy = Math.floor(Math.abs(diff)) }
    else daysUntilActivity = Math.ceil(diff)
  }

  let temp: 'hot' | 'warm' | 'cold' | 'frozen'
  if (overdueBy >= 7) {
    temp = 'frozen'
  } else if (overdueBy >= 3 || !deal.next_activity_at) {
    temp = 'cold'
  } else if (
    (daysUntilDeparture !== null && daysUntilDeparture <= 45) ||
    (isOverdue && overdueBy <= 2) ||
    (daysUntilActivity !== null && daysUntilActivity <= 1)
  ) {
    temp = 'hot'
  } else if (
    (daysUntilDeparture !== null && daysUntilDeparture <= 120) ||
    (daysUntilActivity !== null && daysUntilActivity <= 7)
  ) {
    temp = 'warm'
  } else {
    temp = 'cold'
  }

  let valueTier: null | 'whale' | 'high' = null
  if (deal.deal_value >= 8000) valueTier = 'whale'
  else if (deal.deal_value >= 4000) valueTier = 'high'

  return { daysUntilDeparture, isOverdue, overdueBy, daysUntilActivity, temp, valueTier }
}

export function isRottenDeal(deal: repo.Deal, renderTime: number = Date.now()): boolean {
  if (!deal.next_activity_at) return false
  return (renderTime - new Date(deal.next_activity_at).getTime()) / 86400000 >= 5
}

export async function moveDealToStage(dealId: number, newStage: string, stageLabel: string): Promise<{ success: boolean }> {
  const deal = await repo.getDealById(dealId)
  if (!deal || deal.stage === newStage) return { success: false }

  await repo.updateDeal(dealId, { stage: newStage })
  await repo.insertActivity({
    deal_id: dealId,
    activity_type: 'STAGE_CHANGE',
    notes: `Moved to ${stageLabel}`,
  })

  return { success: true }
}

export async function snoozeDealForDays(dealId: number, days: number): Promise<{ success: boolean }> {
  const now = new Date()
  now.setDate(now.getDate() + days)
  const iso = now.toISOString()

  await repo.updateDeal(dealId, { next_activity_at: iso })

  return { success: true }
}

export function formatCurrency(amount: number): string {
  return '£' + (amount || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })
}

export type CreatePipelineDealInput = {
  selectedClientId?: number | null
  title: string
  dealValue?: string
  departureDate?: string
  source: string
  stage: string
  adults: string
  children: string
  travelType: string
  budgetConf: string
  newFirst?: string
  newLast?: string
  newEmail?: string
  newPhone?: string
}

export async function createPipelineDeal(input: CreatePipelineDealInput, currentStaff: StaffUser | null) {
  if (!input.title.trim()) {
    throw new Error('Deal title is required')
  }

  if (!input.selectedClientId && !input.newFirst?.trim()) {
    throw new Error('Client first name is required')
  }

  let clientId: number
  // The new deal is always owned by the logged-in user.
  // client.owner_staff_id records the client's CRM owner, which is a separate concept
  // and must not overwrite the deal's staff assignment.
  const ownerStaffId: number | null = currentStaff?.id ?? null

  if (input.selectedClientId) {
    const selectedClient = await repo.getClientLookup(input.selectedClientId)
    if (!selectedClient) {
      throw new Error('Selected client not found')
    }
    clientId = selectedClient.id
  } else {
    const { data: newClient, error: clientError } = await repo.insertClient({
      first_name: input.newFirst?.trim() || '',
      last_name: input.newLast?.trim() || '',
      email: input.newEmail?.trim() || '',
      phone: input.newPhone?.trim() || '',
      owner_staff_id: ownerStaffId,
    })

    if (clientError || !newClient) {
      throw new Error(clientError?.message || 'Failed to create client')
    }

    clientId = newClient.id
  }

  const { data: newDeal, error: dealError } = await repo.insertDeal({
    title: input.title.trim(),
    client_id: clientId,
    staff_id: ownerStaffId,
    stage: input.stage,
    deal_value: input.dealValue ? parseFloat(input.dealValue) : null,
    departure_date: input.departureDate || null,
    source: input.source,
  })

  if (dealError || !newDeal) {
    throw new Error(dealError?.message || 'Failed to create deal')
  }

  const qualParts = [
    `Adults: ${input.adults}`,
    parseInt(input.children) > 0 ? `Children: ${input.children}` : null,
    input.travelType ? `Type: ${input.travelType}` : null,
    `Budget: ${input.budgetConf}`,
  ].filter(Boolean)

  if (qualParts.length) {
    await repo.insertActivity({
      deal_id: newDeal.id,
      activity_type: 'NOTE',
      notes: `Qualification — ${qualParts.join(' · ')}`,
    })
  }

  return { id: newDeal.id }
}
