import type {
  HotelCompulsoryCharge,
  HotelContractSeason,
  HotelOffer,
  HotelOfferCombinability,
  HotelOfferRule,
  HotelRoomContract,
  HotelRoomOccupancyRate,
  HotelRoomRate,
  OfferEligibility,
  PricingGuestMix,
  PricingPreview,
  PricingPreviewNight,
  PricingTraceLine,
  PricingRequest,
} from './types'

type PricingPreviewDataset = {
  seasons?: HotelContractSeason[]
  offers?: HotelOffer[]
  offerCombinability?: HotelOfferCombinability[]
  offerRules?: HotelOfferRule[]
  roomContracts?: HotelRoomContract[]
  roomRates?: HotelRoomRate[]
  occupancyRates?: HotelRoomOccupancyRate[]
  compulsoryCharges?: HotelCompulsoryCharge[]
}

function toUtcMidday(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
}

function fromUtcDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function isWithinDateRange(date: string, from: string | null, to: string | null) {
  if (from && date < from) return false
  if (to && date > to) return false
  return true
}

export function parseAgeCsv(input: string) {
  return input
    .split(',')
    .map(part => Number(part.trim()))
    .filter(value => Number.isFinite(value) && value >= 0)
    .sort((a, b) => a - b)
}

function sameText(left: string | null | undefined, right: string | null | undefined) {
  return (left || '').trim().toLowerCase() === (right || '').trim().toLowerCase()
}

export function buildGuestMix(request: PricingRequest): PricingGuestMix {
  const childAges = [...request.childAges].sort((a, b) => a - b)
  const teenAges = [...request.teenAges].sort((a, b) => a - b)

  return {
    adults: request.adults,
    children: childAges.length,
    teens: teenAges.length,
    infants: request.infants,
    childAges,
    teenAges,
  }
}

export function buildStayNights(checkInDate: string, checkOutDate: string) {
  const checkIn = toUtcMidday(checkInDate)
  const checkOut = toUtcMidday(checkOutDate)
  const nights: string[] = []

  for (let cursor = new Date(checkIn); cursor < checkOut; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    nights.push(fromUtcDate(cursor))
  }

  return nights
}

export function findSeasonForNight(date: string, seasons: HotelContractSeason[]) {
  return seasons
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .find(season => date >= season.travel_from && date <= season.travel_to) || null
}

function ageFits(age: number, from: number | null, to: number | null) {
  if (from !== null && age < from) return false
  if (to !== null && age > to) return false
  return true
}

function findNightRoomRate(date: string, request: PricingRequest, dataset: PricingPreviewDataset) {
  const season = dataset.seasons ? findSeasonForNight(date, dataset.seasons) : null
  if (!season) return { season: null, roomRate: null }

  const roomRate = (dataset.roomRates || []).find(rate =>
    rate.season_id === season.id &&
    sameText(rate.room_name, request.roomName) &&
    sameText(rate.board_basis, request.boardBasis),
  ) || null

  return { season, roomRate }
}

function findRoomContract(request: PricingRequest, dataset: PricingPreviewDataset) {
  return (dataset.roomContracts || []).find(room => sameText(room.room_name, request.roomName)) || null
}

function resolveAdultNightlyTotal(rate: HotelRoomRate, adults: number) {
  if (adults <= 0) return 0
  if (adults === 1) return rate.single_rate_value || 0
  if (adults === 2) return (rate.rate_value || 0) * 2
  if (adults === 3) return (rate.triple_rate_value ?? rate.rate_value ?? 0) * 3
  return (rate.rate_value || 0) * adults
}

function resolveSharingGuestRate(
  rate: HotelRoomRate,
  occupancyRates: HotelRoomOccupancyRate[],
  age: number,
) {
  if (age < 3) return 0

  const ageBandCode = age <= 12 ? 'child_share_3_12' : 'teen_share_13_17'
  const exact = occupancyRates.find(row => row.room_rate_id === rate.id && row.age_band_code === ageBandCode)
  return exact?.rate_value || 0
}

