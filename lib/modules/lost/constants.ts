export const LOST_REASONS = [
  { key: 'timing_postponed',      label: 'Timing / Postponed' },
  { key: 'lost_to_competitor',    label: 'Lost to Competitor' },
  { key: 'price',                 label: 'Price' },
  { key: 'different_destination', label: 'Different Destination' },
  { key: 'no_longer_travelling',  label: 'No Longer Travelling' },
  { key: 'other',                 label: 'Other' },
] as const

export type LostReasonKey = (typeof LOST_REASONS)[number]['key']

export function getLostReasonLabel(key: string | null | undefined): string {
  if (!key) return 'No reason given'
  return LOST_REASONS.find(r => r.key === key)?.label ?? key
}
