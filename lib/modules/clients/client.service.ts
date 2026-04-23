import { getClientsWithDeals, getClientById, createClient, updateClient, type BookingSnap, type ClientWithDeals, type CreateClientData, type DealSnap, type UpdateClientData } from './client.repository'
import { buildFieldAuditEntries, logAuditEntries } from '@/lib/audit'
import type { StaffUser } from '@/lib/access'

export type ClientCommercialSummary = {
  enquiries: number
  bookings: number
  bookedLifetimeValue: number
  openPipelineValue: number
}

export type ClientCommercialHistoryItem = {
  id: string
  dealId: number
  bookingId: number | null
  name: string
  date: string | null
  statusLabel: string
  value: number | null
  valueLabel: string
  valueTone: 'booked' | 'pipeline' | 'lost' | 'muted'
}

export type ClientWithStats = ClientWithDeals & {
  enquiryCount: number
  bookingCount: number
  bookedLifetimeValue: number
  openPipelineValue: number
  lastDealDate: string | null
  commercialSummary: ClientCommercialSummary
  commercialHistory: ClientCommercialHistoryItem[]
}

// ── BUSINESS LOGIC ─────────────────────────────────────────
function sortNewestFirst<T extends { created_at: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

function getDealBookings(deal: DealSnap): BookingSnap[] {
  const raw = deal.bookings
  const arr = Array.isArray(raw) ? raw : []
  return sortNewestFirst(arr.filter(Boolean) as BookingSnap[])
}

function getActiveBooking(deal: DealSnap): BookingSnap | null {
  return getDealBookings(deal).find(booking => booking.booking_status !== 'cancelled') || null
}

function hasFinalCommercialTotal(booking: BookingSnap): boolean {
  return booking.total_sell !== null
    && booking.total_sell !== undefined
    && booking.total_net !== null
    && booking.total_net !== undefined
    && (
      booking.final_profit !== null
      && booking.final_profit !== undefined
      || booking.gross_profit !== null
      && booking.gross_profit !== undefined
    )
}

function getBookedValueInfo(deal: DealSnap): { bookingId: number | null; amount: number | null; label: string } {
  const booking = getActiveBooking(deal)
  if (!booking) {
    return { bookingId: null, amount: null, label: 'Booked total pending' }
  }

  if (booking.total_sell === null || booking.total_sell === undefined) {
    return { bookingId: booking.id, amount: null, label: 'Booked total pending' }
  }

  return {
    bookingId: booking.id,
    amount: Number(booking.total_sell),
    label: hasFinalCommercialTotal(booking) ? 'Final commercial total' : 'Booked total',
  }
}

function getHistoryItem(deal: DealSnap): ClientCommercialHistoryItem {
  const activeBooking = getActiveBooking(deal)
  const latestBooking = getDealBookings(deal)[0] || null

  if (activeBooking || deal.stage === 'BOOKED') {
    const bookedValue = getBookedValueInfo(deal)
    return {
      id: `deal-${deal.id}`,
      dealId: deal.id,
      bookingId: bookedValue.bookingId,
      name: deal.title,
      date: activeBooking?.created_at || deal.created_at,
      statusLabel: 'Booked',
      value: bookedValue.amount,
      valueLabel: bookedValue.label,
      valueTone: bookedValue.amount !== null ? 'booked' : 'muted',
    }
  }

  if (latestBooking?.booking_status === 'cancelled') {
    return {
      id: `deal-${deal.id}`,
      dealId: deal.id,
      bookingId: latestBooking.id,
      name: deal.title,
      date: latestBooking.created_at,
      statusLabel: 'Cancelled',
      value: latestBooking.total_sell !== null && latestBooking.total_sell !== undefined ? Number(latestBooking.total_sell) : null,
      valueLabel: latestBooking.total_sell !== null && latestBooking.total_sell !== undefined ? 'Cancelled booking value' : 'Cancelled booking total pending',
      valueTone: 'muted',
    }
  }

  if (deal.stage === 'LOST') {
    return {
      id: `deal-${deal.id}`,
      dealId: deal.id,
      bookingId: null,
      name: deal.title,
      date: deal.lost_at || deal.created_at,
      statusLabel: 'Lost',
      value: deal.deal_value || 0,
      valueLabel: 'Lost opportunity value',
      valueTone: 'lost',
    }
  }

  return {
    id: `deal-${deal.id}`,
    dealId: deal.id,
    bookingId: null,
    name: deal.title,
    date: deal.created_at,
    statusLabel: deal.stage === 'QUOTE_SENT' ? 'Quoted' : 'Open',
    value: deal.deal_value || 0,
    valueLabel: deal.stage === 'QUOTE_SENT' ? 'Quoted value' : 'Open pipeline value',
    valueTone: 'pipeline',
  }
}

export function enrichClientWithStats(client: ClientWithDeals): ClientWithStats {
  const deals = client.deals || []
  const allBookings = deals.flatMap(deal => getDealBookings(deal))
  const convertedBookings = allBookings.filter(booking => booking.booking_status !== 'cancelled')
  const bookedLifetimeValue = convertedBookings.reduce((sum, booking) => {
    if (booking.total_sell === null || booking.total_sell === undefined) return sum
    return sum + Number(booking.total_sell)
  }, 0)
  const openPipelineValue = deals.reduce((sum, deal) => {
    const activeBooking = getActiveBooking(deal)
    if (activeBooking || deal.stage === 'BOOKED' || deal.stage === 'LOST') return sum
    return sum + Number(deal.deal_value || 0)
  }, 0)
  const commercialSummary: ClientCommercialSummary = {
    enquiries: deals.length,
    bookings: convertedBookings.length,
    bookedLifetimeValue,
    openPipelineValue,
  }

  return {
    ...client,
    behaviour_tags: client.behaviour_tags || [],
    enquiryCount: commercialSummary.enquiries,
    bookingCount: commercialSummary.bookings,
    bookedLifetimeValue: commercialSummary.bookedLifetimeValue,
    openPipelineValue: commercialSummary.openPipelineValue,
    lastDealDate: deals.length > 0
      ? [...deals].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0].created_at
      : null,
    commercialSummary,
    commercialHistory: deals
      .map(getHistoryItem)
      .sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime()),
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
