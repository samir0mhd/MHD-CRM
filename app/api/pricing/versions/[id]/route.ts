import { NextResponse } from 'next/server'
import { loadPricingVersionData } from '@/lib/modules/pricing/pricing.service'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const data = await loadPricingVersionData(Number(params.id))
    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error loading pricing version data:', error)
    const message = error instanceof Error ? error.message : 'Pricing data could not be loaded'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
