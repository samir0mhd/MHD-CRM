import { NextRequest, NextResponse } from 'next/server'
import { addLegToSegment, createFlightSegment, deleteFlightLeg, lookupKnownFlight, updateFlightLeg } from '@/lib/modules/bookings/booking.service'

export async function GET(
  request: NextRequest
) {
  try {
    const flightNumber = new URL(request.url).searchParams.get('flightNumber')
    if (!flightNumber) {
      return NextResponse.json({ error: 'flightNumber is required' }, { status: 400 })
    }

    const data = await lookupKnownFlight(flightNumber)
    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error looking up known flight:', error)
    return NextResponse.json({ error: 'Failed to look up flight' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    if (body.segmentId != null) {
      const result = await addLegToSegment(Number(id), body.segmentId, body.direction, body.leg, body.firstLeg)
      return NextResponse.json(result, { status: result.success ? 200 : 400 })
    }
    const result = await createFlightSegment(Number(id), body)
    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  } catch (error) {
    console.error('Error creating flight segment:', error)
    return NextResponse.json({ error: 'Failed to create flight segment' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { legId, ...values } = await request.json()
    const result = await updateFlightLeg(Number(legId), Number(id), values)
    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  } catch (error) {
    console.error('Error updating flight leg:', error)
    return NextResponse.json({ error: 'Failed to update flight leg' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const legId = Number(searchParams.get('legId'))
    if (!legId) {
      return NextResponse.json({ error: 'legId is required' }, { status: 400 })
    }

    const result = await deleteFlightLeg(legId, Number(id))
    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  } catch (error) {
    console.error('Error deleting flight leg:', error)
    return NextResponse.json({ error: 'Failed to delete flight leg' }, { status: 500 })
  }
}
