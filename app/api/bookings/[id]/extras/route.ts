import { NextRequest, NextResponse } from 'next/server'
import { createExtra, deleteExtraEntry, updateExtraEntry } from '@/lib/modules/bookings/booking.service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const values = await request.json()
    const result = await createExtra(Number(id), values)
    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  } catch (error) {
    console.error('Error creating extra:', error)
    return NextResponse.json({ error: 'Failed to create extra' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest
) {
  try {
    const { extraId, ...values } = await request.json()
    const result = await updateExtraEntry(Number(extraId), values)
    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  } catch (error) {
    console.error('Error updating extra:', error)
    return NextResponse.json({ error: 'Failed to update extra' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest
) {
  try {
    const { searchParams } = new URL(request.url)
    const extraId = Number(searchParams.get('extraId'))
    if (!extraId) {
      return NextResponse.json({ error: 'extraId is required' }, { status: 400 })
    }

    const result = await deleteExtraEntry(extraId)
    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  } catch (error) {
    console.error('Error deleting extra:', error)
    return NextResponse.json({ error: 'Failed to delete extra' }, { status: 500 })
  }
}
