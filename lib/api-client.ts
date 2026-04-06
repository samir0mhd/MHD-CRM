import { supabase } from '@/lib/supabase'

type ApiError = {
  code?: string
  message: string
}

type MutationFilter = {
  column: string
  op?: 'eq' | 'in'
  value: unknown
}

type MutationRequest = {
  table: string
  action: 'insert' | 'update' | 'delete' | 'upsert'
  values?: unknown
  filters?: MutationFilter[]
  options?: Record<string, unknown>
  select?: string
  returning?: 'none' | 'many' | 'single' | 'maybeSingle'
}

function asMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Request failed'
}

function resolveApiUrl(path: string) {
  if (typeof window !== 'undefined') return path

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    'http://localhost:3000'

  return new URL(path, baseUrl).toString()
}

async function withAuthHeaders(headers?: HeadersInit) {
  const nextHeaders = new Headers(headers)
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

  if (token) {
    nextHeaders.set('Authorization', `Bearer ${token}`)
  }

  return nextHeaders
}

async function postJson<T>(url: string, body: unknown, headers?: HeadersInit) {
  const nextHeaders = await withAuthHeaders(headers)
  nextHeaders.set('Content-Type', 'application/json')
  const requestUrl = resolveApiUrl(url)

  const response = await fetch(requestUrl, {
    method: 'POST',
    headers: nextHeaders,
    body: JSON.stringify(body),
  })

  const json = await response.json().catch(() => ({}))
  return { response, json: json as T }
}

export async function dbMutate<T = unknown>(request: MutationRequest): Promise<{ data: T | null; error: ApiError | null }> {
  try {
    const { response, json } = await postJson<{ data?: T | null; error?: { code?: string; message?: string } | string }>('/api/db/mutate', request)

    if (!response.ok) {
      if (typeof json.error === 'string') {
        return { data: null, error: { message: json.error || `Request failed (${response.status})` } }
      }
      return {
        data: null,
        error: {
          code: json.error?.code,
          message: json.error?.message || `Request failed (${response.status})`,
        },
      }
    }

    return { data: (json.data ?? null) as T | null, error: null }
  } catch (error) {
    return { data: null, error: { message: asMessage(error) } }
  }
}

export async function dbRpc<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<{ data: T | null; error: ApiError | null }> {
  try {
    const { response, json } = await postJson<{ data?: T | null; error?: { code?: string; message?: string } | string }>('/api/db/rpc', { fn, args })

    if (!response.ok) {
      if (typeof json.error === 'string') {
        return { data: null, error: { message: json.error || `Request failed (${response.status})` } }
      }
      return {
        data: null,
        error: {
          code: json.error?.code,
          message: json.error?.message || `Request failed (${response.status})`,
        },
      }
    }

    return { data: (json.data ?? null) as T | null, error: null }
  } catch (error) {
    return { data: null, error: { message: asMessage(error) } }
  }
}

// Authenticated fetch — identical signature to window.fetch but attaches the
// current session's Bearer token. Use this in client components whenever
// calling an API route that uses getAccessContext() server-side.
export async function authedFetch(input: string, init?: RequestInit): Promise<Response> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const headers = new Headers(init?.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return fetch(input, { ...init, headers })
}
