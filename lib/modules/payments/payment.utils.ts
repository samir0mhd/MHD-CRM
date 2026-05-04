// Single source of truth for payment calculations across all booking types.
// Applies to package, accommodation-only, flight-only, transfer-only, and custom bookings.
//
// Key rule: the effective sell (amount the client owes) = total_sell - discount.
// Discount is a flat reduction in the client's invoice. cc_surcharge is an agency
// cost (not charged to the client), so it does not affect what the client owes.

export type BookingSellSource = {
  total_sell?: number | null
  discount?: number | null
  deals?: { deal_value?: number | null } | null
}

export type PaymentStatus = 'no_sell_value' | 'unpaid' | 'partial' | 'paid' | 'overpaid'

export type PaymentSummary = {
  sell: number
  totalPaid: number
  appliedAmount: number
  overpayment: number
  balanceDue: number
  pctPaid: number
  status: PaymentStatus
}

// Returns the effective amount the client owes: gross sell minus any discount.
// Validation, balance display, and payment locking all use this value — never raw total_sell.
export function getBookingSell(booking: BookingSellSource): number {
  const gross    = Number(booking.total_sell || booking.deals?.deal_value || 0)
  const discount = Number(booking.discount || 0)
  return Math.max(0, gross - discount)
}

export function computePaymentSummary(
  booking: BookingSellSource,
  payments: { amount: number }[],
): PaymentSummary {
  const sell = getBookingSell(booking)
  const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
  const r2 = (n: number) => Math.round(n * 100) / 100

  const appliedAmount = r2(Math.min(totalPaid, sell))
  const overpayment   = r2(Math.max(0, totalPaid - sell))
  const balanceDue    = r2(Math.max(0, sell - totalPaid))
  const pctPaid       = sell > 0 ? Math.min(100, Math.round((totalPaid / sell) * 100)) : 0

  let status: PaymentStatus
  if (sell === 0)               status = 'no_sell_value'
  else if (totalPaid === 0)     status = 'unpaid'
  else if (overpayment > 0.005) status = 'overpaid'
  else if (balanceDue <= 0.005) status = 'paid'
  else                          status = 'partial'

  return { sell, totalPaid, appliedAmount, overpayment, balanceDue, pctPaid, status }
}
