import { NextRequest, NextResponse } from 'next/server'
import { getAccessContext, isManager } from '@/lib/access'
import {
  submitOwnershipClaim,
  approveOwnershipClaim,
  rejectOwnershipClaim,
  enforceRepeatClientRule,
  managerDirectShare,
  managerUndoShare,
} from '@/lib/modules/bookings/booking.service'
import {
  getPendingClaimsForBooking,
  getMyPendingClaim,
  getUnresolvedRepeatFlag,
  getBookingById as fetchBookingById,
} from '@/lib/modules/bookings/booking.repository'

// ── GET: load pending claims + repeat flag for this booking ───
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ?? null
    const { currentStaff } = await getAccessContext(token)
    if (!currentStaff) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const bookingId = Number(id)
    const [pendingClaims, repeatFlag, myPendingClaim] = await Promise.all([
      isManager(currentStaff) ? getPendingClaimsForBooking(bookingId) : Promise.resolve([]),
      isManager(currentStaff) ? getUnresolvedRepeatFlag(bookingId) : Promise.resolve(null),
      !isManager(currentStaff) ? getMyPendingClaim(bookingId, currentStaff.id) : Promise.resolve(null),
    ])

    return NextResponse.json({ pendingClaims, repeatFlag, myPendingClaim })
  } catch (error) {
    console.error('Error loading claims:', error)
    return NextResponse.json({ error: 'Failed to load claims' }, { status: 500 })
  }
}

// ── POST: sales submits a claim ───────────────────────────────
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ?? null
    const { currentStaff } = await getAccessContext(token)
    if (!currentStaff) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
    }
    if (isManager(currentStaff)) {
      return NextResponse.json({ success: false, message: 'Managers use the ownership panel, not claims' }, { status: 400 })
    }

    const { reason } = await request.json()
    const result = await submitOwnershipClaim(Number(id), currentStaff.id, reason)
    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  } catch (error) {
    console.error('Error submitting claim:', error)
    return NextResponse.json({ error: 'Failed to submit claim' }, { status: 500 })
  }
}

// ── PUT: manager approves/rejects a claim or resolves repeat flag ──
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ?? null
    const { currentStaff } = await getAccessContext(token)
    if (!currentStaff || !isManager(currentStaff)) {
      return NextResponse.json({ success: false, message: 'Manager access required' }, { status: 403 })
    }

    const body = await request.json()
    const { action } = body
    const bookingId = Number(id)

    const booking = await fetchBookingById(bookingId)
    if (!booking) {
      return NextResponse.json({ success: false, message: 'Booking not found' }, { status: 404 })
    }

    if (action === 'approve_claim') {
      const claims = await getPendingClaimsForBooking(bookingId)
      const claim = claims.find(c => c.id === body.claimId)
      if (!claim) {
        return NextResponse.json({ success: false, message: 'Claim not found or not pending' }, { status: 404 })
      }
      const result = await approveOwnershipClaim(claim, booking, Number(body.claimantShare), currentStaff, body.reviewNotes || '')
      return NextResponse.json(result, { status: result.success ? 200 : 400 })
    }

    if (action === 'reject_claim') {
      const claims = await getPendingClaimsForBooking(bookingId)
      const claim = claims.find(c => c.id === body.claimId)
      if (!claim) {
        return NextResponse.json({ success: false, message: 'Claim not found or not pending' }, { status: 404 })
      }
      const result = await rejectOwnershipClaim(claim, booking, currentStaff, body.reviewNotes || '')
      return NextResponse.json(result, { status: result.success ? 200 : 400 })
    }

    if (action === 'resolve_repeat_flag') {
      const result = await enforceRepeatClientRule(booking, body.resolution, currentStaff)
      return NextResponse.json(result, { status: result.success ? 200 : 400 })
    }

    if (action === 'manager_direct_share') {
      const { secondStaffId, secondStaffShare } = body
      if (!secondStaffId || !secondStaffShare) {
        return NextResponse.json({ success: false, message: 'secondStaffId and secondStaffShare required' }, { status: 400 })
      }
      const result = await managerDirectShare(booking, Number(secondStaffId), Number(secondStaffShare), currentStaff)
      return NextResponse.json(result, { status: result.success ? 200 : 400 })
    }

    if (action === 'manager_direct_unsplit') {
      const result = await managerUndoShare(booking, currentStaff)
      return NextResponse.json(result, { status: result.success ? 200 : 400 })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('Error processing claim action:', error)
    return NextResponse.json({ error: 'Failed to process action' }, { status: 500 })
  }
}
