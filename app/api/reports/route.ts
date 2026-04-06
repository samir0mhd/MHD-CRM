import { NextRequest, NextResponse } from 'next/server'
import * as reportsService from '@/lib/modules/reports/reports.service'

export async function GET(request: NextRequest) {
  try {
    const yearParam = request.nextUrl.searchParams.get('year')
    const year = yearParam ? Number(yearParam) : new Date().getFullYear()
    const data = await reportsService.getReportData(year)
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error loading report overview:', error)
    return NextResponse.json({ error: 'Failed to load report overview' }, { status: 500 })
  }
}
