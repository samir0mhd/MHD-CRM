import { NextRequest, NextResponse } from 'next/server'
import { getAccessContext } from '@/lib/access'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { updateWorkspaceProfile } from '@/lib/modules/workspace/workspace.repository'

const MAX_BYTES = 2 * 1024 * 1024
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp']
const BUCKET = 'staff-photos'

function extensionForMime(type: string) {
  if (type === 'image/png') return 'png'
  if (type === 'image/webp') return 'webp'
  return 'jpg'
}

function getToken(request: Request) {
  return request.headers.get('authorization')?.replace('Bearer ', '') || null
}

export async function POST(request: NextRequest) {
  try {
    const token = getToken(request)
    const { currentStaff } = await getAccessContext(token)
    if (!currentStaff) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File must be under 2 MB' }, { status: 400 })
    }
    if (!ALLOWED_MIME.includes(file.type)) {
      return NextResponse.json({ error: 'Only JPG, PNG or WebP accepted' }, { status: 400 })
    }
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server auth setup is incomplete' }, { status: 500 })
    }

    const ext = extensionForMime(file.type)
    const storagePath = `staff_users/${currentStaff.id}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, file, { upsert: true, contentType: file.type })

    if (uploadError) {
      console.error('[photo upload]', uploadError)
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
    }

    const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(storagePath)
    const publicUrl = urlData.publicUrl

    await updateWorkspaceProfile(currentStaff.id, { profile_photo_url: publicUrl })

    return NextResponse.json({ success: true, url: publicUrl })
  } catch (error) {
    console.error('[photo upload]', error)
    return NextResponse.json({ error: 'Failed to upload photo' }, { status: 500 })
  }
}
