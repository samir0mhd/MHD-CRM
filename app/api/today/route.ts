import { NextResponse } from 'next/server'
import { getTodayData } from '@/lib/modules/today/today.service'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await getTodayData()
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    })
  } catch (error) {
    console.error('Error loading today data:', error)
    return NextResponse.json({ error: 'Failed to load today data' }, { status: 500 })
  }
}
