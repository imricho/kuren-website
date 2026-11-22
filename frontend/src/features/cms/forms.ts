/**
 * Form state for the CMS editors. Inputs bind to plain strings ('' = not set);
 * `to*Payload` converts back to the API shape, trimming and omitting empty values
 * (the API treats empty strings as "not set" anyway).
 */
import type {
  ClosingDraft,
  CoupleDraft,
  EventDraft,
  FocalPoint,
  GalleryItemDraft,
  GalleryMetaDraft,
  NewItem,
  OpeningDraft,
  PersonDraft,
  RsvpDraft,
  StoryEntryDraft,
  StoryMetaDraft,
} from '@/features/wedding/draft'
import type { EventType, ImageAsset, RegistrationFieldType, RsvpContactMode, WeddingLocale } from '@/features/wedding/types'

export interface ImageForm {
  src: string
  alt: string
  focalPoint: FocalPoint | null
}

export const s = (value: string | undefined | null): string => value ?? ''
export const opt = (value: string): string | undefined => {
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}
/** Remove undefined keys (so payloads never send `key: undefined`). */
export function clean<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T
}

export function imageForm(image: ImageAsset | undefined): ImageForm {
  return { src: s(image?.src), alt: s(image?.alt), focalPoint: image?.focalPoint ? { ...image.focalPoint } : null }
}
export function imagePayload(form: ImageForm): ImageAsset | undefined {
  const src = opt(form.src)
  if (!src) return undefined
  return clean({ src, alt: form.alt.trim(), focalPoint: form.focalPoint ? { ...form.focalPoint } : undefined })
}

// --- Opening (also edits the couple's names) -----------------------------------
export interface OpeningForm {
  groomName: string
  brideName: string
  weddingTitle: string
  weddingDate: string
  coupleNames: string
  headline: string
  introduction: string
  coverImage: ImageForm
  locale: WeddingLocale
  /** "Kepada Yth." line before the guest name from the link's ?to= parameter. */
  guestGreetingEnabled: boolean
  guestGreetingLabel: string
}
export function openingForm(o: OpeningDraft, couple: CoupleDraft, locale: WeddingLocale): OpeningForm {
  return {
    groomName: s(couple.groom.name),
    brideName: s(couple.bride.name),
    weddingTitle: s(o.weddingTitle),
    weddingDate: s(o.weddingDate),
    coupleNames: s(o.coupleNames),
    headline: s(o.headline),
    introduction: s(o.introduction),
    coverImage: imageForm(o.coverImage),
    locale,
    guestGreetingEnabled: o.guestGreeting?.enabled === true,
    guestGreetingLabel: s(o.guestGreeting?.label),
  }
}
/** Guest greeting payload: omitted while it was never used (off and no label); kept (data) when switched off. */
export function guestGreetingPayload(f: Pick<OpeningForm, 'guestGreetingEnabled' | 'guestGreetingLabel'>) {
  const label = opt(f.guestGreetingLabel)
  return f.guestGreetingEnabled || label ? clean({ enabled: f.guestGreetingEnabled, label }) : undefined
}
export function openingPayload(f: OpeningForm): OpeningDraft {
  return clean({
    weddingTitle: opt(f.weddingTitle),
    coupleNames: opt(f.coupleNames),
    headline: opt(f.headline),
    introduction: opt(f.introduction),
    coverImage: imagePayload(f.coverImage),
    weddingDate: opt(f.weddingDate),
    guestGreeting: guestGreetingPayload(f),
  })
}

// --- Couple ----------------------------------------------------------------------
export interface PersonForm {
  name: string
  nickname: string
  description: string
  parents: string
  instagramUrl: string
  image: ImageForm
}
export interface CoupleForm {
  groom: PersonForm
  bride: PersonForm
  /** Only switchable where the variant offers the couple as optional (anniversary). */
  enabled: boolean
}
const personForm = (p: PersonDraft): PersonForm => ({
  name: s(p.name),
  nickname: s(p.nickname),
  description: s(p.description),
  parents: s(p.parents),
  instagramUrl: s(p.instagramUrl),
  image: imageForm(p.image),
})
const personPayload = (p: PersonForm): PersonDraft =>
  clean({
    name: opt(p.name),
    nickname: opt(p.nickname),
    image: imagePayload(p.image),
    description: opt(p.description),
    parents: opt(p.parents),
    instagramUrl: opt(p.instagramUrl),
  })
