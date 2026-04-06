import { NextRequest, NextResponse } from 'next/server'
import * as hotelService from '@/lib/modules/hotels/hotel.service'

export async function GET() {
  try {
    const data = await hotelService.fetchHotelsPageData()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error loading hotels:', error)
    return NextResponse.json({ error: 'Failed to load hotels' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { error } = await hotelService.createHotel(body)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create hotel'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
