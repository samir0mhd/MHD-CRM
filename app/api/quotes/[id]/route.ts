import { NextRequest, NextResponse } from 'next/server'
import { quoteService } from '@/lib/modules/quotes/quote.service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const quoteId = parseInt(id)
    const quote = await quoteService.loadExistingQuote(quoteId)

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    return NextResponse.json(quote)
  } catch (error) {
    console.error('Error loading quote:', error)
    return NextResponse.json({ error: 'Failed to load quote' }, { status: 500 })
  }
}
