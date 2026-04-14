import { NextRequest, NextResponse } from 'next/server'
import { getDashboardData } from '@/lib/modules/dashboard/dashboard.service'

export async function GET(request: NextRequest) {
  try {
    const staffId = request.nextUrl.searchParams.get('staffId')
    const result = await getDashboardData(staffId ? Number(staffId) : undefined)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error loading dashboard:', error)
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 })
  }
}
