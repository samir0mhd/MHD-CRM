import * as quoteRepository from './quote.repository'
import type { HotelOption, Centre, ExtraItem, DealInfo, EmailTemplate } from './quote.repository'
import {
  bookingTypeAllowsMultiCentre,
  bookingTypeRequiresAccommodation,
  normalizeBookingType,
  normalizeQuoteMode,
  resolveQuoteModeFromRecord,
  type BookingType,
  type QuoteMode,
} from '@/lib/modules/bookings/booking-types'

// Re-export types for convenience
export type {
  FlightLeg,
  HotelOption,
  Centre,
  DealInfo,
  EmailTemplate,
  ExtraItem
} from './quote.repository'

// Constants
export const AIRLINES = [
  'British Airways', 'Virgin Atlantic', 'Emirates', 'Qatar Airways', 'Etihad Airways',
  'Air Mauritius', 'Air France', 'KLM', 'Lufthansa', 'Swiss Air', 'Austrian Airlines',
  'Turkish Airlines', 'Singapore Airlines', 'Cathay Pacific', 'Malaysia Airlines',
  'South African Airways', 'Kenya Airways', 'Ethiopian Airlines', 'EgyptAir',
  'Condor', 'TUI', 'Thomas Cook', 'Monarch', 'EasyJet', 'Ryanair'
]

export const AIRPORTS = [
  'LHR', 'LGW', 'LTN', 'STN', 'LCY', 'MAN', 'BHX', 'GLA', 'EDI', 'BRS', 'NCL',
  'EMA', 'LBA', 'SOU', 'CWL', 'BFS', 'JER', 'GCI', 'DUB', 'ORK', 'SNN',
  'CDG', 'ORY', 'FRA', 'MUC', 'FCO', 'AMS', 'ZRH', 'VIE', 'IST',
  'DOH', 'AUH', 'DXB', 'SIN', 'HKG', 'BKK', 'KUL', 'JNB', 'NBO', 'ADD',
  'CAI', 'MRU', 'SEZ', 'BEY', 'TLV', 'CPT', 'DAR', 'MBA', 'ZNZ'
]

export const CABIN_CLASS = ['Economy', 'Premium Economy', 'Business', 'First']

export const QUICK_EXTRAS = [
  'Airport Lounge Access', 'Private Transfer', 'Welcome Amenity',
  'Excursion Credit', 'Travel Insurance', 'Visa Fees'
]

// Utility functions
export function uid(): string {
  return Math.random().toString(36).substr(2, 9)
}

export function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + 'T12:00')
  date.setDate(date.getDate() + days)
  return date.toISOString().split('T')[0]
}

