import { NextRequest, NextResponse } from 'next/server'
import { getAccessContext, isManager } from '@/lib/access'
import * as reportsService from '@/lib/modules/reports/reports.service'

// POST /api/reports/commission/sheets
// Issues (or re-issues) a payroll sheet for a staff member + recognition period.
// Manager-only. Snapshots totals at call time.
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ?? undefined
    const { currentStaff } = await getAccessContext(token)

    if (!currentStaff || !isManager(currentStaff)) {
      return NextResponse.json({ error: 'Manager access required' }, { status: 403 })
    }

    const body = await request.json()
    const { period, staffId, totalCommission, manualBonus } = body

    if (!period || !staffId || totalCommission == null) {
      return NextResponse.json(
        { error: 'period, staffId and totalCommission are required' },
        { status: 400 },
      )
    }

    // Validate period format
    if (!/^\d{4}-\d{2}$/.test(period)) {
      return NextResponse.json({ error: 'period must be YYYY-MM' }, { status: 400 })
    }

    const sheet = await reportsService.issuePayrollSheet({
      period,
      staffId: Number(staffId),
      issuedById: currentStaff.id,
      totalCommission: Number(totalCommission),
      manualBonus: Number(manualBonus ?? 0),
    })

    return NextResponse.json({ sheet })
  } catch (error) {
    console.error('Error issuing payroll sheet:', error)
    return NextResponse.json({ error: 'Failed to issue payroll sheet' }, { status: 500 })
  }
}

// GET /api/reports/commission/sheets?period=YYYY-MM[&staffId=N]
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ?? undefined
    const { currentStaff } = await getAccessContext(token)
    if (!currentStaff) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const period = request.nextUrl.searchParams.get('period')
    const staffIdParam = request.nextUrl.searchParams.get('staffId')

    if (!period) {
      return NextResponse.json({ error: 'period is required' }, { status: 400 })
    }

    if (staffIdParam) {
      const sheet = await reportsService.getPayrollSheet(period, Number(staffIdParam))
      return NextResponse.json({ sheet })
    }

    // Managers can see all sheets for a period; staff see only their own
    if (isManager(currentStaff)) {
      const sheets = await reportsService.getPayrollSheetsForPeriod(period)
      return NextResponse.json({ sheets })
    }

    const sheet = await reportsService.getPayrollSheet(period, currentStaff.id)
    return NextResponse.json({ sheet })
  } catch (error) {
    console.error('Error fetching payroll sheets:', error)
    return NextResponse.json({ error: 'Failed to fetch payroll sheets' }, { status: 500 })
  }
}

