import { NextRequest, NextResponse } from 'next/server'
import { createTransfer, deleteTransferEntry, updateTransferEntry } from '@/lib/modules/bookings/booking.service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const values = await request.json()
    const result = await createTransfer(Number(id), values)
    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  } catch (error) {
    console.error('Error creating transfer:', error)
    return NextResponse.json({ error: 'Failed to create transfer' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest
) {
  try {
    const { transferId, ...values } = await request.json()
    const result = await updateTransferEntry(Number(transferId), values)
    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  } catch (error) {
    console.error('Error updating transfer:', error)
    return NextResponse.json({ error: 'Failed to update transfer' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest
) {
  try {
    const { searchParams } = new URL(request.url)
    const transferId = Number(searchParams.get('transferId'))
    if (!transferId) {
      return NextResponse.json({ error: 'transferId is required' }, { status: 400 })
    }

    const result = await deleteTransferEntry(transferId)
    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  } catch (error) {
    console.error('Error deleting transfer:', error)
    return NextResponse.json({ error: 'Failed to delete transfer' }, { status: 500 })
  }
}
