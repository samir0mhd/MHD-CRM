export type BookingType =
  | 'package'
  | 'accommodation_only'
  | 'flight_only'
  | 'accommodation_transfer'
  | 'custom'

export type QuoteMode = 'single' | 'multi_centre'

export const BOOKING_TYPE_LABELS: Record<BookingType, string> = {
  package: 'Package',
  accommodation_only: 'Accommodation Only',
  flight_only: 'Flight Only',
  accommodation_transfer: 'Accommodation + Transfer',
  custom: 'Custom',
}

type BookingTypeConfig = {
  requiresFlights: boolean
  requiresAccommodation: boolean
  requiresTransfers: boolean
  allowsMultiCentre: boolean
}

const BOOKING_TYPE_CONFIG: Record<BookingType, BookingTypeConfig> = {
  package: {
    requiresFlights: true,
    requiresAccommodation: true,
    requiresTransfers: false,
    allowsMultiCentre: true,
  },
  accommodation_only: {
    requiresFlights: false,
    requiresAccommodation: true,
    requiresTransfers: false,
    allowsMultiCentre: false,
  },
  flight_only: {
    requiresFlights: true,
    requiresAccommodation: false,
    requiresTransfers: false,
    allowsMultiCentre: false,
  },
  accommodation_transfer: {
    requiresFlights: false,
    requiresAccommodation: true,
    requiresTransfers: true,
    allowsMultiCentre: false,
  },
  custom: {
    requiresFlights: false,
    requiresAccommodation: false,
    requiresTransfers: false,
    allowsMultiCentre: true,
  },
}

export function isBookingType(value: unknown): value is BookingType {
  return typeof value === 'string' && value in BOOKING_TYPE_CONFIG
}

export function normalizeBookingType(value: unknown, fallback: BookingType = 'package'): BookingType {
  return isBookingType(value) ? value : fallback
}

export function normalizeQuoteMode(value: unknown, fallback: QuoteMode = 'single'): QuoteMode {
  if (value === 'single' || value === 'multi_centre') return value
  if (value === 'multi') return 'multi_centre'
  return fallback
}

export function getBookingTypeConfig(type: BookingType): BookingTypeConfig {
  return BOOKING_TYPE_CONFIG[type]
}

export function bookingTypeRequiresFlights(type: BookingType): boolean {
  return BOOKING_TYPE_CONFIG[type].requiresFlights
}

export function bookingTypeRequiresAccommodation(type: BookingType): boolean {
  return BOOKING_TYPE_CONFIG[type].requiresAccommodation
}

export function bookingTypeRequiresTransfers(type: BookingType): boolean {
  return BOOKING_TYPE_CONFIG[type].requiresTransfers
}

export function bookingTypeAllowsMultiCentre(type: BookingType): boolean {
  return BOOKING_TYPE_CONFIG[type].allowsMultiCentre
}

export function resolveQuoteModeFromRecord(record: { quote_mode?: unknown; quote_type?: unknown } | null | undefined): QuoteMode {
  if (!record) return 'single'
  if (record.quote_mode) return normalizeQuoteMode(record.quote_mode)
  if (record.quote_type === 'multi_centre') return 'multi_centre'
  return 'single'
}

export function resolveBookingTypeFromQuoteRecord(record: { quote_type?: unknown } | null | undefined): BookingType {
  if (!record) return 'package'
  if (record.quote_type === 'single' || record.quote_type === 'multi_centre') return 'package'
  return normalizeBookingType(record.quote_type)
}

export function inferBookingTypeFromComponents(input: {
  hasAccommodation: boolean
  hasFlights: boolean
  hasTransfers: boolean
}): BookingType {
  const { hasAccommodation, hasFlights, hasTransfers } = input

  if (hasFlights && !hasAccommodation) return 'flight_only'
  if (!hasFlights && hasAccommodation && hasTransfers) return 'accommodation_transfer'
  if (!hasFlights && hasAccommodation) return 'accommodation_only'
  if (hasFlights && hasAccommodation) return 'package'
  return 'custom'
}
