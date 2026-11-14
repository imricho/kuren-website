import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError, request } from './http'

function mockFetch(status: number, body?: unknown) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

describe('request', () => {
  afterEach(() => vi.restoreAllMocks())

  it('sends JSON to the versioned API and parses the response', async () => {
    const fetchSpy = mockFetch(200, { ok: true })
    await expect(request('/thing', { method: 'POST', body: { a: 1 } })).resolves.toEqual({ ok: true })
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/v1/thing',
      expect.objectContaining({ method: 'POST', body: '{"a":1}', credentials: 'same-origin' }),
    )
  })

  it('maps the API error shape including field errors', async () => {
    mockFetch(422, {
      error: { code: 'validation_error', message: 'Some fields are invalid.', details: [{ field: 'email', message: 'bad' }] },
    })
    const err = await request('/thing').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 422, code: 'validation_error', fieldErrors: [{ field: 'email', message: 'bad' }] })
  })

  it('returns undefined for 204 responses', async () => {
    mockFetch(204)
    await expect(request('/thing', { method: 'POST' })).resolves.toBeUndefined()
  })

  it('reports network failures as ApiError', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(request('/thing')).rejects.toMatchObject({ code: 'network_error', status: 0 })
  })
})
