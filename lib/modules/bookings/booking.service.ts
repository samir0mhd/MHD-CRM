import * as repo from './booking.repository'
import { buildFieldAuditEntries, logAuditEntries } from '@/lib/audit'
import { dbMutate } from '@/lib/api-client'
import type { StaffUser } from '@/lib/access'

/** Returns 'YYYY-MM' from any ISO timestamp string. */
function toYearMonth(iso: string): string {
  return iso.slice(0, 7)
}

// ── TASK TEMPLATE ─────────────────────────────────────────────
const TASK_TEMPLATE = [
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
]

// ── UTILITY FUNCTIONS ─────────────────────────────────────────
function getFlightDerivedDates(flights: repo.Flight[]) {
  const outbound = flights
    .filter(f => f.direction === 'outbound' && f.departure_date)
    .sort((a, b) => new Date(a.departure_date!).getTime() - new Date(b.departure_date!).getTime())
  const returns = flights
    .filter(f => f.direction === 'return' && (f.arrival_date || f.departure_date))
    .sort((a, b) => {
      const aDate = a.arrival_date || a.departure_date || ''
      const bDate = b.arrival_date || b.departure_date || ''
      return new Date(aDate).getTime() - new Date(bDate).getTime()
    })

  return {
    departure_date: outbound[0]?.departure_date?.split('T')[0],
    return_date: returns[returns.length - 1]?.arrival_date?.split('T')[0] || returns[returns.length - 1]?.departure_date?.split('T')[0],
  }
}

function calculateTaskDerivedDone(tasks: repo.BookingTask[], flights: repo.Flight[], accommodations: repo.Accommodation[], transfers: repo.Transfer[], payments: repo.Payment[], booking: repo.Booking): Record<string, boolean> {
  const totalPaid = payments.reduce((sum, payment) => sum + (payment.amount || 0), 0)
  const totalSell = booking.total_sell || booking.deals?.deal_value || 0

  return {
    deposit_received: totalPaid > 0 || !!booking.deposit_received,
    balance_due_set: !!booking.balance_due_date,
    balance_received: totalSell > 0 ? totalPaid >= totalSell : false,
    final_costing: booking.total_net != null && (booking.final_profit != null || booking.gross_profit != null),
    flights_ticketed: flights.length === 0 || flights.every(flight => !!flight.pnr),
    hotel_confirmation: accommodations.length === 0 || accommodations.every(stay => !!stay.hotel_confirmation || ['confirmed', 'ref_received'].includes(stay.reservation_status)),
    special_requests: accommodations.length === 0 || accommodations.every(stay => !stay.special_requests || ['confirmed', 'ref_received'].includes(stay.reservation_status)),
    transfer_confirmation:
      transfers.length === 0 ||
      transfers.every(transfer => !!transfer.supplier_name && (!!transfer.arrival_flight || !!transfer.departure_flight || !!transfer.inter_hotel_dates || !!transfer.notes)),
  }
}

// ── MAIN SERVICE FUNCTIONS ────────────────────────────────────
export async function fetchBookings() {
  return await repo.getAllBookings()
}

export async function fetchBookingById(id: number | string) {
  return await repo.getBookingById(id)
}

export async function loadBookingWithAllData(id: number | string) {
  return await repo.getBookingWithAllData(id)
}

export async function loadBookingPageData(id: number | string) {
  const [bookingData, hotels, suppliers, commissions] = await Promise.all([
    repo.getBookingWithAllData(id),
    repo.getHotels(),
    repo.getSuppliers(),
    repo.getBookingCommissions(Number(id)),
  ])

  return {
    ...bookingData,
    hotels,
    suppliers,
    commissions,
  }
}

export async function reconcileTasks(booking: repo.Booking, flights: repo.Flight[], accommodations: repo.Accommodation[], transfers: repo.Transfer[], payments: repo.Payment[], existingTasks: repo.BookingTask[]): Promise<repo.BookingTask[]> {
  const templateMap = new Map(TASK_TEMPLATE.map(task => [task.key, task]))
  let nextTasks = existingTasks.filter(
    task =>
      task.task_key.startsWith('ops_request_') ||
      task.task_key.startsWith('cancel_followup_') ||
      templateMap.has(task.task_key)
  )

  const missingTemplates = TASK_TEMPLATE.filter(task => !nextTasks.some(existing => existing.task_key === task.key))
  if (missingTemplates.length > 0) {
    const { data: insertedData } = await repo.insertTasks(missingTemplates.map(task => ({
      booking_id: booking.id,
      task_name: task.name,
      task_key: task.key,
      category: task.category,
      sort_order: task.sort,
      is_done: false,
      completed_at: null,
      notes: null,
      due_date: null,
    })))
    nextTasks = [...nextTasks, ...(Array.isArray(insertedData) ? insertedData as repo.BookingTask[] : [])]
  }

  const derivedDone = calculateTaskDerivedDone(nextTasks, flights, accommodations, transfers, payments, booking)

  const updates = nextTasks.flatMap(task => {
    const template = templateMap.get(task.task_key)
    if (!template) return []
    const desiredDone = Object.prototype.hasOwnProperty.call(derivedDone, task.task_key) ? derivedDone[task.task_key] : task.is_done
    const patch: Partial<repo.BookingTask> & { id?: number } = {}
    if (task.task_name !== template.name) patch.task_name = template.name
    if (task.category !== template.category) patch.category = template.category
    if (task.sort_order !== template.sort) patch.sort_order = template.sort
    if (task.is_done !== desiredDone) {
      patch.status = desiredDone ? 'done' : 'pending'
      patch.is_done = desiredDone
      patch.completed_at = desiredDone ? (task.completed_at || new Date().toISOString()) : null
    }
    return Object.keys(patch).length > 0 ? [{ id: task.id, ...patch }] : []
  })

  if (updates.length > 0) {
    await Promise.all(updates.map(update => {
      const { id, ...patch } = update
      return repo.updateTask(id!, patch)
    }))
    nextTasks = nextTasks.map(task => {
      const update = updates.find(item => item.id === task.id)
      return update ? { ...task, ...update } : task
    })
  }

  return nextTasks.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
}

