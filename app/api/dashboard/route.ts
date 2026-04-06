import { NextResponse } from 'next/server'
import { getDashboardData } from '@/lib/modules/dashboard/dashboard.service'

export async function GET() {
  try {
    const result = await getDashboardData()
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error loading dashboard:', error)
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 })
  }
}
