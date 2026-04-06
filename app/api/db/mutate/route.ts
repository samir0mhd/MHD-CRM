import { NextResponse } from 'next/server'
import { createRouteSupabaseClient } from '@/lib/supabase-route'

type MutationFilter = {
  column: string
  op?: 'eq' | 'in'
  value: unknown
}

type MutationRequest = {
  table?: string
  action?: 'insert' | 'update' | 'delete' | 'upsert'
  values?: unknown
  filters?: MutationFilter[]
  options?: Record<string, unknown>
  select?: string
  returning?: 'none' | 'many' | 'single' | 'maybeSingle'
}

type MutationQuery = ReturnType<ReturnType<typeof createRouteSupabaseClient>['from']>

function applyFilters(query: MutationQuery, filters: MutationFilter[] = []) {
  return filters.reduce<MutationQuery>((activeQuery, filter) => {
    if (filter.op === 'in') {
      return activeQuery.in(filter.column, Array.isArray(filter.value) ? filter.value : [])
    }

    return activeQuery.eq(filter.column, filter.value)
  }, query)
}

export async function POST(request: Request) {
  const body = (await request.json()) as MutationRequest
  const { table, action, values, filters = [], options = {}, select, returning = 'none' } = body

  if (!table || !action) {
    return NextResponse.json({ error: { message: 'table and action are required' } }, { status: 400 })
  }

  const supabase = createRouteSupabaseClient(request)
  let query: MutationQuery

  if (action === 'insert') {
    query = supabase.from(table).insert(values as never, options)
  } else if (action === 'update') {
    query = supabase.from(table).update(values as never, options)
  } else if (action === 'delete') {
    query = supabase.from(table).delete(options)
  } else if (action === 'upsert') {
    query = supabase.from(table).upsert(values as never, options)
  } else {
    return NextResponse.json({ error: { message: 'Unsupported action' } }, { status: 400 })
  }

  query = applyFilters(query, filters)

  if (select) {
    query = query.select(select)
  }

  if (returning === 'single') {
    query = query.single()
  } else if (returning === 'maybeSingle') {
    query = query.maybeSingle()
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: 400 })
  }

  return NextResponse.json({ data: data ?? null })
}