export async function saveOwnership(booking: repo.Booking, nextStaffId: number, performedBy: StaffUser) {
  const client = booking.deals?.clients
  const auditEntries = [
    ...(client
      ? buildFieldAuditEntries({
          entityType: 'client',
          entityId: client.id,
          performedBy,
          action: 'ownership_reassigned',
          before: { owner_staff_id: client.owner_staff_id ?? null },
          after: { owner_staff_id: nextStaffId },
          fields: ['owner_staff_id'],
          notes: `Ownership reassigned from booking ${booking.id}`,
        })
      : []),
    ...buildFieldAuditEntries({
      entityType: 'deal',
      entityId: booking.deal_id,
      performedBy,
      action: 'ownership_reassigned',
      before: { staff_id: booking.deals?.staff_id ?? null },
      after: { staff_id: nextStaffId },
      fields: ['staff_id'],
      notes: `Realigned from booking ${booking.id}`,
    }),
    ...buildFieldAuditEntries({
      entityType: 'booking',
      entityId: booking.id,
      performedBy,
      action: 'ownership_reassigned',
      before: { staff_id: booking.staff_id ?? null },
      after: { staff_id: nextStaffId },
      fields: ['staff_id'],
      notes: 'Booking consultant updated',
    }),
  ]

  if (auditEntries.length === 0) {
    return { success: false, message: 'Ownership already aligned' }
  }

  try {
    if (client && client.owner_staff_id !== nextStaffId) {
      await repo.updateClientOwner(client.id, nextStaffId)
    }
    if (booking.deals?.staff_id !== nextStaffId) {
      await repo.updateDealStaff(booking.deal_id, nextStaffId)
    }
    if (booking.staff_id !== nextStaffId) {
      await repo.updateBookingStaff(booking.id, nextStaffId)
    }
    await ensureSingleOwnerCommissionPlan(booking.id, nextStaffId)
    await logAuditEntries(auditEntries)
    return { success: true, message: 'Ownership updated ✓' }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Failed to update ownership' }
  }
}

export async function addPassenger(bookingId: number, passengerData: Omit<repo.Passenger, 'id' | 'booking_id'>) {
  if (!passengerData.first_name.trim() || !passengerData.last_name.trim()) {
    return { success: false, message: 'Name required' }
  }

  try {
    const passenger = await repo.insertPassenger({
      booking_id: bookingId,
      ...passengerData,
      first_name: passengerData.first_name.trim(),
      last_name: passengerData.last_name.trim(),
    })

    if (!passenger) {
      return { success: false, message: 'Failed to add passenger' }
    }

    return { success: true, message: 'Passenger added ✓', data: passenger }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Failed to add passenger' }
  }
}

export async function updatePassenger(id: number, passengerData: Partial<repo.Passenger>) {
  try {
    const passenger = await repo.updatePassenger(id, passengerData)
    if (!passenger) {
      return { success: false, message: 'Failed to update passenger' }
    }
    return { success: true, message: 'Passenger updated ✓', data: passenger }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Failed to update passenger' }
  }
}

export async function deletePassenger(id: number) {
  try {
    await repo.deletePassenger(id)
    return { success: true, message: 'Passenger removed' }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Failed to delete passenger' }
  }
}

export async function toggleTask(task: repo.BookingTask, currentStaff: StaffUser | null = null) {
  const newDone = !task.is_done
  const completedAt = newDone ? new Date().toISOString() : null
  const booking = await repo.getBookingById(String(task.booking_id)).catch(() => null)

  // Write identical fields to today.repository.completeBookingTask so the
  // DB trigger (trg_sync_booking_task_done_status) does not override is_done.
  await repo.updateTask(task.id, {
    status: newDone ? 'done' : 'pending',
    is_done: newDone,
    completed_at: completedAt,
  })

  if (!booking?.deal_id) return

  const actor = currentStaff?.name || 'Unknown staff'
  await dbMutate({
    table: 'activities',
    action: 'insert',
    values: {
      deal_id: booking.deal_id,
      activity_type: newDone ? 'TASK_COMPLETED' : 'TASK_REOPENED',
      notes: newDone
        ? `${actor} completed booking task "${task.task_name}" for ${booking.booking_reference}`
        : `${actor} reopened booking task "${task.task_name}" for ${booking.booking_reference}`,
    },
  }).catch(() => null)
}

export async function addOperationalRequest(bookingId: number, requestData: {
  task_name: string
  notes: string
  due_date: string
  category: string
}) {
  if (!requestData.task_name.trim() && !requestData.notes.trim()) {
    return { success: false, message: 'Add the request or reminder first' }
  }
  if (!requestData.due_date) {
    return { success: false, message: 'Choose a due date' }
  }

  try {
    // Get next sort order
    const { tasks } = await repo.getBookingWithAllData(bookingId)
    const nextSort = Math.max(0, ...tasks.map(task => task.sort_order || 0)) + 1

    const task = await repo.insertOperationalTask({
      booking_id: bookingId,
      task_name: requestData.task_name.trim() || requestData.notes.slice(0, 80),
      task_key: `ops_request_${Date.now()}`,
      category: requestData.category,
      sort_order: nextSort,
      is_done: false,
      completed_at: null,
      due_date: requestData.due_date,
      notes: requestData.notes.trim() || null,
    })

    return { success: true, message: 'Request added to Today work ✓', data: task }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Failed to add request' }
  }
}

export async function updateBookingStatus(bookingId: number, status: string) {
  await repo.updateBooking(bookingId, { status })
  return { success: true, message: `Status updated to ${status}` }
}

export async function saveBookingNotes(bookingId: number, notes: { destination?: string | null; booking_notes?: string | null }) {
  await repo.updateBooking(bookingId, notes)
  return { success: true, message: 'Notes saved' }
}

export async function syncDepartureFromFlight(bookingId: number, flights: repo.Flight[]) {
  const dates = getFlightDerivedDates(flights)
  if (!dates.departure_date) return { success: false, message: 'No flight departure date found' }

  await repo.updateBooking(bookingId, { departure_date: dates.departure_date })
  return { success: true, message: 'Departure date synced from flight ✓' }
}

export async function syncReturnFromFlight(bookingId: number, flights: repo.Flight[]) {
  const dates = getFlightDerivedDates(flights)
  if (!dates.return_date) return { success: false, message: 'No flight return date found' }

  await repo.updateBooking(bookingId, { return_date: dates.return_date })
  return { success: true, message: 'Return date synced from flights ✓' }
}

