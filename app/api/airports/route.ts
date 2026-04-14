import { NextRequest, NextResponse } from 'next/server'
import { getAccessContext } from '@/lib/access'
import * as airportService from '@/lib/modules/airports/airport.service'

function authToken(request: NextRequest) {
  const header = request.headers.get('authorization') || ''
  return header.startsWith('Bearer ') ? header.slice(7) : null
}

export async function GET(request: NextRequest) {
  try {
    const { currentStaff } = await getAccessContext(authToken(request))
    if (!currentStaff) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const airports = await airportService.listAirports()
    return NextResponse.json({ airports })
  } catch (error) {
    console.error('Error loading airports:', error)
    return NextResponse.json({ error: 'Failed to load airports' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { currentStaff } = await getAccessContext(authToken(request))
    if (!currentStaff) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const airport = await airportService.createAirport(body)
    return NextResponse.json({ airport })
  } catch (error) {
    console.error('Error creating airport:', error)
    const message = error instanceof Error ? error.message : 'Failed to create airport'
    const status = message.includes('already exists') ? 409 : message.includes('required') || message.includes('IATA code') ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
