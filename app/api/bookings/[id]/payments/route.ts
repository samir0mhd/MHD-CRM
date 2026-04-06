import { NextRequest, NextResponse } from 'next/server'
import { addPaymentToBooking, deletePaymentFromBooking, fetchBookingById, markPaymentInvoiceSent } from '@/lib/modules/bookings/booking.service'
import { getAccessContext } from '@/lib/access'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const booking = await fetchBookingById(id)
    if (!booking) {
      return NextResponse.json({ success: false, message: 'Booking not found' }, { status: 404 })
    }

    const token = request.headers.get('authorization')?.replace('Bearer ', '') ?? null
    const { currentStaff } = await getAccessContext(token)
    const values = await request.json()
    const result = await addPaymentToBooking(booking, { booking_id: booking.id, ...values }, currentStaff)
    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  } catch (error) {
    console.error('Error creating payment:', error)
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest
) {
  try {
    const { paymentId } = await request.json()
    const result = await markPaymentInvoiceSent(Number(paymentId))
    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  } catch (error) {
    console.error('Error updating payment:', error)
    return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const booking = await fetchBookingById(id)
    if (!booking) {
      return NextResponse.json({ success: false, message: 'Booking not found' }, { status: 404 })
    }

    const token = request.headers.get('authorization')?.replace('Bearer ', '') ?? null
    const { currentStaff } = await getAccessContext(token)
    const { searchParams } = new URL(request.url)
    const paymentId = Number(searchParams.get('paymentId'))
    if (!paymentId) {
      return NextResponse.json({ error: 'paymentId is required' }, { status: 400 })
    }

    const result = await deletePaymentFromBooking(booking, paymentId, currentStaff)
    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  } catch (error) {
    console.error('Error deleting payment:', error)
    return NextResponse.json({ error: 'Failed to delete payment' }, { status: 500 })
  }
}