export async function cancelBooking(bookingId: number, cancellationData: {
  type: string
  checklist: Record<string, boolean>
  notes: string | null
  actionedBy: string
  totalPaid: number
}, tasks: repo.BookingTask[]) {
  const today = new Date().toISOString().split('T')[0]
  const pendingFollowUps = Object.entries(cancellationData.checklist)
    .filter(([, done]) => !done)
    .map(([key]) => key)

  const bookingUpdate = {
    booking_status: 'cancelled' as const,
    status: 'CANCELLED' as const,
    cancellation_type: cancellationData.type,
    cancellation_date: today,
    cancellation_actioned_by: cancellationData.actionedBy,
    cancellation_checklist: cancellationData.checklist,
    cancellation_notes: cancellationData.notes,
  }

  await repo.cancelBooking(bookingId, bookingUpdate)

  if (cancellationData.type === 'deposit_only' && cancellationData.totalPaid > 0) {
    await ensureRetainedDepositCancellationRecognition(bookingId, cancellationData.totalPaid, today)
  }

  if (pendingFollowUps.length > 0) {
    const nextSort = Math.max(0, ...tasks.map(task => task.sort_order || 0)) + 1
    await repo.insertCancellationFollowupTasks(pendingFollowUps.map((key, index) => ({
      booking_id: bookingId,
      task_name: `Cancel ${key} with supplier`,
      task_key: `cancel_followup_${key}_${Date.now()}_${index}`,
      category: 'Operations',
      sort_order: nextSort + index,
      is_done: false,
      completed_at: null,
      due_date: today,
      notes: cancellationData.notes ? `Cancellation follow-up: ${cancellationData.notes}` : 'Created from booking cancellation checklist.',
    })))
  }

  // Log audit entry
  await logAuditEntries([{
    entity_type: 'booking',
    entity_id: bookingId,
    action: 'booking_cancelled',
    field_name: 'booking_status',
    old_value: { booking_status: null, status: 'CONFIRMED' }, // Default assumption
    new_value: bookingUpdate,
    performed_by_staff_id: null, // Would need to be passed in
    performed_by_role: null,
    notes: pendingFollowUps.length > 0
      ? `Booking cancelled with ${pendingFollowUps.length} supplier follow-up task${pendingFollowUps.length === 1 ? '' : 's'} created`
      : 'Booking cancelled',
  }])

  return {
    success: true,
    message: pendingFollowUps.length > 0
      ? `Booking cancelled · ${pendingFollowUps.length} follow-up task${pendingFollowUps.length === 1 ? '' : 's'} sent to Today`
      : 'Booking cancelled'
  }
}

export async function lookupKnownFlight(flightNumber: string) {
  if (!flightNumber || flightNumber.length < 4) return null
  return repo.findKnownFlightByNumber(flightNumber.toUpperCase())
}

export async function createFlightSegment(bookingId: number, segment: {
  direction: 'outbound' | 'return'
  pnr?: string
  flight_supplier?: string
  net_cost?: string | number | null
  ticketing_deadline?: string | null
  cabin_class: string
  baggage_notes?: string
  legs: Array<{
    flight_number: string
    airline?: string
    origin?: string
    destination?: string
    terminal?: string
    departure_date?: string
    departure_time?: string
    arrival_time?: string
    next_day?: boolean
    cabin_notes?: string
    ticketing_deadline?: string
    use_segment_deadline?: boolean
  }>
}) {
  if (segment.legs.some(leg => !leg.flight_number.trim())) {
    return { success: false, message: 'All legs need a flight number' }
  }

  const existingLegs = (await repo.getBookingFlights(bookingId)).filter(flight => flight.direction === segment.direction)
  const segmentIds = existingLegs.map(flight => flight.segment_id || 1)
  const nextSegmentId = segmentIds.length ? Math.max(...segmentIds) + 1 : 1
  const rows = segment.legs.map((leg, index) => ({
    booking_id: bookingId,
    direction: segment.direction,
    segment_id: nextSegmentId,
    leg_order: existingLegs.length + index + 1,
    pnr: segment.pnr || null,
    flight_supplier: segment.flight_supplier || null,
    net_cost: index === 0 && segment.net_cost ? Number(segment.net_cost) : null,
    ticketing_deadline: index === 0
      ? (segment.ticketing_deadline || null)
      : (!leg.use_segment_deadline && leg.ticketing_deadline ? leg.ticketing_deadline : null),
    cabin_class: segment.cabin_class,
    baggage_notes: segment.baggage_notes || null,
    flight_number: leg.flight_number,
    airline: leg.airline || null,
    origin: leg.origin || null,
    destination: leg.destination || null,
    terminal: leg.terminal || null,
    departure_date: leg.departure_date || null,
    departure_time: leg.departure_time || null,
    arrival_time: leg.arrival_time || null,
    next_day: !!leg.next_day,
    cabin_notes: leg.cabin_notes || null,
  }))

  try {
    await repo.insertBookingFlights(rows)
    await Promise.all(
      segment.legs
        .filter(leg => leg.flight_number)
        .map(leg =>
          repo.upsertKnownFlight({
            flight_number: leg.flight_number.toUpperCase(),
            airline: leg.airline || null,
            origin: leg.origin || null,
            destination: leg.destination || null,
            departure_time: leg.departure_time || null,
            arrival_time: leg.arrival_time || null,
            next_day: !!leg.next_day,
            updated_at: new Date().toISOString(),
          })
        )
    )
    await syncFlightDates(bookingId)
    return { success: true, message: `${segment.direction === 'outbound' ? 'Outbound' : 'Return'} segment added ✓` }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Failed to save flight segment' }
  }
}

export async function addLegToSegment(
  bookingId: number,
  segmentId: number,
  direction: 'outbound' | 'return',
  leg: {
    flight_number: string
    airline?: string
    origin?: string
    destination?: string
    terminal?: string
    departure_date?: string
    departure_time?: string
    arrival_time?: string
    next_day?: boolean
    cabin_notes?: string
    ticketing_deadline?: string
    use_segment_deadline?: boolean
  },
  firstLeg: { pnr?: string | null; flight_supplier?: string | null; cabin_class: string; baggage_notes?: string | null }
) {
  if (!leg.flight_number?.trim()) {
    return { success: false, message: 'Flight number required' }
  }
  const existingLegs = (await repo.getBookingFlights(bookingId)).filter(f => f.direction === direction)
  const maxLegOrder = existingLegs.length ? Math.max(...existingLegs.map(f => f.leg_order)) : 0
  const row = {
    booking_id: bookingId,
    direction,
    segment_id: segmentId,
    leg_order: maxLegOrder + 1,
    pnr: firstLeg.pnr || null,
    flight_supplier: firstLeg.flight_supplier || null,
    net_cost: null,
    ticketing_deadline: !leg.use_segment_deadline && leg.ticketing_deadline ? leg.ticketing_deadline : null,
    cabin_class: firstLeg.cabin_class,
    baggage_notes: firstLeg.baggage_notes || null,
    flight_number: leg.flight_number.trim(),
    airline: leg.airline || null,
    origin: leg.origin || null,
    destination: leg.destination || null,
    terminal: leg.terminal || null,
    departure_date: leg.departure_date || null,
    departure_time: leg.departure_time || null,
    arrival_time: leg.arrival_time || null,
    next_day: !!leg.next_day,
    cabin_notes: leg.cabin_notes || null,
  }
  try {
    await repo.insertBookingFlights([row])
    if (leg.flight_number) {
      await repo.upsertKnownFlight({
        flight_number: leg.flight_number.toUpperCase(),
        airline: leg.airline || null,
        origin: leg.origin || null,
        destination: leg.destination || null,
        departure_time: leg.departure_time || null,
        arrival_time: leg.arrival_time || null,
        next_day: !!leg.next_day,
        updated_at: new Date().toISOString(),
      })
    }
    await syncFlightDates(bookingId)
    return { success: true, message: 'Connecting leg added ✓' }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Failed to add leg' }
  }
}

