export const NEXT_ACTION_TYPES = [
  'CALL',
  'EMAIL',
  'WHATSAPP',
  'NOTE',
  'MEETING',
  'FOLLOW_UP',
  'DECISION_PUSH',
] as const

export type NextActionType = typeof NEXT_ACTION_TYPES[number]

export const LEGACY_ACTION_NOTE_FALLBACK = 'Follow up with client'

const VALID_ACTION_TYPE_SET = new Set<string>(NEXT_ACTION_TYPES)

const PLACEHOLDER_NOTES = new Set([
  'call',
  'call client',
  'email',
  'email client',
  'whatsapp',
  'whatsapp client',
  'meeting',
  'note',
  'follow up',
  'followup',
  'follow up client',
  'follow up with client',
  'decision push',
  'todo',
  'tbc',
  'na',
  'n a',
  'n/a',
])

function normalizeWhitespace(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ')
}

function normalizeForComparison(value: string | null | undefined): string {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function normalizeActionType(actionType: string | null | undefined): NextActionType | null {
  const normalized = normalizeWhitespace(actionType).toUpperCase()
  if (!normalized || !VALID_ACTION_TYPE_SET.has(normalized)) return null
  return normalized as NextActionType
}

export function normalizeActionNote(actionNote: string | null | undefined): string {
  return normalizeWhitespace(actionNote)
}

export function getDisplayActionType(actionType: string | null | undefined, hasScheduledAction: boolean): NextActionType | null {
  return normalizeActionType(actionType) ?? (hasScheduledAction ? 'FOLLOW_UP' : null)
}

export function getDisplayActionNote(actionNote: string | null | undefined, hasScheduledAction: boolean): string | null {
  const normalized = normalizeActionNote(actionNote)
  if (normalized) return normalized
  return hasScheduledAction ? LEGACY_ACTION_NOTE_FALLBACK : null
}

export function hasMeaningfulActionNote(
  actionNote: string | null | undefined,
  actionType: string | null | undefined,
  options?: { allowFallbackNote?: boolean },
): boolean {
  const normalized = normalizeActionNote(actionNote)
  const comparable = normalizeForComparison(normalized)
  const comparableType = normalizeForComparison(actionType)

  if (!normalized) return false
  if (normalized.length < 8) return false
  if (!options?.allowFallbackNote && normalized === LEGACY_ACTION_NOTE_FALLBACK) return false
  if (PLACEHOLDER_NOTES.has(comparable)) return false
  if (comparable && comparable === comparableType) return false

  return true
}

export function toActionDueAtIso(dueDate: string): string {
  return `${dueDate}T12:00:00.000Z`
}

export function toDateOnly(value: string | null | undefined): string | null {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return normalized.slice(0, 10)
}

export function dayOffsetFromToday(dueDate: string, todayDate: string): number {
  const dueMs = new Date(`${dueDate}T12:00:00`).getTime()
  const todayMs = new Date(`${todayDate}T12:00:00`).getTime()
  return Math.round((dueMs - todayMs) / 86400000)
}

export function validateNextActionInput(input: {
  actionType?: string | null
  dueDate?: string | null
  actionNote?: string | null
}): string | null {
  const actionType = normalizeActionType(input.actionType)
  const dueDate = normalizeWhitespace(input.dueDate)
  const actionNote = normalizeActionNote(input.actionNote)
  const hasAnyValue = Boolean(actionType || dueDate || actionNote)

  if (!hasAnyValue) return 'Choose an action type, due date, and a specific next action note'
  if (!actionType) return 'Choose an action type'
  if (!dueDate) return 'Choose a due date'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return 'Choose a valid due date'
  if (!hasMeaningfulActionNote(actionNote, actionType)) return 'Describe the next action with specific context'

  return null
}
