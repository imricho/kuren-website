/**
 * Content types added by the invitation engine (contract v2.0 §2): the new
 * sections (profiles, milestone, organization, agenda, speakers) and the
 * backward-compatible RSVP / session extensions. Stored as camelCase keys inside
 * `universal_content`. Re-exported from `features/wedding/types` so existing
 * imports keep working.
 *
 * Draft and preview (render) shapes are the same for these sections: every field
 * except `enabled` and list ids is optional, and `toPreviewContent` trims/drops
 * what cannot be rendered.
 */
import type { ImageAsset } from '../wedding/types'

import type { ProfileRole, RegistrationFieldType, RsvpContactMode } from './registry'

export type { ProfileRole, RegistrationFieldType, RsvpContactMode } from './registry'

export const INVITATION_CONTENT_VERSION = '2.0' as const
/** Content versions the client can read; writes use INVITATION_CONTENT_VERSION. */
export const READABLE_CONTENT_VERSIONS = ['1.1', '1.2', '2.0'] as const
export type ContentVersion = (typeof READABLE_CONTENT_VERSIONS)[number]

export interface ProfilePerson {
  id: string
  role: ProfileRole
  name: string
  nickname?: string
  image?: ImageAsset
  description?: string
  parents?: string
  /** YYYY-MM-DD */
  birthDate?: string
}

export interface ProfilesSection {
  enabled: boolean
  title?: string
  people: ProfilePerson[]
}

export interface MilestoneSection {
  enabled: boolean
  title?: string
  /** birthday / sweet_17 (1..150) */
  age?: number
  /** anniversary (1..100) */
  years?: number
  /** religious_celebration, e.g. "Idul Fitri 1448 H" */
  occasion?: string
  institution?: string
  program?: string
  degree?: string
  partyTheme?: string
  description?: string
}

export interface OrganizationSection {
  enabled: boolean
  name?: string
  tagline?: string
  description?: string
  logo?: ImageAsset
  /** https only */
  websiteUrl?: string
}

export interface AgendaItem {
  id: string
  /** HH:MM */
  time?: string
  /** HH:MM */
  endTime?: string
  title: string
  description?: string
  /** Session (`events[].id`) this item belongs to. */
  sessionId?: string
  speakerIds?: string[]
}

export interface AgendaSection {
  enabled: boolean
  title?: string
  items: AgendaItem[]
}

export interface Speaker {
  id: string
  name: string
  role?: string
  organization?: string
  image?: ImageAsset
  bio?: string
}

export interface SpeakersSection {
  enabled: boolean
  title?: string
  people: Speaker[]
}

/** The v2.0 sections, keyed as stored in content. */
export interface InvitationSections {
  profiles?: ProfilesSection
  milestone?: MilestoneSection
  organization?: OrganizationSection
  agenda?: AgendaSection
  speakers?: SpeakersSection
}

// --- Extensions of existing sections --------------------------------------------------

export interface RegistrationField {
  id: string
  /** ≤ 80 */
  label: string
  type: RegistrationFieldType
  required: boolean
  /** `select` only: ≤ 20 options, each ≤ 80. */
  options?: string[]
}

/** Optional RSVP settings added in v2.0 (`maxGuestsPerResponse` already existed). */
export interface RsvpExtensions {
  /** Total attending people, 1..100000. */
  capacity?: number
  collectContact?: RsvpContactMode
  allowSessionChoice?: boolean
  registrationFields?: RegistrationField[]
  /** Public snapshot only: capacity set and reached. Never stored by the editor. */
  full?: boolean
}