export async function updateFlightLeg(id: number, bookingId: number, values: {
  flight_number: string
  airline?: string
  origin?: string
  destination?: string
  departure_date?: string
  departure_time?: string
  arrival_time?: string
  next_day?: boolean
  cabin_class: string
  pnr?: string
  flight_supplier?: string
  net_cost?: string | number | null
  terminal?: string
  ticketing_deadline?: string
  baggage_notes?: string
  cabin_notes?: string
}) {
  try {
    await repo.updateBookingFlight(id, {
      flight_number: values.flight_number,
      airline: values.airline || null,
      origin: values.origin || null,
      destination: values.destination || null,
      departure_date: values.departure_date || null,
      departure_time: values.departure_time || null,
      arrival_time: values.arrival_time || null,
      next_day: !!values.next_day,
      cabin_class: values.cabin_class,
      pnr: values.pnr || null,
      flight_supplier: values.flight_supplier || null,
      net_cost: values.net_cost ? Number(values.net_cost) : null,
      terminal: values.terminal || null,
      ticketing_deadline: values.ticketing_deadline || null,
      baggage_notes: values.baggage_notes || null,
      cabin_notes: values.cabin_notes || null,
    })
    await syncFlightDates(bookingId)
    return { success: true, message: 'Leg updated ✓' }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Failed to update flight leg' }
  }
}

export async function deleteFlightLeg(id: number, bookingId: number) {
  try {
    await repo.deleteBookingFlight(id)
    await syncFlightDates(bookingId)
    return { success: true, message: 'Leg removed' }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Failed to delete flight leg' }
  }
}

export async function createAccommodation(bookingId: number, values: Record<string, unknown>, stayOrder: number) {
  try {
    await repo.insertAccommodation({ booking_id: bookingId, stay_order: stayOrder, ...values })
    return { success: true, message: 'Stay added ✓' }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Failed to add stay' }
  }
}

export async function updateAccommodationEntry(id: number, values: Record<string, unknown>) {
  try {
    await repo.updateAccommodation(id, values)
    return { success: true, message: 'Stay updated ✓' }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Failed to update stay' }
  }
}

export async function updateAccommodationReservationStatus(id: number, status: string) {
  try {
    await repo.updateAccommodation(id, {
      reservation_status: status,
      ...(status === 'sent' ? { reservation_sent_at: new Date().toISOString() } : {}),
    })
    return { success: true, message: 'Status updated' }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Failed to update status' }
  }
}

export async function deleteAccommodationEntry(id: number) {
  try {
    await repo.deleteAccommodation(id)
    return { success: true, message: 'Stay removed' }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Failed to delete stay' }
  }
}

export async function createTransfer(bookingId: number, values: Record<string, unknown>) {
  try {
    await repo.insertTransfer({ booking_id: bookingId, ...values })
    return { success: true, message: 'Transfer added ✓' }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Failed to add transfer' }
  }
}

export async function updateTransferEntry(id: number, values: Record<string, unknown>) {
  try {
    await repo.updateTransfer(id, values)
    return { success: true, message: 'Transfer updated ✓' }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Failed to update transfer' }
  }
}

export async function deleteTransferEntry(id: number) {
  try {
    await repo.deleteTransfer(id)
    return { success: true, message: 'Transfer removed' }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Failed to delete transfer' }
  }
}

export async function createExtra(bookingId: number, values: Record<string, unknown>) {
  try {
    await repo.insertExtra({ booking_id: bookingId, ...values })
    return { success: true, message: 'Extra added ✓' }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Failed to add extra' }
  }
}

export async function updateExtraEntry(id: number, values: Record<string, unknown>) {
  try {
    await repo.updateExtra(id, values)
    return { success: true, message: 'Extra updated ✓' }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Failed to update extra' }
  }
}

export async function deleteExtraEntry(id: number) {
  try {
    await repo.deleteExtra(id)
    return { success: true, message: 'Extra removed' }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Failed to delete extra' }
  }
}

export async function addPaymentToBooking(booking: repo.Booking, paymentData: Record<string, unknown>, currentStaff?: StaffUser | null) {
  try {
    const sell = booking.total_sell || booking.deals?.deal_value || 0
    if (sell > 0) {
      const { payments: existingPayments } = await repo.getBookingWithAllData(booking.id)
      const totalAlreadyPaid = existingPayments.reduce((sum, p) => sum + (p.amount || 0), 0)
      const outstanding = Number((sell - totalAlreadyPaid).toFixed(2))
      const incoming = Number(paymentData.amount) || 0
      if (incoming > outstanding) {
        return {
          success: false,
          message: `Payment of £${incoming.toLocaleString('en-GB', { minimumFractionDigits: 2 })} exceeds outstanding balance of £${outstanding.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`,
        }
      }
    }

    const payment = await repo.insertPayment(paymentData)
    const { payments } = await repo.getBookingWithAllData(booking.id)
    const totalPaid = payments.reduce((sum, entry) => sum + (entry.amount || 0), 0)

    // balance_cleared_at is only set against total_sell (the confirmed costing figure).
    // deal_value is used above for overpayment validation only — it must not trigger
    // commission recognition, which requires real costing to have been pushed.
    const confirmedSell = Number(booking.total_sell || 0)
    const newBalanceClearedAt = confirmedSell > 0 && totalPaid >= confirmedSell
      ? (booking.balance_cleared_at || new Date().toISOString())
      : null
    await repo.updateBooking(booking.id, {
      deposit_received: totalPaid > 0,
      balance_cleared_at: newBalanceClearedAt,
    })

    // When balance first clears, ensure commission is recognised automatically.
    // ensureSingleOwnerCommissionPlan guarantees a commission record exists before
    // ensureCommissionRecognition tries to snapshot allocations.
    // ensureCommissionRecognition uses the current booking_commissions split, so it
    // correctly handles split-claim-approved-before-payment without a separate
    // split_correction pass — that pass only runs from approveOwnershipClaim when
    // a split changes on an already-fully-paid booking.
    if (!booking.balance_cleared_at && newBalanceClearedAt) {
      await ensureSingleOwnerCommissionPlan(booking.id, booking.staff_id ?? null)
      await ensureCommissionRecognition(booking.id)
    }

    await logAuditEntries([{
      entity_type: 'booking',
      entity_id: booking.id,
      action: 'payment_added',
      field_name: 'booking_payments',
      new_value: { payment_id: payment.id, amount: payment.amount, payment_date: payment.payment_date, notes: payment.notes || null },
      performed_by_staff_id: currentStaff?.id ?? null,
      performed_by_role: currentStaff?.role ?? null,
      notes: 'Payment recorded',
    }])

    const refreshed = await repo.getBookingWithAllData(booking.id)
    if (refreshed.booking) {
      await reconcileTasks(
        refreshed.booking,
        refreshed.flights,
        refreshed.accommodations,
        refreshed.transfers,
        refreshed.payments,
        refreshed.tasks
      )
    }

    return { success: true, message: 'Payment recorded ✓' }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Failed to record payment' }
  }
}

