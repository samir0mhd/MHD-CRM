import * as repo from './pricing.repository'
import type { HotelRoomRate } from '@/lib/hotel-pricing/types'

export async function loadPricingSetup() {
  const [hotels, contracts, versions] = await Promise.all([
    repo.getHotels(),
    repo.getContracts(),
    repo.getContractVersions(),
  ])

  return { hotels, contracts, versions }
}

export async function loadPricingVersionData(contractVersionId: number) {
  const [offers, seasons, roomContracts, compulsoryCharges] = await Promise.all([
    repo.getOffers(contractVersionId),
    repo.getSeasons(contractVersionId),
    repo.getRoomContracts(contractVersionId),
    repo.getCompulsoryCharges(contractVersionId),
  ])

  const roomOptions = Array.from(new Set(roomContracts.map(room => room.room_name))).sort((left, right) => left.localeCompare(right))
  const roomContractIds = roomContracts.map(room => room.id)
  const roomRateRows = await repo.getRoomRates(roomContractIds)
  const roomContractMap = new Map(roomContracts.map(room => [room.id, room.room_name]))
  const roomRates = roomRateRows.map(rate => ({
    ...rate,
    room_name: roomContractMap.get(rate.room_contract_id) || 'Unknown room',
  })) as HotelRoomRate[]

  const [occupancyRates, offerRules, offerCombinability] = await Promise.all([
    repo.getOccupancyRates(roomRates.map(rate => rate.id)),
    repo.getOfferRules(offers.map(offer => offer.id)),
    repo.getOfferCombinability(offers.map(offer => offer.id)),
  ])

  return {
    offers,
    seasons,
    roomContracts,
    compulsoryCharges,
    roomOptions,
    roomRates,
    occupancyRates,
    offerRules,
    offerCombinability,
  }
}
