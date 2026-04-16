'use client'

import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { authedFetch } from '@/lib/api-client'

// ── CONSTANTS ─────────────────────────────────────────────
type FlightLeg = {
  id: string
  flight_number?: string
  date?: string
  depart_time?: string
  arrival_time?: string
  checkin_time?: string
  airline?: string
  from?: string
  to?: string
  cabin?: string
  overnight?: boolean
}

type ExtraItem = {
  id: string
  label: string
  net: number
}

type HotelOption = {
  id: string
  hotel: string
  roomType?: string
  boardBasis: string
  nights: string
  checkinDate?: string
  checkinNextDay: boolean
  outLegs: FlightLeg[]
  retLegs: FlightLeg[]
  flightNet: string
  accNet: string
  transNet: string
  extras: ExtraItem[]
  sellPrice: string
  margin: string
  profit: string
  optionLabel?: string
  flightOptionId?: string
  flightOptionLabel?: string
}

type FlightOption = {
  id: string
  label: string
  outLegs: FlightLeg[]
  retLegs: FlightLeg[]
  flightNet: string
  transNet: string
}

type SharedQuoteDefaults = {
  origin: string
  outboundDate: string
  returnDate: string
}

type AccommodationOption = {
  id: string
  hotel: string
  roomType?: string
  boardBasis: string
  nights: string
  checkinDate?: string
  checkinNextDay: boolean
  accNet: string
  extras: ExtraItem[]
  sellPrice: string
  margin: string
  profit: string
  useDefaultFlight: boolean
  assignedFlightOptionIds: string[]
  pricingFlightOptionId: string
}

type Centre = {
  id: string
  destination: string
  hotel: string
  roomType?: string
  boardBasis: string
  nights: string
  checkinDate?: string
  checkinNextDay: boolean
  inboundLegs: FlightLeg[]
  outboundLegs: FlightLeg[]
  flightNet: string
  accNet: string
  transNet: string
  extras: ExtraItem[]
}

type DealInfo = {
  id: number
  title: string
  departure_date?: string
  clients?: {
    first_name: string
    last_name: string
    email: string
    phone?: string
  }
}

type EmailTemplate = {
  id: number
  name: string
  description?: string
  opening_hook?: string
  why_choose_us?: string
  urgency_notice?: string
  closing_cta?: string
}

type AirportOption = {
  code: string
  name: string
  city: string
  country: string
}

const AIRLINES = [
  'British Airways', 'Virgin Atlantic', 'Emirates', 'Qatar Airways', 'Etihad Airways',
  'Air Mauritius', 'Air France', 'KLM', 'Lufthansa', 'Swiss Air', 'Austrian Airlines',
  'Turkish Airlines', 'Singapore Airlines', 'Cathay Pacific', 'Malaysia Airlines',
  'South African Airways', 'Kenya Airways', 'Ethiopian Airlines', 'EgyptAir',
  'Condor', 'TUI', 'Thomas Cook', 'Monarch', 'EasyJet', 'Ryanair'
]

const DEFAULT_AIRPORTS: AirportOption[] = [
  { code: 'LHR', name: 'London Heathrow', city: 'London', country: 'United Kingdom' },
  { code: 'LGW', name: 'London Gatwick', city: 'London', country: 'United Kingdom' },
  { code: 'LTN', name: 'London Luton', city: 'London', country: 'United Kingdom' },
  { code: 'STN', name: 'London Stansted', city: 'London', country: 'United Kingdom' },
  { code: 'LCY', name: 'London City', city: 'London', country: 'United Kingdom' },
  { code: 'MAN', name: 'Manchester', city: 'Manchester', country: 'United Kingdom' },
  { code: 'BHX', name: 'Birmingham', city: 'Birmingham', country: 'United Kingdom' },
  { code: 'GLA', name: 'Glasgow', city: 'Glasgow', country: 'United Kingdom' },
  { code: 'EDI', name: 'Edinburgh', city: 'Edinburgh', country: 'United Kingdom' },
  { code: 'BRS', name: 'Bristol', city: 'Bristol', country: 'United Kingdom' },
  { code: 'NCL', name: 'Newcastle', city: 'Newcastle', country: 'United Kingdom' },
  { code: 'EMA', name: 'East Midlands', city: 'Nottingham', country: 'United Kingdom' },
  { code: 'LBA', name: 'Leeds Bradford', city: 'Leeds', country: 'United Kingdom' },
  { code: 'SOU', name: 'Southampton', city: 'Southampton', country: 'United Kingdom' },
  { code: 'CWL', name: 'Cardiff', city: 'Cardiff', country: 'United Kingdom' },
  { code: 'BFS', name: 'Belfast International', city: 'Belfast', country: 'United Kingdom' },
  { code: 'JER', name: 'Jersey', city: 'Jersey', country: 'Channel Islands' },
  { code: 'GCI', name: 'Guernsey', city: 'Guernsey', country: 'Channel Islands' },
  { code: 'DUB', name: 'Dublin', city: 'Dublin', country: 'Ireland' },
  { code: 'ORK', name: 'Cork', city: 'Cork', country: 'Ireland' },
  { code: 'SNN', name: 'Shannon', city: 'Shannon', country: 'Ireland' },
  { code: 'CDG', name: 'Charles de Gaulle', city: 'Paris', country: 'France' },
  { code: 'ORY', name: 'Orly', city: 'Paris', country: 'France' },
  { code: 'FRA', name: 'Frankfurt', city: 'Frankfurt', country: 'Germany' },
  { code: 'MUC', name: 'Munich', city: 'Munich', country: 'Germany' },
  { code: 'FCO', name: 'Fiumicino', city: 'Rome', country: 'Italy' },
  { code: 'AMS', name: 'Schiphol', city: 'Amsterdam', country: 'Netherlands' },
  { code: 'ZRH', name: 'Zurich', city: 'Zurich', country: 'Switzerland' },
  { code: 'VIE', name: 'Vienna', city: 'Vienna', country: 'Austria' },
  { code: 'IST', name: 'Istanbul', city: 'Istanbul', country: 'Turkey' },
  { code: 'DOH', name: 'Hamad International', city: 'Doha', country: 'Qatar' },
  { code: 'AUH', name: 'Abu Dhabi', city: 'Abu Dhabi', country: 'United Arab Emirates' },
  { code: 'DXB', name: 'Dubai International', city: 'Dubai', country: 'United Arab Emirates' },
  { code: 'SIN', name: 'Changi', city: 'Singapore', country: 'Singapore' },
  { code: 'HKG', name: 'Hong Kong International', city: 'Hong Kong', country: 'Hong Kong' },
  { code: 'BKK', name: 'Suvarnabhumi', city: 'Bangkok', country: 'Thailand' },
  { code: 'KUL', name: 'Kuala Lumpur International', city: 'Kuala Lumpur', country: 'Malaysia' },
  { code: 'JNB', name: 'O.R. Tambo', city: 'Johannesburg', country: 'South Africa' },
  { code: 'NBO', name: 'Jomo Kenyatta', city: 'Nairobi', country: 'Kenya' },
  { code: 'ADD', name: 'Bole International', city: 'Addis Ababa', country: 'Ethiopia' },
  { code: 'CAI', name: 'Cairo International', city: 'Cairo', country: 'Egypt' },
  { code: 'MRU', name: 'Sir Seewoosagur Ramgoolam', city: 'Mauritius', country: 'Mauritius' },
  { code: 'SEZ', name: 'Mahé Seychelles', city: 'Mahé', country: 'Seychelles' },
  { code: 'BEY', name: 'Beirut Rafic Hariri', city: 'Beirut', country: 'Lebanon' },
  { code: 'TLV', name: 'Ben Gurion', city: 'Tel Aviv', country: 'Israel' },
  { code: 'CPT', name: 'Cape Town International', city: 'Cape Town', country: 'South Africa' },
  { code: 'DAR', name: 'Julius Nyerere', city: 'Dar es Salaam', country: 'Tanzania' },
  { code: 'MBA', name: 'Moi International', city: 'Mombasa', country: 'Kenya' },
  { code: 'ZNZ', name: 'Abeid Amani Karume', city: 'Zanzibar', country: 'Tanzania' },
]

const CABIN_CLASS = ['Economy', 'Premium Economy', 'Business', 'First']

const QUICK_EXTRAS = [
  'Airport Lounge Access', 'Private Transfer', 'Welcome Amenity',
  'Excursion Credit', 'Travel Insurance', 'Visa Fees'
]

const CONTACT = {
  direct:'020 8951 6922', whatsapp:'07881 551204',
  email:'samir@mauritiusholidaysdirect.co.uk',
  calendly:'https://calendly.com/mauritiusexpert',
  trustpilot:'https://uk.trustpilot.com/review/www.mauritiusholidaysdirect.co.uk',
  address:'130 Burnt Oak Broadway, Edgware, Middlesex HA8 0BB',
  web:'www.mauritiusholidaysdirect.co.uk',
}

// ── HELPERS ───────────────────────────────────────────────
function uid(): string {
  return Math.random().toString(36).substr(2, 9)
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + 'T12:00')
  date.setDate(date.getDate() + days)
  return date.toISOString().split('T')[0]
}

function fmt(num: number): string {
  return '£' + num.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtS(num: number): string {
  return '£' + num.toLocaleString('en-GB', { maximumFractionDigits: 0 })
}

function genRef(initials: string, count: number): string {
  const now = new Date()
  const dd  = now.getDate().toString().padStart(2, '0')
  const mm  = (now.getMonth() + 1).toString().padStart(2, '0')
  const yy  = now.getFullYear().toString().slice(-2)
  return `${dd}${mm}${yy}${initials}${(count + 1).toString().padStart(2, '0')}`
}

function newLeg(direction: 'out' | 'ret'): FlightLeg {
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

function newHotelOption(): HotelOption {
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

function newSharedQuoteDefaults(): SharedQuoteDefaults {
  return {
    origin: 'LHR',
    outboundDate: '',
    returnDate: '',
  }
}

function newFlightOption(defaults: SharedQuoteDefaults = newSharedQuoteDefaults()): FlightOption {
  return {
    id: uid(),
    label: '',
    outLegs: [{ ...newLeg('out'), from: defaults.origin || 'LHR', date: defaults.outboundDate || '' }],
    retLegs: [{ ...newLeg('ret'), to: defaults.origin || 'LHR', date: defaults.returnDate || '' }],
    flightNet: '',
    transNet: '',
  }
}

function newAccOption(defaults: SharedQuoteDefaults = newSharedQuoteDefaults()): AccommodationOption {
  return {
    id: uid(),
    hotel: '',
    roomType: '',
    boardBasis: 'All Inclusive',
    nights: '7',
    checkinDate: defaults.outboundDate || '',
    checkinNextDay: false,
    accNet: '',
    extras: [],
    sellPrice: '',
    margin: '',
    profit: '',
    useDefaultFlight: true,
    assignedFlightOptionIds: [],
    pricingFlightOptionId: '',
  }
}

function newCentre(destination: string): Centre {
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

function fmtDate(d: string | undefined): string {
  if (!d) return '—'
  return new Date(d + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function sortAirportOptions(airports: AirportOption[]): AirportOption[] {
  return [...airports].sort((a, b) => a.code.localeCompare(b.code))
}


function normaliseLegTime(t: string): string {
  // Accept both HH:MM and HHMM — browsers emit HH:MM from time inputs but
  // users sometimes type HHMM directly (4-digit no colon).
  if (t.length === 4 && !t.includes(':')) return t.slice(0, 2) + ':' + t.slice(2)
  return t
}

function getLegTimestamp(leg: FlightLeg): number {
  if (!leg.date) return Number.MAX_SAFE_INTEGER
  const raw = leg.depart_time || leg.checkin_time || leg.arrival_time || '23:59'
  const time = normaliseLegTime(raw)
  const ts = new Date(`${leg.date}T${time}`).getTime()
  return isNaN(ts) ? Number.MAX_SAFE_INTEGER : ts
}

function getStayTimestamp(checkinDate?: string, checkinNextDay?: boolean): number {
  if (!checkinDate) return Number.MAX_SAFE_INTEGER
  const actualDate = checkinNextDay ? addDays(checkinDate, 1) : checkinDate
  return new Date(`${actualDate}T15:00`).getTime()
}

function sortFlightLegs(legs: FlightLeg[]): FlightLeg[] {
  return [...legs].sort((a, b) => getLegTimestamp(a) - getLegTimestamp(b))
}

function numVal(value: string | number | undefined | null): number {
  const parsed = typeof value === 'number' ? value : parseFloat(value || '')
  return Number.isFinite(parsed) ? parsed : 0
}

function optionLetter(index: number): string {
  return String.fromCharCode(65 + (index % 26))
}

function getFlightOptionTitle(option: FlightOption, index: number): string {
  const customLabel = option.label.trim()
  if (customLabel) return customLabel

  const firstOut = sortFlightLegs(option.outLegs || []).find(leg => leg.airline || leg.from || leg.to || leg.date)
  if (firstOut) {
    const route = [firstOut.from, firstOut.to].filter(Boolean).join(' → ')
    const airline = firstOut.airline ? `${firstOut.airline}${route ? ' · ' : ''}` : ''
    return `${airline}${route || `Flight ${optionLetter(index)}`}`
  }

  return `Flight ${optionLetter(index)}`
}

function getFlightOptionSummary(option: FlightOption): string {
  const outbound = sortFlightLegs(option.outLegs || []).find(leg => leg.from || leg.to || leg.date || leg.depart_time || leg.airline)
  const inbound = sortFlightLegs(option.retLegs || []).find(leg => leg.from || leg.to || leg.date || leg.depart_time || leg.airline)
  const parts = [
    outbound?.date ? fmtDate(outbound.date) : '',
    outbound?.cabin || inbound?.cabin || '',
    outbound?.airline || '',
  ].filter(Boolean)

  if (parts.length > 0) return parts.join(' · ')
  if (outbound?.from || outbound?.to) return [outbound?.from, outbound?.to].filter(Boolean).join(' → ')
  return 'Add airline, routing and timings'
}

function getFlightCostTotal(option: FlightOption | null | undefined): number {
  if (!option) return 0
  return numVal(option.flightNet) + numVal(option.transNet)
}

function getAccommodationExtrasTotal(option: AccommodationOption): number {
  return option.extras.reduce((sum, extra) => sum + numVal(extra.net), 0)
}

function applySharedDefaultsToFlightOption(option: FlightOption, defaults: SharedQuoteDefaults): FlightOption {
  return {
    ...option,
    outLegs: (option.outLegs || []).map((leg, index) => index === 0
      ? {
          ...leg,
          from: leg.from || defaults.origin || leg.from,
          date: leg.date || defaults.outboundDate || leg.date,
        }
      : leg),
    retLegs: (option.retLegs || []).map((leg, index, arr) => index === arr.length - 1
      ? {
          ...leg,
          to: leg.to || defaults.origin || leg.to,
          date: leg.date || defaults.returnDate || leg.date,
        }
      : leg),
  }
}

function applySharedDefaultsToAccommodationOption(option: AccommodationOption, defaults: SharedQuoteDefaults): AccommodationOption {
  if (option.checkinDate || !defaults.outboundDate) return option
  return { ...option, checkinDate: defaults.outboundDate }
}

function getOrderedSelectedFlightOptions(
  option: AccommodationOption,
  flightOptions: FlightOption[],
  defaultFlightOptionId: string
): FlightOption[] {
  const orderedIds: string[] = []

  if (option.useDefaultFlight && defaultFlightOptionId) {
    orderedIds.push(defaultFlightOptionId)
  }

  flightOptions.forEach(flightOption => {
    if (option.assignedFlightOptionIds.includes(flightOption.id) && !orderedIds.includes(flightOption.id)) {
      orderedIds.push(flightOption.id)
    }
  })

  return orderedIds
    .map(id => flightOptions.find(flightOption => flightOption.id === id))
    .filter((flightOption): flightOption is FlightOption => Boolean(flightOption))
}

function normalizeAccommodationOptionAssignments(
  option: AccommodationOption,
  flightOptions: FlightOption[],
  defaultFlightOptionId: string
): AccommodationOption {
  const validIds = new Set(flightOptions.map(flightOption => flightOption.id))
  const assignedFlightOptionIds = Array.from(new Set(
    option.assignedFlightOptionIds.filter(id => validIds.has(id) && id !== defaultFlightOptionId)
  ))
  const useDefaultFlight = option.useDefaultFlight && validIds.has(defaultFlightOptionId)
  const normalizedOption = {
    ...option,
    useDefaultFlight,
    assignedFlightOptionIds,
  }
  const selectedFlightOptions = getOrderedSelectedFlightOptions(normalizedOption, flightOptions, defaultFlightOptionId)
  const pricingFlightOptionId = selectedFlightOptions.some(flightOption => flightOption.id === option.pricingFlightOptionId)
    ? option.pricingFlightOptionId
    : (selectedFlightOptions[0]?.id || '')

  return {
    ...normalizedOption,
    pricingFlightOptionId,
  }
}

function resolveAccommodationPricingFlight(
  option: AccommodationOption,
  flightOptions: FlightOption[],
  defaultFlightOptionId: string
): FlightOption | null {
  const normalizedOption = normalizeAccommodationOptionAssignments(option, flightOptions, defaultFlightOptionId)
  return getOrderedSelectedFlightOptions(normalizedOption, flightOptions, defaultFlightOptionId)
    .find(flightOption => flightOption.id === normalizedOption.pricingFlightOptionId) || null
}

function buildSingleQuoteHotelOptions(
  flightOptions: FlightOption[],
  defaultFlightOptionId: string,
  accommodationOptions: AccommodationOption[]
): HotelOption[] {
  return accommodationOptions.flatMap(accommodationOption => {
    const normalizedAccommodation = normalizeAccommodationOptionAssignments(accommodationOption, flightOptions, defaultFlightOptionId)
    const selectedFlightOptions = getOrderedSelectedFlightOptions(normalizedAccommodation, flightOptions, defaultFlightOptionId)
    const pricingFlightOption = resolveAccommodationPricingFlight(normalizedAccommodation, flightOptions, defaultFlightOptionId)
    const accommodationExtrasNet = getAccommodationExtrasTotal(normalizedAccommodation)
    const accommodationNet = numVal(normalizedAccommodation.accNet)
    const pricingFlightNet = getFlightCostTotal(pricingFlightOption)

    return selectedFlightOptions.map(flightOption => {
      const totalNet = accommodationNet + accommodationExtrasNet + getFlightCostTotal(flightOption)
      let sellPrice = numVal(normalizedAccommodation.sellPrice)

      if (sellPrice > 0 && pricingFlightOption) {
        sellPrice += getFlightCostTotal(flightOption) - pricingFlightNet
      } else if (sellPrice <= 0 && numVal(normalizedAccommodation.margin) > 0) {
        sellPrice = totalNet * (1 + (numVal(normalizedAccommodation.margin) / 100))
      } else if (sellPrice <= 0 && numVal(normalizedAccommodation.profit) > 0) {
        sellPrice = totalNet + numVal(normalizedAccommodation.profit)
      }

      const profit = sellPrice > 0
        ? sellPrice - totalNet
        : numVal(normalizedAccommodation.profit)
      const margin = sellPrice > 0 && profit > 0 && sellPrice > profit
        ? (profit / (sellPrice - profit)) * 100
        : numVal(normalizedAccommodation.margin)
      const flightIndex = flightOptions.findIndex(existingOption => existingOption.id === flightOption.id)
      const flightLabel = getFlightOptionTitle(flightOption, flightIndex >= 0 ? flightIndex : 0)
      const hotelName = normalizedAccommodation.hotel.trim() || 'Hotel option'

      return {
        id: `${normalizedAccommodation.id}:${flightOption.id}`,
        hotel: normalizedAccommodation.hotel,
        roomType: normalizedAccommodation.roomType,
        boardBasis: normalizedAccommodation.boardBasis,
        nights: normalizedAccommodation.nights,
        checkinDate: normalizedAccommodation.checkinDate,
        checkinNextDay: normalizedAccommodation.checkinNextDay,
        outLegs: sortFlightLegs(flightOption.outLegs || []),
        retLegs: sortFlightLegs(flightOption.retLegs || []),
        flightNet: flightOption.flightNet,
        accNet: normalizedAccommodation.accNet,
        transNet: flightOption.transNet,
        extras: normalizedAccommodation.extras,
        sellPrice: sellPrice > 0 ? sellPrice.toFixed(2) : normalizedAccommodation.sellPrice,
        margin: margin > 0 ? margin.toFixed(1) : normalizedAccommodation.margin,
        profit: profit > 0 ? profit.toFixed(2) : normalizedAccommodation.profit,
        optionLabel: `${hotelName} with ${flightLabel}`,
        flightOptionId: flightOption.id,
        flightOptionLabel: flightLabel,
      }
    })
  })
}

function getFlightSignature(option: Pick<HotelOption, 'outLegs' | 'retLegs' | 'flightNet' | 'transNet'>): string {
  return JSON.stringify({
    outLegs: sortFlightLegs(option.outLegs || []),
    retLegs: sortFlightLegs(option.retLegs || []),
    flightNet: option.flightNet,
    transNet: option.transNet,
  })
}

function normalizeHotelOption(option: HotelOption): HotelOption {
  return {
    ...option,
    outLegs: sortFlightLegs(option.outLegs || []),
    retLegs: sortFlightLegs(option.retLegs || []),
  }
}

function getCentreTimestamp(centre: Centre): number {
  const legTimes = [...(centre.inboundLegs || []), ...(centre.outboundLegs || [])]
    .map(getLegTimestamp)
    .filter(Number.isFinite)

  const stayTime = getStayTimestamp(centre.checkinDate, centre.checkinNextDay)
  const candidates = stayTime === Number.MAX_SAFE_INTEGER ? legTimes : [...legTimes, stayTime]
  return candidates.length > 0 ? Math.min(...candidates) : Number.MAX_SAFE_INTEGER
}

function normalizeCentre(centre: Centre): Centre {
  return {
    ...centre,
    inboundLegs: sortFlightLegs(centre.inboundLegs || []),
    outboundLegs: sortFlightLegs(centre.outboundLegs || []),
  }
}

function sortCentresChronologically(centres: Centre[]): Centre[] {
  return [...centres]
    .map(normalizeCentre)
    .sort((a, b) => getCentreTimestamp(a) - getCentreTimestamp(b))
}



function buildChronologicalItinerary(centres: Centre[]): Array<{
  type: 'flights' | 'stay'
  timestamp: number
  title?: string
  legs?: FlightLeg[]
  centre?: Centre
  centreIndex?: number
}> {
  // A leg is only real if it has a date (prevents stray placeholder rows)
  function isRealLeg(leg: FlightLeg): boolean {
    return !!(leg.date)
  }

  const events: Array<{
    type: 'flights' | 'stay'
    timestamp: number
    title?: string
    legs?: FlightLeg[]
    centre?: Centre
    centreIndex?: number
  }> = []

  centres.forEach((centre, index) => {
    // Inbound legs for this centre (e.g. LHR→MRU or MRU→RRG)
    const inLegs = sortFlightLegs((centre.inboundLegs || []).filter(isRealLeg))
    if (inLegs.length > 0) {
      events.push({
        type: 'flights',
        timestamp: getLegTimestamp(inLegs[0]),
        title: index === 0
          ? 'Outbound Flights'
          : `Flights to ${centre.destination || `Centre ${index + 1}`}`,
        legs: inLegs,
      })
    }

    // Stay at this centre
    const stayTs = getStayTimestamp(centre.checkinDate, centre.checkinNextDay)
    if (stayTs !== Number.MAX_SAFE_INTEGER) {
      events.push({
        type: 'stay',
        timestamp: stayTs,
        centre,
        centreIndex: index,
      })
    }

    // Outbound legs from this centre — only emit if this is the last centre
    // (inter-centre legs appear as the *next* centre's inbound legs)
    // However if the last centre has outbound legs, those are the return flights
    if (index === centres.length - 1) {
      const outLegs = sortFlightLegs((centre.outboundLegs || []).filter(isRealLeg))
      if (outLegs.length > 0) {
        events.push({
          type: 'flights',
          timestamp: getLegTimestamp(outLegs[0]),
          title: 'Return Flights',
          legs: outLegs,
        })
      }
    }
  })

  // Final chronological sort (handles edge cases where dates entered out of order)
  return events.sort((a, b) => a.timestamp - b.timestamp)
}

// ── DB-BACKED SEARCH ──────────────────────────────────────
function DBSearch({ table, field='name', value, onChange, placeholder, extraQuery }:{ table:string; field?:string; value:string; onChange:(v:string)=>void; placeholder:string; extraQuery?:(q:any)=>any }) {
  const [q,setQ]           = useState(value)
  const [results,setRes]   = useState<string[]>([])
  const [open,setOpen]     = useState(false)
  const [saving,setSaving] = useState(false)
  const ref                = useRef<HTMLDivElement>(null)
  const timer              = useRef<any>(null)

  useEffect(()=>{ setQ(value) },[value])
  useEffect(()=>{
    const h=(e:MouseEvent)=>{ if(ref.current&&!ref.current.contains(e.target as Node))setOpen(false) }
    document.addEventListener('mousedown',h); return ()=>document.removeEventListener('mousedown',h)
  },[])

  function search(val:string){
    if(timer.current) clearTimeout(timer.current)
    timer.current=setTimeout(async()=>{
      try {
        const response = await fetch(`/api/search?table=${table}&q=${encodeURIComponent(val)}`)
        if (response.ok) {
          const data = await response.json()
          setRes(data)
        }
      } catch (error) {
        console.error('Search failed:', error)
      }
    },200)
  }

  function handleChange(val:string){ setQ(val); onChange(val); setOpen(true); search(val) }

  async function saveNew(){
    if(!q.trim()) return
    setSaving(true)
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table, field, value: q.trim() })
      })
      if (response.ok) {
        setOpen(false)
        onChange(q.trim())
      }
    } catch (error) {
      console.error('Save failed:', error)
    }
    setSaving(false)
  }

  const showSaveNew = q.trim().length>1 && !results.includes(q.trim())

  return(
    <div ref={ref} style={{position:'relative'}}>
      <input className="input" placeholder={placeholder} value={q}
        onChange={e=>handleChange(e.target.value)}
        onFocus={()=>{ setOpen(true); search(q) }} autoComplete="off"/>
      {open&&(
        <div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:400,background:'var(--surface)',border:'1.5px solid var(--border)',borderRadius:'10px',boxShadow:'var(--shadow-lg)',marginTop:'4px',maxHeight:'280px',overflowY:'auto'}}>
          {results.map(r=>(
            <div key={r} onMouseDown={()=>{ setQ(r); onChange(r); setOpen(false) }}
              style={{padding:'10px 16px',fontSize:'13.5px',cursor:'pointer',borderBottom:'1px solid var(--border)',color:'var(--text-primary)',background:r===value?'var(--accent-light)':'transparent'}}
              onMouseEnter={e=>(e.currentTarget.style.background='var(--bg-tertiary)')}
              onMouseLeave={e=>(e.currentTarget.style.background=r===value?'var(--accent-light)':'transparent')}>
              {r===value&&<span style={{color:'var(--accent)',marginRight:'8px'}}>✓</span>}{r}
            </div>
          ))}
          {showSaveNew&&(
            <div onMouseDown={saveNew}
              style={{padding:'10px 16px',fontSize:'13px',cursor:'pointer',color:'var(--accent-mid)',fontWeight:'600',borderTop:'1px solid var(--border)',background:'var(--accent-light)'}}>
              {saving?'Saving…':`+ Save "${q.trim()}" for future use`}
            </div>
          )}
          {results.length===0&&!showSaveNew&&<div style={{padding:'12px 16px',fontSize:'13px',color:'var(--text-muted)'}}>No results — type to save new</div>}
        </div>
      )}
    </div>
  )
}

