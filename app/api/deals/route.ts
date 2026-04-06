import { NextRequest, NextResponse } from 'next/server'
import { quoteService } from '@/lib/modules/quotes/quote.service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (id) {
      // Load single deal
      const deal = await quoteService.loadDeal(parseInt(id))
      if (!deal) {
        return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
      }
      return NextResponse.json(deal)
    } else {
      // Load all deals
      const deals = await quoteService.loadDeals()
      return NextResponse.json(deals)
    }
  } catch (error) {
    console.error('Error loading deals:', error)
    return NextResponse.json({ error: 'Failed to load deals' }, { status: 500 })
  }
}