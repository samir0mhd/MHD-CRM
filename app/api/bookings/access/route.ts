import { NextRequest, NextResponse } from 'next/server'
import { getAccessContext } from '@/lib/access'

// Returns the active staff list (for ownership dropdowns) and the caller's
// own identity. Requires a valid session — exposes names, roles and emails.
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ?? null
    const { staffUsers, currentStaff } = await getAccessContext(token)

    if (!currentStaff) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Scope the staff list: only expose what the booking UI needs
    const safeStaffUsers = staffUsers.map(u => ({
      id: u.id,
      name: u.name,
      role: u.role,
    }))

    return NextResponse.json({ staffUsers: safeStaffUsers, currentStaff: { id: currentStaff.id, name: currentStaff.name, role: currentStaff.role } })
  } catch (error) {
    console.error('Error loading booking access context:', error)
    return NextResponse.json({ error: 'Failed to load access context' }, { status: 500 })
  }
}
