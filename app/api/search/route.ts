import { NextRequest, NextResponse } from 'next/server'
import { quoteService } from '@/lib/modules/quotes/quote.service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const table = searchParams.get('table')
    const query = searchParams.get('q')

    if (!table || !query) {
      return NextResponse.json({ error: 'Table and query parameters are required' }, { status: 400 })
    }

    const results = await quoteService.searchTable(table, query)
    return NextResponse.json(results)
  } catch (error) {
    console.error('Error searching table:', error)
    return NextResponse.json({ error: 'Failed to search table' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { table, field, value } = body

    if (!table || !field || !value) {
      return NextResponse.json({ error: 'Table, field, and value are required' }, { status: 400 })
    }

    await quoteService.saveToTable(table, field, value)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving to table:', error)
    return NextResponse.json({ error: 'Failed to save to table' }, { status: 500 })
  }
}