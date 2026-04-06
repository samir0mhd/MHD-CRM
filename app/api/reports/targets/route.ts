import { NextRequest, NextResponse } from 'next/server'
import * as reportsService from '@/lib/modules/reports/reports.service'

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { error } = await reportsService.saveTargets(body)

    if (error) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save targets'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
