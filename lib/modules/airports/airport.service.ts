import * as repo from './airport.repository'

export type AirportOption = {
  code: string
  name: string
  city: string
  country: string
}

const DEFAULT_AIRPORTS: AirportOption[] = [
  { code: 'LGW', name: 'London Gatwick', city: 'London', country: 'United Kingdom' },
  { code: 'LHR', name: 'London Heathrow', city: 'London', country: 'United Kingdom' },
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
  { code: 'LPL', name: 'Liverpool John Lennon', city: 'Liverpool', country: 'United Kingdom' },
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
  { code: 'GVA', name: 'Geneva', city: 'Geneva', country: 'Switzerland' },
  { code: 'VIE', name: 'Vienna', city: 'Vienna', country: 'Austria' },
  { code: 'IST', name: 'Istanbul', city: 'Istanbul', country: 'Turkey' },
  { code: 'MAD', name: 'Barajas', city: 'Madrid', country: 'Spain' },
  { code: 'BCN', name: 'El Prat', city: 'Barcelona', country: 'Spain' },
  { code: 'DOH', name: 'Hamad International', city: 'Doha', country: 'Qatar' },
  { code: 'AUH', name: 'Abu Dhabi', city: 'Abu Dhabi', country: 'United Arab Emirates' },
  { code: 'DXB', name: 'Dubai International', city: 'Dubai', country: 'United Arab Emirates' },
  { code: 'SIN', name: 'Changi', city: 'Singapore', country: 'Singapore' },
  { code: 'HKG', name: 'Hong Kong International', city: 'Hong Kong', country: 'Hong Kong' },
  { code: 'BKK', name: 'Suvarnabhumi', city: 'Bangkok', country: 'Thailand' },
  { code: 'KUL', name: 'Kuala Lumpur International', city: 'Kuala Lumpur', country: 'Malaysia' },
  { code: 'JNB', name: 'O.R. Tambo', city: 'Johannesburg', country: 'South Africa' },
  { code: 'CPT', name: 'Cape Town International', city: 'Cape Town', country: 'South Africa' },
  { code: 'NBO', name: 'Jomo Kenyatta', city: 'Nairobi', country: 'Kenya' },
  { code: 'ADD', name: 'Bole International', city: 'Addis Ababa', country: 'Ethiopia' },
  { code: 'CAI', name: 'Cairo International', city: 'Cairo', country: 'Egypt' },
  { code: 'MRU', name: 'Sir Seewoosagur Ramgoolam', city: 'Mauritius', country: 'Mauritius' },
  { code: 'SEZ', name: 'Mahé Seychelles', city: 'Mahé', country: 'Seychelles' },
  { code: 'CMB', name: 'Bandaranaike International', city: 'Colombo', country: 'Sri Lanka' },
  { code: 'BEY', name: 'Beirut Rafic Hariri', city: 'Beirut', country: 'Lebanon' },
  { code: 'TLV', name: 'Ben Gurion', city: 'Tel Aviv', country: 'Israel' },
  { code: 'DAR', name: 'Julius Nyerere', city: 'Dar es Salaam', country: 'Tanzania' },
  { code: 'MBA', name: 'Moi International', city: 'Mombasa', country: 'Kenya' },
  { code: 'ZNZ', name: 'Abeid Amani Karume', city: 'Zanzibar', country: 'Tanzania' },
]

function clean(value: string | null | undefined) {
  return (value || '').trim()
}

function normaliseCode(code: string | null | undefined) {
  return clean(code).toUpperCase()
}

function byCode(a: AirportOption, b: AirportOption) {
  return a.code.localeCompare(b.code)
}

export async function listAirports(): Promise<AirportOption[]> {
  const stored = await repo.listStoredAirports()
  const merged = new Map<string, AirportOption>()

  for (const airport of DEFAULT_AIRPORTS) {
    merged.set(airport.code, airport)
  }

  for (const airport of stored) {
    merged.set(normaliseCode(airport.code), {
      code: normaliseCode(airport.code),
      name: clean(airport.name),
      city: clean(airport.city),
      country: clean(airport.country),
    })
  }

  return [...merged.values()].sort(byCode)
}

export async function createAirport(input: AirportOption): Promise<AirportOption> {
  const code = normaliseCode(input.code)
  const name = clean(input.name)
  const city = clean(input.city)
  const country = clean(input.country)

  if (!/^[A-Z]{3}$/.test(code)) {
    throw new Error('IATA code must be 3 uppercase letters')
  }
  if (!name) throw new Error('Airport name is required')
  if (!city) throw new Error('City is required')
  if (!country) throw new Error('Country is required')

  const existing = await listAirports()
  if (existing.some(airport => airport.code === code)) {
    throw new Error(`Airport code ${code} already exists`)
  }

  await repo.insertAirport({ code, name, city, country })
  return { code, name, city, country }
}
