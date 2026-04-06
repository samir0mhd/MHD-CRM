import { NextRequest, NextResponse } from 'next/server'
import * as supplierService from '@/lib/modules/suppliers/supplier.service'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supplier = await supplierService.fetchSupplierById(Number(id))
    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }
    return NextResponse.json(supplier)
  } catch (error) {
    console.error('Error loading supplier:', error)
    return NextResponse.json({ error: 'Failed to load supplier' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { error } = await supplierService.updateSupplier(Number(id), body)

    if (error) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating supplier:', error)
    const message = error instanceof Error ? error.message : 'Failed to update supplier'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await supplierService.removeSupplier(Number(id))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting supplier:', error)
    return NextResponse.json({ error: 'Failed to delete supplier' }, { status: 500 })
  }
}
