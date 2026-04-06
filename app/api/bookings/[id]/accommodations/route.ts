import { NextRequest, NextResponse } from 'next/server'
import {
  createAccommodation,
  deleteAccommodationEntry,
  updateAccommodationEntry,
  updateAccommodationReservationStatus,
} from '@/lib/modules/bookings/booking.service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { stayOrder, ...values } = await request.json()
    const result = await createAccommodation(Number(id), values, Number(stayOrder))
    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  } catch (error) {
    console.error('Error creating accommodation:', error)
    return NextResponse.json({ error: 'Failed to create accommodation' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest
) {
  try {
    const { accommodationId, action, status, ...values } = await request.json()

    if (action === 'reservation_status') {
      const result = await updateAccommodationReservationStatus(Number(accommodationId), status)
      return NextResponse.json(result, { status: result.success ? 200 : 400 })
    }

    const result = await updateAccommodationEntry(Number(accommodationId), values)
    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  } catch (error) {
    console.error('Error updating accommodation:', error)
    return NextResponse.json({ error: 'Failed to update accommodation' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest
) {
  try {
    const { searchParams } = new URL(request.url)
    const accommodationId = Number(searchParams.get('accommodationId'))
    if (!accommodationId) {
      return NextResponse.json({ error: 'accommodationId is required' }, { status: 400 })
    }

    const result = await deleteAccommodationEntry(accommodationId)
    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  } catch (error) {
    console.error('Error deleting accommodation:', error)
    return NextResponse.json({ error: 'Failed to delete accommodation' }, { status: 500 })
  }
}
