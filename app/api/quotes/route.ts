import { NextRequest, NextResponse } from 'next/server'
import { quoteService } from '@/lib/modules/quotes/quote.service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const refs = await quoteService.saveQuoteFromRequest(body)

    return NextResponse.json({ refs })
  } catch (error) {
    console.error('Error saving quote:', error)
    const message = error instanceof Error ? error.message : 'Failed to save quote'
    const status = message === 'Deal ID is required' || message.includes('need') || message.includes('required')
      ? 400
      : 500
    return NextResponse.json({ error: message }, { status })
  }
}