// ── FLIGHT LEG ROW ────────────────────────────────────────
function LegRow({
  leg,
  legs,
  setLegs,
  canRemove,
  airports,
  onCreateAirport,
}:{
  leg:FlightLeg
  legs:FlightLeg[]
  setLegs:(l:FlightLeg[])=>void
  canRemove:boolean
  airports: AirportOption[]
  onCreateAirport: (airport: AirportOption) => Promise<AirportOption>
}){
  const upd=(field:keyof FlightLeg,val:any)=>setLegs(legs.map(l=>l.id===leg.id?{...l,[field]:val}:l))
  const [addField,setAddField] = useState<'from'|'to'|null>(null)
  const [airportForm,setAirportForm] = useState<AirportOption>({ code:'', name:'', city:'', country:'' })
  const [airportSaving,setAirportSaving] = useState(false)
  const [airportError,setAirportError] = useState('')

  function openAirportForm(field: 'from'|'to') {
    const suggestedCode = ((field === 'from' ? leg.from : leg.to) || '').replace(/[^a-z]/gi, '').slice(0, 3).toUpperCase()
    setAddField(field)
    setAirportError('')
    setAirportForm({ code: suggestedCode, name: '', city: '', country: '' })
  }

  async function saveAirport() {
    setAirportSaving(true)
    setAirportError('')
    try {
      const airport = await onCreateAirport(airportForm)
      upd(addField === 'from' ? 'from' : 'to', airport.code)
      setAddField(null)
    } catch (error) {
      setAirportError(error instanceof Error ? error.message : 'Failed to save airport')
    } finally {
      setAirportSaving(false)
    }
  }

  return(
    <div style={{background:'var(--bg-tertiary)',border:'1px solid var(--border)',borderRadius:'10px',padding:'12px 14px',marginBottom:'8px',position:'relative'}}>
      <div style={{display:'grid',gridTemplateColumns:'1fr repeat(4,1fr)',gap:'8px',marginBottom:'8px'}}>
        <div><label className="label">Flight No.</label><input className="input" placeholder="MK053" value={leg.flight_number||''} onChange={e=>upd('flight_number',e.target.value)} style={{fontFamily:'monospace',textTransform:'uppercase'}}/></div>
        <div><label className="label">Date</label><input className="input" type="date" value={leg.date} onChange={e=>upd('date',e.target.value)}/></div>
        <div><label className="label">Departs</label><input className="input" placeholder="16:00" maxLength={5} value={leg.depart_time} onChange={e=>upd('depart_time',e.target.value)} style={{fontFamily:'monospace',textAlign:'center'}}/></div>
        <div><label className="label">Check-in by</label><input className="input" placeholder="13:00" maxLength={5} value={leg.checkin_time} onChange={e=>upd('checkin_time',e.target.value)} style={{fontFamily:'monospace',textAlign:'center'}}/></div>
        <div><label className="label">Arrives</label><input className="input" placeholder="07:40" maxLength={5} value={leg.arrival_time} onChange={e=>upd('arrival_time',e.target.value)} style={{fontFamily:'monospace',textAlign:'center'}}/></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr auto',gap:'8px',alignItems:'flex-end'}}>
        <div><label className="label">Airline</label>
          <select className="input" value={leg.airline} onChange={e=>upd('airline',e.target.value)}>{AIRLINES.map(a=><option key={a}>{a}</option>)}</select></div>
        <div><label className="label" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span>From</span>
          <button type="button" onClick={()=>openAirportForm('from')}
            style={{fontSize:'10.5px',color:'var(--text-muted)',background:'none',border:'none',padding:'0',cursor:'pointer',textDecoration:'underline',textUnderlineOffset:'2px'}}>
            + Add new
          </button>
        </label>
          <select className="input" value={leg.from} onChange={e=>upd('from',e.target.value)}>
            <option value="">Select airport</option>
            {airports.map(a=><option key={a.code} value={a.code}>{a.code}{a.name?` — ${a.name}`:''}</option>)}
          </select></div>
        <div><label className="label" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span>To</span>
          <button type="button" onClick={()=>openAirportForm('to')}
            style={{fontSize:'10.5px',color:'var(--text-muted)',background:'none',border:'none',padding:'0',cursor:'pointer',textDecoration:'underline',textUnderlineOffset:'2px'}}>
            + Add new
          </button>
        </label>
          <select className="input" value={leg.to} onChange={e=>upd('to',e.target.value)}>
            <option value="">Select airport</option>
            {airports.map(a=><option key={a.code} value={a.code}>{a.code}{a.name?` — ${a.name}`:''}</option>)}
          </select></div>
        <div><label className="label">Cabin</label>
          <select className="input" value={leg.cabin} onChange={e=>upd('cabin',e.target.value)}>{CABIN_CLASS.map(c=><option key={c}>{c}</option>)}</select></div>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'4px',paddingBottom:'2px'}}>
          <label className="label" style={{whiteSpace:'nowrap'}}>+1</label>
          <input type="checkbox" checked={leg.overnight} onChange={e=>upd('overnight',e.target.checked)} style={{width:'18px',height:'18px',cursor:'pointer'}}/>
        </div>
      </div>
      {addField && (
        <div style={{position:'absolute',left:'14px',right:'14px',top:'100%',marginTop:'8px',padding:'10px 12px',border:'1px solid var(--border)',borderRadius:'8px',background:'var(--surface)',boxShadow:'var(--shadow-lg)',zIndex:30}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
            <span style={{fontSize:'11px',fontWeight:'600',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.07em'}}>Add new airport</span>
            <button type="button" onClick={()=>setAddField(null)} style={{fontSize:'11px',color:'var(--text-muted)',background:'none',border:'none',padding:'0',cursor:'pointer'}}>Cancel</button>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'90px 1.5fr 1fr 1fr auto',gap:'8px',alignItems:'flex-end'}}>
            <div><label className="label">IATA Code</label>
              <input className="input" maxLength={3} placeholder="RRG" value={airportForm.code}
                onChange={e=>setAirportForm(p=>({...p,code:e.target.value.toUpperCase().replace(/[^A-Z]/g,'')}))}
                style={{textTransform:'uppercase',fontFamily:'monospace',textAlign:'center',letterSpacing:'0.12em'}}/></div>
            <div><label className="label">Airport Name</label>
              <input className="input" placeholder="Plaine Corail Airport" value={airportForm.name}
                onChange={e=>setAirportForm(p=>({...p,name:e.target.value}))}/></div>
            <div><label className="label">City</label>
              <input className="input" placeholder="Rodrigues" value={airportForm.city}
                onChange={e=>setAirportForm(p=>({...p,city:e.target.value}))}/></div>
            <div><label className="label">Country</label>
              <input className="input" placeholder="Mauritius" value={airportForm.country}
                onChange={e=>setAirportForm(p=>({...p,country:e.target.value}))}/></div>
            <div style={{paddingBottom:'1px'}}>
              <button type="button" className="btn btn-cta btn-sm" onClick={saveAirport}
                disabled={airportSaving||airportForm.code.length!==3}>
                {airportSaving?'Saving…':'Save'}
              </button>
            </div>
          </div>
          {airportError && <div style={{marginTop:'6px',fontSize:'11.5px',color:'var(--red)'}}>{airportError}</div>}
        </div>
      )}
      {canRemove&&<button onClick={()=>setLegs(legs.filter(l=>l.id!==leg.id))} style={{marginTop:'8px',background:'var(--red-light)',color:'var(--red)',border:'none',borderRadius:'6px',padding:'4px 10px',cursor:'pointer',fontSize:'11.5px',fontFamily:'Outfit,sans-serif'}}>Remove leg</button>}
    </div>
  )
}

