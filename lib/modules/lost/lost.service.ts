import * as repo from './lost.repository'

export type LostDeal = repo.LostDeal

export async function fetchLostDeals() {
  return repo.getLostDeals()
}

export async function reopenLostDeal(deal: { id: number }) {
  const { error } = await repo.updateDeal(deal.id, { stage: 'NEW_LEAD', lost_reason: null })
  if (error) return { error }

  await repo.createActivity({
    deal_id: deal.id,
    activity_type: 'STAGE_CHANGE',
    notes: 'Reopened from Lost — Win-back',
  })

  return { error: null }
}

export async function scheduleWinback(deal: { id: number }, days: number) {
  const at = new Date()
  at.setDate(at.getDate() + days)
  return repo.updateDeal(deal.id, {
    next_activity_at: at.toISOString(),
    next_activity_type: 'FOLLOW_UP',
    next_activity_note: 'Win-back follow-up after lost deal',
  })
}
