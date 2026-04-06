import { NextRequest, NextResponse } from 'next/server'
import * as reportsService from '@/lib/modules/reports/reports.service'

export async function GET(request: NextRequest) {
  try {
    const from = request.nextUrl.searchParams.get('from')
    const to = request.nextUrl.searchParams.get('to')

    if (!from || !to) {
      return NextResponse.json({ error: 'from and to are required' }, { status: 400 })
    }

    const data = await reportsService.getSalesReport(from, to)
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error loading sales report:', error)
    return NextResponse.json({ error: 'Failed to load sales report' }, { status: 500 })
  }
}
