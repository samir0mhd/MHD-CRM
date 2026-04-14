import * as quoteRepository from './quote.repository'
import { audit } from '@/lib/audit'

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

export function newCentre(destination: string, index: number): Centre {
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

// Business logic functions
export async function loadDeals(): Promise<DealInfo[]> {
  return await quoteRepository.getAllDeals()
}

export async function loadDeal(id: number): Promise<DealInfo | null> {
  return await quoteRepository.getDealById(id)
}

export async function loadExistingQuote(quoteId: number): Promise<any> {
  return await quoteRepository.getQuoteById(quoteId)
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
    quoteType: 'single' | 'multi'
    quoteRef: string
    adults: number
    children: number
    infants: number
    initials: string
    additionalServices: string
    hotelOptions?: HotelOption[]
    centres?: Centre[]
    sellPrice?: number
    margin?: number
    profit?: number
  },
  isEdit: boolean = false,
  editQuoteId?: number
): Promise<string[]> {
  const {
    quoteType,
    quoteRef,
    adults,
    children,
    infants,
    initials,
    additionalServices,
    hotelOptions,
    centres,
    sellPrice,
    margin,
    profit
  } = quoteData

  const refs: string[] = []

  if (isEdit && editQuoteId) {
    // Edit mode
    if (quoteType === 'single' && hotelOptions) {
      const option = hotelOptions[0]
      const sellN = parseFloat(option.sellPrice) || 0
      const profitN = parseFloat(option.profit) || 0
      const marginN = sellN > 0 && profitN > 0 && profitN < sellN
        ? (profitN / (sellN - profitN)) * 100
        : (parseFloat(option.margin) || 0)

      const flightN = parseFloat(option.flightNet) || 0
      const accN = parseFloat(option.accNet) || 0
      const transN = parseFloat(option.transNet) || 0
      const extrasN = option.extras.reduce((a, e) => a + (e.net || 0), 0)

      await quoteRepository.updateQuote(editQuoteId, {
        hotel: option.hotel.trim(),
        board_basis: option.boardBasis,
        room_type: option.roomType || null,
        quote_type: 'single',
        cabin_class: option.outLegs[0]?.cabin || 'Economy',
        departure_date: option.outLegs[0]?.date || null,
        departure_airport: option.outLegs[0]?.from || null,
        airline: option.outLegs[0]?.airline || null,
        nights: parseInt(option.nights) || null,
        adults: adults || 2,
        children: children || 0,
        infants: infants || 0,
        price: sellN,
        profit: profitN,
        margin_percent: parseFloat(marginN.toFixed(1)) || 0,
        consultant_initials: initials,
        flight_details: { outbound: option.outLegs, return: option.retLegs },
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
      })
    } else if (quoteType === 'multi' && centres) {
      const totalNights = centres.reduce((a, c) => a + (parseInt(c.nights) || 0), 0)
      const destList = centres.map(c => c.destination).filter(Boolean).join(' → ')

      await quoteRepository.updateQuote(editQuoteId, {
        quote_type: 'multi_centre',
        centres,
        hotel: centres[0]?.hotel || 'Multi-Centre',
        board_basis: centres[0]?.boardBasis || '',
        departure_date: centres[0]?.inboundLegs[0]?.date || null,
        nights: totalNights,
        adults: adults || 2,
        children: children || 0,
        infants: infants || 0,
        price: sellPrice || 0,
        profit: profit || 0,
        margin_percent: parseFloat((margin || 0).toFixed(1)) || 0,
        consultant_initials: initials,
        additional_services: additionalServices.trim() || null,
        cost_breakdown: {
          total_net: centres.reduce((a, c) => {
            const accN = parseFloat(c.accNet) || 0
            const flightN = parseFloat(c.flightNet) || 0
            const transN = parseFloat(c.transNet) || 0
            return a + accN + flightN + transN + c.extras.reduce((x, e) => x + (e.net || 0), 0)
          }, 0),
          centres: centres.map(c => ({
            destination: c.destination,
            net: parseFloat(c.accNet || '0') + (parseFloat(c.flightNet || '0')) + (parseFloat(c.transNet || '0'))
          }))
        },
      })
    }

    await quoteRepository.createActivity({
      deal_id: dealId,
      activity_type: 'QUOTE_CREATED',
      notes: `Quote ${quoteRef} updated`
    })

    return [quoteRef]
  }

  // New quotes
  if (quoteType === 'single' && hotelOptions) {
    for (let i = 0; i < hotelOptions.length; i++) {
      const option = hotelOptions[i]
      const ref = genRef(initials, await quoteRepository.getQuoteCountForDeal(dealId) + i)
      refs.push(ref)

      const sellN = parseFloat(option.sellPrice) || 0
      const profitN = parseFloat(option.profit) || 0
      const marginN = sellN > 0 && profitN > 0 && profitN < sellN
        ? (profitN / (sellN - profitN)) * 100
        : (parseFloat(option.margin) || 0)

      const flightN = parseFloat(option.flightNet) || 0
      const accN = parseFloat(option.accNet) || 0
      const transN = parseFloat(option.transNet) || 0
      const extrasN = option.extras.reduce((a, e) => a + (e.net || 0), 0)

      await quoteRepository.createQuote({
        deal_id: dealId,
        hotel: option.hotel.trim(),
        board_basis: option.boardBasis,
        room_type: option.roomType || null,
        quote_type: 'single',
        cabin_class: option.outLegs[0]?.cabin || 'Economy',
        departure_date: option.outLegs[0]?.date || null,
        departure_airport: option.outLegs[0]?.from || null,
        airline: option.outLegs[0]?.airline || null,
        nights: parseInt(option.nights) || null,
        adults: adults || 2,
        children: children || 0,
        infants: infants || 0,
        price: sellN,
        profit: profitN,
        margin_percent: parseFloat(marginN.toFixed(1)) || 0,
        consultant_initials: initials,
        quote_ref: ref,
        sent_to_client: false,
        flight_details: { outbound: option.outLegs, return: option.retLegs },
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
      })
    }

    // Update deal with first option's data
    const first = hotelOptions[0]
    await quoteRepository.updateDeal(dealId, {
      deal_value: parseFloat(first.sellPrice) || 0,
      departure_date: first.outLegs[0]?.date || undefined,
    })

    await quoteRepository.createActivity({
      deal_id: dealId,
      activity_type: 'QUOTE_CREATED',
      notes: `${hotelOptions.length} option quote — ${hotelOptions.map(o => o.hotel).join(' / ')} · Refs: ${refs.join(', ')}`
    })
  } else if (quoteType === 'multi' && centres) {
    const ref = genRef(initials, await quoteRepository.getQuoteCountForDeal(dealId))
    refs.push(ref)

    const totalNights = centres.reduce((a, c) => a + (parseInt(c.nights) || 0), 0)
    const destList = centres.map(c => c.destination).filter(Boolean).join(' → ')

    const totalNet = centres.reduce((a, c) => {
      const accN = parseFloat(c.accNet) || 0
      const flightN = parseFloat(c.flightNet) || 0
      const transN = parseFloat(c.transNet) || 0
      return a + accN + flightN + transN + c.extras.reduce((x, e) => x + (e.net || 0), 0)
    }, 0)

    await quoteRepository.createQuote({
      deal_id: dealId,
      quote_type: 'multi_centre',
      centres,
      hotel: `Multi-Centre: ${destList}`,
      destination: destList,
      board_basis: centres.map(c => c.boardBasis).join(' / '),
      departure_date: centres[0]?.inboundLegs[0]?.date || null,
      nights: totalNights,
      adults: adults || 2,
      children: children || 0,
      infants: infants || 0,
      price: sellPrice || 0,
      profit: profit || 0,
      margin_percent: parseFloat((margin || 0).toFixed(1)) || 0,
      consultant_initials: initials,
      quote_ref: ref,
      sent_to_client: false,
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
    })

    await quoteRepository.updateDeal(dealId, {
      deal_value: sellPrice || 0,
      departure_date: centres[0]?.inboundLegs[0]?.date || undefined,
    })

    await quoteRepository.createActivity({
      deal_id: dealId,
      activity_type: 'QUOTE_CREATED',
      notes: `Multi-centre quote — ${destList} · ${fmtS(sellPrice || 0)} · Ref: ${ref}`
    })
  }

  return refs
}

