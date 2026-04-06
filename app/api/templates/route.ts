import { NextResponse } from 'next/server'
import * as templateService from '@/lib/modules/templates/template.service'

export async function GET() {
  try {
    const templates = await templateService.fetchCustomTemplates()
    return NextResponse.json(templates)
  } catch (error) {
    console.error('Error loading templates:', error)
    return NextResponse.json({ error: 'Failed to load templates' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { error } = await templateService.createTemplate(body)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save template'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
