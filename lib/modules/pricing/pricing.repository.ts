import { supabase } from '@/lib/supabase'
import type {
  HotelCompulsoryCharge,
  HotelContractSeason,
  HotelOffer,
  HotelOfferCombinability,
  HotelOfferRule,
  HotelRoomContract,
  HotelRoomOccupancyRate,
  HotelRoomRate,
} from '@/lib/hotel-pricing/types'

export type HotelSummary = {
  id: number
  name: string
}

export type ContractSummary = {
  id: number
  hotel_id: number
  name: string
  status: string
}

export type ContractVersionSummary = {
  id: number
  hotel_contract_id: number
  version_name: string
  valid_from: string
  valid_to: string
  booking_from: string | null
  booking_to: string | null
  is_active: boolean
}

export async function getHotels() {
  const { data, error } = await supabase
    .from('hotel_list')
    .select('id,name')
    .order('name')
  if (error) throw error
  return (data || []) as HotelSummary[]
}

export async function getContracts() {
  const { data, error } = await supabase
    .from('hotel_contracts')
    .select('id,hotel_id,name,status')
    .order('name')
  if (error) throw error
  return (data || []) as ContractSummary[]
}

export async function getContractVersions() {
  const { data, error } = await supabase
    .from('hotel_contract_versions')
    .select('id,hotel_contract_id,version_name,valid_from,valid_to,booking_from,booking_to,is_active')
    .order('valid_from', { ascending: false })
  if (error) throw error
  return (data || []) as ContractVersionSummary[]
}

export async function getOffers(contractVersionId: number) {
  const { data, error } = await supabase
    .from('hotel_offers')
    .select('id,contract_version_id,offer_code,offer_name,offer_family,status,booking_from,booking_to,travel_from,travel_to,minimum_nights,maximum_nights,priority,stop_after_apply,description,notes')
    .eq('contract_version_id', contractVersionId)
    .order('priority')
  if (error) throw error
  return (data || []) as HotelOffer[]
}

export async function getSeasons(contractVersionId: number) {
  const { data, error } = await supabase
    .from('hotel_contract_seasons')
    .select('id,contract_version_id,season_code,season_name,travel_from,travel_to,sort_order')
    .eq('contract_version_id', contractVersionId)
    .order('sort_order')
  if (error) throw error
  return (data || []) as HotelContractSeason[]
}

export async function getRoomContracts(contractVersionId: number) {
  const { data, error } = await supabase
    .from('hotel_room_contracts')
    .select('id,contract_version_id,room_name,room_code,room_group,min_pax,max_pax,max_adults,max_children,max_infants,room_notes')
    .eq('contract_version_id', contractVersionId)
    .order('room_name')
  if (error) throw error
  return (data || []) as HotelRoomContract[]
}

export async function getCompulsoryCharges(contractVersionId: number) {
  const { data, error } = await supabase
    .from('hotel_compulsory_charges')
    .select('id,contract_version_id,charge_name,charge_code,pricing_method,value,per_person,per_night,stay_date_from,stay_date_to,booking_date_from,booking_date_to,age_from,age_to,notes')
    .eq('contract_version_id', contractVersionId)
    .order('stay_date_from')
  if (error) throw error
  return (data || []) as HotelCompulsoryCharge[]
}

export async function getRoomRates(roomContractIds: number[]) {
  if (roomContractIds.length === 0) return []
  const { data, error } = await supabase
    .from('hotel_room_rates')
    .select('id,room_contract_id,season_id,board_basis,pricing_model,rate_value,rate_unit,single_rate_value,triple_rate_value,currency,notes')
    .in('room_contract_id', roomContractIds)
    .order('season_id')
  if (error) throw error
  return (data || []) as Omit<HotelRoomRate, 'room_name'>[]
}

export async function getOccupancyRates(roomRateIds: number[]) {
  if (roomRateIds.length === 0) return []
  const { data, error } = await supabase
    .from('hotel_room_occupancy_rates')
    .select('id,room_rate_id,occupancy_code,adults,children,infants,age_band_code,rate_value,notes')
    .in('room_rate_id', roomRateIds)
  if (error) throw error
  return (data || []) as HotelRoomOccupancyRate[]
}

export async function getOfferRules(offerIds: number[]) {
  if (offerIds.length === 0) return []
  const { data, error } = await supabase
    .from('hotel_offer_rules')
    .select('id,hotel_offer_id,rule_type,target_scope,pricing_method,value,age_from,age_to,room_name,board_basis,apply_stage,sort_order,notes')
    .in('hotel_offer_id', offerIds)
    .order('sort_order')
  if (error) throw error
  return (data || []) as HotelOfferRule[]
}

export async function getOfferCombinability(offerIds: number[]) {
  if (offerIds.length === 0) return []
  const { data, error } = await supabase
    .from('hotel_offer_combinability')
    .select('id,hotel_offer_id,with_offer_family,with_offer_code,is_allowed,notes')
    .in('hotel_offer_id', offerIds)
  if (error) throw error
  return (data || []) as HotelOfferCombinability[]
}
