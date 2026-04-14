import { NextRequest, NextResponse } from 'next/server'
import { getAccessContext, isManager } from '@/lib/access'
import * as reportsService from '@/lib/modules/reports/reports.service'

// GET /api/reports/commission/bonus?period=YYYY-MM&staffId=N
// Returns the current bonus event for a staff member + period (if any).
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ?? undefined
    const { currentStaff } = await getAccessContext(token)
    if (!currentStaff) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const period   = request.nextUrl.searchParams.get('period')
    const staffIdParam = request.nextUrl.searchParams.get('staffId')

    if (!period || !staffIdParam) {
      return NextResponse.json({ error: 'period and staffId are required' }, { status: 400 })
    }

    const staffId = Number(staffIdParam)
    // Non-managers can only view their own bonus
    if (!isManager(currentStaff) && currentStaff.id !== staffId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const bonusEvent = await reportsService.getBonusEventForPeriod(staffId, period)
    return NextResponse.json({ bonusEvent })
  } catch (error) {
    console.error('Error fetching bonus event:', error)
    return NextResponse.json({ error: 'Failed to fetch bonus event' }, { status: 500 })
  }
}

// POST /api/reports/commission/bonus
// Computes and upserts the tier bonus for a staff member + period.
// Manager-only. Idempotent — safe to call multiple times.
// Body: { period: 'YYYY-MM', staffId: number }
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ?? undefined
    const { currentStaff } = await getAccessContext(token)

    if (!currentStaff || !isManager(currentStaff)) {
      return NextResponse.json({ error: 'Manager access required' }, { status: 403 })
    }

    const body = await request.json()
    const { period, staffId } = body

    if (!period || !staffId) {
      return NextResponse.json({ error: 'period and staffId are required' }, { status: 400 })
    }

    if (!/^\d{4}-\d{2}$/.test(period)) {
      return NextResponse.json({ error: 'period must be YYYY-MM' }, { status: 400 })
    }

    const bonusEvent = await reportsService.ensureBonusEvent(Number(staffId), period)

    if (!bonusEvent) {
      return NextResponse.json({
        bonusEvent: null,
        message: 'No tier threshold reached for this period — no bonus event created.',
      })
    }

    return NextResponse.json({ bonusEvent })
  } catch (error) {
    console.error('Error computing bonus event:', error)
    return NextResponse.json({ error: 'Failed to compute bonus event' }, { status: 500 })
  }
}
