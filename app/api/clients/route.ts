import { NextRequest, NextResponse } from 'next/server'
import { getAllClients, createClientWithAudit } from '@/lib/modules/clients/client.service'
import { type CreateClientData } from '@/lib/modules/clients/client.repository'
import { getAccessContext } from '@/lib/access'

// GET /api/clients - Get all clients
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ?? null
    const { currentStaff } = await getAccessContext(token)

    if (!currentStaff) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const clients = await getAllClients()

    return NextResponse.json({
      success: true,
      data: clients
    })
  } catch (error) {
    console.error('Error fetching clients:', error)
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch clients'
    }, { status: 500 })
  }
}

// POST /api/clients - Create a new client
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ?? null
    const { currentStaff } = await getAccessContext(token)

    if (!currentStaff) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const body: CreateClientData = await request.json()

    // Validate required fields
    if (!body.first_name?.trim()) {
      return NextResponse.json({
        success: false,
        message: 'First name is required'
      }, { status: 400 })
    }

    const result = await createClientWithAudit(body, currentStaff)

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Client created successfully'
    })
  } catch (error) {
    console.error('Error creating client:', error)
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create client'
    }, { status: 500 })
  }
}