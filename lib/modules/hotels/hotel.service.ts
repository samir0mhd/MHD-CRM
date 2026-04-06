import * as repo from './hotel.repository'

export type HotelFormPayload = Partial<repo.Hotel> & {
  room_types_text?: string
  meal_plans_text?: string
  highlights_text?: string
}

function normalizeList(value?: string) {
  return value ? value.split('\n').map(item => item.trim()).filter(Boolean) : []
}

export async function fetchHotelsPageData() {
  const [hotels, suppliers] = await Promise.all([
    repo.getHotels(),
    repo.getSuppliers(),
  ])

  return { hotels, suppliers }
}

export async function createHotel(input: HotelFormPayload) {
  if (!input.name?.trim()) {
    throw new Error('Hotel name is required')
  }

  return repo.createHotel({
    ...input,
    room_types: normalizeList(input.room_types_text),
    meal_plans: normalizeList(input.meal_plans_text),
    highlights: normalizeList(input.highlights_text),
  })
}

export async function updateHotel(id: number, input: HotelFormPayload) {
  return repo.updateHotel(id, {
    ...input,
    room_types: normalizeList(input.room_types_text),
    meal_plans: normalizeList(input.meal_plans_text),
    highlights: normalizeList(input.highlights_text),
  })
}

export async function deleteHotel(id: number) {
  return repo.deleteHotel(id)
}
