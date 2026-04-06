import { NextResponse } from 'next/server'
import { createRouteSupabaseClient } from '@/lib/supabase-route'

type RpcRequest = {
  fn?: string
  args?: Record<string, unknown>
}

export async function POST(request: Request) {
  const body = (await request.json()) as RpcRequest

  if (!body.fn) {
    return NextResponse.json({ error: { message: 'fn is required' } }, { status: 400 })
  }

  const supabase = createRouteSupabaseClient(request)
  const { data, error } = await supabase.rpc(body.fn, body.args)

  if (error) {
    return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: 400 })
  }

  return NextResponse.json({ data: data ?? null })
}