export async function markPaymentInvoiceSent(id: number) {
  try {
    await repo.updatePayment(id, { invoice_sent: true, invoice_sent_at: new Date().toISOString() })
    return { success: true, message: 'Invoice marked as sent' }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Failed to update invoice status' }
  }
}

export async function deletePaymentFromBooking(booking: repo.Booking, paymentId: number, currentStaff?: StaffUser | null) {
  try {
    const { payments } = await repo.getBookingWithAllData(booking.id)
    const payment = payments.find(entry => entry.id === paymentId) || null
    await repo.deletePayment(paymentId)
    const { payments: remainingPayments } = await repo.getBookingWithAllData(booking.id)
    const totalPaid = remainingPayments.reduce((sum, entry) => sum + (entry.amount || 0), 0)

    const confirmedSell = Number(booking.total_sell || 0)
    await repo.updateBooking(booking.id, {
      deposit_received: totalPaid > 0,
      balance_cleared_at: confirmedSell > 0 && totalPaid >= confirmedSell
        ? (booking.balance_cleared_at || new Date().toISOString())
        : null,
    })

    await logAuditEntries([{
      entity_type: 'booking',
      entity_id: booking.id,
      action: 'payment_deleted',
      field_name: 'booking_payments',
      old_value: payment,
      performed_by_staff_id: currentStaff?.id ?? null,
      performed_by_role: currentStaff?.role ?? null,
      notes: 'Payment removed',
    }])

    const refreshed = await repo.getBookingWithAllData(booking.id)
    if (refreshed.booking) {
      await reconcileTasks(
        refreshed.booking,
        refreshed.flights,
        refreshed.accommodations,
        refreshed.transfers,
        refreshed.payments,
        refreshed.tasks
      )
    }

    return { success: true, message: 'Payment removed' }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Failed to delete payment' }
  }
}

export async function pushCostingToOverview(booking: repo.Booking, updates: {
  total_sell: number
  total_net: number
  gross_profit: number
  final_profit: number
  cc_surcharge: number
}, currentStaff?: StaffUser | null) {
  try {
    // Recalculate balance_cleared_at against the new total_sell.
    // If the total increased beyond what has been paid, the balance is no longer
    // cleared — this re-opens the balance_received task and the Today balance alert.
    const { payments } = await repo.getBookingWithAllData(booking.id)
    const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0)
    const newSell = updates.total_sell
    const balanceClearedAt = newSell > 0 && totalPaid >= newSell
      ? (booking.balance_cleared_at || new Date().toISOString())
      : null

    await repo.updateBooking(booking.id, {
      total_sell: updates.total_sell,
      total_net: updates.total_net,
      gross_profit: updates.gross_profit,
      final_profit: updates.final_profit,
      cc_surcharge: updates.cc_surcharge,
      balance_cleared_at: balanceClearedAt,
    })
    await logAuditEntries([{
      entity_type: 'booking',
      entity_id: booking.id,
      action: 'commercial_fields_updated',
      field_name: 'gross_profit',
      old_value: {
        total_sell: booking.total_sell,
        total_net: booking.total_net,
        gross_profit: booking.gross_profit,
        final_profit: booking.final_profit,
        cc_surcharge: booking.cc_surcharge,
      },
      new_value: updates,
      performed_by_staff_id: currentStaff?.id ?? null,
      performed_by_role: currentStaff?.role ?? null,
      notes: 'Costing pushed to overview',
    }])

    await recordBookingProfitDeltaEvent(booking.id, updates.final_profit, balanceClearedAt)

    // Ensure a commission plan exists for this booking's owner. Handles cases where
    // the booking was created before the commissions table existed, or where the
    // seed migration assigned the wrong owner.
    await ensureSingleOwnerCommissionPlan(booking.id, booking.staff_id ?? null)

    // Re-run task reconciliation so balance_received reflects the new total_sell.
    const refreshed = await repo.getBookingWithAllData(booking.id)
    if (refreshed.booking) {
      await reconcileTasks(
        refreshed.booking,
        refreshed.flights,
        refreshed.accommodations,
        refreshed.transfers,
        refreshed.payments,
        refreshed.tasks,
      )
    }

    return { success: true, message: 'Total sell, net and gross profit pushed to Overview ✓' }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Failed to push costing' }
  }
}

async function ensureSingleOwnerCommissionPlan(bookingId: number, staffId: number | null) {
  if (!staffId) return

  const existing = await repo.getBookingCommissions(bookingId)
  if (existing.length > 1) return

  if (existing.length === 1) {
    const only = existing[0]
    if (only.staff_id === staffId && Number(only.share_percent) === 100 && only.is_primary) {
      return
    }
  }

  await repo.replaceBookingCommissions(bookingId, [{
    booking_id: bookingId,
    staff_id: staffId,
    share_percent: 100,
    is_primary: true,
  }])
}