function evaluateCompulsoryCharges(
  request: PricingRequest,
  charges: HotelCompulsoryCharge[],
  stayNights: string[],
) {
  const trace: PricingTraceLine[] = []
  let total = 0
  const guestAges = [
    ...Array.from({ length: request.adults }, () => ({ kind: 'adult' as const, age: 30 })),
    ...request.childAges.map(age => ({ kind: 'child' as const, age })),
    ...request.teenAges.map(age => ({ kind: 'teen' as const, age })),
  ]

  for (const charge of charges) {
    for (const night of stayNights) {
      if (night < charge.stay_date_from || night > charge.stay_date_to) continue
      if (!isWithinDateRange(request.bookingDate, charge.booking_date_from, charge.booking_date_to)) continue

      if (charge.per_person) {
        const matchingGuests = guestAges.filter(guest => ageFits(guest.age, charge.age_from, charge.age_to))
        if (matchingGuests.length === 0) continue
        const amount = charge.value * matchingGuests.length
        total += amount
        trace.push({
          stage: 'compulsory_charge',
          label: charge.charge_name,
          amount,
          detail: `${night} · ${matchingGuests.length} passenger(s)`,
        })
      } else {
        total += charge.value
        trace.push({
          stage: 'compulsory_charge',
          label: charge.charge_name,
          amount: charge.value,
          detail: night,
        })
      }
    }
  }

  return { total, trace }
}

export function evaluateOfferEligibility(offer: HotelOffer, request: PricingRequest, nights: string[]): OfferEligibility {
  if (offer.status !== 'active') {
    return { offerId: offer.id, offerCode: offer.offer_code, offerName: offer.offer_name, eligible: false, reason: 'Offer is not active' }
  }

  if (!isWithinDateRange(request.bookingDate, offer.booking_from, offer.booking_to)) {
    return { offerId: offer.id, offerCode: offer.offer_code, offerName: offer.offer_name, eligible: false, reason: 'Booking date is outside the booking window' }
  }

  if (nights.some(date => !isWithinDateRange(date, offer.travel_from, offer.travel_to))) {
    return { offerId: offer.id, offerCode: offer.offer_code, offerName: offer.offer_name, eligible: false, reason: 'Travel dates are outside the travel window' }
  }

  if (offer.minimum_nights !== null && nights.length < offer.minimum_nights) {
    return { offerId: offer.id, offerCode: offer.offer_code, offerName: offer.offer_name, eligible: false, reason: `Minimum ${offer.minimum_nights} nights required` }
  }

  if (offer.maximum_nights !== null && nights.length > offer.maximum_nights) {
    return { offerId: offer.id, offerCode: offer.offer_code, offerName: offer.offer_name, eligible: false, reason: `Maximum ${offer.maximum_nights} nights allowed` }
  }

  return { offerId: offer.id, offerCode: offer.offer_code, offerName: offer.offer_name, eligible: true, reason: 'Eligible by booking window, travel window, and stay length' }
}

