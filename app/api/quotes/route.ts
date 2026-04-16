import { NextRequest, NextResponse } from 'next/server'
import { quoteService } from '@/lib/modules/quotes/quote.service'

// GET /api/quotes?count=<dealId>  — returns number of quotes already saved for a deal
export async function GET(request: NextRequest) {
  try {
    const dealIdParam = request.nextUrl.searchParams.get('count')
    if (!dealIdParam) return NextResponse.json({ error: 'count param required' }, { status: 400 })
    const count = await quoteService.getQuoteCountForDeal(Number(dealIdParam))
    return NextResponse.json({ count })
  } catch (error) {
    console.error('Error fetching quote count:', error)
    return NextResponse.json({ error: 'Failed to fetch quote count' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const result = await quoteService.saveQuoteFromRequest(body)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error saving quote:', error)
    const message = error instanceof Error ? error.message : 'Failed to save quote'
    const status = message === 'Deal ID is required' || message.includes('need') || message.includes('required')
      ? 400
      : 500
    return NextResponse.json({ error: message }, { status })
  }
}
