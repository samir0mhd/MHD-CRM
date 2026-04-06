import { NextRequest, NextResponse } from 'next/server'
import * as supplierService from '@/lib/modules/suppliers/supplier.service'

export async function GET() {
  try {
    const data = await supplierService.fetchSuppliers()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error loading suppliers:', error)
    return NextResponse.json({ error: 'Failed to load suppliers' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { error } = await supplierService.createSupplier(body)

    if (error) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error creating supplier:', error)
    const message = error instanceof Error ? error.message : 'Failed to create supplier'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
