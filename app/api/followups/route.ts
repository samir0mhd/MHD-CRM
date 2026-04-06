import { NextResponse } from 'next/server'
import * as followupService from '@/lib/modules/followups/followup.service'

export async function GET() {
  try {
    const followUps = await followupService.fetchFollowUps()
    return NextResponse.json(followUps)
  } catch (error) {
    console.error('Error loading follow-ups:', error)
    return NextResponse.json({ error: 'Failed to load follow-ups' }, { status: 500 })
  }
}