export function buildPricingPreview(request: PricingRequest, dataset: PricingPreviewDataset = {}): PricingPreview {
  const warnings: string[] = []
  const trace: PricingTraceLine[] = []

  if (!request.checkInDate || !request.checkOutDate) {
    warnings.push('Check-in and check-out dates are required')
  }
  if (!request.bookingDate) {
    warnings.push('Booking date is required')
  }
  if (request.adults < 1) {
    warnings.push('At least one adult is required')
  }
  if (request.checkInDate && request.checkOutDate && request.checkOutDate <= request.checkInDate) {
    warnings.push('Check-out must be after check-in')
  }

  const stayNightsRaw = request.checkInDate && request.checkOutDate
    ? buildStayNights(request.checkInDate, request.checkOutDate)
    : []

  const stayNights: PricingPreviewNight[] = stayNightsRaw.map(date => {
    const season = dataset.seasons ? findSeasonForNight(date, dataset.seasons) : null
    if (!season && dataset.seasons && dataset.seasons.length > 0) {
      warnings.push(`No season matched ${date}`)
    }

    return {
      date,
      seasonCode: season?.season_code || null,
      seasonName: season?.season_name || null,
    }
  })

  const offerChecks = (dataset.offers || [])
    .slice()
    .sort((a, b) => a.priority - b.priority)
    .map(offer => evaluateOfferEligibility(offer, request, stayNightsRaw))

  if (dataset.roomRates && dataset.roomRates.length === 0) {
    warnings.push('No room rates are loaded for this contract version yet')
  }

  const roomContract = findRoomContract(request, dataset)
  const totalGuests = request.adults + request.childAges.length + request.teenAges.length + request.infants
  const totalChildren = request.childAges.length + request.teenAges.length
  let hasBlockingOccupancyIssue = false

  if (roomContract) {
    if (roomContract.max_adults !== null && request.adults > roomContract.max_adults) {
      warnings.push(`${roomContract.room_name} allows a maximum of ${roomContract.max_adults} adult${roomContract.max_adults === 1 ? '' : 's'}`)
      hasBlockingOccupancyIssue = true
    }
    if (roomContract.max_children !== null && totalChildren > roomContract.max_children) {
      warnings.push(`${roomContract.room_name} allows a maximum of ${roomContract.max_children} child/teen passenger${roomContract.max_children === 1 ? '' : 's'}`)
      hasBlockingOccupancyIssue = true
    }
    if (roomContract.max_pax !== null && totalGuests > roomContract.max_pax) {
      warnings.push(`${roomContract.room_name} allows a maximum of ${roomContract.max_pax} total passenger${roomContract.max_pax === 1 ? '' : 's'}`)
      hasBlockingOccupancyIssue = true
    }
  }

  if (hasBlockingOccupancyIssue) {
    return {
      nights: stayNightsRaw.length,
      guestMix: buildGuestMix(request),
      stayNights,
      offerChecks: [],
      trace: [],
      baseAccommodationTotal: 0,
      discountedAccommodationTotal: 0,
      compulsoryChargeTotal: 0,
      finalAccommodationNet: 0,
      warnings: [...new Set(warnings)],
    }
  }

  const eligibleOfferChecks = offerChecks.filter(check => check.eligible)
  const offersById = new Map((dataset.offers || []).map(offer => [offer.id, offer]))
  const combinabilityRows = dataset.offerCombinability || []
  const appliedOfferIds = new Set<number>()
  const selectedOffers: HotelOffer[] = []
  const finalOfferChecks = offerChecks.map(check => ({ ...check }))

  const isCombinationAllowed = (currentOffer: HotelOffer, selectedOffer: HotelOffer) => {
    const directRows = combinabilityRows.filter(row => row.hotel_offer_id === currentOffer.id)
    const reverseRows = combinabilityRows.filter(row => row.hotel_offer_id === selectedOffer.id)
    const matched = [
      ...directRows.filter(row =>
        (row.with_offer_code && sameText(row.with_offer_code, selectedOffer.offer_code)) ||
        (row.with_offer_family && sameText(row.with_offer_family, selectedOffer.offer_family)),
      ),
      ...reverseRows.filter(row =>
        (row.with_offer_code && sameText(row.with_offer_code, currentOffer.offer_code)) ||
        (row.with_offer_family && sameText(row.with_offer_family, currentOffer.offer_family)),
      ),
    ]

    const blocked = matched.find(row => row.is_allowed === false)
    if (blocked) return { allowed: false, reason: `Not combinable with ${selectedOffer.offer_code}` }

    return { allowed: true, reason: '' }
  }

  for (const check of eligibleOfferChecks) {
    const currentOffer = offersById.get(check.offerId)
    if (!currentOffer) continue

    const stopOffer = selectedOffers.find(offer => offer.stop_after_apply)
    if (stopOffer) {
      const rejected = finalOfferChecks.find(item => item.offerId === check.offerId)
      if (rejected) {
        rejected.eligible = false
        rejected.reason = `Blocked after ${stopOffer.offer_code} applied`
      }
      continue
    }

    const conflict = selectedOffers
      .map(selectedOffer => ({ selectedOffer, result: isCombinationAllowed(currentOffer, selectedOffer) }))
      .find(item => item.result.allowed === false)

    if (conflict) {
      const rejected = finalOfferChecks.find(item => item.offerId === check.offerId)
      if (rejected) {
        rejected.eligible = false
        rejected.reason = conflict.result.reason
      }
      continue
    }

    appliedOfferIds.add(check.offerId)
    selectedOffers.push(currentOffer)
  }

  let adultBaseTotal = 0
  let childBaseTotal = 0

  for (const date of stayNightsRaw) {
    const { roomRate } = findNightRoomRate(date, request, dataset)
    if (!roomRate) {
      if (dataset.roomRates && dataset.roomRates.length > 0) warnings.push(`No room rate matched ${request.roomName} / ${request.boardBasis} on ${date}`)
      continue
    }

    const nightlyAdultTotal = resolveAdultNightlyTotal(roomRate, request.adults)
    adultBaseTotal += nightlyAdultTotal

    if (nightlyAdultTotal > 0) {
      trace.push({
        stage: 'base',
        label: `${roomRate.room_name} adult base`,
        amount: nightlyAdultTotal,
        detail: `${date} · ${request.adults} adult(s)`,
      })
    }

    const occupancyRates = (dataset.occupancyRates || []).filter(row => row.room_rate_id === roomRate.id)
    for (const age of [...request.childAges, ...request.teenAges]) {
      const guestRate = resolveSharingGuestRate(roomRate, occupancyRates, age)
      if (guestRate > 0) {
        childBaseTotal += guestRate
        trace.push({
          stage: 'base',
          label: age <= 12 ? 'Child sharing rate' : 'Teen sharing rate',
          amount: guestRate,
          detail: `${date} · age ${age}`,
        })
      }
    }
  }

  const eligibleOfferIds = appliedOfferIds
  const eligibleRules = (dataset.offerRules || [])
    .filter(rule => eligibleOfferIds.has(rule.hotel_offer_id))
    .filter(rule => !rule.room_name || sameText(rule.room_name, request.roomName))
    .filter(rule => !rule.board_basis || sameText(rule.board_basis, request.boardBasis))
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)

  let childDiscountTotal = 0
  for (const rule of eligibleRules.filter(rule => rule.apply_stage === 'child_pricing' && rule.rule_type === 'child_discount' && rule.pricing_method === 'percentage' && rule.value)) {
    const eligibleChildBase = [...request.childAges]
      .filter(age => ageFits(age, rule.age_from, rule.age_to))
      .reduce((subtotal, age) => {
        let childSubtotal = 0
        for (const date of stayNightsRaw) {
          const { roomRate } = findNightRoomRate(date, request, dataset)
          if (!roomRate) continue
          const occupancyRates = (dataset.occupancyRates || []).filter(row => row.room_rate_id === roomRate.id)
          childSubtotal += resolveSharingGuestRate(roomRate, occupancyRates, age)
        }
        return subtotal + childSubtotal
      }, 0)

    if (eligibleChildBase > 0) {
      const discount = eligibleChildBase * ((rule.value || 0) / 100)
      childDiscountTotal += discount
      trace.push({
        stage: 'child_discount',
        label: 'Child discount applied first',
        amount: -discount,
        detail: `${rule.value}%`,
      })
    }
  }

  const accommodationSubtotalAfterChild = adultBaseTotal + childBaseTotal - childDiscountTotal

  let offerDiscountTotal = 0
  for (const rule of eligibleRules.filter(rule => rule.apply_stage === 'offers' && rule.rule_type === 'percentage_discount' && rule.pricing_method === 'percentage' && rule.value)) {
    const discount = accommodationSubtotalAfterChild * ((rule.value || 0) / 100)
    offerDiscountTotal += discount
    trace.push({
      stage: 'offer_discount',
      label: 'Overall offer discount',
      amount: -discount,
      detail: `${rule.value}%`,
    })
  }

  const discountedAccommodationTotal = accommodationSubtotalAfterChild - offerDiscountTotal
  const compulsory = evaluateCompulsoryCharges(request, dataset.compulsoryCharges || [], stayNightsRaw)
  trace.push(...compulsory.trace)
  const finalAccommodationNet = discountedAccommodationTotal + compulsory.total
  trace.push({
    stage: 'final',
    label: 'Final accommodation net',
    amount: finalAccommodationNet,
  })

  return {
    nights: stayNightsRaw.length,
    guestMix: buildGuestMix(request),
    stayNights,
    offerChecks: finalOfferChecks,
    trace,
    baseAccommodationTotal: adultBaseTotal + childBaseTotal,
    discountedAccommodationTotal,
    compulsoryChargeTotal: compulsory.total,
    finalAccommodationNet,
    warnings: [...new Set(warnings)],
  }
}
