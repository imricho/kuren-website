import { describe, expect, it } from 'vitest'

import { ApiError } from '@/api/http'
import { useAppLocale } from '@/composables/useAppLocale'

import { translateApiError } from './apiErrors'

const { t, setLocale } = useAppLocale()
const pydantic = (details: { field: string; message: string }[]) => new ApiError(422, 'validation_error', 'Some fields are invalid.', details)

describe('translateApiError', () => {
  it('never shows raw Pydantic messages on register', () => {
    setLocale('en')
    const result = translateApiError(
      pydantic([
        { field: 'email', message: 'value is not a valid email address: An email address must have an @-sign.' },
        { field: 'password', message: 'String should have at least 8 characters' },
        { field: 'full_name', message: 'Value error, must not be blank' },
      ]),
      'register',
      t,
    )
    expect(result).toEqual({
      formError: null,
      fieldErrors: {
        email: 'Enter a valid email address, e.g. ayu@example.com.',
        password: 'Use at least 8 characters.',
        full_name: 'Enter your name.',
      },
    })
  })

  it('translates to Indonesian', () => {
    setLocale('id')
    try {
      const result = translateApiError(pydantic([{ field: 'password', message: 'String should have at most 128 characters' }]), 'register', t)
      expect(result.fieldErrors.password).toBe('Gunakan maksimal 128 karakter.')
      expect(translateApiError(new ApiError(401, 'invalid_credentials', 'Invalid email or password.'), 'login', t).formError).toBe(
        'Email atau kata sandi salah.',
      )
    } finally {
      setLocale('en')
    }
  })

  it('maps codes and statuses', () => {
    setLocale('en')
    expect(translateApiError(new ApiError(409, 'conflict', 'An account with this email already exists.'), 'register', t)).toEqual({
      formError: null,
      fieldErrors: { email: 'An account with this email already exists. Sign in instead.' },
    })
    expect(translateApiError(new ApiError(0, 'network_error', 'Unable to reach the server.'), 'login', t).formError).toMatch(/can’t reach/)
    expect(translateApiError(new ApiError(429, 'too_many_requests', 'Slow down'), 'login', t).formError).toMatch(/Too many attempts/)
    expect(translateApiError(new ApiError(401, 'not_authenticated', 'Authentication required.'), 'profile', t).formError).toMatch(/session/)
  })

  it('login password errors ask for the password, not a length', () => {
    setLocale('en')
    const result = translateApiError(pydantic([{ field: 'password', message: 'String should have at least 1 character' }]), 'login', t)
    expect(result.fieldErrors.password).toBe('Enter your password.')
  })

  it('falls back to a generic localized message', () => {
    setLocale('en')
    expect(translateApiError(new ApiError(500, 'internal_error', 'An unexpected error occurred.'), 'login', t).formError).toBe(
      'Something went wrong. Please try again.',
    )
    expect(translateApiError(new Error('boom'), 'register', t).formError).toBe('Something went wrong. Please try again.')
    // A field the form doesn't show becomes a form-level message.
    expect(translateApiError(pydantic([{ field: 'unexpected', message: 'Extra inputs are not permitted' }]), 'register', t)).toEqual({
      formError: 'Something went wrong. Please try again.',
      fieldErrors: {},
    })
  })
})
