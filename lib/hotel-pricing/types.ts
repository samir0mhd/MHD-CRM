export type ContractStatus = 'draft' | 'active' | 'archived'

export type PricingModel =
  | 'per_person_per_night'
  | 'per_room_per_night'
  | 'per_unit_per_stay'

export type ChildPricingMethod =
  | 'percentage_discount'
  | 'fixed_rate_per_night'
  | 'free'
  | 'same_as_adult'

export type OfferFamily =
  | 'percentage_discount'
  | 'fixed_discount'
  | 'free_night'
  | 'stay_pay'
  | 'meal_plan_upgrade'
  | 'child_discount'
  | 'honeymoon'
  | 'anniversary'
  | 'repeat_guest'
  | 'early_booking'
  | 'long_stay'
  | 'booking_window_extension'

export type OfferRuleType =
  | 'percentage_discount'
  | 'fixed_discount'
  | 'free_night'
  | 'stay_pay'
  | 'meal_plan_upgrade'
  | 'child_discount'
  | 'compulsory_charge'

export type TargetScope = 'stay' | 'room' | 'board' | 'night' | 'guest' | 'child' | 'teen'

export type ApplyStage =
  | 'pre_child'
  | 'child_pricing'
  | 'pre_supplements'
  | 'supplements'
  | 'compulsory'
  | 'offers'
  | 'post_offers'

export type HotelContractSeason = {
  id: number
  contract_version_id: number
  season_code: string
  season_name: string
  travel_from: string
  travel_to: string
  sort_order: number
}

export type HotelOffer = {
  id: number
  contract_version_id: number
  offer_code: string
  offer_name: string
  offer_family: OfferFamily
  status: ContractStatus
  booking_from: string | null
  booking_to: string | null
  travel_from: string | null
  travel_to: string | null
  minimum_nights: number | null
  maximum_nights: number | null
  priority: number
  stop_after_apply: boolean
  description: string | null
  notes: string | null
}

export type HotelRoomRate = {
  id: number
  room_contract_id: number
  season_id: number
  board_basis: string
  pricing_model: PricingModel
  rate_value: number | null
  rate_unit: string | null
  single_rate_value: number | null
  triple_rate_value: number | null
  currency: string
  notes: string | null
  room_name: string
}

export type HotelRoomContract = {
  id: number
  contract_version_id: number
  room_name: string
  room_code: string | null
  room_group: string | null
  min_pax: number | null
  max_pax: number | null
  max_adults: number | null
  max_children: number | null
  max_infants: number | null
  room_notes: string | null
}

export type HotelRoomOccupancyRate = {
  id: number
  room_rate_id: number
  occupancy_code: string
  adults: number
  children: number
  infants: number
  age_band_code: string | null
  rate_value: number
  notes: string | null
}

export type HotelOfferRule = {
  id: number
  hotel_offer_id: number
  rule_type: OfferRuleType
  target_scope: TargetScope
  pricing_method: 'percentage' | 'fixed_amount' | 'free_night' | 'upgrade'
  value: number | null
  age_from: number | null
  age_to: number | null
  room_name: string | null
  board_basis: string | null
  apply_stage: ApplyStage
  sort_order: number
  notes: string | null
}

export type HotelCompulsoryCharge = {
  id: number
  contract_version_id: number
  charge_name: string
  charge_code: string | null
  pricing_method: 'fixed_amount' | 'fixed_rate_per_night' | 'percentage'
  value: number
  per_person: boolean
  per_night: boolean
  stay_date_from: string
  stay_date_to: string
  booking_date_from: string | null
  booking_date_to: string | null
  age_from: number | null
  age_to: number | null
  notes: string | null
}

export type HotelOfferCombinability = {
  id: number
  hotel_offer_id: number
  with_offer_family: string | null
  with_offer_code: string | null
  is_allowed: boolean
  notes: string | null
}

export type PricingRequest = {
  hotelId: number | null
  contractVersionId: number | null
  bookingDate: string
  checkInDate: string
  checkOutDate: string
  roomName: string
  boardBasis: string
  adults: number
  childAges: number[]
  teenAges: number[]
  infants: number
}

export type PricingGuestMix = {
  adults: number
  children: number
  teens: number
  infants: number
  childAges: number[]
  teenAges: number[]
}

export type PricingPreviewNight = {
  date: string
  seasonCode: string | null
  seasonName: string | null
}

export type PricingTraceLine = {
  stage: 'base' | 'child_discount' | 'offer_discount' | 'compulsory_charge' | 'final'
  label: string
  amount: number
  detail?: string
}

export type OfferEligibility = {
  offerId: number
  offerCode: string
  offerName: string
  eligible: boolean
  reason: string
}

export type PricingPreview = {
  nights: number
  guestMix: PricingGuestMix
  stayNights: PricingPreviewNight[]
  offerChecks: OfferEligibility[]
  trace: PricingTraceLine[]
  baseAccommodationTotal: number
  discountedAccommodationTotal: number
  compulsoryChargeTotal: number
  finalAccommodationNet: number
  warnings: string[]
}