async function recordBookingProfitDeltaEvent(
  bookingId: number,
  nextFinalProfit: number | null,
  balanceClearedAt: string | null,
) {
  const nextProfit = Number(nextFinalProfit || 0)
  const events = await repo.getBookingProfitEvents(bookingId)

  // Exclude 'recognition' events from delta accumulation — they are absolute
  // snapshots, not commercial deltas, and must not inflate the running total.
  const commercialEvents = events.filter(
    e => e.type !== 'recognition' && e.type !== 'cancellation_retained_deposit',
  )
  const recordedTotal = commercialEvents.reduce((sum, e) => sum + Number(e.profit_delta || 0), 0)
  const delta = Number((nextProfit - recordedTotal).toFixed(2))

  if (delta === 0) return

  const commissionable = balanceClearedAt !== null
  // recognition_period = the payroll month this event belongs to.
  // For commissionable events: the month balance cleared (or current month if unclear).
  // For non-commissionable events: null — they don't belong to any payroll period yet.
  const recognition_period = commissionable
    ? toYearMonth(balanceClearedAt!)
    : null
  const event = await repo.insertBookingProfitEvent({
    booking_id: bookingId,
    type: commercialEvents.length === 0 ? 'original' : 'amendment',
    profit_delta: delta,
    commissionable,
    recognition_period,
  })

  // Snapshot the current commission split at the moment this profit event is
  // recorded. This preserves historical attribution even if the split changes later.
  const commissions = await repo.getBookingCommissions(bookingId)
  await repo.insertProfitAllocations(
    commissions.map(c => ({
      profit_event_id: event.id,
      staff_id: c.staff_id,
      share_percent: Number(c.share_percent),
      profit_share: Number((delta * Number(c.share_percent) / 100).toFixed(2)),
    }))
  )
}

// Called only when balance_cleared_at first transitions from null → set.
// If costing was already pushed before payment, this creates a commissionable
// 'recognition' event carrying the full current profit as its delta, giving the
// report a correct commissionable baseline without corrupting the commercial delta chain.
async function ensureCommissionRecognition(bookingId: number) {
  const events = await repo.getBookingProfitEvents(bookingId)
  // If a commissionable event already exists, recognition is already covered.
  // e.commissionable may be undefined pre-migration — treat undefined as false.
  if (events.some(e => e.commissionable === true)) return

  const booking = await repo.getBookingById(bookingId)
  const profit = Number(booking?.final_profit || 0)
  // Nothing to recognize if profit is not yet set.
  if (profit === 0) return

  const event = await repo.insertBookingProfitEvent({
    booking_id: bookingId,
    type: 'recognition',
    profit_delta: profit,
    commissionable: true,
    recognition_period: booking?.balance_cleared_at ? toYearMonth(booking.balance_cleared_at) : null,
  })

  const commissions = await repo.getBookingCommissions(bookingId)
  await repo.insertProfitAllocations(
    commissions.map(c => ({
      profit_event_id: event.id,
      staff_id: c.staff_id,
      share_percent: Number(c.share_percent),
      profit_share: Number((profit * Number(c.share_percent) / 100).toFixed(2)),
    }))
  )
}

async function ensureRetainedDepositCancellationRecognition(
  bookingId: number,
  retainedDepositAmount: number,
  cancellationDate: string,
) {
  const retainedDeposit = Number(Number(retainedDepositAmount || 0).toFixed(2))
  if (retainedDeposit <= 0) return

  const booking = await repo.getBookingById(bookingId)
  if (!booking) return
  if (booking.balance_cleared_at) return
  if (booking.cancellation_type !== 'deposit_only') return

  const events = await repo.getBookingProfitEvents(bookingId)
  if (events.some(e => e.type === 'cancellation_retained_deposit' && e.commissionable === true)) {
    return
  }

  await ensureSingleOwnerCommissionPlan(bookingId, booking.staff_id ?? null)

  const event = await repo.insertBookingProfitEvent({
    booking_id: bookingId,
    type: 'cancellation_retained_deposit',
    profit_delta: retainedDeposit,
    commissionable: true,
    recognition_period: toYearMonth(`${cancellationDate}T00:00:00.000Z`),
  })

  const commissions = await repo.getBookingCommissions(bookingId)
  await repo.insertProfitAllocations(
    commissions.map(c => ({
      profit_event_id: event.id,
      staff_id: c.staff_id,
      share_percent: Number(c.share_percent),
      profit_share: Number((retainedDeposit * Number(c.share_percent) / 100).toFixed(2)),
    }))
  )
}

export async function markDocumentIssued(docId: string, tasks: repo.BookingTask[]) {
  const taskKeys = getDocumentTaskKeys(docId)
  if (taskKeys.length === 0) return { success: true, message: 'No task update required' }

  const pendingTasks = tasks.filter(task => taskKeys.includes(task.task_key) && !task.is_done)
  if (pendingTasks.length === 0) return { success: true, message: 'No task update required' }
  const completedAt = new Date().toISOString()

  await Promise.all(
    pendingTasks.map(task =>
      repo.updateTask(task.id, {
        status: 'done',
        is_done: true,
        completed_at: completedAt,
      })
    )
  )

  return { success: true, message: 'Document task updated ✓' }
}

// ── OWNERSHIP CLAIMS ──────────────────────────────────────────

export async function submitOwnershipClaim(bookingId: number, claimantId: number, reason: string) {
  if (reason.trim().length < 20) {
    return { success: false, message: 'Reason must be at least 20 characters' }
  }
  try {
    await repo.insertOwnershipClaim({ booking_id: bookingId, claimant_id: claimantId, reason: reason.trim() })
    return { success: true, message: 'Share request submitted ✓' }
  } catch (error: unknown) {
    if ((error as { code?: string } | null)?.code === '23505') {
      return { success: false, message: 'You already have a pending claim on this booking' }
    }
    return { success: false, message: error instanceof Error ? error.message : 'Failed to submit claim' }
  }
}