export const coupleForm = (c: CoupleDraft): CoupleForm => ({ groom: personForm(c.groom), bride: personForm(c.bride), enabled: c.enabled !== false })
/** `enabled` is sent only to hide the couple (absent = shown, the backend default). */
export const couplePayload = (c: CoupleForm): CoupleDraft =>
  clean({ groom: personPayload(c.groom), bride: personPayload(c.bride), enabled: c.enabled ? undefined : false })

// --- Story -------------------------------------------------------------------------
export interface StoryMetaForm {
  title: string
  introduction: string
  /** "Show on website" (default on). */
  enabled: boolean
}
export const storyMetaForm = (m: StoryMetaDraft): StoryMetaForm => ({
  title: s(m.title),
  introduction: s(m.introduction),
  enabled: m.enabled !== false,
})
export const storyMetaPayload = (m: StoryMetaForm): StoryMetaDraft =>
  clean({ title: opt(m.title), introduction: opt(m.introduction), enabled: m.enabled })

export interface StoryEntryForm {
  title: string
  date: string
  description: string
  image: ImageForm
}
export const storyEntryForm = (e?: Partial<StoryEntryDraft>): StoryEntryForm => ({
  title: s(e?.title),
  date: s(e?.date),
  description: s(e?.description),
  image: imageForm(e?.image),
})
export const storyEntryPayload = (e: StoryEntryForm): NewItem<'stories'> =>
  clean({ title: opt(e.title), date: opt(e.date), description: opt(e.description), image: imagePayload(e.image) })

// --- Events ------------------------------------------------------------------------
export interface EventForm {
  type: EventType
  title: string
  date: string
  startTime: string
  endTime: string
  venueName: string
  address: string
  mapsUrl: string
  description: string
  dressCodeEnabled: boolean
  dressCodeText: string
  livestreamEnabled: boolean
  livestreamUrl: string
  livestreamLabel: string
  /** A session guests may choose to attend (corporate variants). */
  optional: boolean
  /** How guests attend: in person (default), online, or both. */
  format: 'in_person' | 'online' | 'hybrid'
  onlineUrl: string
  onlineLabel: string
  onlineInstructions: string
  /** Last day of a multi-day session (optional). */
  endDate: string
}
/** Type of a new custom event (most Indonesian weddings have a reception). */
export const DEFAULT_EVENT_TYPE: EventType = 'reception'
export const eventForm = (e?: Partial<EventDraft>): EventForm => ({
  type: e?.type ?? DEFAULT_EVENT_TYPE,
  title: s(e?.title),
  date: s(e?.date),
  startTime: s(e?.startTime),
  endTime: s(e?.endTime),
  venueName: s(e?.venueName),
  address: s(e?.address),
  mapsUrl: s(e?.mapsUrl),
  description: s(e?.description),
  dressCodeEnabled: e?.dressCode?.enabled === true,
  dressCodeText: s(e?.dressCode?.text),
  livestreamEnabled: e?.livestream?.enabled === true,
  livestreamUrl: s(e?.livestream?.url),
  livestreamLabel: s(e?.livestream?.label),
  optional: e?.optional === true,
  format: e?.format === 'online' || e?.format === 'hybrid' ? e.format : 'in_person',
  onlineUrl: s(e?.onlineUrl),
  onlineLabel: s(e?.onlineLabel),
  onlineInstructions: s(e?.onlineInstructions),
  endDate: s(e?.endDate),
})
export const eventPayload = (e: EventForm): NewItem<'events'> =>
  clean({
    type: e.type,
    title: opt(e.title),
    date: opt(e.date),
    startTime: opt(e.startTime),
    endTime: opt(e.endTime),
    venueName: opt(e.venueName),
    address: opt(e.address),
    mapsUrl: opt(e.mapsUrl),
    description: opt(e.description),
    // Each extra has its own switch; its details are kept while it is off.
    dressCode:
      e.dressCodeEnabled || opt(e.dressCodeText) ? clean({ enabled: e.dressCodeEnabled, text: opt(e.dressCodeText) }) : undefined,
    livestream:
      e.livestreamEnabled || opt(e.livestreamUrl) || opt(e.livestreamLabel)
        ? clean({ enabled: e.livestreamEnabled, url: opt(e.livestreamUrl), label: opt(e.livestreamLabel) })
        : undefined,
    optional: e.optional ? true : undefined,
    // In person is the default and is not stored; online details are kept while in person.
    format: e.format === 'in_person' ? undefined : e.format,
    onlineUrl: opt(e.onlineUrl),
    onlineLabel: opt(e.onlineLabel),
    onlineInstructions: opt(e.onlineInstructions),
    endDate: opt(e.endDate),
  })

