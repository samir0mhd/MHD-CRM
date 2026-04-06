import { NextResponse } from 'next/server'
import { loadPricingSetup } from '@/lib/modules/pricing/pricing.service'

export async function GET() {
  try {
    const data = await loadPricingSetup()
    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error loading pricing setup:', error)
    const message = error instanceof Error ? error.message : 'Pricing schema is not available yet'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
