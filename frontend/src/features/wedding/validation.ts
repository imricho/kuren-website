import { EVENT_TYPES, READABLE_CONTENT_VERSIONS, WEDDING_SCHEMA_VERSION, type ImageAsset, type WeddingContent } from './types'

const ISO_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

/**
 * Lightweight runtime check of the content model (TypeScript only protects
 * compile time). Returns a list of human-readable problems; empty means valid.
 * Intended for content coming from storage/APIs before it reaches a theme.
 */
export function validateWeddingContent(content: WeddingContent): string[] {
  const problems: string[] = []
  const required = (value: unknown, path: string) => {
    if (typeof value !== 'string' || value.trim() === '') problems.push(`${path} is required`)
  }
  const date = (value: unknown, path: string) => {
    if (typeof value !== 'string' || !ISO_DATE.test(value)) problems.push(`${path} must be YYYY-MM-DD`)
  }
  const instagram = (value: string | undefined, path: string) => {
    if (value === undefined) return
    if (!isInstagramUrl(value)) problems.push(`${path} must be an https instagram.com URL`)
  }
  const image = (value: ImageAsset | undefined, path: string) => {
    if (!value) return
    required(value.src, `${path}.src`)
    required(value.alt, `${path}.alt`)
  }

  // 1 = created before the invitation engine, 2 = invitation engine (docs/api/invitations.md).
  if (content.schemaVersion !== WEDDING_SCHEMA_VERSION && (content.schemaVersion as number) !== 2) problems.push('schemaVersion is not supported')

  if (content.contentVersion !== undefined && !(READABLE_CONTENT_VERSIONS as readonly string[]).includes(content.contentVersion)) problems.push('contentVersion is not supported')
  const toggle = (value: unknown, path: string) => {
    if (value !== undefined && typeof value !== 'boolean') problems.push(`${path} must be true or false`)
  }
  for (const key of ['holyRecite1', 'holyRecite2', 'greeting', 'countdown', 'wishes', 'amplopDigital'] as const) {
    const section = content[key]
    if (section) {
      if (typeof section.enabled !== 'boolean') problems.push(`${key}.enabled must be true or false`)
    }
  }
  // v2.0 sections (shape only; limits: features/invitation/validation).
  for (const key of ['profiles', 'milestone', 'organization', 'agenda', 'speakers'] as const) {
    const section = content[key]
    if (section && typeof section.enabled !== 'boolean') problems.push(`${key}.enabled must be true or false`)
  }
  for (const key of ['profiles', 'speakers'] as const) {
    const section = content[key]
    if (!section) continue
    if (!Array.isArray(section.people)) problems.push(`${key}.people must be a list`)
    else section.people.forEach((p, i) => {
      required(p.id, `${key}.people[${i}].id`)
      required(p.name, `${key}.people[${i}].name`)
      image(p.image, `${key}.people[${i}].image`)
    })
  }
  if (content.agenda) {
    if (!Array.isArray(content.agenda.items)) problems.push('agenda.items must be a list')
    else content.agenda.items.forEach((item, i) => {
      required(item.id, `agenda.items[${i}].id`)
      required(item.title, `agenda.items[${i}].title`)
      if (item.time !== undefined && !TIME.test(item.time)) problems.push(`agenda.items[${i}].time must be HH:mm`)
      if (item.endTime !== undefined && !TIME.test(item.endTime)) problems.push(`agenda.items[${i}].endTime must be HH:mm`)
    })
  }
  image(content.organization?.logo, 'organization.logo')
  toggle(content.story?.enabled, 'story.enabled')
  toggle(content.gallery?.enabled, 'gallery.enabled')
  for (const key of ['holyRecite1', 'holyRecite2'] as const) {
    const section = content[key]
    if (!section) continue
    for (const field of ['passage', 'reference', 'originalScript', 'translation'] as const) {
      if (section[field] !== undefined && typeof section[field] !== 'string') problems.push(`${key}.${field} must be text`)
    }
  }
  const gifts = content.amplopDigital
  if (gifts) {
    toggle(gifts.bankAccountsEnabled, 'amplopDigital.bankAccountsEnabled')
    toggle(gifts.qrisEnabled, 'amplopDigital.qrisEnabled')
    toggle(gifts.physicalGifts?.enabled, 'amplopDigital.physicalGifts.enabled')
    if (!Array.isArray(gifts.bankAccounts)) problems.push('amplopDigital.bankAccounts must be a list')
    else gifts.bankAccounts.forEach((account, i) => {
      if (typeof account.accountNumber !== 'string') problems.push(`amplopDigital.bankAccounts[${i}].accountNumber must be text`)
    })
    image(gifts.qrisImage, 'amplopDigital.qrisImage')
  }

  required(content.opening?.weddingTitle, 'opening.weddingTitle')
  required(content.opening?.coupleNames, 'opening.coupleNames')
  date(content.opening?.weddingDate, 'opening.weddingDate')
  image(content.opening?.coverImage, 'opening.coverImage')

  // Variants without a couple section (birthday, corporate, …) carry empty names.
  if (!content.sections || content.sections.includes('couple')) {
    required(content.couple?.groom?.name, 'couple.groom.name')
    required(content.couple?.bride?.name, 'couple.bride.name')
  }
  image(content.couple?.groom?.image, 'couple.groom.image')
  image(content.couple?.bride?.image, 'couple.bride.image')
  instagram(content.couple?.groom?.instagramUrl, 'couple.groom.instagramUrl')
  instagram(content.couple?.bride?.instagramUrl, 'couple.bride.instagramUrl')

  content.story?.timeline.forEach((entry, i) => {
    required(entry.title, `story.timeline[${i}].title`)
    required(entry.description, `story.timeline[${i}].description`)
    image(entry.image, `story.timeline[${i}].image`)
  })

  if (!Array.isArray(content.events) || content.events.length === 0) {
    problems.push('events must contain at least one event')
  } else {
    const ids = new Set<string>()
    content.events.forEach((event, i) => {
      const p = `events[${i}]`
      required(event.id, `${p}.id`)
      if (ids.has(event.id)) problems.push(`${p}.id must be unique`)
      ids.add(event.id)
      required(event.title, `${p}.title`)
      if (!EVENT_TYPES.includes(event.type)) problems.push(`${p}.type is not a known event type`)
      date(event.date, `${p}.date`)
      if (!TIME.test(event.startTime ?? '')) problems.push(`${p}.startTime must be HH:mm`)
      if (event.endTime !== undefined && !TIME.test(event.endTime)) problems.push(`${p}.endTime must be HH:mm`)
      required(event.venueName, `${p}.venueName`)
      required(event.address, `${p}.address`)
    })
  }

  content.gallery?.images.forEach((img, i) => image(img, `gallery.images[${i}]`))

  required(content.rsvp?.title, 'rsvp.title')
  if (typeof content.rsvp?.enabled !== 'boolean') problems.push('rsvp.enabled must be true or false')
  if (content.rsvp?.deadline !== undefined) date(content.rsvp.deadline, 'rsvp.deadline')
  const maxGuests = content.rsvp?.maxGuestsPerResponse
  if (maxGuests !== undefined && !isGuestCount(maxGuests)) problems.push('rsvp.maxGuestsPerResponse must be a whole number from 1 to 20')
  const capacity = content.rsvp?.capacity
  if (capacity !== undefined && !(Number.isInteger(capacity) && capacity >= 1 && capacity <= 100000)) problems.push('rsvp.capacity must be a whole number from 1 to 100000')

  required(content.closing?.message, 'closing.message')
  image(content.closing?.image, 'closing.image')

  return problems
}

/** https URL on instagram.com or www.instagram.com (≤2048 chars). */
export function isInstagramUrl(value: string): boolean {
  if (value.length > 2048) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && (url.hostname === 'instagram.com' || url.hostname === 'www.instagram.com')
  } catch {
    return false
  }
}

/** Whole number of guests per RSVP response, 1–20. */
export function isGuestCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 20
}
