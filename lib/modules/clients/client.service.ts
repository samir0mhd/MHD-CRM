import { getClientsWithDeals, getClientById, createClient, updateClient, type ClientWithDeals, type CreateClientData, type UpdateClientData } from './client.repository'
import { buildFieldAuditEntries, logAuditEntries } from '@/lib/audit'
import type { StaffUser } from '@/lib/access'

export type ClientWithStats = ClientWithDeals & {
  dealCount: number
  bookedCount: number
  lifetimeValue: number
  lastDealDate: string | null
}

// ── BUSINESS LOGIC ─────────────────────────────────────────
export function enrichClientWithStats(client: ClientWithDeals): ClientWithStats {
  const deals = client.deals || []
  const bookedDeals = deals.filter(d => d.stage === 'BOOKED')

  return {
    ...client,
    behaviour_tags: client.behaviour_tags || [],
    dealCount: deals.length,
    bookedCount: bookedDeals.length,
    lifetimeValue: bookedDeals.reduce((sum, deal) => sum + (deal.deal_value || 0), 0),
    lastDealDate: deals.length > 0
      ? [...deals].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0].created_at
      : null,
  }
}

export function enrichClientsWithStats(clients: ClientWithDeals[]): ClientWithStats[] {
  return clients.map(enrichClientWithStats)
}

// ── CLIENT OPERATIONS ──────────────────────────────────────
export async function getAllClients(): Promise<ClientWithStats[]> {
  const clients = await getClientsWithDeals()
  return enrichClientsWithStats(clients)
}

export async function getClient(id: number): Promise<ClientWithStats | null> {
  const client = await getClientById(id)
  return client ? enrichClientWithStats(client) : null
}

export async function createClientWithAudit(data: CreateClientData, performedBy: StaffUser | null): Promise<{ id: number }> {
  const result = await createClient(data)

  // Audit logging
  await logAuditEntries([{
    entity_type: 'client',
    entity_id: result.id,
    action: 'client_created',
    new_value: data,
    performed_by_staff_id: performedBy?.id ?? null,
    performed_by_role: performedBy?.role ?? null,
    notes: 'Client created',
  }])

  return result
}

export async function updateClientWithAudit(
  id: number,
  data: UpdateClientData,
  performedBy: StaffUser | null,
  previousData?: ClientWithDeals
): Promise<{ id: number }> {
  const result = await updateClient(id, data)

  // Audit logging
  if (previousData) {
    await logAuditEntries(buildFieldAuditEntries({
      entityType: 'client',
      entityId: id,
      performedBy,
      action: 'client_updated',
      before: previousData,
      after: data,
      fields: ['first_name', 'last_name', 'phone', 'email', 'date_of_birth', 'source', 'advisor_notes', 'billing_address_line1', 'billing_city', 'billing_postcode', 'billing_country', 'owner_staff_id'],
    }))
  }

  return result
}

// ── UTILITY FUNCTIONS ──────────────────────────────────────
export function calculateClientAge(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) return null
  return Math.floor((Date.now() - new Date(dateOfBirth).getTime()) / (365.25 * 86400000))
}

export function formatCurrency(amount: number): string {
  return '£' + amount.toLocaleString('en-GB', { maximumFractionDigits: 0 })
}

export function getClientInitials(client: { first_name: string; last_name: string }): string {
  return ((client.first_name?.[0] || '') + (client.last_name?.[0] || '')).toUpperCase()
}

export function getBudgetRangeLabel(min: number | null, max: number | null): string | null {
  if (!min && !max) return null

  const ranges = [
    { label: 'Under £3,000', min: 0, max: 3000 },
    { label: '£3,000–£5,000', min: 3000, max: 5000 },
    { label: '£5,000–£8,000', min: 5000, max: 8000 },
    { label: '£8,000–£12,000', min: 8000, max: 12000 },
    { label: '£12,000–£20,000', min: 12000, max: 20000 },
    { label: '£20,000+', min: 20000, max: 999999 },
  ]

  const range = ranges.find(r => r.min === min && r.max === max)
  return range ? range.label : `${formatCurrency(min || 0)} – ${max === 999999 ? '£20,000+' : formatCurrency(max || 0)}`
}

// ── CONSTANTS ─────────────────────────────────────────────
export const BEHAVIOUR_TAGS = [
  { key: 'price-driven', label: 'Price-driven', icon: '💰', color: '#ef4444' },
  { key: 'value-seeker', label: 'Value seeker', icon: '🔍', color: '#f97316' },
  { key: 'luxury-spender', label: 'Luxury spender', icon: '💎', color: '#8b5cf6' },
  { key: 'repeat-client', label: 'Repeat client', icon: '🔁', color: '#10b981' },
  { key: 'vip', label: 'VIP', icon: '⭐', color: '#f59e0b' },
  { key: 'fast-decision', label: 'Fast decision', icon: '⚡', color: '#3b82f6' },
  { key: 'slow-to-commit', label: 'Slow to commit', icon: '🐢', color: '#6b7280' },
  { key: 'cancellation-history', label: 'Cancellation history', icon: '⚠️', color: '#dc2626' },
  { key: 'prefers-whatsapp', label: 'Prefers WhatsApp', icon: '💬', color: '#25d366' },
  { key: 'prefers-phone', label: 'Prefers phone', icon: '📞', color: '#1a3a5c' },
]

export const SOURCES = ['Referral', 'Website', 'Instagram', 'Facebook', 'Travel Fair', 'Repeat Client', 'Phone Enquiry', 'Email Enquiry', 'Google', 'Other']

export const BUDGET_RANGES = [
  { label: 'Under £3,000', min: 0, max: 3000 },
  { label: '£3,000–£5,000', min: 3000, max: 5000 },
  { label: '£5,000–£8,000', min: 5000, max: 8000 },
  { label: '£8,000–£12,000', min: 8000, max: 12000 },
  { label: '£12,000–£20,000', min: 12000, max: 20000 },
  { label: '£20,000+', min: 20000, max: 999999 },
]

export const STAGE_LABELS: Record<string, string> = {
  NEW_LEAD: 'New Lead', QUOTE_SENT: 'Quote Sent', ENGAGED: 'Engaged',
  FOLLOW_UP: 'Follow Up', DECISION_PENDING: 'Decision Pending',
  BOOKED: 'Booked', LOST: 'Lost',
}

export const STAGE_COLORS: Record<string, string> = {
  NEW_LEAD: '#8b5cf6', QUOTE_SENT: '#f59e0b', ENGAGED: '#3b82f6',
  FOLLOW_UP: '#f97316', DECISION_PENDING: '#ec4899',
  BOOKED: '#10b981', LOST: '#ef4444',
}

export const AVATAR_COLORS = [
  '#1a3a5c', '#534AB7', '#0F6E56', '#993C1D', '#BA7517',
  '#185FA5', '#3B6D11', '#8b5cf6', '#0d9488', '#b45309',
]

export function getAvatarColor(id: number): string {
  return AVATAR_COLORS[id % AVATAR_COLORS.length]
}

export function getTagInfo(key: string) {
  return BEHAVIOUR_TAGS.find(t => t.key === key)
}