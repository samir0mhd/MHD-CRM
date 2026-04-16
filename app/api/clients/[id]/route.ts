import { NextRequest, NextResponse } from 'next/server'
import { getClient, updateClientWithAudit } from '@/lib/modules/clients/client.service'
import { type UpdateClientData } from '@/lib/modules/clients/client.repository'
import { getAccessContext } from '@/lib/access'

// GET /api/clients/[id] - Get a specific client
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ?? null
    const { currentStaff } = await getAccessContext(token)

    if (!currentStaff) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const clientId = parseInt(id)
    if (isNaN(clientId)) {
      return NextResponse.json({ success: false, message: 'Invalid client ID' }, { status: 400 })
    }

    const client = await getClient(clientId)

    if (!client) {
      return NextResponse.json({ success: false, message: 'Client not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: client
    })
  } catch (error) {
    console.error('Error fetching client:', error)
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch client'
    }, { status: 500 })
  }
}

// PUT /api/clients/[id] - Update a specific client
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ?? null
    const { currentStaff } = await getAccessContext(token)

    if (!currentStaff) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const clientId = parseInt(id)
    if (isNaN(clientId)) {
      return NextResponse.json({ success: false, message: 'Invalid client ID' }, { status: 400 })
    }

    const body: UpdateClientData = await request.json()

    // Get the current client data for audit logging
    const currentClient = await getClient(clientId)
    if (!currentClient) {
      return NextResponse.json({ success: false, message: 'Client not found' }, { status: 404 })
    }

    const result = await updateClientWithAudit(clientId, body, currentStaff, currentClient)

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Client updated successfully'
    })
  } catch (error) {
    console.error('Error updating client:', error)
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update client'
    }, { status: 500 })
  }
}