// ── HOTEL OPTION PANEL (Single Destination) ───────────────
function HotelOptionPanel({
  option,
  index,
  totalOptions,
  onChange,
  onRemove,
  onDuplicate,
  airports,
  onCreateAirport,
}:{
  option:HotelOption
  index:number
  totalOptions:number
  onChange:(o:HotelOption)=>void
  onRemove:()=>void
  onDuplicate:()=>void
  airports: AirportOption[]
  onCreateAirport: (airport: AirportOption) => Promise<AirportOption>
}){
  const [collapsed,setCollapsed]=useState(false)
  const upd=(field:keyof HotelOption,val:any)=>onChange({...option,[field]:val})
  const updLeg=(dir:'out'|'ret',legs:FlightLeg[])=>onChange({...option,[dir==='out'?'outLegs':'retLegs']:legs})
  const updExtra=(id:string,field:keyof ExtraItem,val:any)=>upd('extras',option.extras.map(e=>e.id===id?{...e,[field]:val}:e))

  const flightN=parseFloat(option.flightNet)||0, accN=parseFloat(option.accNet)||0, transN=parseFloat(option.transNet)||0
  const extrasN=option.extras.reduce((a,e)=>a+(e.net||0),0), totalNet=flightN+accN+transN+extrasN
  const sellN=parseFloat(option.sellPrice)||0, profitN=parseFloat(option.profit)||0
  const markupN = parseFloat(option.margin)|| (sellN>0&&profitN>0&&profitN<sellN ? (profitN/(sellN-profitN))*100 : 0)

  function onSell(v:string){
    const sell=parseFloat(v)||0
    const mg=parseFloat(option.margin)||0
    const pr=parseFloat(option.profit)||0
    if(sell>0&&mg>0){
      const profit = totalNet>0 ? totalNet*mg/100 : sell*mg/(100+mg)
      onChange({...option,sellPrice:v,profit:profit.toFixed(2)})
    } else if(sell>0&&pr>0){
      const markup = sell>pr ? (pr/(sell-pr))*100 : 0
      onChange({...option,sellPrice:v,margin:markup.toFixed(1)})
    } else onChange({...option,sellPrice:v})
  }
  function onMargin(v:string){
    const sell=parseFloat(option.sellPrice)||0
    const mg=parseFloat(v)||0
    if(totalNet>0&&mg>0){
      const s=totalNet*(1+mg/100)
      onChange({...option,margin:v,sellPrice:s.toFixed(2),profit:(totalNet*mg/100).toFixed(2)})
    } else if(sell>0&&mg>0){
      const profit = sell*mg/(100+mg)
      onChange({...option,margin:v,profit:profit.toFixed(2)})
    } else onChange({...option,margin:v})
  }
  function onProfit(v:string){
    const sell=parseFloat(option.sellPrice)||0
    const pr=parseFloat(v)||0
    if(sell>0&&pr>0){
      const markup = sell>pr ? (pr/(sell-pr))*100 : 0
      onChange({...option,profit:v,margin:markup.toFixed(1)})
    } else if(totalNet>0&&pr>0){
      const s=totalNet+pr
      onChange({...option,profit:v,sellPrice:s.toFixed(2),margin:((pr/totalNet)*100).toFixed(1)})
    } else onChange({...option,profit:v})
  }

  const COLORS=['#8b5cf6','#3b82f6','#10b981','#f59e0b','#ec4899']
  const color=COLORS[index%COLORS.length]

  return(
    <div className="card" style={{marginBottom:'14px',borderLeft:`3px solid ${color}`,overflow:'hidden'}}>
      <div style={{padding:'14px 18px',display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer',background:'var(--bg-tertiary)'}} onClick={()=>setCollapsed(c=>!c)}>
        <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
          <div style={{width:'26px',height:'26px',borderRadius:'50%',background:color,color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',fontWeight:'700',flexShrink:0}}>{index+1}</div>
          <div>
            <div style={{fontFamily:'Fraunces,serif',fontSize:'15px',fontWeight:'300',color:'var(--text-primary)'}}>{option.hotel||`Option ${index+1} — select hotel`}</div>
            <div style={{fontSize:'11.5px',color:'var(--text-muted)',marginTop:'1px'}}>{option.boardBasis}{option.nights?` · ${option.nights} nights`:''}{sellN>0?` · ${fmtS(sellN)}`:''}{markupN>0?` · ${markupN.toFixed(1)}%`:''}</div>
          </div>
        </div>
        <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
          {totalOptions>1&&<button onClick={e=>{e.stopPropagation();onDuplicate()}} className="btn btn-ghost btn-xs">⧉ Copy</button>}
          {totalOptions>1&&<button onClick={e=>{e.stopPropagation();onRemove()}} className="btn btn-danger btn-xs">Remove</button>}
          <span style={{color:'var(--text-muted)',fontSize:'16px',marginLeft:'4px'}}>{collapsed?'▸':'▾'}</span>
        </div>
      </div>

      {!collapsed&&(
        <div style={{padding:'18px'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'14px'}}>
            <div style={{gridColumn:'1/-1'}}><label className="label">Hotel Name *</label><DBSearch table="hotel_list" value={option.hotel} onChange={v=>upd('hotel',v)} placeholder="Search or type hotel name…"/></div>
            <div style={{gridColumn:'1/-1'}}><label className="label">Room Type</label><input className="input" placeholder="e.g. Deluxe Ocean Suite…" value={option.roomType} onChange={e=>upd('roomType',e.target.value)}/></div>
            <div><label className="label">Meal Plan</label><DBSearch table="meal_plan_list" value={option.boardBasis} onChange={v=>upd('boardBasis',v)} placeholder="Search meal plan…"/></div>
            <div><label className="label">Nights</label><input className="input" type="number" min="1" value={option.nights} onChange={e=>{
              const nights=e.target.value
              upd('nights',nights)
              // Auto-populate return flight date
              if(option.checkinDate&&nights){
                const retDate=new Date(option.checkinDate+'T12:00')
                retDate.setDate(retDate.getDate()+parseInt(nights)||0)
                const retStr=retDate.toISOString().split('T')[0]
                const updatedRetLegs=option.retLegs.map((l,i)=>i===0&&!l.date?{...l,date:retStr}:l)
                onChange({...option,nights,retLegs:updatedRetLegs})
              }
            }}/></div>
            <div><label className="label">Check-in Date</label><input className="input" type="date" value={option.checkinDate} onChange={e=>{
              const checkin=e.target.value
              // Auto-populate outbound flight date if empty
              const updatedOutLegs=option.outLegs.map((l,i)=>i===0&&!l.date?{...l,date:checkin}:l)
              // Auto-populate return flight date if nights set
              let updatedRetLegs=option.retLegs
              if(checkin&&option.nights){
                const retDate=new Date(checkin+'T12:00')
                retDate.setDate(retDate.getDate()+(parseInt(option.nights)||0))
                const retStr=retDate.toISOString().split('T')[0]
                updatedRetLegs=option.retLegs.map((l,i)=>i===0&&!l.date?{...l,date:retStr}:l)
              }
              onChange({...option,checkinDate:checkin,outLegs:updatedOutLegs,retLegs:updatedRetLegs})
            }}/></div>
            <div style={{display:'flex',flexDirection:'column',justifyContent:'flex-end',paddingBottom:'4px'}}>
              <label style={{display:'flex',alignItems:'center',gap:'8px',cursor:'pointer'}}>
                <input type="checkbox" checked={option.checkinNextDay} onChange={e=>upd('checkinNextDay',e.target.checked)} style={{width:'16px',height:'16px'}}/>
                <span style={{fontSize:'13px',color:'var(--text-secondary)'}}>Check-in next day{option.checkinNextDay&&option.checkinDate?<span style={{color:'var(--accent)',marginLeft:'6px',fontSize:'11.5px'}}>({addDays(option.checkinDate,1)})</span>:null}</span>
              </label>
            </div>
          </div>

          {/* Flights */}
          <div style={{marginBottom:'14px'}}>
            <div style={{fontWeight:'600',fontSize:'12px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'8px'}}>✈ Outbound Flights</div>
            {option.outLegs.map(leg=><LegRow key={leg.id} leg={leg} legs={option.outLegs} setLegs={l=>updLeg('out',l)} canRemove={option.outLegs.length>1} airports={airports} onCreateAirport={onCreateAirport}/>)}
            <button className="btn btn-ghost btn-sm" style={{border:'1.5px dashed var(--border)',width:'100%',justifyContent:'center'}} onClick={()=>updLeg('out',[...option.outLegs,newLeg('out')])}>+ Add outbound leg</button>
          </div>
          <div style={{marginBottom:'14px'}}>
            <div style={{fontWeight:'600',fontSize:'12px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'8px'}}>↩ Return Flights</div>
            {option.retLegs.map(leg=><LegRow key={leg.id} leg={leg} legs={option.retLegs} setLegs={l=>updLeg('ret',l)} canRemove={option.retLegs.length>1} airports={airports} onCreateAirport={onCreateAirport}/>)}
            <button className="btn btn-ghost btn-sm" style={{border:'1.5px dashed var(--border)',width:'100%',justifyContent:'center'}} onClick={()=>updLeg('ret',[...option.retLegs,newLeg('ret')])}>+ Add return leg</button>
          </div>

          {/* Nets */}
          <div style={{background:'var(--bg-tertiary)',borderRadius:'10px',padding:'14px',marginBottom:'12px'}}>
            <div style={{fontWeight:'600',fontSize:'11px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'10px'}}>Internal Net Costs</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'10px',marginBottom:'12px'}}>
              {([['Flight Net (£)',option.flightNet,(v:string)=>upd('flightNet',v)],['Accommodation Net (£)',option.accNet,(v:string)=>upd('accNet',v)],['Transfers Net (£)',option.transNet,(v:string)=>upd('transNet',v)]] as [string,string,any][]).map(([l,v,s])=>(
                <div key={l}><label className="label">{l}</label><input className="input" type="number" step="0.01" placeholder="0.00" value={v} onChange={e=>s(e.target.value)}/></div>
              ))}
            </div>
            {option.extras.length>0&&(
              <div style={{marginBottom:'10px'}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 130px 32px',gap:'6px',marginBottom:'5px'}}>
                  {['Extra Item','Net (£)',''].map(h=><div key={h} style={{fontSize:'10px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.06em'}}>{h}</div>)}
                </div>
                {option.extras.map(e=>(
                  <div key={e.id} style={{display:'grid',gridTemplateColumns:'1fr 130px 32px',gap:'6px',marginBottom:'6px',alignItems:'center'}}>
                    <input className="input" placeholder="e.g. Airport Lounge" value={e.label} onChange={x=>updExtra(e.id,'label',x.target.value)}/>
                    <input className="input" type="number" step="0.01" placeholder="0.00" value={e.net||''} onChange={x=>updExtra(e.id,'net',parseFloat(x.target.value)||0)}/>
                    <button onClick={()=>upd('extras',option.extras.filter(x=>x.id!==e.id))} style={{background:'var(--red-light)',color:'var(--red)',border:'none',borderRadius:'6px',width:'30px',height:'36px',cursor:'pointer',fontSize:'13px'}}>✕</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{display:'flex',flexWrap:'wrap',gap:'5px',marginBottom:totalNet>0?'10px':'0'}}>
              {QUICK_EXTRAS.map(label=>(
                <button key={label} onClick={()=>upd('extras',[...option.extras,{id:uid(),label,net:0}])}
                  style={{padding:'3px 9px',borderRadius:'20px',border:'1px solid var(--border)',background:'transparent',color:'var(--text-muted)',fontSize:'11px',cursor:'pointer',fontFamily:'Outfit,sans-serif'}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent)';e.currentTarget.style.color='var(--accent)'}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--text-muted)'}}>+ {label}</button>
              ))}
              <button onClick={()=>upd('extras',[...option.extras,{id:uid(),label:'',net:0}])} style={{padding:'3px 9px',borderRadius:'20px',border:'1px dashed var(--border)',background:'transparent',color:'var(--text-muted)',fontSize:'11px',cursor:'pointer',fontFamily:'Outfit,sans-serif'}}>+ Custom</button>
            </div>
            {totalNet>0&&<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',paddingTop:'10px',borderTop:'1px solid var(--border)'}}>
              <span style={{fontSize:'12px',color:'var(--text-muted)',fontWeight:'600'}}>Total Net Cost</span>
              <span style={{fontFamily:'Fraunces,serif',fontSize:'18px',fontWeight:'300',color:'var(--text-primary)'}}>{fmt(totalNet)}</span>
            </div>}
          </div>

          {/* Sell price */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'10px',marginBottom:'10px'}}>
            <div><label className="label">Sell Price (£) *</label><input className="input" type="number" step="1" placeholder="4500" value={option.sellPrice} onChange={e=>onSell(e.target.value)} style={{fontSize:'15px',fontWeight:'500'}}/></div>
            <div><label className="label">Markup %</label><div style={{position:'relative'}}><input className="input" type="number" step="0.1" placeholder="10" value={option.margin} onChange={e=>onMargin(e.target.value)} style={{paddingRight:'26px'}}/><span style={{position:'absolute',right:'10px',top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)',fontSize:'13px',pointerEvents:'none'}}>%</span></div></div>
            <div><label className="label">Profit (£)</label><input className="input" type="number" step="1" placeholder="Auto" value={option.profit} onChange={e=>onProfit(e.target.value)} style={{color:'var(--gold)',fontWeight:'500'}}/></div>
          </div>
          {sellN>0&&(
            <div style={{display:'flex',gap:'14px',padding:'10px 14px',background:'var(--bg-tertiary)',borderRadius:'8px'}}>
              {[...(totalNet>0?[{l:'Net',v:fmtS(totalNet),c:'var(--text-primary)'}]:[]),{l:'Sell',v:fmtS(sellN),c:'var(--text-primary)'},{l:'Profit',v:fmtS(profitN),c:'var(--gold)'},{l:'Markup',v:markupN.toFixed(1)+'%',c:markupN>=10?'var(--green)':markupN>=7?'var(--amber)':'var(--red)'}].map(s=>(
                <div key={s.l} style={{textAlign:'center'}}>
                  <div style={{fontSize:'10px',textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--text-muted)',marginBottom:'2px'}}>{s.l}</div>
                  <div style={{fontFamily:'Fraunces,serif',fontSize:'17px',fontWeight:'300',color:s.c}}>{s.v}</div>
                </div>
              ))}
              <div style={{flex:1,display:'flex',alignItems:'center',paddingLeft:'6px'}}>
                <div style={{width:'100%',height:'5px',background:'var(--border)',borderRadius:'3px',overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${Math.min(markupN,30)/30*100}%`,borderRadius:'3px',background:markupN>=10?'var(--green)':markupN>=7?'var(--amber)':'var(--red)',transition:'all 0.3s'}}/>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── BASE TRAVEL CARD (shared flights for single-destination) ──
function BaseTravelCard({
  outLegs, retLegs, flightNet, transNet, onChangeLegs, onChangeNet, airports, onCreateAirport,
}: {
  outLegs: FlightLeg[]
  retLegs: FlightLeg[]
  flightNet: string
  transNet: string
  onChangeLegs: (dir: 'out'|'ret', legs: FlightLeg[]) => void
  onChangeNet: (field: 'flightNet'|'transNet', val: string) => void
  airports: AirportOption[]
  onCreateAirport: (a: AirportOption) => Promise<AirportOption>
}) {
  return (
    <div className="card" style={{padding:'18px 20px',marginBottom:'16px'}}>
      <div style={{fontFamily:'Fraunces,serif',fontSize:'17px',fontWeight:'300',marginBottom:'4px'}}>Flights & Transfers</div>
      <div style={{fontSize:'12px',color:'var(--text-muted)',marginBottom:'14px'}}>Shared across all hotel options — enter once.</div>
      <div style={{marginBottom:'14px'}}>
        <div style={{fontWeight:'600',fontSize:'12px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'8px'}}>✈ Outbound Flights</div>
        {outLegs.map(leg=><LegRow key={leg.id} leg={leg} legs={outLegs} setLegs={l=>onChangeLegs('out',l)} canRemove={outLegs.length>1} airports={airports} onCreateAirport={onCreateAirport}/>)}
        <button className="btn btn-ghost btn-sm" style={{border:'1.5px dashed var(--border)',width:'100%',justifyContent:'center'}} onClick={()=>onChangeLegs('out',[...outLegs,newLeg('out')])}>+ Add outbound leg</button>
      </div>
      <div style={{marginBottom:'14px'}}>
        <div style={{fontWeight:'600',fontSize:'12px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'8px'}}>↩ Return Flights</div>
        {retLegs.map(leg=><LegRow key={leg.id} leg={leg} legs={retLegs} setLegs={l=>onChangeLegs('ret',l)} canRemove={retLegs.length>1} airports={airports} onCreateAirport={onCreateAirport}/>)}
        <button className="btn btn-ghost btn-sm" style={{border:'1.5px dashed var(--border)',width:'100%',justifyContent:'center'}} onClick={()=>onChangeLegs('ret',[...retLegs,newLeg('ret')])}>+ Add return leg</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
        <div><label className="label">Flight Net (£)</label><input className="input" type="number" step="0.01" placeholder="0.00" value={flightNet} onChange={e=>onChangeNet('flightNet',e.target.value)}/></div>
        <div><label className="label">Transfer Net (£)</label><input className="input" type="number" step="0.01" placeholder="0.00" value={transNet} onChange={e=>onChangeNet('transNet',e.target.value)}/></div>
      </div>
    </div>
  )
}

// ── ACCOMMODATION OPTION PANEL (hotel + pricing only, no flights) ──
function AccommodationOptionPanel({
  option, index, totalOptions, baseFlightNet, baseTransNet, onChange, onRemove, onDuplicate,
}:{
  option: AccommodationOption
  index: number
  totalOptions: number
  baseFlightNet: string
  baseTransNet: string
  onChange: (o: AccommodationOption) => void
  onRemove: () => void
  onDuplicate: () => void
}) {
  const [collapsed,setCollapsed]=useState(false)
  const upd=(field:keyof AccommodationOption,val:any)=>onChange({...option,[field]:val})
  const updExtra=(id:string,field:keyof ExtraItem,val:any)=>upd('extras',option.extras.map(e=>e.id===id?{...e,[field]:val}:e))

  const flightN=parseFloat(baseFlightNet)||0, accN=parseFloat(option.accNet)||0, transN=parseFloat(baseTransNet)||0
  const extrasN=option.extras.reduce((a,e)=>a+(e.net||0),0), totalNet=flightN+accN+transN+extrasN
  const sellN=parseFloat(option.sellPrice)||0, profitN=parseFloat(option.profit)||0
  const markupN=parseFloat(option.margin)||(sellN>0&&profitN>0&&profitN<sellN?(profitN/(sellN-profitN))*100:0)

  function onSell(v:string){
    const sell=parseFloat(v)||0,mg=parseFloat(option.margin)||0,pr=parseFloat(option.profit)||0
    if(sell>0&&mg>0){const profit=totalNet>0?totalNet*mg/100:sell*mg/(100+mg);onChange({...option,sellPrice:v,profit:profit.toFixed(2)})}
    else if(sell>0&&pr>0){const markup=sell>pr?(pr/(sell-pr))*100:0;onChange({...option,sellPrice:v,margin:markup.toFixed(1)})}
    else onChange({...option,sellPrice:v})
  }
  function onMargin(v:string){
    const sell=parseFloat(option.sellPrice)||0,mg=parseFloat(v)||0
    if(totalNet>0&&mg>0){const s=totalNet*(1+mg/100);onChange({...option,margin:v,sellPrice:s.toFixed(2),profit:(totalNet*mg/100).toFixed(2)})}
    else if(sell>0&&mg>0){const profit=sell*mg/(100+mg);onChange({...option,margin:v,profit:profit.toFixed(2)})}
    else onChange({...option,margin:v})
  }
  function onProfit(v:string){
    const sell=parseFloat(option.sellPrice)||0,pr=parseFloat(v)||0
    if(sell>0&&pr>0){const markup=sell>pr?(pr/(sell-pr))*100:0;onChange({...option,profit:v,margin:markup.toFixed(1)})}
    else if(totalNet>0&&pr>0){const s=totalNet+pr;onChange({...option,profit:v,sellPrice:s.toFixed(2),margin:((pr/totalNet)*100).toFixed(1)})}
    else onChange({...option,profit:v})
  }

  const COLORS=['#8b5cf6','#3b82f6','#10b981','#f59e0b','#ec4899']
  const color=COLORS[index%COLORS.length]

  return(
    <div className="card" style={{marginBottom:'14px',borderLeft:`3px solid ${color}`,overflow:'hidden'}}>
      <div style={{padding:'14px 18px',display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer',background:'var(--bg-tertiary)'}} onClick={()=>setCollapsed(c=>!c)}>
        <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
          <div style={{width:'26px',height:'26px',borderRadius:'50%',background:color,color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',fontWeight:'700',flexShrink:0}}>{index+1}</div>
          <div>
            <div style={{fontFamily:'Fraunces,serif',fontSize:'15px',fontWeight:'300',color:'var(--text-primary)'}}>{option.hotel||`Option ${index+1} — select hotel`}</div>
            <div style={{fontSize:'11.5px',color:'var(--text-muted)',marginTop:'1px'}}>{option.boardBasis}{option.nights?` · ${option.nights} nights`:''}{sellN>0?` · ${fmtS(sellN)}`:''}{markupN>0?` · ${markupN.toFixed(1)}%`:''}</div>
          </div>
        </div>
        <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
          {totalOptions>1&&<button onClick={e=>{e.stopPropagation();onDuplicate()}} className="btn btn-ghost btn-xs">⧉ Copy</button>}
          {totalOptions>1&&<button onClick={e=>{e.stopPropagation();onRemove()}} className="btn btn-danger btn-xs">Remove</button>}
          <span style={{color:'var(--text-muted)',fontSize:'16px',marginLeft:'4px'}}>{collapsed?'▸':'▾'}</span>
        </div>
      </div>
      {!collapsed&&(
        <div style={{padding:'18px'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'14px'}}>
            <div style={{gridColumn:'1/-1'}}><label className="label">Hotel Name *</label><DBSearch table="hotel_list" value={option.hotel} onChange={v=>upd('hotel',v)} placeholder="Search or type hotel name…"/></div>
            <div style={{gridColumn:'1/-1'}}><label className="label">Room Type</label><input className="input" placeholder="e.g. Deluxe Ocean Suite…" value={option.roomType||''} onChange={e=>upd('roomType',e.target.value)}/></div>
            <div><label className="label">Meal Plan</label><DBSearch table="meal_plan_list" value={option.boardBasis} onChange={v=>upd('boardBasis',v)} placeholder="Search meal plan…"/></div>
            <div><label className="label">Nights</label><input className="input" type="number" min="1" value={option.nights} onChange={e=>upd('nights',e.target.value)}/></div>
            <div><label className="label">Check-in Date</label><input className="input" type="date" value={option.checkinDate||''} onChange={e=>upd('checkinDate',e.target.value)}/></div>
            <div style={{display:'flex',flexDirection:'column',justifyContent:'flex-end',paddingBottom:'4px'}}>
              <label style={{display:'flex',alignItems:'center',gap:'8px',cursor:'pointer'}}>
                <input type="checkbox" checked={option.checkinNextDay} onChange={e=>upd('checkinNextDay',e.target.checked)} style={{width:'16px',height:'16px'}}/>
                <span style={{fontSize:'13px',color:'var(--text-secondary)'}}>Check-in next day{option.checkinNextDay&&option.checkinDate?<span style={{color:'var(--accent)',marginLeft:'6px',fontSize:'11.5px'}}>({addDays(option.checkinDate,1)})</span>:null}</span>
              </label>
            </div>
          </div>
          <div style={{background:'var(--bg-tertiary)',borderRadius:'10px',padding:'14px',marginBottom:'12px'}}>
            <div style={{fontWeight:'600',fontSize:'11px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'10px'}}>Internal Net Costs</div>
            <div style={{marginBottom:'10px'}}>
              <label className="label">Accommodation Net (£)</label>
              <input className="input" type="number" step="0.01" placeholder="0.00" value={option.accNet} onChange={e=>upd('accNet',e.target.value)}/>
            </div>
            {(parseFloat(baseFlightNet)>0||parseFloat(baseTransNet)>0)&&(
              <div style={{fontSize:'11.5px',color:'var(--text-muted)',marginBottom:'10px',padding:'7px 10px',background:'var(--surface)',borderRadius:'6px',border:'1px solid var(--border)'}}>
                Shared flight net: {baseFlightNet?fmt(parseFloat(baseFlightNet)):'—'} &nbsp;·&nbsp; Transfer net: {baseTransNet?fmt(parseFloat(baseTransNet)):'—'}
              </div>
            )}
            {option.extras.length>0&&(
              <div style={{marginBottom:'10px'}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 130px 32px',gap:'6px',marginBottom:'5px'}}>
                  {['Extra Item','Net (£)',''].map(h=><div key={h} style={{fontSize:'10px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.06em'}}>{h}</div>)}
                </div>
                {option.extras.map(e=>(
                  <div key={e.id} style={{display:'grid',gridTemplateColumns:'1fr 130px 32px',gap:'6px',marginBottom:'6px',alignItems:'center'}}>
                    <input className="input" placeholder="e.g. Airport Lounge" value={e.label} onChange={x=>updExtra(e.id,'label',x.target.value)}/>
                    <input className="input" type="number" step="0.01" placeholder="0.00" value={e.net||''} onChange={x=>updExtra(e.id,'net',parseFloat(x.target.value)||0)}/>
                    <button onClick={()=>upd('extras',option.extras.filter(x=>x.id!==e.id))} style={{background:'var(--red-light)',color:'var(--red)',border:'none',borderRadius:'6px',width:'30px',height:'36px',cursor:'pointer',fontSize:'13px'}}>✕</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{display:'flex',flexWrap:'wrap',gap:'5px',marginBottom:totalNet>0?'10px':'0'}}>
              {QUICK_EXTRAS.map(label=>(
                <button key={label} onClick={()=>upd('extras',[...option.extras,{id:uid(),label,net:0}])}
                  style={{padding:'3px 9px',borderRadius:'20px',border:'1px solid var(--border)',background:'transparent',color:'var(--text-muted)',fontSize:'11px',cursor:'pointer',fontFamily:'Outfit,sans-serif'}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent)';e.currentTarget.style.color='var(--accent)'}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--text-muted)'}}>+ {label}</button>
              ))}
              <button onClick={()=>upd('extras',[...option.extras,{id:uid(),label:'',net:0}])} style={{padding:'3px 9px',borderRadius:'20px',border:'1px dashed var(--border)',background:'transparent',color:'var(--text-muted)',fontSize:'11px',cursor:'pointer',fontFamily:'Outfit,sans-serif'}}>+ Custom</button>
            </div>
            {totalNet>0&&<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',paddingTop:'10px',borderTop:'1px solid var(--border)'}}>
              <span style={{fontSize:'12px',color:'var(--text-muted)',fontWeight:'600'}}>Total Net Cost</span>
              <span style={{fontFamily:'Fraunces,serif',fontSize:'18px',fontWeight:'300',color:'var(--text-primary)'}}>{fmt(totalNet)}</span>
            </div>}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'10px',marginBottom:'10px'}}>
            <div><label className="label">Sell Price (£) *</label><input className="input" type="number" step="1" placeholder="4500" value={option.sellPrice} onChange={e=>onSell(e.target.value)} style={{fontSize:'15px',fontWeight:'500'}}/></div>
            <div><label className="label">Markup %</label><div style={{position:'relative'}}><input className="input" type="number" step="0.1" placeholder="10" value={option.margin} onChange={e=>onMargin(e.target.value)} style={{paddingRight:'26px'}}/><span style={{position:'absolute',right:'10px',top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)',fontSize:'13px',pointerEvents:'none'}}>%</span></div></div>
            <div><label className="label">Profit (£)</label><input className="input" type="number" step="1" placeholder="Auto" value={option.profit} onChange={e=>onProfit(e.target.value)} style={{color:'var(--gold)',fontWeight:'500'}}/></div>
          </div>
          {sellN>0&&(
            <div style={{display:'flex',gap:'14px',padding:'10px 14px',background:'var(--bg-tertiary)',borderRadius:'8px'}}>
              {[...(totalNet>0?[{l:'Net',v:fmtS(totalNet),c:'var(--text-primary)'}]:[]),{l:'Sell',v:fmtS(sellN),c:'var(--text-primary)'},{l:'Profit',v:fmtS(profitN),c:'var(--gold)'},{l:'Markup',v:markupN.toFixed(1)+'%',c:markupN>=10?'var(--green)':markupN>=7?'var(--amber)':'var(--red)'}].map(s=>(
                <div key={s.l} style={{textAlign:'center'}}>
                  <div style={{fontSize:'10px',textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--text-muted)',marginBottom:'2px'}}>{s.l}</div>
                  <div style={{fontFamily:'Fraunces,serif',fontSize:'17px',fontWeight:'300',color:s.c}}>{s.v}</div>
                </div>
              ))}
              <div style={{flex:1,display:'flex',alignItems:'center',paddingLeft:'6px'}}>
                <div style={{width:'100%',height:'5px',background:'var(--border)',borderRadius:'3px',overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${Math.min(markupN,30)/30*100}%`,borderRadius:'3px',background:markupN>=10?'var(--green)':markupN>=7?'var(--amber)':'var(--red)',transition:'all 0.3s'}}/>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── CENTRE PANEL (Multi-Centre) ───────────────────────────
function FlightOptionPanel({
  option,
  index,
  totalOptions,
  isDefault,
  onSetDefault,
  onChange,
  onRemove,
  airports,
  onCreateAirport,
}: {
  option: FlightOption
  index: number
  totalOptions: number
  isDefault: boolean
  onSetDefault: () => void
  onChange: (option: FlightOption) => void
  onRemove: () => void
  airports: AirportOption[]
  onCreateAirport: (airport: AirportOption) => Promise<AirportOption>
}) {
  const [collapsed,setCollapsed]=useState(false)
  const upd=(field:keyof FlightOption,val:any)=>onChange({...option,[field]:val})
  const updLeg=(dir:'out'|'ret',legs:FlightLeg[])=>onChange({...option,[dir==='out'?'outLegs':'retLegs']:legs})
  const flightN=numVal(option.flightNet)
  const transN=numVal(option.transNet)

  return (
    <div className="card" style={{marginBottom:'14px',borderLeft:`3px solid ${isDefault?'#d4a84a':'#3b82f6'}`,overflow:'hidden'}}>
      <div style={{padding:'14px 18px',display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer',background:'var(--bg-tertiary)'}} onClick={()=>setCollapsed(c=>!c)}>
        <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
          <div style={{width:'26px',height:'26px',borderRadius:'50%',background:isDefault?'#d4a84a':'#3b82f6',color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',fontWeight:'700',flexShrink:0}}>{optionLetter(index)}</div>
          <div>
            <div style={{fontFamily:'Fraunces,serif',fontSize:'15px',fontWeight:'300',color:'var(--text-primary)'}}>{getFlightOptionTitle(option, index)}</div>
            <div style={{fontSize:'11.5px',color:'var(--text-muted)',marginTop:'1px'}}>{getFlightOptionSummary(option)}{flightN>0||transN>0?` · ${fmtS(flightN+transN)} net`:''}</div>
          </div>
        </div>
        <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
          {isDefault
            ? <span style={{fontSize:'10px',fontWeight:'700',letterSpacing:'0.08em',textTransform:'uppercase',color:'#9a7a2d',background:'#fff7df',padding:'4px 8px',borderRadius:'999px'}}>Default</span>
            : <button onClick={e=>{e.stopPropagation();onSetDefault()}} className="btn btn-secondary btn-xs">Use As Default</button>}
          {totalOptions>1&&<button onClick={e=>{e.stopPropagation();onRemove()}} className="btn btn-danger btn-xs">Remove</button>}
          <span style={{color:'var(--text-muted)',fontSize:'16px',marginLeft:'4px'}}>{collapsed?'▸':'▾'}</span>
        </div>
      </div>

      {!collapsed&&(
        <div style={{padding:'18px'}}>
          <div style={{marginBottom:'14px'}}>
            <label className="label">Flight Option Label</label>
            <input className="input" placeholder="e.g. Direct BA, Emirates via Dubai..." value={option.label} onChange={e=>upd('label',e.target.value)}/>
            <div style={{fontSize:'11.5px',color:'var(--text-muted)',marginTop:'6px'}}>Used in hotel assignment and in the final option list when flights differ.</div>
          </div>

          <div style={{marginBottom:'14px'}}>
            <div style={{fontWeight:'600',fontSize:'12px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'8px'}}>Outbound Flights</div>
            {option.outLegs.map(leg=><LegRow key={leg.id} leg={leg} legs={option.outLegs} setLegs={legs=>updLeg('out',legs)} canRemove={option.outLegs.length>1} airports={airports} onCreateAirport={onCreateAirport}/>)}
            <button className="btn btn-ghost btn-sm" style={{border:'1.5px dashed var(--border)',width:'100%',justifyContent:'center'}} onClick={()=>updLeg('out',[...option.outLegs,newLeg('out')])}>+ Add outbound leg</button>
          </div>

          <div style={{marginBottom:'14px'}}>
            <div style={{fontWeight:'600',fontSize:'12px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'8px'}}>Return Flights</div>
            {option.retLegs.map(leg=><LegRow key={leg.id} leg={leg} legs={option.retLegs} setLegs={legs=>updLeg('ret',legs)} canRemove={option.retLegs.length>1} airports={airports} onCreateAirport={onCreateAirport}/>)}
            <button className="btn btn-ghost btn-sm" style={{border:'1.5px dashed var(--border)',width:'100%',justifyContent:'center'}} onClick={()=>updLeg('ret',[...option.retLegs,newLeg('ret')])}>+ Add return leg</button>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
            <div><label className="label">Flight Net (£)</label><input className="input" type="number" step="0.01" placeholder="0.00" value={option.flightNet} onChange={e=>upd('flightNet',e.target.value)}/></div>
            <div><label className="label">Transfer Net (£)</label><input className="input" type="number" step="0.01" placeholder="0.00" value={option.transNet} onChange={e=>upd('transNet',e.target.value)}/></div>
          </div>
        </div>
      )}
    </div>
  )
}

function AssignedAccommodationOptionPanel({
  option,
  index,
  totalOptions,
  flightOptions,
  defaultFlightOptionId,
  onChange,
  onRemove,
  onDuplicate,
}:{
  option: AccommodationOption
  index: number
  totalOptions: number
  flightOptions: FlightOption[]
  defaultFlightOptionId: string
  onChange: (o: AccommodationOption) => void
  onRemove: () => void
  onDuplicate: () => void
}) {
  const [collapsed,setCollapsed]=useState(false)
  const normalizedOption = normalizeAccommodationOptionAssignments(option, flightOptions, defaultFlightOptionId)
  const selectedFlightOptions = getOrderedSelectedFlightOptions(normalizedOption, flightOptions, defaultFlightOptionId)
  const pricingFlightOption = resolveAccommodationPricingFlight(normalizedOption, flightOptions, defaultFlightOptionId)
  const defaultFlightOption = flightOptions.find(flightOption => flightOption.id === defaultFlightOptionId) || null
  const nonDefaultFlightOptions = flightOptions.filter(flightOption => flightOption.id !== defaultFlightOptionId)

  const upd=(field:keyof AccommodationOption,val:any)=>onChange(normalizeAccommodationOptionAssignments({...normalizedOption,[field]:val}, flightOptions, defaultFlightOptionId))
  const updExtra=(id:string,field:keyof ExtraItem,val:any)=>upd('extras',normalizedOption.extras.map(extra=>extra.id===id?{...extra,[field]:val}:extra))

  const flightN=pricingFlightOption ? numVal(pricingFlightOption.flightNet) : 0
  const accN=numVal(normalizedOption.accNet)
  const transN=pricingFlightOption ? numVal(pricingFlightOption.transNet) : 0
  const extrasN=normalizedOption.extras.reduce((sum,extra)=>sum+numVal(extra.net),0)
  const totalNet=flightN+accN+transN+extrasN
  const sellN=numVal(normalizedOption.sellPrice)
  const profitN=numVal(normalizedOption.profit)
  const markupN=numVal(normalizedOption.margin)||(sellN>0&&profitN>0&&profitN<sellN?(profitN/(sellN-profitN))*100:0)

  function onSell(v:string){
    const sell=numVal(v),mg=numVal(normalizedOption.margin),pr=numVal(normalizedOption.profit)
    if(sell>0&&mg>0){const profit=totalNet>0?totalNet*mg/100:sell*mg/(100+mg);onChange({...normalizedOption,sellPrice:v,profit:profit.toFixed(2)})}
    else if(sell>0&&pr>0){const markup=sell>pr?(pr/(sell-pr))*100:0;onChange({...normalizedOption,sellPrice:v,margin:markup.toFixed(1)})}
    else onChange({...normalizedOption,sellPrice:v})
  }
  function onMargin(v:string){
    const sell=numVal(normalizedOption.sellPrice),mg=numVal(v)
    if(totalNet>0&&mg>0){const s=totalNet*(1+mg/100);onChange({...normalizedOption,margin:v,sellPrice:s.toFixed(2),profit:(totalNet*mg/100).toFixed(2)})}
    else if(sell>0&&mg>0){const profit=sell*mg/(100+mg);onChange({...normalizedOption,margin:v,profit:profit.toFixed(2)})}
    else onChange({...normalizedOption,margin:v})
  }
  function onProfit(v:string){
    const sell=numVal(normalizedOption.sellPrice),pr=numVal(v)
    if(sell>0&&pr>0){const markup=sell>pr?(pr/(sell-pr))*100:0;onChange({...normalizedOption,profit:v,margin:markup.toFixed(1)})}
    else if(totalNet>0&&pr>0){const s=totalNet+pr;onChange({...normalizedOption,profit:v,sellPrice:s.toFixed(2),margin:((pr/totalNet)*100).toFixed(1)})}
    else onChange({...normalizedOption,profit:v})
  }

  function toggleAssignedFlightOption(flightOptionId: string, checked: boolean) {
    const assignedFlightOptionIds = checked
      ? [...normalizedOption.assignedFlightOptionIds, flightOptionId]
      : normalizedOption.assignedFlightOptionIds.filter(id => id !== flightOptionId)

    onChange(normalizeAccommodationOptionAssignments({
      ...normalizedOption,
      assignedFlightOptionIds,
    }, flightOptions, defaultFlightOptionId))
  }

  function changePricingFlightOption(nextFlightOptionId: string) {
    const currentFlightCost = getFlightCostTotal(pricingFlightOption)
    const nextFlightOption = flightOptions.find(flightOption => flightOption.id === nextFlightOptionId) || null
    const nextFlightCost = getFlightCostTotal(nextFlightOption)
    const adjustedSell = sellN > 0 ? sellN + (nextFlightCost - currentFlightCost) : 0
    const nextTotalNet = accN + extrasN + nextFlightCost

    onChange(normalizeAccommodationOptionAssignments({
      ...normalizedOption,
      pricingFlightOptionId: nextFlightOptionId,
      sellPrice: adjustedSell > 0 ? adjustedSell.toFixed(2) : normalizedOption.sellPrice,
      profit: adjustedSell > 0 ? (adjustedSell - nextTotalNet).toFixed(2) : normalizedOption.profit,
      margin: adjustedSell > 0 && nextTotalNet > 0 ? (((adjustedSell - nextTotalNet) / nextTotalNet) * 100).toFixed(1) : normalizedOption.margin,
    }, flightOptions, defaultFlightOptionId))
  }

  const COLORS=['#8b5cf6','#3b82f6','#10b981','#f59e0b','#ec4899']
  const color=COLORS[index%COLORS.length]

  return(
    <div className="card" style={{marginBottom:'14px',borderLeft:`3px solid ${color}`,overflow:'hidden'}}>
      <div style={{padding:'14px 18px',display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer',background:'var(--bg-tertiary)'}} onClick={()=>setCollapsed(c=>!c)}>
        <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
          <div style={{width:'26px',height:'26px',borderRadius:'50%',background:color,color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',fontWeight:'700',flexShrink:0}}>{index+1}</div>
          <div>
            <div style={{fontFamily:'Fraunces,serif',fontSize:'15px',fontWeight:'300',color:'var(--text-primary)'}}>{normalizedOption.hotel||`Option ${index+1} - select hotel`}</div>
            <div style={{fontSize:'11.5px',color:'var(--text-muted)',marginTop:'1px'}}>{normalizedOption.boardBasis}{normalizedOption.nights?` · ${normalizedOption.nights} nights`:''}{sellN>0?` · ${fmtS(sellN)}`:''}{markupN>0?` · ${markupN.toFixed(1)}%`:''}{selectedFlightOptions.length>0?` · ${selectedFlightOptions.length} flight choice${selectedFlightOptions.length===1?'':'s'}`:''}</div>
          </div>
        </div>
        <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
          {totalOptions>1&&<button onClick={e=>{e.stopPropagation();onDuplicate()}} className="btn btn-ghost btn-xs">⧉ Copy</button>}
          {totalOptions>1&&<button onClick={e=>{e.stopPropagation();onRemove()}} className="btn btn-danger btn-xs">Remove</button>}
          <span style={{color:'var(--text-muted)',fontSize:'16px',marginLeft:'4px'}}>{collapsed?'▸':'▾'}</span>
        </div>
      </div>
      {!collapsed&&(
        <div style={{padding:'18px'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'14px'}}>
            <div style={{gridColumn:'1/-1'}}><label className="label">Hotel Name *</label><DBSearch table="hotel_list" value={normalizedOption.hotel} onChange={v=>upd('hotel',v)} placeholder="Search or type hotel name..."/></div>
            <div style={{gridColumn:'1/-1'}}><label className="label">Room Type</label><input className="input" placeholder="e.g. Deluxe Ocean Suite..." value={normalizedOption.roomType||''} onChange={e=>upd('roomType',e.target.value)}/></div>
            <div><label className="label">Meal Plan</label><DBSearch table="meal_plan_list" value={normalizedOption.boardBasis} onChange={v=>upd('boardBasis',v)} placeholder="Search meal plan..."/></div>
            <div><label className="label">Nights</label><input className="input" type="number" min="1" value={normalizedOption.nights} onChange={e=>upd('nights',e.target.value)}/></div>
            <div><label className="label">Check-in Date</label><input className="input" type="date" value={normalizedOption.checkinDate||''} onChange={e=>upd('checkinDate',e.target.value)}/></div>
            <div style={{display:'flex',flexDirection:'column',justifyContent:'flex-end',paddingBottom:'4px'}}>
              <label style={{display:'flex',alignItems:'center',gap:'8px',cursor:'pointer'}}>
                <input type="checkbox" checked={normalizedOption.checkinNextDay} onChange={e=>upd('checkinNextDay',e.target.checked)} style={{width:'16px',height:'16px'}}/>
                <span style={{fontSize:'13px',color:'var(--text-secondary)'}}>Check-in next day{normalizedOption.checkinNextDay&&normalizedOption.checkinDate?<span style={{color:'var(--accent)',marginLeft:'6px',fontSize:'11.5px'}}>({addDays(normalizedOption.checkinDate,1)})</span>:null}</span>
              </label>
            </div>
          </div>

          <div style={{background:'var(--bg-tertiary)',borderRadius:'10px',padding:'14px',marginBottom:'12px'}}>
            <div style={{fontWeight:'600',fontSize:'11px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'10px'}}>Flight Assignment</div>
            <label style={{display:'flex',alignItems:'flex-start',gap:'10px',cursor:'pointer',padding:'10px 12px',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'8px',marginBottom:'10px'}}>
              <input type="checkbox" checked={normalizedOption.useDefaultFlight} onChange={e=>onChange(normalizeAccommodationOptionAssignments({...normalizedOption,useDefaultFlight:e.target.checked}, flightOptions, defaultFlightOptionId))} style={{width:'16px',height:'16px',marginTop:'1px'}}/>
              <span>
                <span style={{display:'block',fontSize:'13px',fontWeight:'600',color:'var(--text-primary)'}}>Use default flight option</span>
                <span style={{display:'block',fontSize:'11.5px',color:'var(--text-muted)',marginTop:'2px'}}>{defaultFlightOption ? `${getFlightOptionTitle(defaultFlightOption, flightOptions.findIndex(flightOption => flightOption.id === defaultFlightOption.id))} · ${getFlightOptionSummary(defaultFlightOption)}` : 'Create a flight option first'}</span>
              </span>
            </label>

            <div style={{fontSize:'11px',fontWeight:'700',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'8px'}}>Specific flight options</div>
            {nonDefaultFlightOptions.length>0 ? nonDefaultFlightOptions.map(flightOption => {
              const flightIndex = flightOptions.findIndex(existingOption => existingOption.id === flightOption.id)
              return (
                <label key={flightOption.id} style={{display:'flex',alignItems:'flex-start',gap:'10px',cursor:'pointer',padding:'10px 12px',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'8px',marginBottom:'8px'}}>
                  <input type="checkbox" checked={normalizedOption.assignedFlightOptionIds.includes(flightOption.id)} onChange={e=>toggleAssignedFlightOption(flightOption.id, e.target.checked)} style={{width:'16px',height:'16px',marginTop:'1px'}}/>
                  <span>
                    <span style={{display:'block',fontSize:'13px',fontWeight:'600',color:'var(--text-primary)'}}>{getFlightOptionTitle(flightOption, flightIndex)}</span>
                    <span style={{display:'block',fontSize:'11.5px',color:'var(--text-muted)',marginTop:'2px'}}>{getFlightOptionSummary(flightOption)}</span>
                  </span>
                </label>
              )
            }) : (
              <div style={{fontSize:'11.5px',color:'var(--text-muted)',padding:'8px 0'}}>No extra flight options yet. Add another flight option above to attach alternatives to this hotel.</div>
            )}

            {selectedFlightOptions.length>0 ? (
              <div style={{fontSize:'11.5px',color:'var(--text-muted)',marginTop:'4px'}}>
                Client options from this hotel: <strong style={{color:'var(--text-primary)'}}>{selectedFlightOptions.map(flightOption => getFlightOptionTitle(flightOption, flightOptions.findIndex(existingOption => existingOption.id === flightOption.id))).join(', ')}</strong>
              </div>
            ) : (
              <div style={{fontSize:'11.5px',color:'var(--red)',marginTop:'4px'}}>Select the default flight or at least one specific flight option so this hotel produces a quote option.</div>
            )}

            {selectedFlightOptions.length>1&&(
              <div style={{marginTop:'12px'}}>
                <label className="label">Price This Hotel Against</label>
                <select className="input" value={normalizedOption.pricingFlightOptionId} onChange={e=>changePricingFlightOption(e.target.value)}>
                  {selectedFlightOptions.map(flightOption => {
                    const flightIndex = flightOptions.findIndex(existingOption => existingOption.id === flightOption.id)
                    return <option key={flightOption.id} value={flightOption.id}>{getFlightOptionTitle(flightOption, flightIndex)}</option>
                  })}
                </select>
                <div style={{fontSize:'11.5px',color:'var(--text-muted)',marginTop:'6px'}}>Other attached flights inherit this hotel price and adjust it only by the flight and transfer net difference.</div>
              </div>
            )}
          </div>

          <div style={{background:'var(--bg-tertiary)',borderRadius:'10px',padding:'14px',marginBottom:'12px'}}>
            <div style={{fontWeight:'600',fontSize:'11px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'10px'}}>Internal Net Costs</div>
            <div style={{marginBottom:'10px'}}>
              <label className="label">Accommodation Net (£)</label>
              <input className="input" type="number" step="0.01" placeholder="0.00" value={normalizedOption.accNet} onChange={e=>upd('accNet',e.target.value)}/>
            </div>
            {pricingFlightOption&&(
              <div style={{fontSize:'11.5px',color:'var(--text-muted)',marginBottom:'10px',padding:'7px 10px',background:'var(--surface)',borderRadius:'6px',border:'1px solid var(--border)'}}>
                Pricing flight: <strong style={{color:'var(--text-primary)'}}>{getFlightOptionTitle(pricingFlightOption, flightOptions.findIndex(existingOption => existingOption.id === pricingFlightOption.id))}</strong> · Flight net: {pricingFlightOption.flightNet?fmt(numVal(pricingFlightOption.flightNet)):'—'} · Transfer net: {pricingFlightOption.transNet?fmt(numVal(pricingFlightOption.transNet)):'—'}
              </div>
            )}
            {normalizedOption.extras.length>0&&(
              <div style={{marginBottom:'10px'}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 130px 32px',gap:'6px',marginBottom:'5px'}}>
                  {['Extra Item','Net (£)',''].map(h=><div key={h} style={{fontSize:'10px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.06em'}}>{h}</div>)}
                </div>
                {normalizedOption.extras.map(extra=>(
                  <div key={extra.id} style={{display:'grid',gridTemplateColumns:'1fr 130px 32px',gap:'6px',marginBottom:'6px',alignItems:'center'}}>
                    <input className="input" placeholder="e.g. Airport Lounge" value={extra.label} onChange={event=>updExtra(extra.id,'label',event.target.value)}/>
                    <input className="input" type="number" step="0.01" placeholder="0.00" value={extra.net||''} onChange={event=>updExtra(extra.id,'net',parseFloat(event.target.value)||0)}/>
                    <button onClick={()=>upd('extras',normalizedOption.extras.filter(existingExtra=>existingExtra.id!==extra.id))} style={{background:'var(--red-light)',color:'var(--red)',border:'none',borderRadius:'6px',width:'30px',height:'36px',cursor:'pointer',fontSize:'13px'}}>✕</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{display:'flex',flexWrap:'wrap',gap:'5px',marginBottom:totalNet>0?'10px':'0'}}>
              {QUICK_EXTRAS.map(label=>(
                <button key={label} onClick={()=>upd('extras',[...normalizedOption.extras,{id:uid(),label,net:0}])}
                  style={{padding:'3px 9px',borderRadius:'20px',border:'1px solid var(--border)',background:'transparent',color:'var(--text-muted)',fontSize:'11px',cursor:'pointer',fontFamily:'Outfit,sans-serif'}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent)';e.currentTarget.style.color='var(--accent)'}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--text-muted)'}}>+ {label}</button>
              ))}
              <button onClick={()=>upd('extras',[...normalizedOption.extras,{id:uid(),label:'',net:0}])} style={{padding:'3px 9px',borderRadius:'20px',border:'1px dashed var(--border)',background:'transparent',color:'var(--text-muted)',fontSize:'11px',cursor:'pointer',fontFamily:'Outfit,sans-serif'}}>+ Custom</button>
            </div>
            {totalNet>0&&<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',paddingTop:'10px',borderTop:'1px solid var(--border)'}}>
              <span style={{fontSize:'12px',color:'var(--text-muted)',fontWeight:'600'}}>Pricing Net Cost</span>
              <span style={{fontFamily:'Fraunces,serif',fontSize:'18px',fontWeight:'300',color:'var(--text-primary)'}}>{fmt(totalNet)}</span>
            </div>}
          </div>

          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'10px',marginBottom:'10px'}}>
            <div><label className="label">Sell Price (£) *</label><input className="input" type="number" step="1" placeholder="4500" value={normalizedOption.sellPrice} onChange={e=>onSell(e.target.value)} style={{fontSize:'15px',fontWeight:'500'}}/></div>
            <div><label className="label">Commission %</label><div style={{position:'relative'}}><input className="input" type="number" step="0.1" placeholder="10" value={normalizedOption.margin} onChange={e=>onMargin(e.target.value)} style={{paddingRight:'26px'}}/><span style={{position:'absolute',right:'10px',top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)',fontSize:'13px',pointerEvents:'none'}}>%</span></div></div>
            <div><label className="label">Profit (£)</label><input className="input" type="number" step="1" placeholder="Auto" value={normalizedOption.profit} onChange={e=>onProfit(e.target.value)} style={{color:'var(--gold)',fontWeight:'500'}}/></div>
          </div>
          {sellN>0&&(
            <div style={{display:'flex',gap:'14px',padding:'10px 14px',background:'var(--bg-tertiary)',borderRadius:'8px'}}>
              {[...(totalNet>0?[{l:'Net',v:fmtS(totalNet),c:'var(--text-primary)'}]:[]),{l:'Sell',v:fmtS(sellN),c:'var(--text-primary)'},{l:'Profit',v:fmtS(profitN),c:'var(--gold)'},{l:'Commission',v:markupN.toFixed(1)+'%',c:markupN>=10?'var(--green)':markupN>=7?'var(--amber)':'var(--red)'}].map(stat=>(
                <div key={stat.l} style={{textAlign:'center'}}>
                  <div style={{fontSize:'10px',textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--text-muted)',marginBottom:'2px'}}>{stat.l}</div>
                  <div style={{fontFamily:'Fraunces,serif',fontSize:'17px',fontWeight:'300',color:stat.c}}>{stat.v}</div>
                </div>
              ))}
              <div style={{flex:1,display:'flex',alignItems:'center',paddingLeft:'6px'}}>
                <div style={{width:'100%',height:'5px',background:'var(--border)',borderRadius:'3px',overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${Math.min(markupN,30)/30*100}%`,borderRadius:'3px',background:markupN>=10?'var(--green)':markupN>=7?'var(--amber)':'var(--red)',transition:'all 0.3s'}}/>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function CentrePanel({
  centre,
  index,
  total,
  onChange,
  onRemove,
  airports,
  onCreateAirport,
}:{
  centre:Centre
  index:number
  total:number
  onChange:(c:Centre)=>void
  onRemove:()=>void
  airports: AirportOption[]
  onCreateAirport: (airport: AirportOption) => Promise<AirportOption>
}){
  const [collapsed,setCollapsed]=useState(false)
  const upd=(field:keyof Centre,val:any)=>onChange({...centre,[field]:val})
  const updExtra=(id:string,field:keyof ExtraItem,val:any)=>upd('extras',centre.extras.map(e=>e.id===id?{...e,[field]:val}:e))

  const DEST_COLORS=['#f59e0b','#8b5cf6','#10b981','#3b82f6','#ec4899']
  const color=DEST_COLORS[index%DEST_COLORS.length]
  const accN=parseFloat(centre.accNet)||0, flightN=parseFloat(centre.flightNet)||0, transN=parseFloat(centre.transNet)||0
  const extrasN=centre.extras.reduce((a,e)=>a+(e.net||0),0)
  const totalNet=accN+flightN+transN+extrasN

  const checkinDisplay = fmtDate(centre.checkinNextDay && centre.checkinDate ? addDays(centre.checkinDate, 1) : centre.checkinDate)

  const isFirst=index===0
  const isLast=index===total-1

  return(
    <div style={{marginBottom:'14px',position:'relative'}}>
      {/* Connector line */}
      {!isLast&&<div style={{position:'absolute',left:'22px',top:'100%',width:'2px',height:'14px',background:`${color}44`,zIndex:1}}/>}

      <div className="card" style={{borderLeft:`3px solid ${color}`,overflow:'hidden'}}>
        <div style={{padding:'13px 18px',display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer',background:'var(--bg-tertiary)'}} onClick={()=>setCollapsed(c=>!c)}>
          <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
            <div style={{width:'30px',height:'30px',borderRadius:'50%',background:color,color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',fontWeight:'700',flexShrink:0}}>
              {index+1}
            </div>
            <div>
              <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                {centre.destination&&<span style={{fontSize:'11px',fontWeight:'700',textTransform:'uppercase',letterSpacing:'0.08em',color,background:`${color}18`,padding:'2px 8px',borderRadius:'4px'}}>{centre.destination}</span>}
                <span style={{fontFamily:'Fraunces,serif',fontSize:'15px',fontWeight:'300',color:'var(--text-primary)'}}>{centre.hotel||'Select hotel…'}</span>
              </div>
              <div style={{fontSize:'11.5px',color:'var(--text-muted)',marginTop:'1px'}}>
                {centre.boardBasis} · {centre.nights} nights
                {centre.checkinDate&&` · from ${checkinDisplay}`}
                {totalNet>0&&` · Net: ${fmtS(totalNet)}`}
              </div>
            </div>
          </div>
          <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
            {total>2&&<button onClick={e=>{e.stopPropagation();onRemove()}} className="btn btn-danger btn-xs">Remove</button>}
            <span style={{color:'var(--text-muted)',fontSize:'16px',marginLeft:'4px'}}>{collapsed?'▸':'▾'}</span>
          </div>
        </div>

        {!collapsed&&(
          <div style={{padding:'18px'}}>
            {/* Destination */}
            <div style={{marginBottom:'14px'}}>
              <label className="label">Destination *</label>
              <DBSearch table="destinations" value={centre.destination} onChange={v=>upd('destination',v)} placeholder="e.g. Dubai, Mauritius, Cape Town…"/>
            </div>

            {/* Hotel & Accommodation */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'14px'}}>
              <div style={{gridColumn:'1/-1'}}><label className="label">Hotel</label><DBSearch table="hotel_list" value={centre.hotel} onChange={v=>upd('hotel',v)} placeholder="Search or type hotel…"/></div>
              <div style={{gridColumn:'1/-1'}}><label className="label">Room Type</label><input className="input" placeholder="e.g. Superior Room, Suite…" value={centre.roomType} onChange={e=>upd('roomType',e.target.value)}/></div>
              <div><label className="label">Meal Plan</label><DBSearch table="meal_plan_list" value={centre.boardBasis} onChange={v=>upd('boardBasis',v)} placeholder="Search meal plan…"/></div>
              <div><label className="label">Nights</label><input className="input" type="number" min="1" value={centre.nights} onChange={e=>upd('nights',e.target.value)}/></div>
              <div><label className="label">Check-in Date</label><input className="input" type="date" value={centre.checkinDate} onChange={e=>upd('checkinDate',e.target.value)}/></div>
              <div style={{display:'flex',flexDirection:'column',justifyContent:'flex-end',paddingBottom:'4px'}}>
                <label style={{display:'flex',alignItems:'center',gap:'8px',cursor:'pointer'}}>
                  <input type="checkbox" checked={centre.checkinNextDay} onChange={e=>upd('checkinNextDay',e.target.checked)} style={{width:'16px',height:'16px'}}/>
                  <span style={{fontSize:'13px',color:'var(--text-secondary)'}}>
                    Check-in next day
                    {centre.checkinNextDay&&centre.checkinDate&&<span style={{color:'var(--accent)',marginLeft:'6px',fontSize:'11.5px'}}>({addDays(centre.checkinDate,1)})</span>}
                  </span>
                </label>
              </div>
            </div>

            {/* Inbound flights */}
            <div style={{marginBottom:'12px'}}>
              <div style={{fontWeight:'600',fontSize:'11.5px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'8px'}}>
                ✈ Flights {isFirst?'from UK':'between centres'} → {centre.destination||'Destination'}
              </div>
              {centre.inboundLegs.map(leg=><LegRow key={leg.id} leg={leg} legs={centre.inboundLegs} setLegs={l=>upd('inboundLegs',l)} canRemove={centre.inboundLegs.length>1} airports={airports} onCreateAirport={onCreateAirport}/>)}
              <button className="btn btn-ghost btn-sm" style={{border:'1.5px dashed var(--border)',width:'100%',justifyContent:'center'}} onClick={()=>upd('inboundLegs',[...centre.inboundLegs,{...newLeg('out'),from:'',to:''}])}>+ Add leg</button>
            </div>

            {/* Outbound flights (only on last centre) */}
            {isLast&&(
              <div style={{marginBottom:'12px'}}>
                <div style={{fontWeight:'600',fontSize:'11.5px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'8px'}}>
                  ↩ Return Flights → UK
                </div>
                {centre.outboundLegs.map(leg=><LegRow key={leg.id} leg={leg} legs={centre.outboundLegs} setLegs={l=>upd('outboundLegs',l)} canRemove={centre.outboundLegs.length>1} airports={airports} onCreateAirport={onCreateAirport}/>)}
                <button className="btn btn-ghost btn-sm" style={{border:'1.5px dashed var(--border)',width:'100%',justifyContent:'center'}} onClick={()=>upd('outboundLegs',[...centre.outboundLegs,{...newLeg('ret'),from:'',to:''}])}>+ Add leg</button>
              </div>
            )}

            {/* Net costs */}
            <div style={{background:'var(--bg-tertiary)',borderRadius:'10px',padding:'13px',marginBottom:'10px'}}>
              <div style={{fontWeight:'600',fontSize:'11px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'10px'}}>Net Costs — {centre.destination||`Centre ${index+1}`}</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'10px',marginBottom:'10px'}}>
                {([['Accommodation (£)',centre.accNet,(v:string)=>upd('accNet',v)],['Flights (£)',centre.flightNet,(v:string)=>upd('flightNet',v)],['Transfers (£)',centre.transNet,(v:string)=>upd('transNet',v)]] as [string,string,any][]).map(([l,v,s])=>(
                  <div key={l}><label className="label">{l}</label><input className="input" type="number" step="0.01" placeholder="0.00" value={v} onChange={e=>s(e.target.value)}/></div>
                ))}
              </div>
              {centre.extras.length>0&&(
                <div style={{marginBottom:'8px'}}>
                  {centre.extras.map(e=>(
                    <div key={e.id} style={{display:'grid',gridTemplateColumns:'1fr 120px 30px',gap:'6px',marginBottom:'6px',alignItems:'center'}}>
                      <input className="input" placeholder="Extra item" value={e.label} onChange={x=>updExtra(e.id,'label',x.target.value)}/>
                      <input className="input" type="number" placeholder="0.00" value={e.net||''} onChange={x=>updExtra(e.id,'net',parseFloat(x.target.value)||0)}/>
                      <button onClick={()=>upd('extras',centre.extras.filter(x=>x.id!==e.id))} style={{background:'var(--red-light)',color:'var(--red)',border:'none',borderRadius:'6px',width:'28px',height:'36px',cursor:'pointer',fontSize:'13px'}}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{display:'flex',flexWrap:'wrap',gap:'5px',marginBottom:totalNet>0?'10px':'0'}}>
                {['Lounge Access','Transfers','Excursion','Visa Fees','Travel Insurance'].map(label=>(
                  <button key={label} onClick={()=>upd('extras',[...centre.extras,{id:uid(),label,net:0}])}
                    style={{padding:'3px 8px',borderRadius:'20px',border:'1px solid var(--border)',background:'transparent',color:'var(--text-muted)',fontSize:'11px',cursor:'pointer',fontFamily:'Outfit,sans-serif'}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent)';e.currentTarget.style.color='var(--accent)'}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--text-muted)'}}>+ {label}</button>
                ))}
                <button onClick={()=>upd('extras',[...centre.extras,{id:uid(),label:'',net:0}])} style={{padding:'3px 8px',borderRadius:'20px',border:'1px dashed var(--border)',background:'transparent',color:'var(--text-muted)',fontSize:'11px',cursor:'pointer',fontFamily:'Outfit,sans-serif'}}>+ Custom</button>
              </div>
              {totalNet>0&&<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',paddingTop:'8px',borderTop:'1px solid var(--border)'}}>
                <span style={{fontSize:'12px',color:'var(--text-muted)',fontWeight:'600'}}>Centre Net</span>
                <span style={{fontFamily:'Fraunces,serif',fontSize:'16px',fontWeight:'300',color:'var(--text-primary)'}}>{fmt(totalNet)}</span>
              </div>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── MAIN PAGE ─────────────────────────────────────────────
export default function NewQuotePage(){
  const searchParams = useSearchParams()
  const dealId       = searchParams.get('deal')  ? Number(searchParams.get('deal'))  : null
  const editQuoteId  = searchParams.get('quote') ? Number(searchParams.get('quote')) : null
  const isEditMode   = !!editQuoteId

  const [deal,setDeal]         = useState<DealInfo|null>(null)
  const [deals,setDeals]       = useState<DealInfo[]>([])
  const [saving,setSaving]     = useState(false)
  const [saved,setSaved]       = useState(false)
  const [savedRefs,setSavedRefs] = useState<string[]>([])
  const [error,setError]       = useState('')
  const [showPreview,setShowPreview] = useState(false)
  const [emailTemplate,setEmailTemplate] = useState<1|2|3|4>(1)
  const [dealIdVal,setDealIdVal] = useState(dealId?String(dealId):'')

  // Mode: 'single' or 'multi'
  const [quoteMode,setQuoteMode] = useState<'single'|'multi'>('single')

  // Shared
  const [adults,setAdults]     = useState('2')
  const [children,setChildren] = useState('0')
  const [infants,setInfants]   = useState('0')
  const [initials,setInitials] = useState('SA')
  const [additionalServices,setAdditionalServices] = useState('')
  const [quoteCount,setQuoteCount] = useState(0)
  const [activeQuoteRef,setActiveQuoteRef] = useState('')
  const [activeQuoteId,setActiveQuoteId] = useState<number|null>(editQuoteId)
  const [airportOptions,setAirportOptions] = useState<AirportOption[]>(sortAirportOptions(DEFAULT_AIRPORTS))
  const [customTemplates,setCustomTemplates] = useState<{id:number;name:string;description:string;opening_hook:string;why_choose_us:string;urgency_notice:string;closing_cta:string}[]>([])
  const [selectedCustomTemplate,setSelectedCustomTemplate] = useState<number|null>(null)

  // Single mode — shared defaults + reusable flight options + hotel options
  const [sharedQuoteDefaults,setSharedQuoteDefaults] = useState<SharedQuoteDefaults>(newSharedQuoteDefaults())
  const [flightOptions,setFlightOptions] = useState<FlightOption[]>([newFlightOption(newSharedQuoteDefaults())])
  const [defaultFlightOptionId,setDefaultFlightOptionId] = useState('')
  const [accommodationOptions,setAccommodationOptions] = useState<AccommodationOption[]>([newAccOption(newSharedQuoteDefaults())])

  // Multi-centre mode
  const [centres,setCentres]   = useState<Centre[]>([newCentre('Dubai'), newCentre('Mauritius')])
  const [mcSellPrice,setMcSell]= useState('')
  const [mcMargin,setMcMargin] = useState('')
  const [mcProfit,setMcProfit] = useState('')

  useEffect(()=>{
    if(dealId){loadDeal(dealId);setDealIdVal(String(dealId))}
    loadDeals()
    if(editQuoteId) loadExistingQuote(editQuoteId)
    loadCustomTemplates()
    loadAirports()
  },[dealId,editQuoteId])

  useEffect(() => {
    if (!flightOptions.length) return
    if (!defaultFlightOptionId || !flightOptions.some(option => option.id === defaultFlightOptionId)) {
      setDefaultFlightOptionId(flightOptions[0].id)
    }
  }, [flightOptions, defaultFlightOptionId])

  useEffect(() => {
    setFlightOptions(prev => prev.map(option => applySharedDefaultsToFlightOption(option, sharedQuoteDefaults)))
    setAccommodationOptions(prev => prev.map(option => applySharedDefaultsToAccommodationOption(option, sharedQuoteDefaults)))
  }, [sharedQuoteDefaults])

  const singleQuoteOptions = buildSingleQuoteHotelOptions(
    flightOptions,
    defaultFlightOptionId,
    accommodationOptions
  ).map(normalizeHotelOption)

  async function loadAirports() {
    try {
      const response = await authedFetch('/api/airports')
      if (!response.ok) return
      const data = await response.json()
      setAirportOptions(sortAirportOptions(data.airports || []))
    } catch (error) {
      console.error('Failed to load airports:', error)
    }
  }

  async function createAirport(airport: AirportOption) {
    const response = await authedFetch('/api/airports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(airport),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || !data.airport) {
      throw new Error(data.error || 'Failed to save airport')
    }
    setAirportOptions(prev => sortAirportOptions([...prev, data.airport]))
    return data.airport as AirportOption
  }

  async function loadCustomTemplates(){
    try {
      const response = await fetch('/api/templates')
      if (response.ok) {
        const data = await response.json()
        setCustomTemplates(data)
      }
    } catch (error) {
      console.error('Failed to load templates:', error)
    }
  }
  async function loadDeal(id:number){
    try {
      const response = await fetch(`/api/deals?id=${id}`)
      if (response.ok) {
        const data = await response.json()
        setDeal(data)
        if(!isEditMode){
          setSharedQuoteDefaults(prev=>({
            ...prev,
            outboundDate: data.departure_date || prev.outboundDate,
          }))
          setCentres(prev=>prev.map((c,i)=>i===prev.length-1?{...c,checkinDate:data.departure_date||''}:c))
        }
      }
      // Get quote count for reference generation (per-deal sequence)
      const countResponse = await authedFetch(`/api/quotes?count=${id}`)
      if (countResponse.ok) {
        const countData = await countResponse.json()
        setQuoteCount(countData.count ?? 0)
      }
    } catch (error) {
      console.error('Failed to load deal:', error)
    }
  }
  async function loadDeals(){
    try {
      const response = await fetch('/api/deals')
      if (response.ok) {
        const data = await response.json()
        setDeals(data)
      }
    } catch (error) {
      console.error('Failed to load deals:', error)
    }
  }
  async function loadExistingQuote(qid:number){
    try {
      const response = await fetch(`/api/quotes/${qid}`)
      if (response.ok) {
        const data = await response.json()
        setActiveQuoteId(Number(data.id || qid))
        setActiveQuoteRef(data.quote_ref||'')
        if (data.deal_id) {
          setDealIdVal(String(data.deal_id))
          if (!dealId) {
            loadDeal(Number(data.deal_id))
          }
        }
        setAdults(String(data.adults||2)); setChildren(String(data.children||0)); setInfants(String(data.infants||0))
        setInitials(data.consultant_initials||'SA'); setAdditionalServices(data.additional_services||'')
        if(data.quote_type==='multi_centre'&&data.centres){
          setQuoteMode('multi'); setCentres(sortCentresChronologically(data.centres))
          setMcSell(String(data.price||'')); setMcMargin(String(data.margin_percent||'')); setMcProfit(String(data.profit||''))
        } else {
          setQuoteMode('single')
          const builderState = data.single_quote_builder
          if (builderState) {
            const nextSharedDefaults: SharedQuoteDefaults = {
              origin: builderState.sharedQuoteDefaults?.origin || 'LHR',
              outboundDate: builderState.sharedQuoteDefaults?.outboundDate || '',
              returnDate: builderState.sharedQuoteDefaults?.returnDate || '',
            }
            const nextFlightOptions = (builderState.flightOptions?.length > 0 ? builderState.flightOptions : [newFlightOption(nextSharedDefaults)])
              .map((option: FlightOption) => applySharedDefaultsToFlightOption({
                id: option.id || uid(),
                label: option.label || '',
                outLegs: sortFlightLegs(option.outLegs?.length > 0 ? option.outLegs : [newLeg('out')]),
                retLegs: sortFlightLegs(option.retLegs?.length > 0 ? option.retLegs : [newLeg('ret')]),
                flightNet: String(option.flightNet || ''),
                transNet: String(option.transNet || ''),
              }, nextSharedDefaults))
            const nextDefaultFlightOptionId = nextFlightOptions.some((option: FlightOption) => option.id === builderState.defaultFlightOptionId)
              ? builderState.defaultFlightOptionId
              : nextFlightOptions[0]?.id || ''
            const nextAccommodationOptions = (builderState.accommodationOptions?.length > 0 ? builderState.accommodationOptions : [newAccOption(nextSharedDefaults)])
              .map((option: AccommodationOption) => normalizeAccommodationOptionAssignments({
                ...newAccOption(nextSharedDefaults),
                ...option,
                id: option.id || uid(),
                hotel: option.hotel || '',
                roomType: option.roomType || '',
                boardBasis: option.boardBasis || 'All Inclusive',
                nights: String(option.nights || '7'),
                checkinDate: option.checkinDate || nextSharedDefaults.outboundDate || '',
                checkinNextDay: !!option.checkinNextDay,
                accNet: String(option.accNet || ''),
                extras: Array.isArray(option.extras) ? option.extras : [],
                sellPrice: String(option.sellPrice || ''),
                margin: String(option.margin || ''),
                profit: String(option.profit || ''),
                useDefaultFlight: option.useDefaultFlight !== false,
                assignedFlightOptionIds: Array.isArray(option.assignedFlightOptionIds) ? option.assignedFlightOptionIds : [],
                pricingFlightOptionId: option.pricingFlightOptionId || '',
              }, nextFlightOptions, nextDefaultFlightOptionId))

            setSharedQuoteDefaults(nextSharedDefaults)
            setFlightOptions(nextFlightOptions)
            setDefaultFlightOptionId(nextDefaultFlightOptionId)
            setAccommodationOptions(nextAccommodationOptions)
            return
          }
          const costs=data.cost_breakdown||{}, fd=data.flight_details||{}
          const flightOptionId = uid()
          const outboundLegs = fd.outbound?.length>0 ? sortFlightLegs(fd.outbound) : [newLeg('out')]
          const returnLegs = fd.return?.length>0 ? sortFlightLegs(fd.return) : [newLeg('ret')]
          setSharedQuoteDefaults({
            origin: outboundLegs[0]?.from || returnLegs[returnLegs.length-1]?.to || 'LHR',
            outboundDate: outboundLegs[0]?.date || data.departure_date || '',
            returnDate: returnLegs[0]?.date || '',
          })
          setFlightOptions([{
            id: flightOptionId,
            label: '',
            outLegs: outboundLegs,
            retLegs: returnLegs,
            flightNet: String(costs.flight_net||''),
            transNet: String(costs.trans_net||''),
          }])
          setDefaultFlightOptionId(flightOptionId)
          setAccommodationOptions([{
            id: uid(),
            hotel: data.hotel||'',
            roomType: data.room_type||'',
            boardBasis: data.board_basis||'All Inclusive',
            nights: String(data.nights||7),
            checkinDate: data.checkin_date||data.departure_date||'',
            checkinNextDay: data.checkin_next_day||false,
            accNet: String(costs.acc_net||''),
            extras: costs.extras||[],
            sellPrice: String(data.price||''),
            margin: String(data.margin_percent||''),
            profit: String(data.profit||''),
            useDefaultFlight: true,
            assignedFlightOptionIds: [],
            pricingFlightOptionId: flightOptionId,
          }])
        }
      }
    } catch (error) {
      console.error('Failed to load quote:', error)
    }
  }

  function markDirty(){
    setSaved(false)
    setSavedRefs(activeQuoteRef ? [activeQuoteRef] : [])
  }

  function updateSharedQuoteDefaults(field: keyof SharedQuoteDefaults, value: string) {
    markDirty()
    setSharedQuoteDefaults(prev => ({ ...prev, [field]: value }))
  }

  function addFlightOption() {
    markDirty()
    setFlightOptions(prev => [...prev, newFlightOption(sharedQuoteDefaults)])
  }

  function updateFlightOption(updatedOption: FlightOption) {
    markDirty()
    setFlightOptions(prev => prev.map(option => option.id === updatedOption.id ? updatedOption : option))
  }

  function removeFlightOption(flightOptionId: string) {
    markDirty()
    setFlightOptions(prev => {
      const nextOptions = prev.filter(option => option.id !== flightOptionId)
      const nextDefaultFlightOptionId = defaultFlightOptionId === flightOptionId
        ? (nextOptions[0]?.id || '')
        : defaultFlightOptionId

      setDefaultFlightOptionId(nextDefaultFlightOptionId)
      setAccommodationOptions(existingOptions => existingOptions.map(option => normalizeAccommodationOptionAssignments({
        ...option,
        assignedFlightOptionIds: option.assignedFlightOptionIds.filter(id => id !== flightOptionId),
        useDefaultFlight: option.useDefaultFlight ? nextDefaultFlightOptionId !== '' : false,
        pricingFlightOptionId: option.pricingFlightOptionId === flightOptionId ? nextDefaultFlightOptionId : option.pricingFlightOptionId,
      }, nextOptions, nextDefaultFlightOptionId)))

      return nextOptions
    })
  }

  // Multi-centre pricing
  const mcSellN=parseFloat(mcSellPrice)||0, mcProfitN=parseFloat(mcProfit)||0
  const mcMarginN = parseFloat(mcMargin)|| (mcSellN>0&&mcProfitN>0&&mcProfitN<mcSellN ? (mcProfitN/(mcSellN-mcProfitN))*100 : 0)
  const mcTotalNet=centres.reduce((a,c)=>{
    const accN=parseFloat(c.accNet)||0,flightN=parseFloat(c.flightNet)||0,transN=parseFloat(c.transNet)||0
    return a+accN+flightN+transN+c.extras.reduce((x,e)=>x+(e.net||0),0)
  },0)
  const sortedCentres = sortCentresChronologically(centres)
  function onMcSell(v:string){
    markDirty()
    const sell=parseFloat(v)||0,mg=parseFloat(mcMargin)||0,pr=parseFloat(mcProfit)||0
    if(sell>0&&mg>0){
      const profit = mcTotalNet>0 ? mcTotalNet*mg/100 : sell*mg/(100+mg)
      setMcProfit(profit.toFixed(2))
    } else if(sell>0&&pr>0){
      const markup = sell>pr ? (pr/(sell-pr))*100 : 0
      setMcMargin(markup.toFixed(1))
    }
    setMcSell(v)
  }
  function onMcMargin(v:string){
    markDirty()
    const sell=parseFloat(mcSellPrice)||0,mg=parseFloat(v)||0
    if(mcTotalNet>0&&mg>0){
      const s=mcTotalNet*(1+mg/100)
      setMcSell(s.toFixed(2)); setMcProfit((mcTotalNet*mg/100).toFixed(2))
    } else if(sell>0&&mg>0){
      const profit = sell*mg/(100+mg)
      setMcProfit(profit.toFixed(2))
    }
    setMcMargin(v)
  }
  function onMcProfit(v:string){
    markDirty()
    const sell=parseFloat(mcSellPrice)||0,pr=parseFloat(v)||0
    if(sell>0&&pr>0){
      const markup = sell>pr ? (pr/(sell-pr))*100 : 0
      setMcMargin(markup.toFixed(1))
    } else if(mcTotalNet>0&&pr>0){
      const s=mcTotalNet+pr; setMcSell(s.toFixed(2)); setMcMargin(((pr/mcTotalNet)*100).toFixed(1))
    }
    setMcProfit(v)
  }

  const quoteRef = activeQuoteRef || genRef(initials, quoteCount)

  async function handleSave(){
    const tid = Number(dealIdVal)
    if(!tid){ setError('Select a deal'); return }
    if(quoteMode==='single' && singleQuoteOptions.length===0){ setError('Add at least one complete hotel + flight option before saving'); return }

    setSaving(true); setError('')
    const wasPersistedQuote = !!activeQuoteRef

    try {
      const response = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealId: tid,
          quoteType: quoteMode,
          quoteRef: quoteRef,
          adults: parseInt(adults),
          children: parseInt(children),
          infants: parseInt(infants),
          initials,
          additionalServices,
          hotelOptions: singleQuoteOptions,
          centres: sortCentresChronologically(centres),
          sellPrice: parseFloat(mcSellPrice),
          margin: parseFloat(mcMargin),
          profit: parseFloat(mcProfit),
          isEdit: false,
          editQuoteId: activeQuoteId || editQuoteId,
          singleQuoteBuilder: quoteMode==='single' ? {
            sharedQuoteDefaults,
            flightOptions,
            defaultFlightOptionId,
            accommodationOptions,
          } : undefined,
        })
      })

      if (response.ok) {
        const { refs, quoteId } = await response.json()
        setSavedRefs(refs)
        if (refs?.[0]) setActiveQuoteRef(refs[0])
        if (quoteId) setActiveQuoteId(Number(quoteId))
        setSaving(false)
        setSaved(true)
        if (!wasPersistedQuote && refs?.length) {
          setQuoteCount(c => c + 1)
        }
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to save quote')
        setSaving(false)
      }
    } catch (error) {
      console.error('Save failed:', error)
      setError('Failed to save quote')
      setSaving(false)
    }
  }

  const TEMPLATES=[{id:1,label:'The Dream Seller',desc:'Sell the experience'},{id:2,label:'The Trusted Expert',desc:'Authority & credentials'},{id:3,label:'The Urgency Close',desc:'Drive action now'},{id:4,label:'The VIP Treatment',desc:'Bespoke & exclusive'}] as const

  return(
    <div>
      <div className="page-header">
        <div style={{display:'flex',alignItems:'center',gap:'14px'}}>
          {dealId?<Link href={`/deals/${dealId}`} style={{color:'var(--text-muted)',textDecoration:'none',fontSize:'13px'}}>← Back to Deal</Link>
                 :<Link href="/pipeline" style={{color:'var(--text-muted)',textDecoration:'none',fontSize:'13px'}}>← Pipeline</Link>}
          <div style={{width:'1px',height:'20px',background:'var(--border)'}}/>
          <div>
            <div className="page-title">{isEditMode?'Edit Quote':'Quote Builder'}</div>
            <div style={{fontSize:'12.5px',color:'var(--text-muted)',marginTop:'1px'}}>
              Ref: <strong style={{color:'var(--accent-mid)',fontFamily:'monospace'}}>{quoteRef}</strong>
              {isEditMode&&<span style={{marginLeft:'8px',fontSize:'11px',background:'var(--amber-light)',color:'var(--amber)',padding:'2px 8px',borderRadius:'10px',fontWeight:'600'}}>Editing</span>}
              {deal&&` · ${deal.title}`}
            </div>
          </div>
        </div>
        <div style={{display:'flex',gap:'8px'}}>
          {((quoteMode==='single' && singleQuoteOptions.length>0) || (quoteMode==='multi' && centres.some(c=>c.hotel.trim())))&&<button className="btn btn-secondary" onClick={()=>setShowPreview(true)}>👁 Preview Quote</button>}
          {saved
            ?<Link href={`/deals/${dealIdVal}`}><button className="btn btn-primary">← Back to Deal</button></Link>
            :<button className="btn btn-cta btn-lg" onClick={handleSave} disabled={saving}>{saving?'Saving…':isEditMode?'Update Quote':'Save Quote'}</button>}
        </div>
      </div>

      <div className="page-body">
        {error&&<div style={{background:'var(--red-light)',color:'var(--red)',padding:'12px 16px',borderRadius:'8px',fontSize:'13px',marginBottom:'16px'}}>{error}</div>}
        {saved&&(
          <div style={{background:'var(--green-light)',color:'var(--green)',padding:'12px 16px',borderRadius:'8px',fontSize:'13px',marginBottom:'16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span>✓ {savedRefs.length} quote{savedRefs.length>1?'s':''} saved! Refs: {savedRefs.join(', ')}</span>
            <div style={{display:'flex',gap:'8px'}}>
              <button onClick={()=>setShowPreview(true)} style={{background:'var(--green)',color:'white',border:'none',borderRadius:'6px',padding:'5px 12px',fontSize:'12px',cursor:'pointer',fontFamily:'Outfit,sans-serif'}}>👁 Preview Quote</button>
              <Link href={`/deals/${dealIdVal}`}><button className="btn btn-secondary btn-sm">Back to Deal →</button></Link>
            </div>
          </div>
        )}

        <div style={{display:'grid',gridTemplateColumns:'1fr 290px',gap:'20px'}}>
          <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>

            {/* Deal selector */}
            <div className="card" style={{padding:'18px 20px'}}>
              <div style={{fontFamily:'Fraunces,serif',fontSize:'17px',fontWeight:'300',marginBottom:'12px'}}>Deal</div>
              {deal?(
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'11px 14px',background:'var(--accent-light)',borderRadius:'8px',border:'1.5px solid var(--accent)'}}>
                  <div>
                    <div style={{fontWeight:'500',color:'var(--accent-mid)',fontSize:'14px'}}>{deal.title}</div>
                    {deal.clients&&<div style={{fontSize:'12px',color:'var(--text-muted)',marginTop:'1px'}}>{(deal.clients as any).first_name} {(deal.clients as any).last_name} · {(deal.clients as any).email}</div>}
                  </div>
                  <button onClick={()=>{ markDirty(); setActiveQuoteRef(''); setActiveQuoteId(null); setDeal(null); setDealIdVal('') }} className="btn btn-secondary btn-sm">Change</button>
                </div>
              ):(
                <div>
                  <label className="label">Select Deal *</label>
                  <select className="input" value={dealIdVal} onChange={e=>{ markDirty(); setActiveQuoteRef(''); setActiveQuoteId(null); setDealIdVal(e.target.value);loadDeal(Number(e.target.value)) }}>
                    <option value="">Choose…</option>
                    {deals.map(d=><option key={d.id} value={d.id}>{d.title}{d.clients?` — ${(d.clients as any).first_name} ${(d.clients as any).last_name}`:''}</option>)}
                  </select>
                </div>
              )}
            </div>

            {/* Quote type toggle */}
            {!isEditMode&&(
              <div className="card" style={{padding:'18px 20px'}}>
                <div style={{fontFamily:'Fraunces,serif',fontSize:'17px',fontWeight:'300',marginBottom:'14px'}}>Quote Type</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
                  {[
                    {key:'single',label:'Single Destination',desc:'One or more hotel options for the same destination',icon:'🏨'},
                    {key:'multi',label:'Multi-Centre',desc:'Sequential itinerary across 2+ destinations (e.g. Dubai + Mauritius)',icon:'✈'},
                  ].map(t=>(
                    <button key={t.key} onClick={()=>{ markDirty(); setQuoteMode(t.key as 'single'|'multi') }}
                      style={{padding:'14px',borderRadius:'10px',border:'2px solid',textAlign:'left',cursor:'pointer',fontFamily:'Outfit,sans-serif',
                        borderColor:quoteMode===t.key?'var(--accent-mid)':'var(--border)',
                        background:quoteMode===t.key?'var(--accent-light)':'transparent',
                        transition:'all 0.15s'}}>
                      <div style={{fontSize:'18px',marginBottom:'6px'}}>{t.icon}</div>
                      <div style={{fontSize:'13.5px',fontWeight:'600',color:quoteMode===t.key?'var(--accent-mid)':'var(--text-primary)',marginBottom:'3px'}}>{t.label}</div>
                      <div style={{fontSize:'11.5px',color:'var(--text-muted)',lineHeight:'1.4'}}>{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Passengers */}
            <div className="card" style={{padding:'18px 20px'}}>
              <div style={{fontFamily:'Fraunces,serif',fontSize:'17px',fontWeight:'300',marginBottom:'12px'}}>Passengers</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'10px'}}>
                <div><label className="label">Adults</label><input className="input" type="number" min="1" value={adults} onChange={e=>{ markDirty(); setAdults(e.target.value) }}/></div>
                <div><label className="label">Children</label><input className="input" type="number" min="0" value={children} onChange={e=>{ markDirty(); setChildren(e.target.value) }}/></div>
                <div><label className="label">Infants</label><input className="input" type="number" min="0" value={infants} onChange={e=>{ markDirty(); setInfants(e.target.value) }}/></div>
              </div>
            </div>

            {/* ── SINGLE DESTINATION ── */}
            {quoteMode==='single'&&(
              <div>
                <div className="card" style={{padding:'18px 20px',marginBottom:'16px'}}>
                  <div style={{fontFamily:'Fraunces,serif',fontSize:'17px',fontWeight:'300',marginBottom:'4px'}}>Shared Quote Defaults</div>
                  <div style={{fontSize:'12px',color:'var(--text-muted)',marginBottom:'14px'}}>Passengers stay at quote level, and these defaults pre-fill new flight and hotel options without forcing full itinerary duplication.</div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'10px'}}>
                    <div><label className="label">Origin</label><input className="input" placeholder="LHR" value={sharedQuoteDefaults.origin} onChange={e=>updateSharedQuoteDefaults('origin',e.target.value.toUpperCase())}/></div>
                    <div><label className="label">Outbound Date</label><input className="input" type="date" value={sharedQuoteDefaults.outboundDate} onChange={e=>updateSharedQuoteDefaults('outboundDate',e.target.value)}/></div>
                    <div><label className="label">Return Date</label><input className="input" type="date" value={sharedQuoteDefaults.returnDate} onChange={e=>updateSharedQuoteDefaults('returnDate',e.target.value)}/></div>
                  </div>
                </div>

                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}>
                  <div>
                    <div style={{fontFamily:'Fraunces,serif',fontSize:'17px',fontWeight:'300'}}>Flight Options</div>
                    <div style={{fontSize:'12px',color:'var(--text-muted)',marginTop:'2px'}}>Add reusable flight-only options once, then attach them to one or more hotels below.</div>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={addFlightOption}>+ Add Flight Option</button>
                </div>
                {flightOptions.map((option,index)=>(
                  <FlightOptionPanel
                    key={option.id}
                    option={option}
                    index={index}
                    totalOptions={flightOptions.length}
                    isDefault={option.id===defaultFlightOptionId}
                    onSetDefault={()=>{ markDirty(); setDefaultFlightOptionId(option.id); setAccommodationOptions(prev=>prev.map(acc=>normalizeAccommodationOptionAssignments(acc, flightOptions, option.id))) }}
                    onChange={updated=>updateFlightOption(updated)}
                    onRemove={()=>removeFlightOption(option.id)}
                    airports={airportOptions}
                    onCreateAirport={createAirport}
                  />
                ))}
                {flightOptions.length<6&&(
                  <button onClick={addFlightOption}
                    style={{width:'100%',padding:'13px',border:'2px dashed var(--border)',borderRadius:'12px',background:'transparent',color:'var(--text-muted)',fontSize:'13px',cursor:'pointer',fontFamily:'Outfit,sans-serif',marginBottom:'18px'}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent)';e.currentTarget.style.color='var(--accent)'}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--text-muted)'}}>
                    + Add Another Flight Option
                  </button>
                )}

                {/* Accommodation options */}
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}>
                  <div>
                    <div style={{fontFamily:'Fraunces,serif',fontSize:'17px',fontWeight:'300'}}>Accommodation Options</div>
                    <div style={{fontSize:'12px',color:'var(--text-muted)',marginTop:'2px'}}>Hotels stay separate from flights, and each hotel can use the default flight and/or attach specific alternatives.</div>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={()=>{ markDirty(); setAccommodationOptions(p=>[...p,newAccOption(sharedQuoteDefaults)]) }}>+ Add Accommodation Option</button>
                </div>
                {accommodationOptions.map((o,i)=>(
                  <AssignedAccommodationOptionPanel key={o.id} option={o} index={i} totalOptions={accommodationOptions.length}
                    flightOptions={flightOptions}
                    defaultFlightOptionId={defaultFlightOptionId}
                    onChange={updated=>{ markDirty(); setAccommodationOptions(p=>p.map(x=>x.id===updated.id?updated:x)) }}
                    onRemove={()=>{ markDirty(); setAccommodationOptions(p=>p.filter(x=>x.id!==o.id)) }}
                    onDuplicate={()=>{ const src=accommodationOptions.find(x=>x.id===o.id); if(src){ markDirty(); setAccommodationOptions(p=>[...p,{...src,id:uid(),hotel:''}]) } }}
                  />
                ))}
                {accommodationOptions.length<6&&(
                  <button onClick={()=>{ markDirty(); setAccommodationOptions(p=>[...p,newAccOption(sharedQuoteDefaults)]) }}
                    style={{width:'100%',padding:'13px',border:'2px dashed var(--border)',borderRadius:'12px',background:'transparent',color:'var(--text-muted)',fontSize:'13px',cursor:'pointer',fontFamily:'Outfit,sans-serif'}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent)';e.currentTarget.style.color='var(--accent)'}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--text-muted)'}}>
                    + Add Another Accommodation Option
                  </button>
                )}
              </div>
            )}

            {/* ── MULTI-CENTRE ── */}
            {quoteMode==='multi'&&(
              <div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'4px'}}>
                  <div style={{fontFamily:'Fraunces,serif',fontSize:'17px',fontWeight:'300'}}>Centres</div>
                  <button className="btn btn-secondary btn-sm" onClick={()=>{ markDirty(); setCentres(p=>sortCentresChronologically([...p,newCentre('')])) }}>+ Add Centre</button>
                </div>
                <div style={{fontSize:'12px',color:'var(--text-muted)',marginBottom:'14px'}}>Each centre has its own destination, hotel, flights and net costs. The return flight goes on the last centre.</div>

                {centres.map((c,i)=>(
                  <CentrePanel key={c.id} centre={c} index={i} total={centres.length}
                    onChange={updated=>{ markDirty(); setCentres(p=>sortCentresChronologically(p.map(x=>x.id===updated.id?normalizeCentre(updated):x))) }}
                    onRemove={()=>{ markDirty(); setCentres(p=>sortCentresChronologically(p.filter(x=>x.id!==c.id))) }}
                    airports={airportOptions}
                    onCreateAirport={createAirport}/>
                ))}

                {centres.length<6&&(
                  <button onClick={()=>{ markDirty(); setCentres(p=>sortCentresChronologically([...p,newCentre('')])) }}
                    style={{width:'100%',padding:'13px',border:'2px dashed var(--border)',borderRadius:'12px',background:'transparent',color:'var(--text-muted)',fontSize:'13px',cursor:'pointer',fontFamily:'Outfit,sans-serif'}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent)';e.currentTarget.style.color='var(--accent)'}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--text-muted)'}}>
                    + Add Another Centre
                  </button>
                )}

                {/* Multi-centre combined pricing */}
                <div className="card" style={{padding:'20px',marginTop:'16px'}}>
                  <div style={{fontFamily:'Fraunces,serif',fontSize:'17px',fontWeight:'300',marginBottom:'6px'}}>Combined Package Price</div>
                  <div style={{fontSize:'12px',color:'var(--text-muted)',marginBottom:'14px'}}>
                    {mcTotalNet>0&&<span>Total net across all centres: <strong>{fmt(mcTotalNet)}</strong> · </span>}
                    One price shown to client covering the full itinerary.
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'12px',marginBottom:'14px'}}>
                    <div><label className="label">Sell Price (£) *</label><input className="input" type="number" step="1" placeholder="8500" value={mcSellPrice} onChange={e=>onMcSell(e.target.value)} style={{fontSize:'15px',fontWeight:'500'}}/></div>
                    <div><label className="label">Markup %</label><div style={{position:'relative'}}><input className="input" type="number" step="0.1" placeholder="10" value={mcMargin} onChange={e=>onMcMargin(e.target.value)} style={{paddingRight:'26px'}}/><span style={{position:'absolute',right:'10px',top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)',fontSize:'13px',pointerEvents:'none'}}>%</span></div></div>
                    <div><label className="label">Profit (£)</label><input className="input" type="number" step="1" placeholder="Auto" value={mcProfit} onChange={e=>onMcProfit(e.target.value)} style={{color:'var(--gold)',fontWeight:'500'}}/></div>
                  </div>
                  {mcSellN>0&&(
                    <div style={{display:'flex',gap:'16px',padding:'12px 14px',background:'var(--bg-tertiary)',borderRadius:'8px'}}>
                      {[...(mcTotalNet>0?[{l:'Net',v:fmtS(mcTotalNet),c:'var(--text-primary)'}]:[]),{l:'Sell',v:fmtS(mcSellN),c:'var(--text-primary)'},{l:'Profit',v:fmtS(mcProfitN),c:'var(--gold)'},{l:'Markup',v:mcMarginN.toFixed(1)+'%',c:mcMarginN>=10?'var(--green)':mcMarginN>=7?'var(--amber)':'var(--red)'}].map(s=>(
                        <div key={s.l} style={{textAlign:'center'}}>
                          <div style={{fontSize:'10px',textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--text-muted)',marginBottom:'2px'}}>{s.l}</div>
                          <div style={{fontFamily:'Fraunces,serif',fontSize:'18px',fontWeight:'300',color:s.c}}>{s.v}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Additional services */}
            <div className="card" style={{padding:'18px 20px'}}>
              <div style={{fontFamily:'Fraunces,serif',fontSize:'17px',fontWeight:'300',marginBottom:'4px'}}>Additional Services</div>
              <div style={{fontSize:'12px',color:'var(--text-muted)',marginBottom:'10px'}}>Shown to client in the quote email</div>
              <textarea className="input" style={{minHeight:'90px',resize:'vertical'}}
                placeholder="e.g. Airport lounge access at Gatwick South Terminal, private chauffeur transfer, welcome amenity at resort on arrival…"
                value={additionalServices} onChange={e=>{ markDirty(); setAdditionalServices(e.target.value) }}/>
            </div>
          </div>

          {/* SIDEBAR */}
          <div style={{position:'sticky',top:'80px',alignSelf:'flex-start',display:'flex',flexDirection:'column',gap:'12px'}}>

            {/* Live summary */}
            {quoteMode==='single'&&accommodationOptions.map((o,i)=>{
              const sellN=parseFloat(o.sellPrice)||0,profitN=parseFloat(o.profit)||0
              const marginN = sellN>0&&profitN>0&&profitN<sellN ? (profitN/(sellN-profitN))*100 : (parseFloat(o.margin)||0)
              const COLORS=['#8b5cf6','#3b82f6','#10b981','#f59e0b','#ec4899']
              const col=COLORS[i%COLORS.length]
              return(
                <div key={o.id} style={{background:'#0d1b2a',borderRadius:'12px',padding:'16px',color:'white',borderLeft:`3px solid ${col}`}}>
                  <div style={{fontSize:'9px',textTransform:'uppercase',letterSpacing:'0.12em',color:col,marginBottom:'3px'}}>Option {i+1}</div>
                  <div style={{fontFamily:'Fraunces,serif',fontSize:'15px',fontWeight:'300',marginBottom:'2px'}}>{o.hotel||'—'}</div>
                  <div style={{fontSize:'11px',opacity:0.5,marginBottom:'10px'}}>{o.boardBasis} · {o.nights} nights{o.useDefaultFlight||o.assignedFlightOptionIds.length>0?` · ${(o.useDefaultFlight?1:0)+o.assignedFlightOptionIds.length} flight choice${((o.useDefaultFlight?1:0)+o.assignedFlightOptionIds.length)===1?'':'s'}`:''}</div>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span style={{fontSize:'10px',opacity:0.6}}>Total</span>
                    <span style={{fontFamily:'Fraunces,serif',fontSize:'19px',fontWeight:'300',color:'#d4a84a'}}>{sellN>0?fmtS(sellN):'—'}</span>
                  </div>
                  {profitN>0&&<div style={{textAlign:'right',fontSize:'10px',color:'rgba(201,168,76,0.5)',marginTop:'2px'}}>Profit: {fmtS(profitN)} ({marginN.toFixed(1)}%)</div>}
                </div>
              )
            })}

            {quoteMode==='multi'&&(
              <div style={{background:'#0d1b2a',borderRadius:'12px',padding:'16px',color:'white'}}>
                <div style={{fontSize:'9px',textTransform:'uppercase',letterSpacing:'0.12em',color:'#d4a84a',marginBottom:'6px'}}>Multi-Centre Itinerary</div>
                {sortedCentres.map((c,i)=>(
                  <div key={c.id} style={{marginBottom:'6px',paddingBottom:'6px',borderBottom:i<centres.length-1?'1px solid rgba(255,255,255,0.07)':'none'}}>
                    <div style={{fontSize:'11px',fontWeight:'600',color:'#d4a84a'}}>{c.destination||`Centre ${i+1}`}</div>
                    <div style={{fontSize:'12px',color:'rgba(255,255,255,0.75)',fontFamily:'Fraunces,serif',fontWeight:'300'}}>{c.hotel||'—'}</div>
                    <div style={{fontSize:'10px',color:'rgba(255,255,255,0.35)'}}>{c.nights} nights · {c.boardBasis}</div>
                  </div>
                ))}
                <div style={{marginTop:'10px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:'10px',opacity:0.6}}>Package Total</span>
                  <span style={{fontFamily:'Fraunces,serif',fontSize:'19px',fontWeight:'300',color:'#d4a84a'}}>{mcSellN>0?fmtS(mcSellN):'—'}</span>
                </div>
              </div>
            )}

            {/* Consultant initials */}
            <div className="card" style={{padding:'14px 16px'}}>
              <label className="label">Consultant Initials</label>
              <input className="input" maxLength={3} style={{textTransform:'uppercase',letterSpacing:'0.1em',fontWeight:'600',marginBottom:'6px'}} value={initials} onChange={e=>{ markDirty(); setInitials(e.target.value.toUpperCase()) }}/>
              <div style={{fontSize:'11.5px',color:'var(--text-muted)'}}>Ref: <span style={{fontWeight:'600',color:'var(--accent-mid)',fontFamily:'monospace'}}>{quoteRef}</span></div>
            </div>

            {/* Template picker */}
            <div className="card" style={{padding:'14px 16px'}}>
              <div style={{fontSize:'11px',fontWeight:'700',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'8px'}}>Email Template</div>
              <div style={{display:'flex',flexDirection:'column',gap:'5px'}}>
                <div style={{fontSize:'10px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.06em',padding:'4px 0 2px',fontWeight:'600'}}>Built-in</div>
                {TEMPLATES.map(t=>(
                  <button key={t.id} onClick={()=>{setEmailTemplate(t.id as 1|2|3|4);setSelectedCustomTemplate(null)}}
                    style={{padding:'7px 10px',borderRadius:'7px',border:'1.5px solid',textAlign:'left',cursor:'pointer',fontFamily:'Outfit,sans-serif',
                      borderColor:emailTemplate===t.id&&!selectedCustomTemplate?'var(--accent-mid)':'var(--border)',
                      background:emailTemplate===t.id&&!selectedCustomTemplate?'var(--accent-light)':'transparent'}}>
                    <div style={{fontSize:'12px',fontWeight:'500',color:emailTemplate===t.id&&!selectedCustomTemplate?'var(--accent-mid)':'var(--text-primary)'}}>{t.label}</div>
                    <div style={{fontSize:'10.5px',color:'var(--text-muted)'}}>{t.desc}</div>
                  </button>
                ))}
                {customTemplates.length>0&&(
                  <>
                    <div style={{fontSize:'10px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.06em',padding:'6px 0 2px',fontWeight:'600',borderTop:'1px solid var(--border)',marginTop:'4px'}}>Custom</div>
                    {customTemplates.map(t=>(
                      <button key={t.id} onClick={()=>setSelectedCustomTemplate(t.id)}
                        style={{padding:'7px 10px',borderRadius:'7px',border:'1.5px solid',textAlign:'left',cursor:'pointer',fontFamily:'Outfit,sans-serif',
                          borderColor:selectedCustomTemplate===t.id?'var(--accent-mid)':'var(--border)',
                          background:selectedCustomTemplate===t.id?'var(--accent-light)':'transparent'}}>
                        <div style={{fontSize:'12px',fontWeight:'500',color:selectedCustomTemplate===t.id?'var(--accent-mid)':'var(--text-primary)'}}>{t.name}</div>
                        {t.description&&<div style={{fontSize:'10.5px',color:'var(--text-muted)'}}>{t.description}</div>}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>

            <div style={{background:'var(--gold-light)',borderRadius:'10px',padding:'12px 14px',border:'1px solid var(--border)'}}>
              <div style={{fontSize:'10.5px',fontWeight:'700',color:'var(--gold)',marginBottom:'6px',textTransform:'uppercase',letterSpacing:'0.06em'}}>Commission Guide</div>
              <div style={{fontSize:'12px',color:'var(--text-secondary)',lineHeight:'1.8'}}>
                <div>🟢 10%+ great margin</div><div>🟡 7–10% acceptable</div><div>🔴 Under 7% review</div>
              </div>
            </div>

            <button className="btn btn-secondary" style={{width:'100%',justifyContent:'center',padding:'11px'}} onClick={()=>setShowPreview(true)}>
              👁 Preview & Deliver Quote
            </button>
          </div>
        </div>
      </div>

      {showPreview&&(
        <QuoteDeliveryModal
          deal={deal} quoteMode={quoteMode}
          hotelOptions={singleQuoteOptions} centres={centres}
          adults={adults} children={children} infants={infants}
          additionalServices={additionalServices}
          sellPrice={quoteMode==='single'?parseFloat(singleQuoteOptions[0]?.sellPrice||'0'):mcSellN}
          quoteRef={quoteRef} template={emailTemplate}
          selectedCustomTemplate={selectedCustomTemplate}
          customTemplates={customTemplates}
          onClose={()=>setShowPreview(false)}/>
      )}
    </div>
  )
}

// helper to check hotel var
function hotel(options: {hotel:string}[]) { return options[0]?.hotel || '' }

// ── QUOTE DELIVERY ────────────────────────────────────────

const QN = '#1a2e4a'   // navy
const QG = '#b8922e'   // gold
const QB = '#f5f2ee'   // warm background
const QT = '#2c2c2c'   // body text
const QM = '#6b6b6b'   // muted text
const QD = '#e2ddd8'   // border

function qEsc(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

function qOptionPriceRow(price: number, label: string, nights?: number): string {
  if (!(price > 0)) return ''
  const dep = price * 0.1
  const fp  = '&pound;' + price.toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2})
  const fd  = '&pound;' + dep.toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2})
  const nightCount = Math.max(1, Number(nights || 0))
  const perNight = nightCount > 0 ? price / nightCount : price
  const pn = '&pound;' + perNight.toLocaleString('en-GB',{minimumFractionDigits:0,maximumFractionDigits:0})
  return `<tr><td style="padding:0 36px 20px;">
    <p style="font-size:10px;font-weight:700;color:#9a7a3a;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 10px;">${label}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f5;border:1px solid #e2dbd2;border-radius:6px;overflow:hidden;">
      <tr>
        <td style="padding:18px 22px 16px;border-top:2px solid ${QG};vertical-align:middle;width:62%;">
          <p style="font-size:8px;text-transform:uppercase;letter-spacing:0.2em;color:#b0a090;margin:0 0 6px;">Total Investment</p>
          <p style="font-size:26px;color:${QN};font-family:Georgia,serif;font-weight:normal;margin:0;line-height:1.1;letter-spacing:-0.01em;">${fp}</p>
          <p style="font-size:10px;color:#9a8e80;margin:6px 0 0;">${pn} per night</p>
        </td>
        <td style="padding:18px 22px 16px;border-top:2px solid transparent;border-left:1px solid #e2dbd2;text-align:right;vertical-align:middle;width:38%;background:#f4efe8;">
          <p style="font-size:8px;text-transform:uppercase;letter-spacing:0.18em;color:#b0a090;margin:0 0 5px;">Deposit to reserve</p>
          <p style="font-size:20px;color:${QG};font-family:Georgia,serif;font-weight:normal;margin:0;">${fd}</p>
          <p style="font-size:10px;color:#9a8e80;margin:4px 0 0;">10% to secure</p>
        </td>
      </tr>
    </table>
  </td></tr>`
}

function qSectionHead(title: string): string {
  return `<p style="font-size:10.5px;font-weight:700;color:${QN};text-transform:uppercase;letter-spacing:0.1em;margin:0 0 12px;padding-bottom:8px;border-bottom:2px solid ${QG};">${title}</p>`
}

function qFlightsSection(legs: FlightLeg[]): string {
  const rows = legs.filter(l => l.date || l.depart_time || l.flight_number || l.airline)
  if (!rows.length) return ''
  const cols = ['Flight','Date','Departs','Arrives','Airline','Route','Cabin']
  return `
  <tr><td style="padding:0 36px 24px;">
    ${qSectionHead('Flights')}
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:12px;">
      <thead><tr bgcolor="${QN}">
        ${cols.map(h=>`<th style="padding:7px 9px;text-align:left;color:white;font-weight:500;font-size:10.5px;">${h}</th>`).join('')}
      </tr></thead>
      <tbody>
        ${rows.map((f,i)=>`
          <tr bgcolor="${i%2===0?'#f8f6f3':'#ffffff'}">
            <td style="padding:7px 9px;font-family:monospace;font-weight:600;font-size:11px;">${f.flight_number||'&mdash;'}</td>
            <td style="padding:7px 9px;">${fmtDate(f.date)}</td>
            <td style="padding:7px 9px;font-family:monospace;">${f.depart_time||'&mdash;'}</td>
            <td style="padding:7px 9px;font-family:monospace;">${f.arrival_time||'&mdash;'}${f.overnight?' (+1)':''}</td>
            <td style="padding:7px 9px;">${f.airline||'&mdash;'}</td>
            <td style="padding:7px 9px;font-weight:500;">${[f.from,f.to].filter(Boolean).join(' &rarr; ')}</td>
            <td style="padding:7px 9px;">${f.cabin||'&mdash;'}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  </td></tr>`
}

function qAccomRow(l1:string,v1:string,l2:string,v2:string,bg:string): string {
  return `<tr bgcolor="${bg}">
    <td style="padding:8px 12px;font-weight:700;font-size:10.5px;color:${QM};width:90px;white-space:nowrap;">${l1}</td>
    <td style="padding:8px 12px;font-size:13px;color:${QT};">${v1||'&mdash;'}</td>
    <td style="padding:8px 12px;font-weight:700;font-size:10.5px;color:${QM};width:80px;white-space:nowrap;">${l2}</td>
    <td style="padding:8px 12px;font-size:13px;color:${QT};">${v2||'&mdash;'}</td>
  </tr>`
}

function generateQuoteHtml(p: {
  deal: DealInfo|null
  quoteMode: 'single'|'multi'
  hotelOptions: HotelOption[]
  centres: Centre[]
  adults: string; children: string; infants: string
  additionalServices: string
  sellPrice: number
  quoteRef: string
  templateId: number
  customTemplate: any
  isPdf: boolean
}): string {
  const client    = p.deal?.clients as any
  const firstName = client?.first_name || 'Valued Client'
  const today     = new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})
  const isMulti   = p.quoteMode === 'multi'
  const ordC      = isMulti ? sortCentresChronologically(p.centres) : []
  const tpl       = p.templateId
  const multiOpts = !isMulti && p.hotelOptions.length > 1
  const hasSharedFlightsAcrossOptions = !isMulti && p.hotelOptions.length > 1
    ? new Set(p.hotelOptions.map(option => getFlightSignature(option))).size === 1
    : false

  // Pax
  const pax: string[] = [`${p.adults} Adult${parseInt(p.adults)!==1?'s':''}`]
  if (parseInt(p.children)>0) pax.push(`${p.children} Child${parseInt(p.children)!==1?'ren':''}`)
  if (parseInt(p.infants)>0)  pax.push(`${p.infants} Infant${parseInt(p.infants)!==1?'s':''}`)
  const paxLine = pax.join(' &middot; ')

  // Trip title + subtitle
  let tripTitle = '', tripSub = ''
  if (isMulti) {
    const dests = ordC.map(c=>c.destination).filter(Boolean)
    const nights = ordC.reduce((s,c)=>s+(parseInt(c.nights)||0),0)
    tripTitle = `${qEsc(firstName)}&rsquo;s ${qEsc(dests[dests.length-1]||'Indian Ocean')} Journey`
    tripSub   = `${dests.map(d=>qEsc(d)).join(' &rarr; ')} &mdash; ${nights} nights`
  } else if (!multiOpts) {
    const opt = p.hotelOptions[0]
    tripTitle = `${qEsc(firstName)}&rsquo;s Mauritius Escape`
    tripSub   = `${opt?.nights||''} nights at ${qEsc(opt?.hotel||'your resort')}`
  } else {
    tripTitle = `${qEsc(firstName)}&rsquo;s Mauritius Holiday`
    tripSub   = `${p.hotelOptions.length} tailored options &mdash; your choice`
  }

  // Tone tagline (T1/T2: single italic line under subtitle; T3/T4: structural blocks)
  let toneTagline = ''
  if (p.customTemplate?.opening_hook) {
    toneTagline = qEsc(p.customTemplate.opening_hook
      .replace(/\[Client Name\]/g, firstName)
      .replace(/\[Hotel Name\]/g, isMulti ? (ordC[0]?.hotel||'') : (p.hotelOptions[0]?.hotel||'')))
  } else if (tpl===1) {
    toneTagline = isMulti
      ? 'A journey crafted around you &mdash; every detail personally selected.'
      : 'Personally curated for you &mdash; I am confident this will exceed every expectation.'
  } else if (tpl===2) {
    toneTagline = 'With over 25 years of exclusive Mauritius expertise, every property in this proposal has been personally visited and reviewed.'
  }

  // Deposit + price display
  const dep        = p.sellPrice
  const depositAmt = dep * 0.1
  const depositFmt = '&pound;' + depositAmt.toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2})
  const priceFmt   = '&pound;' + dep.toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2})
  const showTopPrice = dep > 0 && (!multiOpts || isMulti)
  const totalNights = isMulti
    ? ordC.reduce((s,c)=>s+(parseInt(c.nights)||0),0)
    : (parseInt(p.hotelOptions[0]?.nights || '0') || 0)
  const perNight = totalNights > 0 ? dep / totalNights : dep
  const perNightFmt = '&pound;' + perNight.toLocaleString('en-GB',{minimumFractionDigits:0,maximumFractionDigits:0})

  function buildOpeningParagraph(): string {
    if (isMulti) {
      const destinations = ordC.map(c => c.destination).filter(Boolean).map(qEsc)
      return `From your first view of the Indian Ocean to the final evening of your journey, this itinerary is designed to feel effortless, indulgent and beautifully well-paced. Moving through ${destinations.join(' &rarr; ')}, you experience Mauritius as more than a hotel stay: a sequence of memorable settings, hand-picked so the holiday feels exclusive from the moment you arrive.`
    }

    const opt = p.hotelOptions[0]
    const hotelName = qEsc(opt?.hotel || 'your resort')
    const boardBasis = qEsc(opt?.boardBasis || 'your preferred meal plan')
    return `Imagine stepping into ${hotelName}, settling immediately into island time, and letting the rest of the world fall away. This proposal is built around the kind of Mauritius escape clients usually want most: smooth travel, a beautiful resort base, ${boardBasis.toLowerCase()}, and enough time to properly unwind rather than simply pass through.`
  }

  function buildPersonalReasons(): string[] {
    const reasons: string[] = []
    const primaryOption = p.hotelOptions[0]
    const firstOutLeg = sortFlightLegs([
      ...(primaryOption?.outLegs || []),
      ...(primaryOption?.retLegs || []),
    ]).find(leg => leg.from || leg.date || leg.airline)
    const dealTitle = (p.deal?.title || '').toLowerCase()
    const adultsCount = parseInt(p.adults) || 0
    const childrenCount = parseInt(p.children) || 0

    if (childrenCount > 0) {
      reasons.push(`It works well for your party because the trip is planned for ${p.adults} adults and ${p.children} children, with flights, resort stay and transfers kept simple from the start.`)
    } else if (adultsCount >= 2) {
      reasons.push(`It is shaped for shared downtime, giving you the kind of escape that feels romantic, restorative and easy to enjoy together from day one.`)
    } else {
      reasons.push(`It keeps the journey smooth and well-supported, so the holiday feels easy to enjoy from the moment you depart.`)
    }

    if (isMulti) {
      const destinations = ordC.map(c => c.destination).filter(Boolean).map(qEsc)
      reasons.push(`You get more than one version of Mauritius in a single trip, combining ${destinations.join(' and ')} so the holiday feels richer and more memorable.`)
    } else if (primaryOption?.hotel) {
      reasons.push(`${qEsc(primaryOption.hotel)} gives you a strong resort anchor, so you can settle into one exceptional base instead of constantly repacking or moving around.`)
    }

    if (primaryOption?.boardBasis) {
      reasons.push(`${qEsc(primaryOption.boardBasis)} helps keep the holiday feeling relaxed and premium on the ground, with less day-to-day planning once you are there.`)
    }

    if (firstOutLeg?.from || firstOutLeg?.airline || firstOutLeg?.date) {
      const routeBits = [
        firstOutLeg.from ? `from ${qEsc(firstOutLeg.from)}` : '',
        firstOutLeg.airline ? `with ${qEsc(firstOutLeg.airline)}` : '',
        firstOutLeg.date ? `on ${fmtDate(firstOutLeg.date)}` : '',
      ].filter(Boolean)
      reasons.push(`The travel plan is already aligned around a clear outbound journey ${routeBits.join(' ')}, which makes the holiday easier to commit to with confidence.`)
    }

    if (p.additionalServices.trim()) {
      reasons.push(`The extras already included add value beyond the core package, helping the holiday feel more complete and more tailored to how you want to travel.`)
    } else {
      reasons.push(`Private transfers and the essential trip logistics are already built in, which removes friction and keeps the experience polished from arrival to departure.`)
    }

    if (dealTitle.includes('honeymoon') || dealTitle.includes('anniversary') || dealTitle.includes('birthday')) {
      reasons.unshift(`The brief already points toward a special-occasion trip, and this proposal leans into that with a more elevated, experience-led feel rather than a standard package.`)
    }

    return reasons.slice(0, 5)
  }

  const openingParagraph = buildOpeningParagraph()
  const personalReasons = buildPersonalReasons()
  const reasonsHtml = `<tr><td style="padding:0 36px 28px;">
    ${qSectionHead('Why This Trip Is Perfect For You')}
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      ${personalReasons.map(reason => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid ${QD};vertical-align:top;">
            <span style="display:inline-block;width:22px;color:${QG};font-weight:700;font-size:12px;">&#10003;</span>
            <span style="display:inline-block;width:calc(100% - 26px);font-size:13.5px;color:${QT};line-height:1.7;">${reason}</span>
          </td>
        </tr>`).join('')}
    </table>
  </td></tr>`

  // ── EXPERIENCE BULLETS ────────────────────────────────────
  function expBullets(opt: HotelOption|null, centres: Centre[]): string {
    let rows = ''
    const bullet = (content: string) =>
      `<tr><td style="padding:8px 0;border-bottom:1px solid ${QD};"><span style="color:${QG};font-size:11px;margin-right:10px;font-weight:700;">&#9670;</span><span style="font-size:13.5px;color:${QT};line-height:1.5;">${content}</span></td></tr>`

    if (isMulti) {
      const nights = centres.reduce((s,c)=>s+(parseInt(c.nights)||0),0)
      const dests  = centres.map(c=>c.destination).filter(Boolean)
      rows += bullet(`${dests.map(d=>qEsc(d)).join(' &rarr; ')} &mdash; <strong>${nights} nights</strong>`)
      centres.forEach(c => {
        const ci = c.checkinDate ? fmtDate(c.checkinNextDay ? addDays(c.checkinDate,1) : c.checkinDate) : null
        rows += `<tr><td style="padding:5px 0 5px 32px;border-bottom:1px solid ${QD};font-size:13px;color:${QM};">
          <strong style="color:${QT};">${qEsc(c.destination||'')}</strong> &mdash; ${qEsc(c.hotel||'')} &middot; ${c.nights} nights &middot; ${qEsc(c.boardBasis)}${ci?` &middot; check-in ${ci}`:''}
        </td></tr>`
      })
    } else if (opt) {
      const ci = opt.checkinDate ? fmtDate(opt.checkinNextDay ? addDays(opt.checkinDate,1) : opt.checkinDate) : null
      const allLegs = sortFlightLegs([...(opt.outLegs||[]),...(opt.retLegs||[])])
      const fOut = allLegs.find(l=>l.from && (l.date||l.depart_time))
      rows += bullet(`<strong>${qEsc(opt.hotel||'Resort to confirm')}</strong>${opt.roomType?` &mdash; ${qEsc(opt.roomType)}`:''}`)
      rows += bullet(`${opt.nights} nights &middot; <strong>${qEsc(opt.boardBasis)}</strong>${ci?` &middot; check-in ${ci}`:''}`)
      if (fOut) rows += bullet(`Flights from <strong>${fOut.from||'UK'}</strong>${fOut.date?` &mdash; ${fmtDate(fOut.date)}`:''}${fOut.airline?` &middot; ${fOut.airline}`:''}`)
    }
    rows += bullet(`${paxLine} &middot; transfers &amp; all taxes included`)
    return `<table width="100%" cellpadding="0" cellspacing="0">${rows}</table>`
  }

  // ── OPTION BULLETS (for multi-option single quotes) ───────
  function optBullets(opt: HotelOption): string {
    const ci = opt.checkinDate ? fmtDate(opt.checkinNextDay ? addDays(opt.checkinDate,1) : opt.checkinDate) : null
    const allLegs = sortFlightLegs([...(opt.outLegs||[]),...(opt.retLegs||[])])
    const fOut = allLegs.find(l=>l.from && (l.date||l.depart_time))
    const bullet = (content: string) =>
      `<tr><td style="padding:6px 0;border-bottom:1px solid ${QD};"><span style="color:${QG};font-size:11px;margin-right:10px;font-weight:700;">&#9670;</span><span style="font-size:13px;color:${QT};">${content}</span></td></tr>`
    let rows = bullet(`<strong>${qEsc(opt.hotel||'Resort to confirm')}</strong>${opt.roomType?` &mdash; ${qEsc(opt.roomType)}`:''}`)
    rows += bullet(`${opt.nights} nights &middot; <strong>${qEsc(opt.boardBasis)}</strong>${ci?` &middot; check-in ${ci}`:''}`)
    if (fOut) rows += bullet(`Flights from <strong>${fOut.from||'UK'}</strong>${fOut.date?` &mdash; ${fmtDate(fOut.date)}`:''}`)
    rows += bullet(`${paxLine} &middot; transfers &amp; all taxes included`)
    return `<table width="100%" cellpadding="0" cellspacing="0">${rows}</table>`
  }

  // ── BUILD DETAILS BODY ────────────────────────────────────
  let body = ''

  if (isMulti) {
    const itin = buildChronologicalItinerary(ordC)
    let cc = 0
    itin.forEach(ev => {
      if (ev.type==='flights' && ev.legs?.length) {
        body += qFlightsSection(ev.legs)
      } else if (ev.type==='stay' && ev.centre) {
        cc++
        const c  = ev.centre
        const ci = c.checkinDate ? fmtDate(c.checkinNextDay ? addDays(c.checkinDate,1) : c.checkinDate) : '&mdash;'
        body += `<tr><td style="padding:0 36px 22px;">
          <p style="font-size:9.5px;font-weight:700;color:${QG};text-transform:uppercase;letter-spacing:0.12em;margin:0 0 8px;">Centre ${cc} &mdash; ${qEsc(c.destination||'')}</p>
          ${qSectionHead(qEsc(c.hotel||`Centre ${cc}`))}
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid ${QD};">
            <tbody>
              ${qAccomRow('Hotel',qEsc(c.hotel||''),'Meal Plan',qEsc(c.boardBasis),'#f8f6f3')}
              ${qAccomRow('Room',qEsc(c.roomType||'To be confirmed'),'Nights',c.nights,'#ffffff')}
              ${qAccomRow('Check-In',ci,'Destination',qEsc(c.destination||''),'#f8f6f3')}
            </tbody>
          </table>
        </td></tr>`
      }
    })
  } else if (!multiOpts) {
    const opt = p.hotelOptions[0]
    if (opt) {
      body += qFlightsSection(sortFlightLegs([...(opt.outLegs||[]),...(opt.retLegs||[])]))
      const ci = opt.checkinDate ? fmtDate(opt.checkinNextDay ? addDays(opt.checkinDate,1) : opt.checkinDate) : '&mdash;'
      body += `<tr><td style="padding:0 36px 24px;">${qSectionHead('Accommodation')}
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid ${QD};">
          <tbody>
            ${qAccomRow('Resort',qEsc(opt.hotel||''),'Meal Plan',qEsc(opt.boardBasis),'#f8f6f3')}
            ${qAccomRow('Room',qEsc(opt.roomType||'To be confirmed'),'Nights',opt.nights,'#ffffff')}
            ${qAccomRow('Check-In',ci,'Destination','Mauritius, Indian Ocean','#f8f6f3')}
          </tbody>
        </table>
      </td></tr>`
    }
  } else {
    // Multiple options — flights shown once (shared), then per-option hotel blocks
    if (hasSharedFlightsAcrossOptions && p.hotelOptions.length > 0) {
      body += qFlightsSection(sortFlightLegs([...(p.hotelOptions[0].outLegs||[]),...(p.hotelOptions[0].retLegs||[])]))
    }
    p.hotelOptions.forEach((opt, idx) => {
      const sellN = parseFloat(opt.sellPrice)||0
      const ci    = opt.checkinDate ? fmtDate(opt.checkinNextDay ? addDays(opt.checkinDate,1) : opt.checkinDate) : '&mdash;'
      body += `<tr><td style="padding:0 36px 8px;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:2px solid ${QD};padding-top:28px;"></td></tr></table>
      </td></tr>`
      body += qOptionPriceRow(sellN, opt.optionLabel || `Option ${idx+1}`, parseInt(opt.nights || '0') || 0)
      body += `<tr><td style="padding:0 36px 16px;">${optBullets(opt)}</td></tr>`
      if (!hasSharedFlightsAcrossOptions) {
        body += qFlightsSection(sortFlightLegs([...(opt.outLegs||[]),...(opt.retLegs||[])]))
      }
      body += `<tr><td style="padding:0 36px 24px;">${qSectionHead('Accommodation')}
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid ${QD};">
          <tbody>
            ${qAccomRow('Resort',qEsc(opt.hotel||''),'Meal Plan',qEsc(opt.boardBasis),'#f8f6f3')}
            ${qAccomRow('Room',qEsc(opt.roomType||'To be confirmed'),'Nights',opt.nights,'#ffffff')}
            ${qAccomRow('Check-In',ci,'Destination','Mauritius, Indian Ocean','#f8f6f3')}
          </tbody>
        </table>
      </td></tr>`
    })
  }

  // Additional services
  const svcHtml = p.additionalServices ? `
  <tr><td style="padding:0 36px 24px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fdf6e8;border-left:3px solid ${QG};">
      <tr><td style="padding:14px 18px;">
        <p style="font-size:9.5px;font-weight:700;color:${QN};text-transform:uppercase;letter-spacing:0.1em;margin:0 0 8px;">Also Included</p>
        <p style="font-size:13px;color:${QT};margin:0;line-height:1.8;white-space:pre-line;">${qEsc(p.additionalServices)}</p>
      </td></tr>
    </table>
  </td></tr>` : ''

  // Urgency notice (T3)
  const urgHtml = tpl===3 ? `
  <tr><td style="padding:0 36px 24px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border-left:3px solid #c9820a;background:#fff9f0;">
      <tr><td style="padding:12px 16px;">
        <p style="font-size:9.5px;font-weight:700;color:#7a4f00;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 5px;">Availability Notice</p>
        <p style="font-size:12.5px;color:#7a4f00;margin:0;line-height:1.65;">This quote is based on live availability. Prices and rooms can change at any time. Confirming today locks in everything shown.</p>
      </td></tr>
    </table>
  </td></tr>` : ''

  // VIP promise block (T4 — replaces standard trust grid)
  const vipHtml = tpl===4 ? `
  <tr bgcolor="${QN}"><td style="padding:24px 36px;">
    <p style="font-size:9.5px;font-weight:700;color:${QG};text-transform:uppercase;letter-spacing:0.14em;margin:0 0 16px;">Your Dedicated Service Promise</p>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="50%" style="padding:0 14px 12px 0;vertical-align:top;border-right:1px solid rgba(255,255,255,0.06);">
          <p style="color:${QG};font-weight:600;font-size:12px;margin:0 0 4px;">Personal Consultant</p>
          <p style="color:rgba(255,255,255,0.5);font-size:12px;margin:0;line-height:1.6;">Samir manages your booking personally from first contact to your return</p>
        </td>
        <td width="50%" style="padding:0 0 12px 14px;vertical-align:top;">
          <p style="color:${QG};font-weight:600;font-size:12px;margin:0 0 4px;">24/7 In-Resort Support</p>
          <p style="color:rgba(255,255,255,0.5);font-size:12px;margin:0;line-height:1.6;">Direct line to us throughout your entire holiday</p>
        </td>
      </tr>
      <tr>
        <td width="50%" style="padding:12px 14px 0 0;vertical-align:top;border-right:1px solid rgba(255,255,255,0.06);">
          <p style="color:${QG};font-weight:600;font-size:12px;margin:0 0 4px;">Airport Representative</p>
          <p style="color:rgba(255,255,255,0.5);font-size:12px;margin:0;line-height:1.6;">Our team meets you personally on arrival in Mauritius</p>
        </td>
        <td width="50%" style="padding:12px 0 0 14px;vertical-align:top;">
          <p style="color:${QG};font-weight:600;font-size:12px;margin:0 0 4px;">Full Financial Protection</p>
          <p style="color:rgba(255,255,255,0.5);font-size:12px;margin:0;line-height:1.6;">ABTA &middot; IATA &middot; ATOL 5744 &mdash; fully protected</p>
        </td>
      </tr>
    </table>
  </td></tr>` : ''

  // Confirmation steps (T3)
  const confirmHtml = tpl===3 ? `
  <tr><td style="padding:0 36px 24px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f2f9f2;border:1px solid #b0d4b0;">
      <tr><td style="padding:16px 20px;">
        <p style="font-size:12.5px;font-weight:700;color:#1a4a1a;margin:0 0 12px;">How to Confirm Today</p>
        <table cellpadding="0" cellspacing="0" width="100%">
          <tr><td style="padding:5px 0;font-size:13px;color:#333;line-height:1.6;"><span style="display:inline-block;width:20px;height:20px;background:#2d6a2d;color:white;text-align:center;border-radius:50%;font-size:10px;line-height:20px;margin-right:9px;font-weight:700;vertical-align:middle;">1</span>Call <strong>${CONTACT.direct}</strong> or reply to this email</td></tr>
          <tr><td style="padding:5px 0;font-size:13px;color:#333;line-height:1.6;"><span style="display:inline-block;width:20px;height:20px;background:#2d6a2d;color:white;text-align:center;border-radius:50%;font-size:10px;line-height:20px;margin-right:9px;font-weight:700;vertical-align:middle;">2</span>Pay your 10% deposit of <strong>${depositFmt}</strong> by card or bank transfer</td></tr>
          <tr><td style="padding:5px 0;font-size:13px;color:#333;line-height:1.6;"><span style="display:inline-block;width:20px;height:20px;background:#2d6a2d;color:white;text-align:center;border-radius:50%;font-size:10px;line-height:20px;margin-right:9px;font-weight:700;vertical-align:middle;">3</span>Receive confirmation &amp; ATOL certificate within 24 hours</td></tr>
        </table>
      </td></tr>
    </table>
  </td></tr>` : ''

  const printCss = p.isPdf ? `
    @page { margin: 10mm 12mm; size: A4; }
    @media print { body { margin:0; } * { -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important; } }` : ''
  const autoPrint = p.isPdf ? `<script>window.onload=function(){setTimeout(function(){window.print();},500);}</script>` : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Quote ${qEsc(p.quoteRef)} &mdash; Mauritius Holidays Direct</title>
<style>
  body{margin:0;padding:24px 0;background:${QB};font-family:Arial,Helvetica,sans-serif;}
  a{color:${QN};}
  ${printCss}
</style>
${autoPrint}
</head><body>
<table width="100%" cellpadding="0" cellspacing="0" bgcolor="${QB}">
<tr><td align="center" style="padding:0 16px 32px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid ${QD};font-family:Arial,Helvetica,sans-serif;">

  <!-- 1. HEADER -->
  <tr bgcolor="${QN}"><td align="center" style="padding:22px 36px 20px;">
    <p style="color:${QG};font-size:20px;font-weight:bold;letter-spacing:0.09em;font-family:Georgia,serif;margin:0 0 4px;">MAURITIUS HOLIDAYS DIRECT</p>
    <p style="color:rgba(255,255,255,0.28);font-size:9px;margin:0;letter-spacing:0.22em;text-transform:uppercase;">Your Luxury Mauritius Specialist &nbsp;&middot;&nbsp; Est. 1999</p>
  </td></tr>

  <!-- 2. HERO: Trip identity (no "Dear...") -->
  <tr bgcolor="${QB}"><td style="padding:28px 36px 22px;">
    <p style="font-size:27px;color:${QN};font-family:Georgia,serif;margin:0 0 5px;font-weight:normal;line-height:1.15;">${tripTitle}</p>
    <p style="font-size:15px;color:${QM};margin:0 0 ${toneTagline?'16px':'0'};line-height:1.4;">${tripSub}</p>
    ${toneTagline ? `<p style="font-size:12.5px;color:${QT};margin:0;line-height:1.8;border-left:2px solid ${QG};padding-left:14px;font-style:italic;">${toneTagline}</p>` : ''}
  </td></tr>

  <!-- META BAR -->
  <tr><td style="padding:0 36px 28px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="border-top:1px solid ${QD};border-bottom:1px solid ${QD};padding:8px 0;">
        <p style="font-size:11px;color:${QM};margin:0;line-height:1.9;">
          <strong style="color:${QN};">Ref:</strong> <span style="font-family:monospace;color:${QN};">${qEsc(p.quoteRef)}</span>
          &nbsp;&nbsp;<strong style="color:${QN};">Date:</strong> ${today}
          &nbsp;&nbsp;<strong style="color:${QN};">Party:</strong> ${paxLine}
        </p>
      </td>
    </tr></table>
  </td></tr>

  <!-- 3. PRICE — restrained luxury panel -->
  ${showTopPrice ? `<tr><td style="padding:0 36px 30px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f5;border:1px solid #e2dbd2;border-radius:5px;overflow:hidden;">
      <tr>
        <td style="padding:20px 26px 18px;border-top:2px solid ${QG};vertical-align:middle;width:58%;">
          <p style="font-size:8px;text-transform:uppercase;letter-spacing:0.2em;color:#b0a090;margin:0 0 7px;">Total Investment</p>
          <p style="font-size:30px;color:${QN};font-family:Georgia,serif;font-weight:normal;margin:0;line-height:1.1;letter-spacing:-0.01em;">${priceFmt}</p>
          <p style="font-size:10.5px;color:#9a8e80;margin:7px 0 0;">${perNightFmt} per night &nbsp;&middot;&nbsp; flights, hotel, transfers &amp; taxes included</p>
        </td>
        <td style="padding:20px 26px 18px;border-top:2px solid transparent;border-left:1px solid #e2dbd2;vertical-align:middle;width:42%;background:#f4efe8;text-align:right;">
          <p style="font-size:8px;text-transform:uppercase;letter-spacing:0.18em;color:#b0a090;margin:0 0 5px;">Deposit to reserve</p>
          <p style="font-size:22px;color:${QG};font-family:Georgia,serif;font-weight:normal;margin:0;line-height:1.1;">${depositFmt}</p>
          <p style="font-size:10px;color:#9a8e80;margin:6px 0 0;">Balance due 12 weeks before departure</p>
        </td>
      </tr>
    </table>
  </td></tr>` : ''}

  ${urgHtml}

  <!-- 4. EMOTIONAL OPENING -->
  <tr><td style="padding:0 36px 24px;">
    ${qSectionHead('The Experience')}
    <p style="font-size:14px;color:${QT};margin:0;line-height:1.9;">${openingParagraph}</p>
  </td></tr>

  <!-- 5. EXPERIENCE SUMMARY -->
  <tr><td style="padding:0 36px 28px;">
    ${qSectionHead('Your Holiday at a Glance')}
    ${isMulti ? expBullets(null,ordC) : (!multiOpts && p.hotelOptions[0] ? expBullets(p.hotelOptions[0],[]) : `<p style="font-size:13px;color:${QM};margin:0;line-height:1.7;"><strong style="color:${QN};">${p.hotelOptions.length} tailored options</strong> &mdash; see pricing and full details for each below. Each includes flights, accommodation, transfers and all taxes.</p>`)}
  </td></tr>

  <!-- 6. PERSONALISED REASONS -->
  ${reasonsHtml}

  <!-- 7. DETAILS (lower visual weight) -->
  <tr><td style="padding:0 36px 16px;">
    <p style="font-size:11px;font-weight:700;color:${QM};text-transform:uppercase;letter-spacing:0.12em;margin:0;">Journey details</p>
    <p style="font-size:13px;color:${QM};margin:8px 0 0;line-height:1.7;">Below are the practical details of the itinerary. They are there to support the holiday story above, not define it.</p>
  </td></tr>
  ${body}
  ${svcHtml}

  <!-- 6. TRUST -->
  ${tpl!==4 ? `<tr bgcolor="${QB}"><td style="padding:24px 36px;">
    ${qSectionHead('Why Book With Us')}
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="50%" style="padding:0 14px 14px 0;vertical-align:top;">
          <p style="font-weight:700;font-size:13px;color:${QN};margin:0 0 3px;">25 Years of Expertise</p>
          <p style="font-size:12px;color:${QM};margin:0;line-height:1.65;">Mauritius specialists since 1999 &mdash; every resort personally visited and reviewed.</p>
        </td>
        <td width="50%" style="padding:0 0 14px 14px;vertical-align:top;">
          <p style="font-weight:700;font-size:13px;color:${QN};margin:0 0 3px;">ATOL &amp; ABTA Protected</p>
          <p style="font-size:12px;color:${QM};margin:0;line-height:1.65;">ABTA &middot; IATA &middot; ATOL 5744. Your money is 100% protected from the moment you pay.</p>
        </td>
      </tr>
      <tr>
        <td width="50%" style="padding:0 14px 0 0;vertical-align:top;">
          <p style="font-weight:700;font-size:13px;color:${QN};margin:0 0 3px;">5-Star Trustpilot</p>
          <p style="font-size:12px;color:${QM};margin:0;line-height:1.65;">Thousands of verified reviews from clients who trusted us with their dream holidays.</p>
        </td>
        <td width="50%" style="padding:0 0 0 14px;vertical-align:top;">
          <p style="font-weight:700;font-size:13px;color:${QN};margin:0 0 3px;">Best Price Guarantee</p>
          <p style="font-size:12px;color:${QM};margin:0;line-height:1.65;">Find it cheaper within 72 hours &mdash; we&apos;ll refund the difference, guaranteed.</p>
        </td>
      </tr>
    </table>
  </td></tr>` : ''}

  ${vipHtml}
  ${confirmHtml}

  <!-- 8. CLOSING CTA -->
  <tr bgcolor="${QN}"><td align="center" style="padding:32px 36px 28px;">
    <p style="font-size:9px;text-transform:uppercase;letter-spacing:0.18em;color:rgba(184,146,46,0.6);margin:0 0 8px;">Your Next Step</p>
    <p style="font-size:22px;color:white;font-family:Georgia,serif;margin:0 0 8px;font-weight:normal;">If this feels like the right Mauritius escape, I can secure it from <span style="color:${QG};">${depositFmt}</span></p>
    <p style="font-size:12px;color:rgba(255,255,255,0.42);margin:0 0 22px;line-height:1.7;">Reply to this quote, WhatsApp me, or call directly and I will guide you through the next step personally before availability changes.</p>
    <table cellpadding="0" cellspacing="0" align="center">
      <tr>
        <td style="padding:0 4px;"><a href="tel:02089516922" style="display:inline-block;background:${QG};color:white;padding:13px 22px;text-decoration:none;font-size:12.5px;font-weight:700;letter-spacing:0.04em;font-family:Arial,sans-serif;">Call Samir</a></td>
        <td style="padding:0 4px;"><a href="https://wa.me/447881551204" style="display:inline-block;background:#25D366;color:white;padding:13px 22px;text-decoration:none;font-size:12.5px;font-weight:700;letter-spacing:0.04em;font-family:Arial,sans-serif;">Message on WhatsApp</a></td>
        <td style="padding:0 4px;"><a href="mailto:${CONTACT.email}" style="display:inline-block;border:1.5px solid rgba(255,255,255,0.2);color:white;padding:13px 22px;text-decoration:none;font-size:12.5px;font-weight:700;letter-spacing:0.04em;font-family:Arial,sans-serif;">Reply by Email</a></td>
      </tr>
    </table>
    <p style="font-size:10.5px;color:rgba(255,255,255,0.22);margin:18px 0 0;">${CONTACT.direct} &nbsp;&middot;&nbsp; ${CONTACT.email}</p>
  </td></tr>

  <!-- 8. CONSULTANT -->
  <tr><td style="padding:18px 36px;border-top:3px solid ${QG};">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="vertical-align:middle;">
        <p style="font-size:10.5px;color:${QM};margin:0 0 2px;">Your dedicated specialist</p>
        <p style="font-size:20px;color:${QN};font-family:Georgia,serif;margin:0 0 2px;font-weight:normal;">Samir Abattouy</p>
        <p style="font-size:11px;color:${QG};font-style:italic;margin:0;">Mauritius Expert &nbsp;&middot;&nbsp; Senior Travel Consultant</p>
      </td>
      <td style="vertical-align:middle;text-align:right;">
        <p style="font-size:11.5px;color:${QM};margin:0;line-height:2.1;">${CONTACT.direct}<br>${CONTACT.email}</p>
      </td>
    </tr></table>
  </td></tr>

  <!-- FOOTER -->
  <tr bgcolor="${QN}"><td style="padding:11px 36px;text-align:center;">
    <p style="font-size:9px;color:${QG};letter-spacing:0.12em;margin:0;font-weight:700;">ABTA &nbsp;&middot;&nbsp; IATA &nbsp;&middot;&nbsp; ATOL PROTECTED 5744</p>
    <p style="font-size:9px;color:rgba(255,255,255,0.22);margin:4px 0 0;">${CONTACT.address} &nbsp;&middot;&nbsp; ${CONTACT.web}</p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`
}

// ── QUOTE DELIVERY MODAL ──────────────────────────────────
function QuoteDeliveryModal({deal,quoteMode,hotelOptions,centres,adults,children,infants,additionalServices,sellPrice,quoteRef,template,selectedCustomTemplate,customTemplates,onClose}:any){
  const [activeTemplate,setActiveTemplate]=useState<1|2|3|4>(template)
  const [activeCustom,setActiveCustom]=useState<number|null>(selectedCustomTemplate)
  const [downloading,setDownloading]=useState<'pdf'|'email'|null>(null)

  const TEMPLATES=[{id:1,label:'Dream Seller'},{id:2,label:'Trusted Expert'},{id:3,label:'Urgency Close'},{id:4,label:'VIP Treatment'}] as const
  const activeCustomData=activeCustom?customTemplates?.find((t:any)=>t.id===activeCustom):null

  const htmlParams={
    deal,quoteMode,hotelOptions,centres,adults,children,infants,
    additionalServices,sellPrice,quoteRef,
    templateId:(activeCustomData?1:activeTemplate) as number,
    customTemplate:activeCustomData,
    isPdf:false,
  }

  function downloadPdf(){
    setDownloading('pdf')
    const html=generateQuoteHtml({...htmlParams,isPdf:true})
    const win=window.open('','_blank')
    if(!win){setDownloading(null);return}
    win.document.write(html)
    win.document.close()
    win.focus()
    setDownloading(null)
  }

  function downloadEmail(){
    setDownloading('email')
    const html=generateQuoteHtml(htmlParams)
    const blob=new Blob([html],{type:'text/html;charset=utf-8'})
    const url=URL.createObjectURL(blob)
    const a=document.createElement('a')
    a.href=url
    a.download=`quote-${quoteRef}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setDownloading(null)
  }

  const previewHtml=generateQuoteHtml(htmlParams)

  return(
    <div className="modal-backdrop" onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div style={{background:'var(--surface)',borderRadius:'16px',width:'100%',maxWidth:'760px',maxHeight:'94vh',overflow:'hidden',display:'flex',flexDirection:'column',boxShadow:'var(--shadow-lg)'}}>
        {/* Header */}
        <div style={{padding:'14px 22px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
          <div style={{fontFamily:'Fraunces,serif',fontSize:'17px',fontWeight:'300'}}>Quote Preview — {quoteRef}</div>
          <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
            <button className="btn btn-cta btn-sm" onClick={downloadPdf} disabled={!!downloading}
              title="Opens print-ready version — save as PDF from the print dialog">
              {downloading==='pdf'?'Opening…':'↓ Download PDF'}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={downloadEmail} disabled={!!downloading}
              title="Downloads Outlook-compatible HTML file — open in browser then paste into email">
              {downloading==='email'?'Saving…':'✉ Download Email HTML'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
          </div>
        </div>
        {/* Tone selector */}
        <div style={{padding:'8px 22px',borderBottom:'1px solid var(--border)',display:'flex',gap:'6px',flexShrink:0,background:'var(--bg-tertiary)',alignItems:'center',flexWrap:'wrap'}}>
          <span style={{fontSize:'11px',color:'var(--text-muted)',marginRight:'4px',fontWeight:'600',textTransform:'uppercase',letterSpacing:'0.06em'}}>Tone:</span>
          {TEMPLATES.map(t=>(
            <button key={t.id} onClick={()=>{setActiveTemplate(t.id as 1|2|3|4);setActiveCustom(null)}}
              style={{padding:'4px 12px',borderRadius:'20px',border:'1.5px solid',fontSize:'11.5px',cursor:'pointer',fontFamily:'Outfit,sans-serif',
                borderColor:activeTemplate===t.id&&!activeCustom?'var(--accent-mid)':'var(--border)',
                background:activeTemplate===t.id&&!activeCustom?'var(--accent-mid)':'transparent',
                color:activeTemplate===t.id&&!activeCustom?'white':'var(--text-muted)'}}>
              {t.label}
            </button>
          ))}
          {customTemplates?.length>0&&customTemplates.map((t:any)=>(
            <button key={t.id} onClick={()=>setActiveCustom(t.id)}
              style={{padding:'4px 12px',borderRadius:'20px',border:'1.5px solid',fontSize:'11.5px',cursor:'pointer',fontFamily:'Outfit,sans-serif',
                borderColor:activeCustom===t.id?'var(--accent-mid)':'var(--border)',
                background:activeCustom===t.id?'var(--accent-mid)':'transparent',
                color:activeCustom===t.id?'white':'var(--text-muted)'}}>
              ✦ {t.name}
            </button>
          ))}
        </div>
        {/* Preview */}
        <div style={{overflow:'auto',flex:1}}>
          <iframe srcDoc={previewHtml} style={{width:'100%',border:'none',minHeight:'600px'}}
            title="Quote Preview"
            onLoad={e=>{
              const f=e.currentTarget,doc=f.contentDocument||f.contentWindow?.document
              if(doc?.body) f.style.height=(doc.body.scrollHeight+40)+'px'
            }}/>
        </div>
      </div>
    </div>
  )
}