export async function approveOwnershipClaim(
  claim: repo.OwnershipClaim,
  booking: repo.Booking,
  claimantSharePercent: number,
  reviewedBy: StaffUser,
  reviewNotes: string,
) {
  if (claimantSharePercent < 1 || claimantSharePercent > 99) {
    return { success: false, message: 'Share must be between 1 and 99%' }
  }
  const primaryShare = Number((100 - claimantSharePercent).toFixed(2))
  const primaryStaffId = booking.staff_id
  if (!primaryStaffId) return { success: false, message: 'Booking has no primary owner' }

  const now = new Date().toISOString()
  try {
    const newCommissions = [
      { booking_id: booking.id, staff_id: primaryStaffId, share_percent: primaryShare, is_primary: true },
      { booking_id: booking.id, staff_id: claim.claimant_id, share_percent: claimantSharePercent, is_primary: false },
    ]
    await repo.replaceBookingCommissions(booking.id, newCommissions)
    
    // If this booking was already fully paid when the split changed, create a
    // split_correction event with allocations that adjust each staff member's
    // net share to match the new commission split. This ensures the report shows
    // the correct allocation regardless of when the claim was approved.
    if (booking.balance_cleared_at) {
      await repo.createSplitCorrectionAllocations(booking.id, [
        { staff_id: primaryStaffId, share_percent: primaryShare },
        { staff_id: claim.claimant_id, share_percent: claimantSharePercent },
      ])
    }
    
    await repo.insertOwnershipHistory({
      booking_id: booking.id,
      changed_by: reviewedBy.id,
      change_type: 'claim_approved',
      previous_primary_staff_id: primaryStaffId,
      new_primary_staff_id: primaryStaffId,
      commission_snapshot: newCommissions.map(c => ({ staff_id: c.staff_id, share_percent: c.share_percent, is_primary: c.is_primary })),
      claim_id: claim.id,
      notes: reviewNotes || `Approved: ${claimantSharePercent}% to claimant`,
    })
    await repo.updateOwnershipClaim(claim.id, {
      status: 'approved',
      reviewed_by: reviewedBy.id,
      review_notes: reviewNotes || null,
      approved_split: claimantSharePercent,
      reviewed_at: now,
    })
    return { success: true, message: 'Claim approved — split updated ✓' }
  } catch (error) {
    // PostgrestError is not an Error subclass — extract its message explicitly
    const msg =
      error instanceof Error
        ? error.message
        : (error as { message?: string })?.message ?? 'Failed to approve claim'
    console.error('[approveOwnershipClaim] error:', error)
    return { success: false, message: msg }
  }
}

function toCommissionSnapshot(
  commissions: { staff_id: number; share_percent: number; is_primary: boolean }[],
) {
  return commissions.map(c => ({
    staff_id: c.staff_id,
    share_percent: c.share_percent,
    is_primary: c.is_primary,
  }))
}

function sameCommissionPlan(
  current: { staff_id: number; share_percent: number; is_primary: boolean }[],
  next: { staff_id: number; share_percent: number; is_primary: boolean }[],
) {
  if (current.length !== next.length) return false

  const normalize = (rows: { staff_id: number; share_percent: number; is_primary: boolean }[]) =>
    [...rows]
      .map(row => ({
        staff_id: row.staff_id,
        share_percent: Number(row.share_percent),
        is_primary: row.is_primary,
      }))
      .sort((a, b) => {
        if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1
        return a.staff_id - b.staff_id
      })

  const currentNormalized = normalize(current)
  const nextNormalized = normalize(next)

  return currentNormalized.every((row, index) => {
    const other = nextNormalized[index]
    return row.staff_id === other.staff_id
      && row.is_primary === other.is_primary
      && Number(row.share_percent.toFixed(2)) === Number(other.share_percent.toFixed(2))
  })
}

/**
 * Manager directly creates a split without requiring a prior claim.
 * Writes booking_commissions, optionally a split_correction event (if already paid),
 * and an audit history entry.
 */
export async function managerDirectShare(
  booking: repo.Booking,
  secondStaffId: number,
  secondStaffShare: number,
  manager: StaffUser,
): Promise<{ success: boolean; message: string }> {
  if (secondStaffShare < 1 || secondStaffShare > 99) {
    return { success: false, message: 'Share must be between 1 and 99%' }
  }
  const primaryStaffId = booking.staff_id
  if (!primaryStaffId) return { success: false, message: 'Booking has no primary owner — assign an owner first' }
  if (secondStaffId === primaryStaffId) return { success: false, message: 'Second staff member must be different from the primary owner' }

  const primaryShare = Number((100 - secondStaffShare).toFixed(2))
  const newCommissions = [
    { booking_id: booking.id, staff_id: primaryStaffId, share_percent: primaryShare, is_primary: true },
    { booking_id: booking.id, staff_id: secondStaffId,  share_percent: secondStaffShare, is_primary: false },
  ]

  try {
    const currentCommissions = await repo.getBookingCommissions(booking.id)
    const existingLiveSplit = currentCommissions.length > 1
    if (sameCommissionPlan(currentCommissions, newCommissions)) {
      return { success: true, message: 'Split already matches the current live ownership ✓' }
    }

    await repo.replaceBookingCommissions(booking.id, newCommissions)

    if (booking.balance_cleared_at) {
      await repo.createSplitCorrectionAllocations(booking.id, [
        { staff_id: primaryStaffId, share_percent: primaryShare },
        { staff_id: secondStaffId,  share_percent: secondStaffShare },
      ])
    }

    await repo.insertOwnershipHistory({
      booking_id: booking.id,
      changed_by: manager.id,
      change_type: existingLiveSplit ? 'manual_split_replaced' : 'manual_split',
      previous_primary_staff_id: primaryStaffId,
      new_primary_staff_id: primaryStaffId,
      commission_snapshot: toCommissionSnapshot(newCommissions),
      claim_id: null,
      notes: existingLiveSplit
        ? `Manager replaced split: ${primaryShare}% primary / ${secondStaffShare}% staff #${secondStaffId}`
        : `Manager created split: ${primaryShare}% primary / ${secondStaffShare}% staff #${secondStaffId}`,
    })

    return {
      success: true,
      message: existingLiveSplit
        ? `Split replaced safely — ${primaryShare}% / ${secondStaffShare}% ✓`
        : `Split saved — ${primaryShare}% / ${secondStaffShare}% ✓`,
    }
  } catch (error) {
    const msg = error instanceof Error
      ? error.message
      : (error as { message?: string })?.message ?? 'Failed to save split'
    console.error('[managerDirectShare] error:', error)
    return { success: false, message: msg }
  }
}

