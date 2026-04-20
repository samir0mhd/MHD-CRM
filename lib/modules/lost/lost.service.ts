import * as repo from './lost.repository'
import { getLostReasonLabel } from './constants'

export type LostDeal = repo.LostDeal

export async function fetchLostDeals() {
  return repo.getLostDeals()
}

function winbackNote(structuredReason: string | null | undefined): string {
  switch (structuredReason) {
    case 'timing_postponed':      return 'Follow up — client postponed, check if ready to rebook'
    case 'lost_to_competitor':    return 'Win-back — check if competitor booking fell through'
    case 'price':                 return 'Win-back — revisit pricing or offer alternative options'
    case 'different_destination': return 'Win-back — explore alternative destinations with client'
    case 'no_longer_travelling':  return 'Check in — circumstances may have changed'
    default:                      return `Win-back follow-up — ${getLostReasonLabel(structuredReason)}`
  }
}

export async function reopenLostDeal(deal: { id: number }) {
  const { error } = await repo.updateDeal(deal.id, {
    stage: 'NEW_LEAD',
    lost_reason: null,
    lost_structured_reason: null,
    lost_at: null,
  })
  if (error) return { error }

  await repo.createActivity({
    deal_id: deal.id,
    activity_type: 'STAGE_CHANGE',
    notes: 'Reopened from Lost — Win-back',
  })

  return { error: null }
}

export async function scheduleWinback(
  deal: { id: number },
  days: number,
  structuredReason?: string | null,
) {
  const at = new Date()
  at.setDate(at.getDate() + days)
  return repo.updateDeal(deal.id, {
    next_activity_at: at.toISOString(),
    next_activity_type: 'FOLLOW_UP',
    next_activity_note: winbackNote(structuredReason),
  })
}
