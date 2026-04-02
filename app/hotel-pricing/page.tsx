'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { buildPricingPreview, parseAgeCsv } from '@/lib/hotel-pricing/engine'
import type {
  HotelCompulsoryCharge,
  HotelContractSeason,
  HotelOffer,
  HotelOfferCombinability,
  HotelOfferRule,
  HotelRoomContract,
  HotelRoomOccupancyRate,
  HotelRoomRate,
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
      adults: 2,
      childAges: [8],
      teenAges: [],
      infants: 0,
    }
  })

  async function loadDashboard() {
    setLoading(true)
    setSetupError(null)

    const { data: hotelRows, error: hotelError } = await supabase
      .from('hotel_list')
      .select('id,name')
      .order('name')

    if (hotelError) {
      setSetupError(hotelError.message)
      setLoading(false)
      return
    }

    setHotels((hotelRows || []) as HotelSummary[])

    const [{ data: contractRows, error: contractError }, { data: versionRows, error: versionError }] = await Promise.all([
      supabase.from('hotel_contracts').select('id,hotel_id,name,status').order('name'),
      supabase.from('hotel_contract_versions').select('id,hotel_contract_id,version_name,valid_from,valid_to,booking_from,booking_to,is_active').order('valid_from', { ascending: false }),
    ])

    if (contractError || versionError) {
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
      setSetupError(contractError?.message || versionError?.message || 'Pricing schema is not available yet')
      setLoading(false)
      return
    }

    const safeContracts = (contractRows || []) as ContractSummary[]
    const safeVersions = (versionRows || []) as ContractVersionSummary[]
    setContracts(safeContracts)
    setVersions(safeVersions)

    const pilotHotel = (hotelRows || []).find(hotel => hotel.name.toLowerCase().includes('ravenala'))
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
  }

  async function loadVersionData(contractVersionId: number) {
    const [
      { data: offerRows, error: offerError },
      { data: seasonRows, error: seasonError },
      { data: roomContractRows, error: roomContractError },
      { data: chargeRows, error: chargeError },
    ] = await Promise.all([
      supabase
        .from('hotel_offers')
        .select('id,contract_version_id,offer_code,offer_name,offer_family,status,booking_from,booking_to,travel_from,travel_to,minimum_nights,maximum_nights,priority,stop_after_apply,description,notes')
        .eq('contract_version_id', contractVersionId)
        .order('priority'),
      supabase
        .from('hotel_contract_seasons')
        .select('id,contract_version_id,season_code,season_name,travel_from,travel_to,sort_order')
        .eq('contract_version_id', contractVersionId)
        .order('sort_order'),
      supabase
        .from('hotel_room_contracts')
        .select('id,contract_version_id,room_name,room_code,room_group,min_pax,max_pax,max_adults,max_children,max_infants,room_notes')
        .eq('contract_version_id', contractVersionId)
        .order('room_name'),
      supabase
        .from('hotel_compulsory_charges')
        .select('id,contract_version_id,charge_name,charge_code,pricing_method,value,per_person,per_night,stay_date_from,stay_date_to,booking_date_from,booking_date_to,age_from,age_to,notes')
        .eq('contract_version_id', contractVersionId)
        .order('stay_date_from'),
    ])

    if (offerError || seasonError || roomContractError || chargeError) {
      setOffers([])
      setOfferCombinability([])
      setSeasons([])
      setRoomOptions([])
      setRoomContracts([])
      setRoomRates([])
      setOccupancyRates([])
      setOfferRules([])
      setCompulsoryCharges([])
      setSetupError(offerError?.message || seasonError?.message || roomContractError?.message || chargeError?.message || 'Pricing data could not be loaded')
      return
    }

    const safeOffers = (offerRows || []) as HotelOffer[]
    const safeSeasons = (seasonRows || []) as HotelContractSeason[]
    const safeRoomContracts = (roomContractRows || []) as HotelRoomContract[]
    const safeCharges = (chargeRows || []) as HotelCompulsoryCharge[]

    setOffers(safeOffers)
    setSeasons(safeSeasons)
    setRoomContracts(safeRoomContracts)
    setCompulsoryCharges(safeCharges)

    const safeRoomOptions = Array.from(new Set(safeRoomContracts.map(room => room.room_name))).sort((left, right) => left.localeCompare(right))
    setRoomOptions(safeRoomOptions)

    const roomContractIds = safeRoomContracts.map(room => room.id)
    if (roomContractIds.length === 0) {
      setRoomRates([])
      setOccupancyRates([])
      setOfferRules([])
      setOfferCombinability([])
      setRequest(prev => {
        if (!prev.contractVersionId || prev.contractVersionId !== contractVersionId) return prev
        return safeRoomOptions.length > 0 && !safeRoomOptions.includes(prev.roomName)
          ? { ...prev, roomName: safeRoomOptions[0] }
          : prev
      })
      return
    }

    const { data: roomRateRows, error: roomRateError } = await supabase
      .from('hotel_room_rates')
      .select('id,room_contract_id,season_id,board_basis,pricing_model,rate_value,rate_unit,single_rate_value,triple_rate_value,currency,notes')
      .in('room_contract_id', roomContractIds)
      .order('season_id')

    if (roomRateError) {
      setRoomRates([])
      setOccupancyRates([])
      setOfferRules([])
      setOfferCombinability([])
      setSetupError(roomRateError.message)
      return
    }

    const roomContractMap = new Map(safeRoomContracts.map(room => [room.id, room.room_name]))
    const safeRoomRates = ((roomRateRows || []) as Omit<HotelRoomRate, 'room_name'>[]).map(rate => ({
      ...rate,
      room_name: roomContractMap.get(rate.room_contract_id) || 'Unknown room',
    }))

    setRoomRates(safeRoomRates)

    const roomRateIds = safeRoomRates.map(rate => rate.id)
    const offerIds = safeOffers.map(offer => offer.id)

    if (roomRateIds.length > 0) {
      const { data: occupancyRows, error: occupancyError } = await supabase
        .from('hotel_room_occupancy_rates')
        .select('id,room_rate_id,occupancy_code,adults,children,infants,age_band_code,rate_value,notes')
        .in('room_rate_id', roomRateIds)

      if (occupancyError) {
        setOccupancyRates([])
        setSetupError(occupancyError.message)
        return
      }

      setOccupancyRates((occupancyRows || []) as HotelRoomOccupancyRate[])
    } else {
      setOccupancyRates([])
    }

    if (offerIds.length > 0) {
      const { data: ruleRows, error: ruleError } = await supabase
        .from('hotel_offer_rules')
        .select('id,hotel_offer_id,rule_type,target_scope,pricing_method,value,age_from,age_to,room_name,board_basis,apply_stage,sort_order,notes')
        .in('hotel_offer_id', offerIds)
        .order('sort_order')

      if (ruleError) {
        setOfferRules([])
        setOfferCombinability([])
        setSetupError(ruleError.message)
        return
      }

      setOfferRules((ruleRows || []) as HotelOfferRule[])

      const { data: combinabilityRows, error: combinabilityError } = await supabase
        .from('hotel_offer_combinability')
        .select('id,hotel_offer_id,with_offer_family,with_offer_code,is_allowed,notes')
        .in('hotel_offer_id', offerIds)

      if (combinabilityError) {
        setOfferCombinability([])
        setSetupError(combinabilityError.message)
        return
      }

      setOfferCombinability((combinabilityRows || []) as HotelOfferCombinability[])
    } else {
      setOfferRules([])
      setOfferCombinability([])
    }

    const boardOptions = Array.from(new Set(safeRoomRates.map(rate => rate.board_basis))).sort((left, right) => left.localeCompare(right))
    setRequest(prev => {
      if (prev.contractVersionId !== contractVersionId) return prev

      let next = prev
      if (safeRoomOptions.length > 0 && !safeRoomOptions.includes(prev.roomName)) {
        next = { ...next, roomName: safeRoomOptions[0] }
      }
      if (boardOptions.length > 0 && !boardOptions.some(board => board.toLowerCase() === prev.boardBasis.toLowerCase())) {
        next = { ...next, boardBasis: boardOptions[0] }
      }
      return next
    })

    setSetupError(null)
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
                  <label className="label">Child Ages</label>
                  <input className="input" placeholder="e.g. 8, 10" value={request.childAges.join(', ')} onChange={event => setRequest(prev => ({ ...prev, childAges: parseAgeCsv(event.target.value) }))} />
                </div>
                <div>
                  <label className="label">Teen Ages</label>
                  <input className="input" placeholder="e.g. 14, 16" value={request.teenAges.join(', ')} onChange={event => setRequest(prev => ({ ...prev, teenAges: parseAgeCsv(event.target.value) }))} />
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
