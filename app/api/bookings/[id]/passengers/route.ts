import { NextRequest, NextResponse } from 'next/server'
import { loadBookingWithAllData } from '@/lib/modules/bookings/booking.service'
import { addPassenger, updatePassenger, deletePassenger } from '@/lib/modules/bookings/booking.service'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { passengers } = await loadBookingWithAllData(id)
    return NextResponse.json({ data: passengers })
  } catch (error) {
    console.error('Error loading passengers:', error)
    return NextResponse.json(
      { error: 'Failed to load passengers' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const passengerData = await request.json()
    const result = await addPassenger(Number(id), passengerData)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error adding passenger:', error)
    return NextResponse.json(
      { error: 'Failed to add passenger' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest
) {
  try {
    const { passengerId, ...passengerData } = await request.json()
    const result = await updatePassenger(passengerId, passengerData)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error updating passenger:', error)
    return NextResponse.json(
      { error: 'Failed to update passenger' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest
) {
  try {
    const { searchParams } = new URL(request.url)
    const passengerId = searchParams.get('passengerId')

    if (!passengerId) {
      return NextResponse.json(
        { error: 'Passenger ID required' },
        { status: 400 }
      )
    }

    const result = await deletePassenger(Number(passengerId))
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error deleting passenger:', error)
    return NextResponse.json(
      { error: 'Failed to delete passenger' },
      { status: 500 }
    )
  }
}
