import { NextResponse } from 'next/server'
import { getAccessContext, isManager } from '@/lib/access'
import { getWorkspaceData, updateWorkspaceProfile } from '@/lib/modules/workspace/workspace.service'

function getToken(request: Request) {
  const authHeader = request.headers.get('authorization')
  return authHeader?.replace('Bearer ', '') || null
}

export async function GET(request: Request) {
  try {
    const token = getToken(request)
    const { currentStaff, staffUsers } = await getAccessContext(token)

    if (!currentStaff) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const requestedStaffIdRaw = new URL(request.url).searchParams.get('staffId')
    const requestedStaffId = requestedStaffIdRaw ? Number(requestedStaffIdRaw) : currentStaff.id

    if (!Number.isFinite(requestedStaffId)) {
      return NextResponse.json({ error: 'Invalid workspace staffId' }, { status: 400 })
    }

    if (requestedStaffId !== currentStaff.id && !isManager(currentStaff)) {
      return NextResponse.json({ error: 'Manager access required for other staff workspaces' }, { status: 403 })
    }

    const targetStaff = staffUsers.find(user => user.id === requestedStaffId)
    if (!targetStaff) {
      return NextResponse.json({ error: 'Workspace staff member not found' }, { status: 404 })
    }

    const data = await getWorkspaceData(requestedStaffId)
    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error loading workspace:', error)
    return NextResponse.json({ error: 'Failed to load workspace' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const token = getToken(request)
    const { currentStaff } = await getAccessContext(token)

    if (!currentStaff) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const profile = await updateWorkspaceProfile(currentStaff.id, {
      job_title: typeof body.job_title === 'string' ? body.job_title : undefined,
      profile_photo_url: typeof body.profile_photo_url === 'string' ? body.profile_photo_url : undefined,
      email_signature: typeof body.email_signature === 'string' ? body.email_signature : undefined,
    })

    return NextResponse.json({ profile })
  } catch (error) {
    console.error('Error updating workspace profile:', error)
    return NextResponse.json({ error: 'Failed to update workspace profile' }, { status: 500 })
  }
}