export async function managerUndoShare(
  booking: repo.Booking,
  manager: StaffUser,
): Promise<{ success: boolean; message: string }> {
  const primaryStaffId = booking.staff_id
  if (!primaryStaffId) return { success: false, message: 'Booking has no primary owner — assign an owner first' }

  try {
    const currentCommissions = await repo.getBookingCommissions(booking.id)
    const singleOwnerCommission = [{
      booking_id: booking.id,
      staff_id: primaryStaffId,
      share_percent: 100,
      is_primary: true,
    }]

    if (sameCommissionPlan(currentCommissions, singleOwnerCommission)) {
      return { success: true, message: 'Booking is already on a single-owner commission plan ✓' }
    }

    await repo.replaceBookingCommissions(booking.id, singleOwnerCommission)

    if (booking.balance_cleared_at) {
      await repo.createSplitCorrectionAllocations(booking.id, [
        { staff_id: primaryStaffId, share_percent: 100 },
      ])
    }

    await repo.insertOwnershipHistory({
      booking_id: booking.id,
      changed_by: manager.id,
      change_type: 'manual_unsplit',
      previous_primary_staff_id: primaryStaffId,
      new_primary_staff_id: primaryStaffId,
      commission_snapshot: toCommissionSnapshot(singleOwnerCommission),
      claim_id: null,
      notes: `Manager reverted booking to single owner: staff #${primaryStaffId} at 100%`,
    })

    return { success: true, message: 'Split removed — booking is back to a single owner ✓' }
  } catch (error) {
    const msg = error instanceof Error
      ? error.message
      : (error as { message?: string })?.message ?? 'Failed to undo split'
    console.error('[managerUndoShare] error:', error)
    return { success: false, message: msg }
  }
}

export async function rejectOwnershipClaim(
  claim: repo.OwnershipClaim,
  booking: repo.Booking,
  reviewedBy: StaffUser,
  reviewNotes: string,
) {
  const now = new Date().toISOString()
  try {
    await repo.updateOwnershipClaim(claim.id, {
      status: 'rejected',
      reviewed_by: reviewedBy.id,
      review_notes: reviewNotes || null,
      reviewed_at: now,
    })
    const currentCommissions = await repo.getBookingCommissions(booking.id)
    await repo.insertOwnershipHistory({
      booking_id: booking.id,
      changed_by: reviewedBy.id,
      change_type: 'claim_rejected',
      previous_primary_staff_id: booking.staff_id ?? null,
      new_primary_staff_id: booking.staff_id ?? null,
      commission_snapshot: currentCommissions.map(c => ({ staff_id: c.staff_id, share_percent: c.share_percent, is_primary: c.is_primary })),
      claim_id: claim.id,
      notes: reviewNotes || 'Claim rejected',
    })
    return { success: true, message: 'Claim rejected ✓' }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Failed to reject claim' }
  }
}

// ── REPEAT CLIENT ENFORCEMENT ─────────────────────────────────

export async function enforceRepeatClientRule(
  booking: repo.Booking,
  resolution: 'enforced_50_50' | 'reassigned_to_original' | 'manager_override' | 'dismissed',
  manager: StaffUser,
) {
  const flag = await repo.getUnresolvedRepeatFlag(booking.id)
  if (!flag) return { success: false, message: 'No unresolved repeat-client flag on this booking' }

  try {
    let currentCommissions: { staff_id: number; share_percent: number; is_primary: boolean }[] = []

    if (resolution === 'enforced_50_50' && flag.original_staff_id && flag.handling_staff_id) {
      const rows = [
        { booking_id: booking.id, staff_id: flag.handling_staff_id, share_percent: 50, is_primary: true },
        { booking_id: booking.id, staff_id: flag.original_staff_id, share_percent: 50, is_primary: false },
      ]
      const updated = await repo.replaceBookingCommissions(booking.id, rows)
      currentCommissions = updated.map(c => ({ staff_id: c.staff_id, share_percent: Number(c.share_percent), is_primary: c.is_primary }))
    } else if (resolution === 'reassigned_to_original' && flag.original_staff_id) {
      const rows = [
        { booking_id: booking.id, staff_id: flag.original_staff_id, share_percent: 100, is_primary: true },
      ]
      const updated = await repo.replaceBookingCommissions(booking.id, rows)
      currentCommissions = updated.map(c => ({ staff_id: c.staff_id, share_percent: Number(c.share_percent), is_primary: c.is_primary }))
      await repo.updateBookingStaff(booking.id, flag.original_staff_id)
      if (booking.deal_id) await repo.updateDealStaff(booking.deal_id, flag.original_staff_id)
      if (booking.deals?.clients?.id) await repo.updateClientOwner(booking.deals.clients.id, flag.original_staff_id)
    } else {
      const existing = await repo.getBookingCommissions(booking.id)
      currentCommissions = existing.map(c => ({ staff_id: c.staff_id, share_percent: Number(c.share_percent), is_primary: c.is_primary }))
    }

    await repo.resolveRepeatFlag(booking.id, manager.id, resolution)
    await repo.rejectAllPendingClaims(booking.id, manager.id, `Auto-rejected: repeat-client flag resolved as ${resolution}`)

    await repo.insertOwnershipHistory({
      booking_id: booking.id,
      changed_by: manager.id,
      change_type: 'repeat_client_enforcement',
      previous_primary_staff_id: flag.handling_staff_id ?? null,
      new_primary_staff_id: resolution === 'reassigned_to_original' ? flag.original_staff_id : (flag.handling_staff_id ?? null),
      commission_snapshot: currentCommissions,
      claim_id: null,
      notes: `Repeat-client flag resolved: ${resolution}`,
    })
    return { success: true, message: 'Repeat-client flag resolved ✓' }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Failed to resolve repeat-client flag' }
  }
}

// ── UTILITY FUNCTIONS ─────────────────────────────────────────
export function taskProgress(tasks: repo.BookingTask[]) {
  if (!tasks?.length) return 0
  return Math.round((tasks.filter(t => t.is_done).length / tasks.length) * 100)
}

export function bookingNeedsOwnershipCleanup(booking: repo.Booking) {
  if (booking.status === 'CANCELLED') return false
  const bookingStaffId = booking.staff_id ?? null
  const dealStaffId = booking.deals?.staff_id ?? null
  const clientOwnerId = booking.deals?.clients?.owner_staff_id ?? null
  return !bookingStaffId || bookingStaffId !== dealStaffId || bookingStaffId !== clientOwnerId
}

function getDocumentTaskKeys(docId: string) {
  if (docId === 'invoice_confirmation') return ['booking_confirmation']
  if (docId === 'atol') return ['atol_certificate']
  if (docId === 'itinerary') return ['etickets_sent', 'travel_docs']
  if (docId.startsWith('accom_') && docId.endsWith('_customer')) return ['travel_docs']
  if (docId.startsWith('transfer_')) return ['travel_docs']
  return []
}

async function syncFlightDates(bookingId: number) {
  const flights = await repo.getBookingFlights(bookingId)
  const dates = getFlightDerivedDates(flights)
  await repo.updateBooking(bookingId, {
    departure_date: dates.departure_date ?? null,
    return_date: dates.return_date ?? null,
  })
}
