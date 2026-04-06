import { NextRequest, NextResponse } from 'next/server'
import { fetchBookings } from '@/lib/modules/bookings/booking.service'

export async function GET() {
  try {
    const bookings = await fetchBookings()
    return NextResponse.json({ data: bookings })
  } catch (error) {
    console.error('Error fetching bookings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch bookings' },
      { status: 500 }
    )
  }
}