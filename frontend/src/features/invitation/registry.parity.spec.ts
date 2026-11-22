/**
 * The frontend registry is a typed mirror of backend/app/core/invitation_registry.json
 * (the single source of truth). Fail on ANY drift: ids, labels, sections (order,
 * required, defaultEnabled, roles, fields, defaults), session presets, RSVP
 * defaults and template compatibility.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { EVENT_TYPES } from '@/features/wedding/types'

import {
  CATEGORIES,
  DEFAULT_TIMEZONE,
  LEGACY_TEMPLATE_COMPATIBILITY,
  MILESTONE_FIELDS,
  PROFILE_ROLES,
  SECTION_ORDER,
  TEMPLATES,
  VARIANTS,
} from './registry'

// frontend/src/features/invitation → repo root → backend/app/core
const backendRegistry = resolve(__dirname, '../../../../backend/app/core/invitation_registry.json')
const backendThemes = resolve(__dirname, '../../../../backend/app/core/selectable_theme_ids.json')

interface JsonSection {
  id: string
  required?: boolean
  defaultEnabled: boolean
  roles?: string[]
  fields?: string[]
  defaults?: Record<string, unknown>
}
interface JsonRegistry {
  defaultTimezone: string
  sectionOrder: string[]
  sessionTypes: string[]
  profileRoles: string[]
  milestoneFields: string[]
  categories: { id: string; label: { en: string; id: string }; variants: string[] }[]
  variants: {
    id: string
    category: string
    label: { en: string; id: string }
    sections: JsonSection[]
    sessionPresets: { type: string; title: { en: string; id: string } }[]
    rsvpDefaults: Record<string, unknown>
  }[]
  templates: { id: string; categories: string[]; variants?: string[] }[]
  legacyTemplates: { categories: string[]; variants?: string[] }
}

/** Normalise a section to the frontend shape (absent `required` = false, absent lists omitted). */
const section = (s: JsonSection) => ({
  id: s.id,
  required: s.required === true,
  defaultEnabled: s.defaultEnabled,
  ...(s.roles ? { roles: s.roles } : {}),
  ...(s.fields ? { fields: s.fields } : {}),
  ...(s.defaults ? { defaults: s.defaults } : {}),
})
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

describe.skipIf(!existsSync(backendRegistry))(
  'invitation registry parity with backend/app/core/invitation_registry.json (skipped when the backend folder is not accessible, e.g. in the frontend container)',
  () => {
    const json = (): JsonRegistry => JSON.parse(readFileSync(backendRegistry, 'utf8')) as JsonRegistry

    it('has the same constants: section order, session types, profile roles, milestone fields, default timezone', () => {
      const r = json()
      expect([...SECTION_ORDER]).toEqual(r.sectionOrder)
      expect([...EVENT_TYPES]).toEqual(r.sessionTypes)
      expect([...PROFILE_ROLES]).toEqual(r.profileRoles)
      expect([...MILESTONE_FIELDS]).toEqual(r.milestoneFields)
      expect(DEFAULT_TIMEZONE).toBe(r.defaultTimezone)
    })

    it('has the same categories (ids, labels, variant lists) in the same order', () => {
      expect(plain(CATEGORIES)).toEqual(json().categories)
    })

    it('has the same variants: ids, categories, labels, sections, session presets and RSVP defaults', () => {
      const backend = json().variants
      expect(VARIANTS.map((v) => v.id)).toEqual(backend.map((v) => v.id))
      for (const b of backend) {
        const f = VARIANTS.find((v) => v.id === b.id)!
        expect({ id: f.id, category: f.category, label: f.label }, b.id).toEqual({ id: b.id, category: b.category, label: b.label })
        expect(plain(f.sections), `${b.id} sections`).toEqual(b.sections.map(section))
        expect(plain(f.sessionPresets), `${b.id} sessionPresets`).toEqual(b.sessionPresets)
        expect(plain(f.rsvpDefaults), `${b.id} rsvpDefaults`).toEqual(b.rsvpDefaults)
      }
    })

    it('has the same template compatibility (temuvibe templates and the legacy rule)', () => {
      const r = json()
      expect(plain(TEMPLATES)).toEqual(r.templates)
      expect(plain(LEGACY_TEMPLATE_COMPATIBILITY)).toEqual({ categories: r.legacyTemplates.categories, variants: r.legacyTemplates.variants })
    })

    it.skipIf(!existsSync(backendThemes))('lists every temuvibe template in the backend selectable theme list', () => {
      const selectable = JSON.parse(readFileSync(backendThemes, 'utf8')) as string[]
      for (const t of TEMPLATES) expect(selectable, t.id).toContain(t.id)
    })
  },
)
