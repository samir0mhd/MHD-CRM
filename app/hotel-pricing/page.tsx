'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { buildPricingPreview } from '@/lib/hotel-pricing/engine'
import type {
  HotelCompulsoryCharge,
  HotelContractSeason,
  HotelOffer,
  HotelOfferCombinability,
  HotelOfferRule,
  HotelRoomContract,
  HotelRoomOccupancyRate,
  HotelRoomRate,
  OfferFamily,
  PricingRequest,
} from '@/lib/hotel-pricing/types'

type HotelSummary = {
  id: number
  name: string
}

type ContractSummary = {
  id: number
  hotel_id: number
  name: string
  status: string
}

type ContractVersionSummary = {
  id: number
  hotel_contract_id: number
  version_name: string
  valid_from: string
  valid_to: string
  booking_from: string | null
  booking_to: string | null
  is_active: boolean
}

type SpecialOfferOption = {
  aliases: string[]
  description: string
  label: string
  value: OfferFamily
}

const CHILD_AGE_OPTIONS = Array.from({ length: 10 }, (_, index) => index + 3)
const TEEN_AGE_OPTIONS = Array.from({ length: 5 }, (_, index) => index + 13)

const SPECIAL_OFFER_OPTIONS: SpecialOfferOption[] = [
  {
    value: 'honeymoon',
    label: 'HM Offers',
    description: 'Qualify honeymoon, civil-union, or wedding-anniversary benefits.',
    aliases: ['hm', 'hm offer', 'hm offers', 'honeymoon', 'honeymoon offer', 'honeymoon offers', 'anniversary', 'wedding anniversary', 'civil union'],
  },
]

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function addDaysIso(date: string, days: number) {
  const value = new Date(`${date}T12:00:00`)
  value.setDate(value.getDate() + days)
  return value.toISOString().slice(0, 10)
}

function formatMoney(value: number) {
  const sign = value < 0 ? '-' : ''
  return `${sign}£${Math.abs(value).toFixed(2)}`
}

function syncAgeList(ages: number[], count: number, allowedAges: number[], fallbackAge: number) {
  const normalized = ages.filter(age => allowedAges.includes(age))
  const next = normalized.slice(0, Math.max(0, count))

  while (next.length < count) {
    next.push(fallbackAge)
  }

  return next
}

function findSpecialOfferOption(input: string) {
  const normalized = input.trim().toLowerCase()
  if (!normalized) return null

  return SPECIAL_OFFER_OPTIONS.find(option =>
    option.value === normalized ||
    option.label.toLowerCase() === normalized ||
    option.aliases.includes(normalized),
  ) || null
}

async function apiRequest<T = unknown>(url: string) {
  const response = await fetch(url)
  const json = await response.json().catch(() => ({}))
  if (!response.ok || json?.error) {
    throw new Error(json?.error || 'Request failed')
  }
  return json as T
}

