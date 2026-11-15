import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError, parseRevisionEtag, request, requestWithHeaders } from './http'

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

  it('exposes response headers and sends extra request headers', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"ok":true}', { status: 200, headers: { 'Content-Type': 'application/json', ETag: '"4"' } }),
    )
    const res = await requestWithHeaders('/thing', { method: 'PUT', body: {}, headers: { 'If-Match': '"3"' } })
    expect(res.data).toEqual({ ok: true })
    expect(res.headers.get('ETag')).toBe('"4"')
    expect(fetchSpy.mock.calls[0]![1]!.headers).toEqual({ 'If-Match': '"3"', 'Content-Type': 'application/json' })
  })

  it('keeps non-list error details (409 edit_conflict currentRevision)', async () => {
    mockFetch(409, { error: { code: 'edit_conflict', message: 'Edited elsewhere', details: { currentRevision: 9 } } })
    const err = (await request('/thing', { method: 'PUT' }).catch((e: unknown) => e)) as ApiError
    expect(err.fieldErrors).toEqual([])
    expect(err.conflictRevision).toBe(9)
    expect(err.isNetworkError).toBe(false)
  })
})

describe('parseRevisionEtag', () => {
  it('accepts strong, weak and bare revisions', () => {
    expect(parseRevisionEtag('"12"')).toBe(12)
    expect(parseRevisionEtag('W/"3"')).toBe(3)
    expect(parseRevisionEtag('7')).toBe(7)
    expect(parseRevisionEtag(null)).toBeNull()
    expect(parseRevisionEtag('"abc"')).toBeNull()
  })
})