export function fmt(num: number): string {
  return '£' + num.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function fmtS(num: number): string {
  return '£' + num.toLocaleString('en-GB', { maximumFractionDigits: 0 })
}

export function genRef(initials: string, count: number): string {
  const now = new Date()
  const dd  = now.getDate().toString().padStart(2, '0')
  const mm  = (now.getMonth() + 1).toString().padStart(2, '0')
  const yy  = now.getFullYear().toString().slice(-2)
  return `${dd}${mm}${yy}${initials}${(count + 1).toString().padStart(2, '0')}`
}

// Constructor functions
export function newLeg(direction: 'out' | 'ret'): quoteRepository.FlightLeg {
  return {
    id: uid(),
    flight_number: '',
    date: '',
    depart_time: '',
    arrival_time: '',
    checkin_time: '',
    airline: '',
    from: direction === 'out' ? 'LHR' : '',
    to: direction === 'out' ? '' : 'LHR',
    cabin: 'Economy',
    overnight: false
  }
}

export function newHotelOption(): HotelOption {
  return {
    id: uid(),
    hotel: '',
    roomType: '',
    boardBasis: 'All Inclusive',
    nights: '7',
    checkinDate: '',
    checkinNextDay: false,
    outLegs: [newLeg('out')],
    retLegs: [newLeg('ret')],
    flightNet: '',
    accNet: '',
    transNet: '',
    extras: [],
    sellPrice: '',
    margin: '',
    profit: ''
  }
}

export function newCentre(destination: string): Centre {
  return {
    id: uid(),
    destination,
    hotel: '',
    roomType: '',
    boardBasis: 'All Inclusive',
    nights: '7',
    checkinDate: '',
    checkinNextDay: false,
    inboundLegs: [newLeg('out')],
    outboundLegs: [newLeg('ret')],
    flightNet: '',
    accNet: '',
    transNet: '',
    extras: []
  }
}

type SharedQuoteDefaultsInput = {
  origin?: string
  outboundDate?: string
  returnDate?: string
}

type FlightOptionInput = {
  id?: string
  label?: string
  outLegs?: quoteRepository.FlightLeg[]
  retLegs?: quoteRepository.FlightLeg[]
  flightNet?: string
  transNet?: string
  sellPrice?: string
  margin?: string
  profit?: string
}

type AccommodationOptionInput = {
  id?: string
  hotel?: string
  roomType?: string
  boardBasis?: string
  nights?: string
  checkinDate?: string
  checkinNextDay?: boolean
  accNet?: string
  extras?: ExtraItem[]
  sellPrice?: string
  margin?: string
  profit?: string
  useDefaultFlight?: boolean
  assignedFlightOptionIds?: string[]
  pricingFlightOptionId?: string
}

type SingleQuoteBuilderState = {
  sharedQuoteDefaults?: SharedQuoteDefaultsInput
  flightOptions?: FlightOptionInput[]
  defaultFlightOptionId?: string
  accommodationOptions?: AccommodationOptionInput[]
}

type SaveQuoteResult = {
  refs: string[]
  quoteId?: number
}

function quoteRefPrefix(initials: string): string {
  const now = new Date()
  const dd = now.getDate().toString().padStart(2, '0')
  const mm = (now.getMonth() + 1).toString().padStart(2, '0')
  const yy = now.getFullYear().toString().slice(-2)
  return `${dd}${mm}${yy}${initials}`
}

function getNextQuoteRef(initials: string, existingRefs: string[]): string {
  const prefix = quoteRefPrefix(initials)
  const maxSequence = existingRefs.reduce((max, ref) => {
    const trimmedRef = ref.trim()
    if (!trimmedRef.startsWith(prefix)) return max
    const suffix = parseInt(trimmedRef.slice(prefix.length), 10)
    return Number.isFinite(suffix) ? Math.max(max, suffix) : max
  }, 0)

  return `${prefix}${String(maxSequence + 1).padStart(2, '0')}`
}

async function generateNextQuoteRef(dealId: number, initials: string): Promise<string> {
  // Rule 1: if this deal already has any quote ref, always reuse the canonical one.
  // A deal has exactly one quote reference family — never generate a second ref for it.
  const dealRows = await quoteRepository.getQuoteReferenceRowsForDeal(dealId)
  const dealRefs = Array.from(new Set(
    dealRows.map(r => r.quote_ref?.trim() || '').filter(Boolean)
  ))
  if (dealRefs.length > 0) {
    // Return the lexicographically smallest (earliest sequential) ref as canonical.
    return dealRefs.sort()[0]
  }

  // Rule 2: deal has no ref yet — find the next available sequence across ALL deals today.
  // This prevents two different deals from being assigned the same ref.
  const prefix = quoteRefPrefix(initials)
  const allRows = await quoteRepository.getRefsByPrefix(prefix)
  const allRefs = Array.from(new Set(
    allRows.map(r => r.quote_ref?.trim() || '').filter(Boolean)
  ))
  return getNextQuoteRef(initials, allRefs)
}

function buildSingleQuoteRow(
  option: HotelOption,
  {
    productType,
    adults,
    children,
    infants,
    childAges,
    initials,
    additionalServices,
    builderState,
  }: {
    productType: BookingType
    adults: number
    children: number
    infants: number
    childAges: number[]
    initials: string
    additionalServices: string
    builderState?: SingleQuoteBuilderState
  }
) {
  const sellN = parseFloat(option.sellPrice) || 0
  const profitN = parseFloat(option.profit) || 0
  const marginN = sellN > 0 && profitN > 0 && profitN < sellN
    ? (profitN / (sellN - profitN)) * 100
    : (parseFloat(option.margin) || 0)

  const flightN = parseFloat(option.flightNet) || 0
  const accN = parseFloat(option.accNet) || 0
  const transN = parseFloat(option.transNet) || 0
  const extrasN = option.extras.reduce((a: number, e: ExtraItem) => a + (e.net || 0), 0)
  const departureDate = option.outLegs[0]?.date || option.checkinDate || null

  return {
    hotel: option.hotel.trim(),
    board_basis: option.boardBasis,
    room_type: option.roomType || null,
    quote_type: productType,
    quote_mode: 'single',
    cabin_class: option.outLegs[0]?.cabin || 'Economy',
    departure_date: departureDate,
    departure_airport: option.outLegs[0]?.from || null,
    airline: option.outLegs[0]?.airline || null,
    nights: parseInt(option.nights) || null,
    adults: adults || 2,
    children: children || 0,
    infants: infants || 0,
    child_ages: childAges.length > 0 ? childAges : null,
    price: sellN,
    profit: profitN,
    margin_percent: parseFloat(marginN.toFixed(1)) || 0,
    consultant_initials: initials,
    flight_details: {
      outbound: option.outLegs,
      return: option.retLegs,
      ...(builderState ? { builder_state: builderState } : {}),
    },
    cost_breakdown: {
      flight_net: flightN,
      acc_net: accN,
      trans_net: transN,
      extras: option.extras,
      total_net: flightN + accN + transN + extrasN
    },
    additional_services: additionalServices.trim() || null,
    checkin_date: option.checkinDate || null,
    checkin_next_day: option.checkinNextDay,
  }
}

function buildMultiCentreRow(
  centres: Centre[],
  {
    productType,
    adults,
    children,
    infants,
    childAges,
    initials,
    additionalServices,
    sellPrice,
    margin,
    profit,
  }: {
    productType: BookingType
    adults: number
    children: number
    infants: number
    childAges: number[]
    initials: string
    additionalServices: string
    sellPrice?: number
    margin?: number
    profit?: number
  }
) {
  const totalNights = centres.reduce((a, c) => a + (parseInt(c.nights) || 0), 0)
  const destList = centres.map(c => c.destination).filter(Boolean).join(' â†’ ')
  const totalNet = centres.reduce((a, c) => {
    const accN = parseFloat(c.accNet) || 0
    const flightN = parseFloat(c.flightNet) || 0
    const transN = parseFloat(c.transNet) || 0
    return a + accN + flightN + transN + c.extras.reduce((x, e) => x + (e.net || 0), 0)
  }, 0)

  return {
    quote_type: productType,
    quote_mode: 'multi_centre',
    centres,
    hotel: `Multi-Centre: ${destList}`,
    destination: destList,
    board_basis: centres.map(c => c.boardBasis).join(' / '),
    departure_date: centres[0]?.inboundLegs[0]?.date || null,
    nights: totalNights,
    adults: adults || 2,
    children: children || 0,
    infants: infants || 0,
    child_ages: childAges.length > 0 ? childAges : null,
    price: sellPrice || 0,
    profit: profit || 0,
    margin_percent: parseFloat((margin || 0).toFixed(1)) || 0,
    consultant_initials: initials,
    cost_breakdown: {
      total_net: totalNet,
      centres: centres.map(c => ({
        destination: c.destination,
        hotel: c.hotel,
        nights: c.nights,
        net: parseFloat(c.accNet || '0') + (parseFloat(c.flightNet || '0')) + (parseFloat(c.transNet || '0'))
      }))
    },
    additional_services: additionalServices.trim() || null,
  }
}

export async function getQuoteCountForDeal(dealId: number): Promise<number> {
  return quoteRepository.getQuoteCountForDeal(dealId)
}

// Business logic functions
export async function loadDeals(): Promise<DealInfo[]> {
  return await quoteRepository.getAllDeals()
}

export async function loadDeal(id: number): Promise<DealInfo | null> {
  return await quoteRepository.getDealById(id)
}

export async function loadExistingQuote(quoteId: number): Promise<Record<string, unknown> | null> {
  const quote = await quoteRepository.getQuoteById(quoteId)
  if (!quote) return null

  const quoteMode = resolveQuoteModeFromRecord(quote)

  if (quoteMode === 'single' && quote.quote_ref && quote.deal_id) {
    const quoteGroup = await quoteRepository.getQuotesByRef(quote.deal_id, quote.quote_ref)
    const builderState = quoteGroup.find(row => row.flight_details?.builder_state)?.flight_details?.builder_state
      || quote.flight_details?.builder_state

    return {
      ...quote,
      quote_mode: quoteMode,
      quote_group_ids: quoteGroup.map(row => row.id),
      quote_group_size: quoteGroup.length || 1,
      ...(builderState ? { single_quote_builder: builderState } : {}),
    }
  }

  return {
    ...quote,
    quote_mode: quoteMode,
  }
}

export async function loadCustomTemplates(): Promise<EmailTemplate[]> {
  return await quoteRepository.getCustomTemplates()
}

export async function searchTable(table: string, query: string): Promise<string[]> {
  return await quoteRepository.searchTable(table, query)
}

export async function saveToTable(table: string, field: string, value: string): Promise<void> {
  await quoteRepository.saveToTable(table, field, value)
}

export async function saveQuote(
  dealId: number,
  quoteData: {
    productType: BookingType
    quoteMode: QuoteMode
    quoteRef: string
    adults: number
    children: number
    infants: number
    childAges: number[]
    initials: string
    additionalServices: string
    hotelOptions?: HotelOption[]
    centres?: Centre[]
    sellPrice?: number
    margin?: number
    profit?: number
    singleQuoteBuilder?: SingleQuoteBuilderState
  },
  editQuoteId?: number
): Promise<SaveQuoteResult> {
  const {
    productType,
    quoteMode,
    quoteRef,
    adults,
    children,
    infants,
    childAges,
    initials,
    additionalServices,
    hotelOptions,
    centres,
    sellPrice,
    margin,
    profit,
    singleQuoteBuilder,
  } = quoteData

  const refs: string[] = []

  if (quoteMode === 'single' && hotelOptions) {
    const providedQuoteRef = quoteRef.trim()
    const existingQuoteGroup = providedQuoteRef
      ? await quoteRepository.getQuotesByRef(dealId, providedQuoteRef)
      : []
    const legacyEditQuote = (!providedQuoteRef && editQuoteId)
      ? await quoteRepository.getQuoteById(editQuoteId)
      : null
    const persistedQuoteGroup = existingQuoteGroup.length > 0
      ? existingQuoteGroup
      : (legacyEditQuote ? [legacyEditQuote] : [])
    const effectiveQuoteRef = existingQuoteGroup[0]?.quote_ref?.trim()
      || legacyEditQuote?.quote_ref?.trim()
      || await generateNextQuoteRef(dealId, initials)
    const version = persistedQuoteGroup[0]?.version || 1
    const sentToClient = persistedQuoteGroup.some(quote => !!quote.sent_to_client)
    const createdQuotes: quoteRepository.CreatedQuoteRow[] = []

    refs.push(effectiveQuoteRef)

    for (let i = 0; i < hotelOptions.length; i++) {
      const option = hotelOptions[i]
      const rowValues = {
        deal_id: dealId,
        quote_ref: effectiveQuoteRef,
        version,
        sent_to_client: sentToClient,
        ...buildSingleQuoteRow(option, {
          productType,
          adults,
          children,
          infants,
          childAges,
          initials,
          additionalServices,
          builderState: singleQuoteBuilder,
        }),
      }

      if (persistedQuoteGroup[i]?.id) {
        await quoteRepository.updateQuote(persistedQuoteGroup[i].id, rowValues)
      } else {
        const createdQuote = await quoteRepository.createQuote(rowValues)
        if (createdQuote) createdQuotes.push(createdQuote)
      }
    }

    if (persistedQuoteGroup.length > hotelOptions.length) {
      await quoteRepository.deleteQuotes(
        persistedQuoteGroup.slice(hotelOptions.length).map(quote => Number(quote.id)).filter(Boolean)
      )
    }

    const first = hotelOptions[0]
    await quoteRepository.updateDeal(dealId, {
      booking_type: productType,
      deal_value: parseFloat(first.sellPrice) || 0,
      departure_date: first.outLegs[0]?.date || first.checkinDate || undefined,
    })

    await quoteRepository.createActivity({
      deal_id: dealId,
      activity_type: 'QUOTE_CREATED',
      notes: persistedQuoteGroup.length > 0
        ? `Quote ${effectiveQuoteRef} updated`
        : `${hotelOptions.length} option quote - ${hotelOptions.map(o => o.hotel).join(' / ')} - Ref: ${effectiveQuoteRef}`
    })

    return {
      refs,
      quoteId: Number(persistedQuoteGroup[0]?.id || createdQuotes[0]?.id || editQuoteId || 0) || undefined,
    }
  }

  if (quoteMode === 'multi_centre' && centres) {
    const providedQuoteRef = quoteRef.trim()
    const existingQuoteGroup = providedQuoteRef
      ? await quoteRepository.getQuotesByRef(dealId, providedQuoteRef)
      : []
    const legacyEditQuote = (!providedQuoteRef && editQuoteId)
      ? await quoteRepository.getQuoteById(editQuoteId)
      : null
    const baseQuote = existingQuoteGroup[0] || legacyEditQuote || null
    const effectiveQuoteRef = existingQuoteGroup[0]?.quote_ref?.trim()
      || legacyEditQuote?.quote_ref?.trim()
      || await generateNextQuoteRef(dealId, initials)
    let createdQuote: quoteRepository.CreatedQuoteRow | null = null

    refs.push(effectiveQuoteRef)

    const rowValues = {
      deal_id: dealId,
      quote_ref: effectiveQuoteRef,
      version: baseQuote?.version || 1,
      sent_to_client: !!baseQuote?.sent_to_client,
      ...buildMultiCentreRow(centres, {
        productType,
        adults,
        children,
        infants,
        childAges,
        initials,
        additionalServices,
        sellPrice,
        margin,
        profit,
      }),
    }

    if (baseQuote?.id) {
      await quoteRepository.updateQuote(baseQuote.id, rowValues)
      if (existingQuoteGroup.length > 1) {
        await quoteRepository.deleteQuotes(existingQuoteGroup.slice(1).map(quote => Number(quote.id)).filter(Boolean))
      }
    } else {
      createdQuote = await quoteRepository.createQuote(rowValues)
    }

    await quoteRepository.updateDeal(dealId, {
      booking_type: productType,
      deal_value: sellPrice || 0,
      departure_date: centres[0]?.inboundLegs[0]?.date || centres[0]?.checkinDate || undefined,
    })

    await quoteRepository.createActivity({
      deal_id: dealId,
      activity_type: 'QUOTE_CREATED',
      notes: baseQuote
        ? `Quote ${effectiveQuoteRef} updated`
        : `Multi-centre quote - ${centres.map(c => c.destination).filter(Boolean).join(' -> ')} - Ref: ${effectiveQuoteRef}`
    })

    return {
      refs,
      quoteId: Number(baseQuote?.id || createdQuote?.id || editQuoteId || 0) || undefined,
    }
  }

  return { refs }
}

export async function saveQuoteFromRequest(body: {
  dealId?: number | string
  quoteType?: BookingType | 'single' | 'multi'
  quoteMode?: QuoteMode | 'single' | 'multi'
  quoteRef?: string
  adults?: number | string
  children?: number | string
  infants?: number | string
  childAges?: number[]
  initials?: string
  additionalServices?: string
  hotelOptions?: HotelOption[]
  centres?: Centre[]
  sellPrice?: number | string
  margin?: number | string
  profit?: number | string
  isEdit?: boolean
  editQuoteId?: number | string
  singleQuoteBuilder?: SingleQuoteBuilderState
}): Promise<SaveQuoteResult> {
  const dealId = Number(body.dealId)
  if (!dealId) {
    throw new Error('Deal ID is required')
  }

  const productType = normalizeBookingType(
    body.quoteType === 'single' || body.quoteType === 'multi' ? 'package' : body.quoteType,
    'package'
  )
  const quoteMode = normalizeQuoteMode(
    body.quoteMode || body.quoteType || (Array.isArray(body.centres) && body.centres.length > 0 ? 'multi_centre' : 'single'),
    'single'
  )
  const sellPrice = body.sellPrice === undefined || body.sellPrice === null || body.sellPrice === ''
    ? undefined
    : Number(body.sellPrice)
  const margin = body.margin === undefined || body.margin === null || body.margin === ''
    ? undefined
    : Number(body.margin)
  const profit = body.profit === undefined || body.profit === null || body.profit === ''
    ? undefined
    : Number(body.profit)

  const validationError = validateQuote(productType, quoteMode, body.hotelOptions, body.centres, sellPrice)
  if (validationError) {
    throw new Error(validationError)
  }

  return saveQuote(
    dealId,
    {
      productType,
      quoteMode,
      quoteRef: body.quoteRef || '',
      adults: Number(body.adults) || 2,
      children: Number(body.children) || 0,
      infants: Number(body.infants) || 0,
      childAges: Array.isArray(body.childAges) ? body.childAges.map(Number).filter(n => !isNaN(n)) : [],
      initials: body.initials || 'SA',
      additionalServices: body.additionalServices || '',
      hotelOptions: body.hotelOptions,
      centres: body.centres,
      sellPrice,
      margin,
      profit,
      singleQuoteBuilder: body.singleQuoteBuilder,
    },
    body.editQuoteId ? Number(body.editQuoteId) : undefined
  )
}

export function validateQuote(
  productType: BookingType,
  quoteMode: QuoteMode,
  hotelOptions?: HotelOption[],
  centres?: Centre[],
  sellPrice?: number
): string | null {
  if (quoteMode === 'multi_centre' && !bookingTypeAllowsMultiCentre(productType)) {
    return 'This booking type only supports single-destination quotes'
  }

  if (quoteMode === 'single') {
    if (!hotelOptions) {
      return 'Quote options are required'
    }
    if (hotelOptions.length === 0) {
      return 'At least one client-facing quote option is required'
    }
    if (bookingTypeRequiresAccommodation(productType) && hotelOptions.some(o => !o.hotel.trim())) {
      return 'All hotel options need a hotel name'
    }
    if (hotelOptions.some(o => !o.sellPrice)) {
      return 'All hotel options need a sell price'
    }
  } else if (quoteMode === 'multi_centre') {
    if (!centres) {
      return 'Centres are required'
    }
    if (centres.some(c => !c.destination.trim())) {
      return 'All centres need a destination'
    }
    if (bookingTypeRequiresAccommodation(productType) && centres.some(c => !c.hotel.trim())) {
      return 'All centres need a hotel'
    }
    if (!sellPrice) {
      return 'Sell price required'
    }
  }

  return null
}

// Export the service object
export const quoteService = {
  // Types (re-exported above)
  // Constants
  AIRLINES,
  AIRPORTS,
  CABIN_CLASS,
  QUICK_EXTRAS,
  // Utility functions
  uid,
  addDays,
  fmt,
  fmtS,
  genRef,
  // Constructor functions
  newLeg,
  newHotelOption,
  newCentre,
  // Business logic functions
  loadDeals,
  loadDeal,
  loadExistingQuote,
  loadCustomTemplates,
  searchTable,
  saveToTable,
  saveQuote,
  saveQuoteFromRequest,
  validateQuote,
  getQuoteCountForDeal,
}
