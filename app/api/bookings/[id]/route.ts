import { NextRequest, NextResponse } from 'next/server'
import { fetchBookingById, loadBookingWithAllData, loadBookingPageData, saveOwnership, saveBookingNotes, syncDepartureFromFlight, syncReturnFromFlight, addOperationalRequest, cancelBooking, pushCostingToOverview } from '@/lib/modules/bookings/booking.service'
import { updateBooking } from '@/lib/modules/bookings/booking.repository'
import { getAccessContext, isManager } from '@/lib/access'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const includeAll = searchParams.get('all') === 'true'

    if (includeAll) {
      const result = await loadBookingPageData(id)
      return NextResponse.json({ data: result })
    } else {
      const booking = await fetchBookingById(id)
      return NextResponse.json({ data: booking })
    }
  } catch (error) {
    console.error('Error fetching booking:', error)
    return NextResponse.json(
      { error: 'Failed to fetch booking' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { action, ...data } = body

    switch (action) {
      case 'update_balance_due': {
        await updateBooking(Number(id), { balance_due_date: data.balance_due_date })
        return NextResponse.json({ success: true, message: 'Balance due date updated ✓' })
      }

      case 'save_notes': {
        const result = await saveBookingNotes(Number(id), data)
        return NextResponse.json(result)
      }

      case 'sync_departure_from_flight': {
        const { flights } = await loadBookingWithAllData(id)
        const result = await syncDepartureFromFlight(Number(id), flights)
        return NextResponse.json(result)
      }

      case 'sync_return_from_flight': {
        const { flights } = await loadBookingWithAllData(id)
        const result = await syncReturnFromFlight(Number(id), flights)
        return NextResponse.json(result)
      }

      case 'save_ownership': {
        const token = request.headers.get('authorization')?.replace('Bearer ', '') ?? null
        const { currentStaff } = await getAccessContext(token)
        if (!currentStaff) {
          return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
        }

        const booking = await fetchBookingById(id)
        if (!booking) {
          return NextResponse.json({ success: false, message: 'Booking not found' }, { status: 404 })
        }

        const result = await saveOwnership(booking, data.staffId, currentStaff)
        return NextResponse.json(result)
      }

      case 'add_operational_request': {
        const result = await addOperationalRequest(Number(id), data)
        return NextResponse.json(result)
      }

      case 'cancel_booking': {
        const { tasks } = await loadBookingWithAllData(id)
        const result = await cancelBooking(Number(id), data, tasks)
        if (result.success) {
          return NextResponse.json(result)
        }
        return NextResponse.json(result, { status: 400 })
      }

      case 'update_cc_surcharge': {
        const booking = await fetchBookingById(id)
        if (!booking) {
          return NextResponse.json({ success: false, message: 'Booking not found' }, { status: 404 })
        }
        if (booking.deposit_received) {
          const token = request.headers.get('authorization')?.replace('Bearer ', '') ?? null
          const { currentStaff } = await getAccessContext(token)
          if (!isManager(currentStaff)) {
            return NextResponse.json({ success: false, message: 'Deposit received — only managers can change commercial fields' }, { status: 403 })
          }
        }
        const result = await updateBooking(Number(id), { cc_surcharge: Number(data.cc_surcharge) || 0 })
        return NextResponse.json({ success: true, message: 'CC surcharge updated ✓', data: result })
      }

      case 'update_discount': {
        const booking = await fetchBookingById(id)
        if (!booking) {
          return NextResponse.json({ success: false, message: 'Booking not found' }, { status: 404 })
        }
        if (booking.deposit_received) {
          const token = request.headers.get('authorization')?.replace('Bearer ', '') ?? null
          const { currentStaff } = await getAccessContext(token)
          if (!isManager(currentStaff)) {
            return NextResponse.json({ success: false, message: 'Deposit received — only managers can change commercial fields' }, { status: 403 })
          }
        }
        const result = await updateBooking(Number(id), { discount: Number(data.discount) || null })
        return NextResponse.json({ success: true, message: 'Discount updated ✓', data: result })
      }

      case 'push_costing': {
        const booking = await fetchBookingById(id)
        if (!booking) {
          return NextResponse.json({ success: false, message: 'Booking not found' }, { status: 404 })
        }
        const token = request.headers.get('authorization')?.replace('Bearer ', '') ?? null
        const { currentStaff } = await getAccessContext(token)
        if (booking.deposit_received && !isManager(currentStaff)) {
          return NextResponse.json({ success: false, message: 'Deposit received — only managers can change commercial fields' }, { status: 403 })
        }
        const result = await pushCostingToOverview(booking, data, currentStaff)
        return NextResponse.json(result, { status: result.success ? 200 : 400 })
      }

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error updating booking:', error)
    return NextResponse.json(
      { error: 'Failed to update booking' },
      { status: 500 }
    )
  }
}
