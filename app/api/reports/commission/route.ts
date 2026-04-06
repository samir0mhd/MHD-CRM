import { NextRequest, NextResponse } from 'next/server'
import * as reportsService from '@/lib/modules/reports/reports.service'

export async function GET(request: NextRequest) {
  try {
    const staffId = Number(request.nextUrl.searchParams.get('staffId'))
    const from = request.nextUrl.searchParams.get('from')
    const to = request.nextUrl.searchParams.get('to')

    if (!staffId || !from || !to) {
      return NextResponse.json({ error: 'staffId, from and to are required' }, { status: 400 })
    }

    const data = await reportsService.getCommissionReport(staffId, from, to)
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error loading commission report:', error)
    return NextResponse.json({ error: 'Failed to load commission report' }, { status: 500 })
  }
}