// --- Gallery -----------------------------------------------------------------------
export interface GalleryMetaForm {
  title: string
  description: string
  /** "Show on website" (default on). */
  enabled: boolean
}
export const galleryMetaForm = (m: GalleryMetaDraft): GalleryMetaForm => ({
  title: s(m.title),
  description: s(m.description),
  enabled: m.enabled !== false,
})
export const galleryMetaPayload = (m: GalleryMetaForm): GalleryMetaDraft =>
  clean({ title: opt(m.title), description: opt(m.description), enabled: m.enabled })

export interface GalleryItemForm {
  image: ImageForm
  caption: string
}
export const galleryItemForm = (g?: Partial<GalleryItemDraft>): GalleryItemForm => ({
  image: { src: s(g?.src), alt: s(g?.alt), focalPoint: g?.focalPoint ? { ...g.focalPoint } : null },
  caption: s(g?.caption),
})
export const galleryItemPayload = (g: GalleryItemForm): NewItem<'gallery'> =>
  clean({
    src: g.image.src.trim(),
    alt: g.image.alt.trim(),
    caption: opt(g.caption),
    focalPoint: g.image.focalPoint ? { ...g.image.focalPoint } : undefined,
  })

// --- RSVP ----------------------------------------------------------------------------
export interface RsvpForm {
  enabled: boolean
  title: string
  introduction: string
  deadline: string
  confirmationMessage: string
  /** Kept as text so a half-typed value can be shown and validated. */
  maxGuestsPerResponse: string
  /** v2.0: total attending people (text, '' = no limit). */
  capacity: string
  collectContact: RsvpContactMode
  allowSessionChoice: boolean
  registrationFields: RegistrationFieldForm[]
}
export interface RegistrationFieldForm {
  id: string
  label: string
  type: RegistrationFieldType
  required: boolean
  /** Select options, one input each ('' rows are dropped). */
  options: string[]
}
export const rsvpForm = (r: RsvpDraft): RsvpForm => ({
  enabled: r.enabled !== false,
  title: s(r.title),
  introduction: s(r.introduction),
  deadline: s(r.deadline),
  confirmationMessage: s(r.confirmationMessage),
  maxGuestsPerResponse: r.maxGuestsPerResponse === undefined ? '' : String(r.maxGuestsPerResponse),
  capacity: r.capacity === undefined ? '' : String(r.capacity),
  collectContact: r.collectContact ?? 'none',
  allowSessionChoice: r.allowSessionChoice === true,
  registrationFields: (r.registrationFields ?? []).map((f) => ({
    id: f.id,
    label: s(f.label),
    type: f.type,
    required: f.required === true,
    options: [...(f.options ?? [])],
  })),
})
export const rsvpPayload = (r: RsvpForm): RsvpDraft => {
  const max = String(r.maxGuestsPerResponse).trim()
  return clean({
    title: opt(r.title),
    introduction: opt(r.introduction),
    enabled: r.enabled,
    deadline: opt(r.deadline),
    confirmationMessage: opt(r.confirmationMessage),
    maxGuestsPerResponse: max === '' ? undefined : Number(max),
    capacity: r.capacity.trim() === '' ? undefined : Number(r.capacity.trim()),
    collectContact: r.collectContact === 'none' ? undefined : r.collectContact,
    allowSessionChoice: r.allowSessionChoice ? true : undefined,
    registrationFields: r.registrationFields.length
      ? r.registrationFields.map((f) =>
          clean({
            id: f.id,
            label: f.label.trim(),
            type: f.type,
            required: f.required,
            options: f.type === 'select' ? f.options.map((o) => o.trim()).filter(Boolean) : undefined,
          }),
        )
      : undefined,
  })
}

// --- Closing -------------------------------------------------------------------------
export interface ClosingForm {
  message: string
  thankYou: string
  image: ImageForm
  /** "Turut mengundang" names; line breaks kept. */
  familyAcknowledgments: string
}
export const closingForm = (c: ClosingDraft): ClosingForm => ({
  message: s(c.message),
  thankYou: s(c.thankYou),
  image: imageForm(c.image),
  familyAcknowledgments: s(c.familyAcknowledgments),
})
export const closingPayload = (c: ClosingForm): ClosingDraft =>
  clean({
    message: opt(c.message),
    thankYou: opt(c.thankYou),
    image: imagePayload(c.image),
    familyAcknowledgments: opt(c.familyAcknowledgments),
  })
