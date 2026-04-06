import { dbMutate } from './api-client'
import type { StaffUser } from './access'

type AuditEntry = {
  entity_type: string
  entity_id: number
  action: string
  field_name?: string | null
  old_value?: unknown
  new_value?: unknown
  performed_by_staff_id?: number | null
  performed_by_role?: string | null
  notes?: string | null
}

export async function logAuditEntries(entries: AuditEntry[]) {
  if (entries.length === 0) return
  await dbMutate({
    table: 'audit_log',
    action: 'insert',
    values: entries.map(entry => ({
      entity_type: entry.entity_type,
      entity_id: entry.entity_id,
      action: entry.action,
      field_name: entry.field_name || null,
      old_value: entry.old_value ?? null,
      new_value: entry.new_value ?? null,
      performed_by_staff_id: entry.performed_by_staff_id ?? null,
      performed_by_role: entry.performed_by_role ?? null,
      notes: entry.notes || null,
    })),
  })
}

export function buildFieldAuditEntries({
  entityType,
  entityId,
  performedBy,
  action,
  before,
  after,
  fields,
  notes,
}: {
  entityType: string
  entityId: number
  performedBy: StaffUser | null
  action: string
  before: Record<string, unknown>
  after: Record<string, unknown>
  fields: string[]
  notes?: string
}) {
  return fields.flatMap(field => {
    const oldValue = before[field] ?? null
    const newValue = after[field] ?? null
    if (JSON.stringify(oldValue) === JSON.stringify(newValue)) return []
    return [{
      entity_type: entityType,
      entity_id: entityId,
      action,
      field_name: field,
      old_value: oldValue,
      new_value: newValue,
      performed_by_staff_id: performedBy?.id ?? null,
      performed_by_role: performedBy?.role ?? null,
      notes: notes || null,
    }]
  })
}