export async function saveQuoteFromRequest(body: {
  dealId?: number | string
  quoteType?: 'single' | 'multi'
  quoteRef?: string
  adults?: number | string
  children?: number | string
  infants?: number | string
  initials?: string
  additionalServices?: string
  hotelOptions?: HotelOption[]
  centres?: Centre[]
  sellPrice?: number | string
  margin?: number | string
  profit?: number | string
  isEdit?: boolean
  editQuoteId?: number | string
}): Promise<string[]> {
  const dealId = Number(body.dealId)
  if (!dealId) {
    throw new Error('Deal ID is required')
  }

  const quoteType = body.quoteType || 'single'
  const sellPrice = body.sellPrice === undefined || body.sellPrice === null || body.sellPrice === ''
    ? undefined
    : Number(body.sellPrice)
  const margin = body.margin === undefined || body.margin === null || body.margin === ''
    ? undefined
    : Number(body.margin)
  const profit = body.profit === undefined || body.profit === null || body.profit === ''
    ? undefined
    : Number(body.profit)

  const validationError = validateQuote(quoteType, body.hotelOptions, body.centres, sellPrice)
  if (validationError) {
    throw new Error(validationError)
  }

  return saveQuote(
    dealId,
    {
      quoteType,
      quoteRef: body.quoteRef || '',
      adults: Number(body.adults) || 2,
      children: Number(body.children) || 0,
      infants: Number(body.infants) || 0,
      initials: body.initials || 'SA',
      additionalServices: body.additionalServices || '',
      hotelOptions: body.hotelOptions,
      centres: body.centres,
      sellPrice,
      margin,
      profit,
    },
    Boolean(body.isEdit),
    body.editQuoteId ? Number(body.editQuoteId) : undefined
  )
}

export function validateQuote(
  quoteType: 'single' | 'multi',
  hotelOptions?: HotelOption[],
  centres?: Centre[],
  sellPrice?: number
): string | null {
  if (quoteType === 'single' && hotelOptions) {
    if (hotelOptions.some(o => !o.hotel.trim())) {
      return 'All hotel options need a hotel name'
    }
    if (hotelOptions.some(o => !o.sellPrice)) {
      return 'All hotel options need a sell price'
    }
  } else if (quoteType === 'multi' && centres) {
    if (centres.some(c => !c.destination.trim())) {
      return 'All centres need a destination'
    }
    if (centres.some(c => !c.hotel.trim())) {
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
  getQuoteCountForDeal: quoteRepository.getQuoteCountForDeal,
}