export default function HotelPricingPage() {
  const [loading, setLoading] = useState(true)
  const [setupError, setSetupError] = useState<string | null>(null)
  const [hotels, setHotels] = useState<HotelSummary[]>([])
  const [contracts, setContracts] = useState<ContractSummary[]>([])
  const [versions, setVersions] = useState<ContractVersionSummary[]>([])
  const [offers, setOffers] = useState<HotelOffer[]>([])
  const [offerCombinability, setOfferCombinability] = useState<HotelOfferCombinability[]>([])
  const [seasons, setSeasons] = useState<HotelContractSeason[]>([])
  const [roomOptions, setRoomOptions] = useState<string[]>([])
  const [roomContracts, setRoomContracts] = useState<HotelRoomContract[]>([])
  const [roomRates, setRoomRates] = useState<HotelRoomRate[]>([])
  const [occupancyRates, setOccupancyRates] = useState<HotelRoomOccupancyRate[]>([])
  const [offerRules, setOfferRules] = useState<HotelOfferRule[]>([])
  const [compulsoryCharges, setCompulsoryCharges] = useState<HotelCompulsoryCharge[]>([])

  const [request, setRequest] = useState<PricingRequest>(() => {
    const bookingDate = todayIso()
    const checkInDate = addDaysIso(bookingDate, 14)

    return {
      hotelId: null,
      contractVersionId: null,
      bookingDate,
      checkInDate,
      checkOutDate: addDaysIso(checkInDate, 7),
      roomName: 'Family Suite',
      boardBasis: 'All Inclusive',
      selectedOfferFamilies: [],
      adults: 2,
      childAges: [8],
      teenAges: [],
      infants: 0,
    }
  })
  const [specialOfferSearch, setSpecialOfferSearch] = useState('')

  function updateChildGuests(count: number) {
    setRequest(prev => ({
      ...prev,
      childAges: syncAgeList(prev.childAges, count, CHILD_AGE_OPTIONS, 8),
    }))
  }

  function updateTeenGuests(count: number) {
    setRequest(prev => ({
      ...prev,
      teenAges: syncAgeList(prev.teenAges, count, TEEN_AGE_OPTIONS, 14),
    }))
  }

  function updateChildAge(index: number, age: number) {
    setRequest(prev => ({
      ...prev,
      childAges: prev.childAges.map((value, valueIndex) => valueIndex === index ? age : value),
    }))
  }

  function updateTeenAge(index: number, age: number) {
    setRequest(prev => ({
      ...prev,
      teenAges: prev.teenAges.map((value, valueIndex) => valueIndex === index ? age : value),
    }))
  }

  function addSpecialOfferSelection() {
    const match = findSpecialOfferOption(specialOfferSearch)
    if (!match) return

    setRequest(prev => ({
      ...prev,
      selectedOfferFamilies: prev.selectedOfferFamilies.includes(match.value)
        ? prev.selectedOfferFamilies
        : [...prev.selectedOfferFamilies, match.value],
    }))
    setSpecialOfferSearch('')
  }

  function removeSpecialOfferSelection(offerFamily: OfferFamily) {
    setRequest(prev => ({
      ...prev,
      selectedOfferFamilies: prev.selectedOfferFamilies.filter(value => value !== offerFamily),
    }))
  }

  async function loadDashboard() {
    setLoading(true)
    setSetupError(null)

    try {
      const { data } = await apiRequest<{ data: { hotels: HotelSummary[]; contracts: ContractSummary[]; versions: ContractVersionSummary[] } }>('/api/pricing')
      const hotelRows = data.hotels
      const safeContracts = data.contracts
      const safeVersions = data.versions

      setHotels(hotelRows)
      setContracts(safeContracts)
      setVersions(safeVersions)

      const pilotHotel = hotelRows.find(hotel => hotel.name.toLowerCase().includes('ravenala'))
      const pilotContract = pilotHotel ? safeContracts.find(contract => contract.hotel_id === pilotHotel.id) : null
      const pilotVersion = pilotContract
        ? safeVersions.find(version => version.hotel_contract_id === pilotContract.id && version.is_active) || safeVersions.find(version => version.hotel_contract_id === pilotContract.id) || null
        : null

      setRequest(prev => ({
        ...prev,
        hotelId: prev.hotelId ?? pilotHotel?.id ?? null,
        contractVersionId: prev.contractVersionId ?? pilotVersion?.id ?? null,
      }))
      setLoading(false)
    } catch (error: unknown) {
      setContracts([])
      setVersions([])
      setOffers([])
      setOfferCombinability([])
      setSeasons([])
      setRoomOptions([])
      setRoomContracts([])
      setRoomRates([])
      setOccupancyRates([])
      setOfferRules([])
      setCompulsoryCharges([])
      setSetupError(error instanceof Error ? error.message : 'Pricing schema is not available yet')
      setLoading(false)
    }
  }

  async function loadVersionData(contractVersionId: number) {
    try {
      const { data } = await apiRequest<{
        data: {
          offers: HotelOffer[]
          seasons: HotelContractSeason[]
          roomContracts: HotelRoomContract[]
          compulsoryCharges: HotelCompulsoryCharge[]
          roomOptions: string[]
          roomRates: HotelRoomRate[]
          occupancyRates: HotelRoomOccupancyRate[]
          offerRules: HotelOfferRule[]
          offerCombinability: HotelOfferCombinability[]
        }
      }>(`/api/pricing/versions/${contractVersionId}`)

      const safeOffers = data.offers
      const safeSeasons = data.seasons
      const safeRoomContracts = data.roomContracts
      const safeCharges = data.compulsoryCharges

      setOffers(safeOffers)
      setSeasons(safeSeasons)
      setRoomContracts(safeRoomContracts)
      setCompulsoryCharges(safeCharges)
      setRoomOptions(data.roomOptions)
      setRoomRates(data.roomRates)
      setOccupancyRates(data.occupancyRates)
      setOfferRules(data.offerRules)
      setOfferCombinability(data.offerCombinability)

      const boardOptions = Array.from(new Set(data.roomRates.map(rate => rate.board_basis))).sort((left, right) => left.localeCompare(right))
      setRequest(prev => {
        if (prev.contractVersionId !== contractVersionId) return prev

        let next = prev
        if (data.roomOptions.length > 0 && !data.roomOptions.includes(prev.roomName)) {
          next = { ...next, roomName: data.roomOptions[0] }
        }
        if (boardOptions.length > 0 && !boardOptions.some(board => board.toLowerCase() === prev.boardBasis.toLowerCase())) {
          next = { ...next, boardBasis: boardOptions[0] }
        }
        return next
      })

      setSetupError(null)
    } catch (error: unknown) {
      setOffers([])
      setOfferCombinability([])
      setSeasons([])
      setRoomOptions([])
      setRoomContracts([])
      setRoomRates([])
      setOccupancyRates([])
      setOfferRules([])
      setCompulsoryCharges([])
      setSetupError(error instanceof Error ? error.message : 'Pricing data could not be loaded')
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadDashboard() }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!request.contractVersionId) {
      return
    }

    const timer = window.setTimeout(() => { void loadVersionData(request.contractVersionId!) }, 0)
    return () => window.clearTimeout(timer)
  }, [request.contractVersionId])

  const versionOptions = request.hotelId
    ? versions.filter(version => contracts.find(contract => contract.id === version.hotel_contract_id)?.hotel_id === request.hotelId)
    : versions

  const activeOffers = request.contractVersionId ? offers : undefined
  const activeOfferCombinability = request.contractVersionId ? offerCombinability : undefined
  const activeSeasons = request.contractVersionId ? seasons : undefined
  const activeRoomOptions = request.contractVersionId ? roomOptions : []
  const activeRoomContracts = request.contractVersionId ? roomContracts : undefined
  const activeRoomRates = request.contractVersionId ? roomRates : undefined
  const activeOccupancyRates = request.contractVersionId ? occupancyRates : undefined
  const activeOfferRules = request.contractVersionId ? offerRules : undefined
  const activeCompulsoryCharges = request.contractVersionId ? compulsoryCharges : undefined
  const boardOptions = Array.from(new Set((activeRoomRates || []).map(rate => rate.board_basis))).sort((left, right) => left.localeCompare(right))
  const preview = buildPricingPreview(request, {
    seasons: activeSeasons,
    offers: activeOffers,
    offerCombinability: activeOfferCombinability,
    offerRules: activeOfferRules,
    roomContracts: activeRoomContracts,
    roomRates: activeRoomRates,
    occupancyRates: activeOccupancyRates,
    compulsoryCharges: activeCompulsoryCharges,
  })
  const activeHotel = hotels.find(hotel => hotel.id === request.hotelId) || null
  const activeVersion = versions.find(version => version.id === request.contractVersionId) || null
  const ravenalaHotel = hotels.find(hotel => hotel.name.toLowerCase().includes('ravenala')) || null
  const ravenalaContracts = ravenalaHotel ? contracts.filter(contract => contract.hotel_id === ravenalaHotel.id) : []

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '70vh' }}>
        <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Loading hotel pricing…</div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Hotel Pricing</div>
          <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Contracts, offers, and the Ravenala pilot workspace.
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Link href="/hotels"><button className="btn btn-secondary btn-sm">Hotel Directory</button></Link>
          <Link href="/quotes/new"><button className="btn btn-secondary btn-sm">Quote Builder</button></Link>
        </div>
      </div>

      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '18px' }}>
          {[
            { label: 'Hotels', value: hotels.length, sub: 'directory entries' },
            { label: 'Contracts', value: contracts.length, sub: 'pricing contracts' },
            { label: 'Versions', value: versions.length, sub: 'contract versions' },
            { label: 'Offers', value: activeOffers?.length || 0, sub: activeVersion ? 'loaded for selection' : 'load a version' },
          ].map(card => (
            <div key={card.label} className="card" style={{ padding: '16px 18px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
                {card.label}
              </div>
              <div style={{ fontFamily: 'Fraunces, serif', fontSize: '26px', fontWeight: '300', color: 'var(--text-primary)' }}>
                {card.value}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {card.sub}
              </div>
            </div>
          ))}
        </div>

        {setupError ? (
          <div className="card" style={{ padding: '16px 18px', marginBottom: '18px', border: '1px solid #fdba74', background: '#fff7ed' }}>
            <div style={{ fontWeight: '600', color: '#9a3412', marginBottom: '6px' }}>Pricing schema not available yet</div>
            <div style={{ fontSize: '13px', color: '#9a3412', lineHeight: 1.6 }}>
              {setupError}
            </div>
            <div style={{ fontSize: '12px', color: '#9a3412', marginTop: '8px' }}>
              Apply migration <span style={{ fontFamily: 'monospace' }}>20260402101500_create_hotel_pricing_engine_schema.sql</span> to activate the module tables.
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: '16px 18px', marginBottom: '18px', border: '1px solid var(--border)' }}>
            <div style={{ fontWeight: '600', color: 'var(--text-primary)', marginBottom: '6px' }}>Schema status</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Contract tables are available. Apply the Ravenala seed migration to load the first live pilot contract into this workspace.
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: '18px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div className="card" style={{ padding: '20px 22px' }}>
              <div style={{ fontFamily: 'Fraunces, serif', fontSize: '20px', fontWeight: '300', marginBottom: '14px' }}>
                Ravenala Pilot
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '14px' }}>
                Pilot hotel for the engine. This workspace now runs a first-pass accommodation calculation using contract seasons, room rates, child-first offer rules, and compulsory festive charges.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '14px' }}>
                <div style={{ padding: '12px 14px', borderRadius: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Hotel</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600' }}>{ravenalaHotel?.name || 'Awaiting directory match'}</div>
                </div>
                <div style={{ padding: '12px 14px', borderRadius: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Contracts</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600' }}>{ravenalaContracts.length}</div>
                </div>
                <div style={{ padding: '12px 14px', borderRadius: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Active Version</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600' }}>{activeVersion?.version_name || 'Not loaded'}</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {[
                  'Contract shell',
                  'Seasons',
                  'Room rates',
                  'Occupancy rules',
                  'Child-first pricing',
                  'Offer eligibility',
                  'Compulsory charges',
                ].map(label => (
                  <span key={label} style={{ fontSize: '11.5px', color: 'var(--text-secondary)', padding: '5px 10px', borderRadius: '999px', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                    {label}
                  </span>
                ))}
              </div>
            </div>

            <div className="card" style={{ padding: '20px 22px' }}>
              <div style={{ fontFamily: 'Fraunces, serif', fontSize: '20px', fontWeight: '300', marginBottom: '14px' }}>
                Sandbox Scenario
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="label">Hotel</label>
                  <select
                    className="input"
                    value={request.hotelId ?? ''}
                    onChange={event => setRequest(prev => ({ ...prev, hotelId: event.target.value ? Number(event.target.value) : null, contractVersionId: null }))}
                  >
                    <option value="">Select hotel…</option>
                    {hotels.map(hotel => <option key={hotel.id} value={hotel.id}>{hotel.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Contract Version</label>
                  <select
                    className="input"
                    value={request.contractVersionId ?? ''}
                    onChange={event => setRequest(prev => ({ ...prev, contractVersionId: event.target.value ? Number(event.target.value) : null }))}
                  >
                    <option value="">Select version…</option>
                    {versionOptions.map(version => <option key={version.id} value={version.id}>{version.version_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Booking Date</label>
                  <input className="input" type="date" value={request.bookingDate} onChange={event => setRequest(prev => ({ ...prev, bookingDate: event.target.value }))} />
                </div>
                <div>
                  <label className="label">Board Basis</label>
                  {boardOptions.length > 0 ? (
                    <select
                      className="input"
                      value={request.boardBasis}
                      onChange={event => setRequest(prev => ({ ...prev, boardBasis: event.target.value }))}
                    >
                      {boardOptions.map(board => <option key={board} value={board}>{board}</option>)}
                    </select>
                  ) : (
                    <input className="input" value={request.boardBasis} onChange={event => setRequest(prev => ({ ...prev, boardBasis: event.target.value }))} />
                  )}
                </div>
                <div>
                  <label className="label">Check-in</label>
                  <input className="input" type="date" value={request.checkInDate} onChange={event => setRequest(prev => ({ ...prev, checkInDate: event.target.value }))} />
                </div>
                <div>
                  <label className="label">Check-out</label>
                  <input className="input" type="date" value={request.checkOutDate} onChange={event => setRequest(prev => ({ ...prev, checkOutDate: event.target.value }))} />
                </div>
                <div>
                  <label className="label">Room</label>
                  {activeRoomOptions.length > 0 ? (
                    <select
                      className="input"
                      value={request.roomName}
                      onChange={event => setRequest(prev => ({ ...prev, roomName: event.target.value }))}
                    >
                      {activeRoomOptions.map(room => <option key={room} value={room}>{room}</option>)}
                    </select>
                  ) : (
                    <input className="input" value={request.roomName} onChange={event => setRequest(prev => ({ ...prev, roomName: event.target.value }))} />
                  )}
                </div>
                <div>
                  <label className="label">Adults</label>
                  <input className="input" type="number" min="1" value={request.adults} onChange={event => setRequest(prev => ({ ...prev, adults: Number(event.target.value) || 0 }))} />
                </div>
                <div>
                  <label className="label">Infants</label>
                  <input className="input" type="number" min="0" value={request.infants} onChange={event => setRequest(prev => ({ ...prev, infants: Number(event.target.value) || 0 }))} />
                </div>
                <div>
                  <label className="label">Child Guests</label>
                  <input className="input" type="number" min="0" max="6" value={request.childAges.length} onChange={event => updateChildGuests(Math.min(6, Math.max(0, Number(event.target.value) || 0)))} />
                </div>
                <div>
                  <label className="label">Teen Guests</label>
                  <input className="input" type="number" min="0" max="6" value={request.teenAges.length} onChange={event => updateTeenGuests(Math.min(6, Math.max(0, Number(event.target.value) || 0)))} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="label">Special Offer Search</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      className="input"
                      list="hotel-special-offer-options"
                      placeholder="Search and add a trigger such as HM Offers…"
                      value={specialOfferSearch}
                      onChange={event => setSpecialOfferSearch(event.target.value)}
                      onKeyDown={event => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          addSpecialOfferSelection()
                        }
                      }}
                    />
                    <button type="button" className="btn btn-secondary btn-sm" onClick={addSpecialOfferSelection}>
                      Add
                    </button>
                  </div>
                  <datalist id="hotel-special-offer-options">
                    {SPECIAL_OFFER_OPTIONS.map(option => (
                      <option key={option.value} value={option.label}>{option.description}</option>
                    ))}
                  </datalist>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '6px' }}>
                    Add `HM Offers` when a honeymoon-style benefit should be considered. If it is not selected, contracted pricing can still fall back.
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                    {request.selectedOfferFamilies.length === 0 && (
                      <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                        No manual special-offer triggers selected.
                      </span>
                    )}
                    {request.selectedOfferFamilies.map(offerFamily => {
                      const option = SPECIAL_OFFER_OPTIONS.find(value => value.value === offerFamily)
                      return (
                        <button
                          key={offerFamily}
                          type="button"
                          onClick={() => removeSpecialOfferSelection(offerFamily)}
                          style={{
                            fontSize: '11.5px',
                            color: 'var(--text-secondary)',
                            padding: '6px 10px',
                            borderRadius: '999px',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border)',
                            cursor: 'pointer',
                          }}
                        >
                          {option?.label || offerFamily} ×
                        </button>
                      )
                    })}
                  </div>
                </div>
                {request.childAges.length > 0 && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                      Child Ages
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
                      {request.childAges.map((age, index) => (
                        <div key={`child-age-${index}`}>
                          <label className="label">Child {index + 1}</label>
                          <select className="input" value={age} onChange={event => updateChildAge(index, Number(event.target.value))}>
                            {CHILD_AGE_OPTIONS.map(option => <option key={option} value={option}>{option} years</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {request.teenAges.length > 0 && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                      Teen Ages
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
                      {request.teenAges.map((age, index) => (
                        <div key={`teen-age-${index}`}>
                          <label className="label">Teen {index + 1}</label>
                          <select className="input" value={age} onChange={event => updateTeenAge(index, Number(event.target.value))}>
                            {TEEN_AGE_OPTIONS.map(option => <option key={option} value={option}>{option} years</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(request.childAges.length > 0 || request.teenAges.length > 0) && (
                  <div style={{ gridColumn: '1 / -1', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    Children are limited to ages 3-12 and teens to ages 13-17 so the right occupancy bands are priced automatically.
                  </div>
                )}
                {request.selectedOfferFamilies.length > 0 && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                      Selected Special Offer Triggers
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {request.selectedOfferFamilies.map(offerFamily => {
                        const option = SPECIAL_OFFER_OPTIONS.find(value => value.value === offerFamily)
                        return (
                          <span key={`selected-${offerFamily}`} style={{ fontSize: '11.5px', color: 'var(--text-secondary)', padding: '5px 10px', borderRadius: '999px', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                            {option?.label || offerFamily}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}
                {request.selectedOfferFamilies.length === 0 && (
                  <div style={{ gridColumn: '1 / -1', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    Special-offer families such as honeymoon are only considered when you add them from the search box.
                  </div>
                )}
                {request.childAges.length === 0 && request.teenAges.length === 0 && (
                  <div style={{ gridColumn: '1 / -1', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    Add child or teen guests above to select the exact ages used in the pricing bands.
                  </div>
                )}
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                    Current Guest Ages
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {request.childAges.map((age, index) => (
                      <span key={`child-pill-${index}`} style={{ fontSize: '11.5px', color: 'var(--text-secondary)', padding: '5px 10px', borderRadius: '999px', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                        Child {index + 1}: {age}
                      </span>
                    ))}
                    {request.teenAges.map((age, index) => (
                      <span key={`teen-pill-${index}`} style={{ fontSize: '11.5px', color: 'var(--text-secondary)', padding: '5px 10px', borderRadius: '999px', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                        Teen {index + 1}: {age}
                      </span>
                    ))}
                    {request.childAges.length === 0 && request.teenAges.length === 0 && (
                      <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                        No child or teen ages selected yet.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div className="card" style={{ padding: '20px 22px' }}>
              <div style={{ fontFamily: 'Fraunces, serif', fontSize: '20px', fontWeight: '300', marginBottom: '14px' }}>
                Engine Preview
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '16px' }}>
                <div style={{ padding: '12px 14px', borderRadius: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '5px' }}>Hotel</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600' }}>{activeHotel?.name || 'Not selected'}</div>
                </div>
                <div style={{ padding: '12px 14px', borderRadius: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '5px' }}>Nights</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600' }}>{preview.nights}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '16px' }}>
                {[
                  { label: 'Base Stay', value: preview.baseAccommodationTotal },
                  { label: 'After Offers', value: preview.discountedAccommodationTotal },
                  { label: 'Compulsory', value: preview.compulsoryChargeTotal },
                  { label: 'Final Net', value: preview.finalAccommodationNet },
                ].map(card => (
                  <div key={card.label} style={{ padding: '12px 14px', borderRadius: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '5px' }}>{card.label}</div>
                    <div style={{ fontSize: '16px', color: 'var(--text-primary)', fontWeight: '700' }}>{formatMoney(card.value)}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Guest Mix</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {[
                    `${preview.guestMix.adults} adults`,
                    `${preview.guestMix.children} children`,
                    `${preview.guestMix.teens} teens`,
                    `${preview.guestMix.infants} infants`,
                  ].map(label => (
                    <span key={label} style={{ fontSize: '11.5px', color: 'var(--text-secondary)', padding: '5px 10px', borderRadius: '999px', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                      {label}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Stay Nights</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
                  {preview.stayNights.map(night => (
                    <div key={night.date} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600' }}>{night.date}</div>
                      <div style={{ fontSize: '12px', color: night.seasonCode ? 'var(--text-secondary)' : 'var(--red)' }}>
                        {night.seasonCode ? `${night.seasonCode} · ${night.seasonName}` : 'No season mapped'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Offer Eligibility</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {preview.offerChecks.length === 0 && (
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '10px 0' }}>
                      No offers loaded for this version yet.
                    </div>
                  )}
                  {preview.offerChecks.map(check => (
                    <div key={check.offerId} style={{ padding: '12px 14px', borderRadius: '12px', border: `1px solid ${check.eligible ? '#bbf7d0' : '#fecaca'}`, background: check.eligible ? '#f0fdf4' : '#fef2f2' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '4px' }}>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>{check.offerCode}</div>
                        <div style={{ fontSize: '11px', fontWeight: '700', color: check.eligible ? '#15803d' : '#b91c1c' }}>
                          {check.eligible ? 'Eligible' : 'Rejected'}
                        </div>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {check.offerName}
                      </div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                        {check.reason}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: '16px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Calculation Trace</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '260px', overflowY: 'auto' }}>
                  {preview.trace.length === 0 && (
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '10px 0' }}>
                      No pricing trace yet. Load a contract version with room rates to begin.
                    </div>
                  )}
                  {preview.trace.map((line, index) => (
                    <div key={`${line.stage}-${line.label}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '10px 12px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>
                      <div>
                        <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600' }}>{line.label}</div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '3px' }}>
                          {line.stage.replaceAll('_', ' ')}{line.detail ? ` · ${line.detail}` : ''}
                        </div>
                      </div>
                      <div style={{ fontSize: '12.5px', color: line.amount < 0 ? '#b91c1c' : 'var(--text-primary)', fontWeight: '700', whiteSpace: 'nowrap' }}>
                        {formatMoney(line.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: '20px 22px' }}>
              <div style={{ fontFamily: 'Fraunces, serif', fontSize: '20px', fontWeight: '300', marginBottom: '14px' }}>
                Warnings
              </div>
              {preview.warnings.length === 0 ? (
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  No structural warnings for this scenario.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {preview.warnings.map(warning => (
                    <div key={warning} style={{ padding: '10px 12px', borderRadius: '10px', background: '#fff7ed', border: '1px solid #fdba74', color: '#9a3412', fontSize: '12px' }}>
                      {warning}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
