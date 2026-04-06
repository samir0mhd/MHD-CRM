import { NextRequest, NextResponse } from 'next/server'
import * as reportsService from '@/lib/modules/reports/reports.service'

export async function GET(request: NextRequest) {
  try {
    const from = request.nextUrl.searchParams.get('from')
    const to = request.nextUrl.searchParams.get('to')

    if (!from || !to) {
      return NextResponse.json({ error: 'from and to are required' }, { status: 400 })
    }

    const data = await reportsService.getQuotesReport(from, to)
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error loading quote report:', error)
    return NextResponse.json({ error: 'Failed to load quote report' }, { status: 500 })
  }
}
