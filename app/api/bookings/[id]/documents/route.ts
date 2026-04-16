import { NextRequest, NextResponse } from 'next/server'
import { loadBookingWithAllData, markDocumentIssued } from '@/lib/modules/bookings/booking.service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { docId } = await request.json()
    const { tasks } = await loadBookingWithAllData(id)
    const result = await markDocumentIssued(docId, tasks)
    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  } catch (error) {
    console.error('Error issuing document task:', error)
    return NextResponse.json({ error: 'Failed to update document task' }, { status: 500 })
  }
}
