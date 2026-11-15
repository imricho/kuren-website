/**
 * Live drafts: in-progress edits overlaid on the SAVED wedding content, so the
 * live preview can render what the couple is typing before it is saved.
 *
 * Each working copy (a section form, an item editor, the new-item form)
 * publishes the payload it would send to the API as one or more `LivePatch`es.
 * `applyLivePatches` overlays them on the saved draft with shallow copies only
 * along the changed path (structural sharing): untouched sections keep their
 * object identity, and nothing is deep-cloned.
 */
import type {
  CollectionItems,
  CollectionName,
  NewItem,
  SectionName,
  SectionPayloads,
  WeddingDraft,
} from '@/features/wedding/draft'
import type { WeddingLocale } from '@/features/wedding/types'

/** Id given to a not-yet-created item while it is shown in the preview. */
export const NEW_ITEM_PREVIEW_ID = '__new__'

export type SectionPatch = { [S in SectionName]: { kind: 'section'; section: S; value: SectionPayloads[S] } }[SectionName]
export type ItemPatch = {
  [C in CollectionName]: {
    kind: 'item'
    collection: C
    /** Existing item id, or null for the new-item form (appended if it has content). */
    itemId: string | null
    value: NewItem<C>
  }
}[CollectionName]
/** The couple's names as edited on the Opening page (only `name` changes). */
export interface NamesPatch {
  kind: 'names'
  groom: string
  bride: string
}
export interface LocalePatch {
  kind: 'locale'
  locale: WeddingLocale
}
export type LivePatch = SectionPatch | ItemPatch | NamesPatch | LocalePatch

function getList<C extends CollectionName>(d: WeddingDraft, collection: C): CollectionItems[C][] {
  if (collection === 'stories') return d.story.timeline as CollectionItems[C][]
  if (collection === 'events') return d.events as CollectionItems[C][]
  return d.gallery.images as CollectionItems[C][]
}

function withList<C extends CollectionName>(d: WeddingDraft, collection: C, items: CollectionItems[C][]): WeddingDraft {
  if (collection === 'stories') return { ...d, story: { ...d.story, timeline: items as CollectionItems['stories'][] } }
  if (collection === 'events') return { ...d, events: items as CollectionItems['events'][] }
  return { ...d, gallery: { ...d.gallery, images: items as CollectionItems['gallery'][] } }
}

/** A new item is shown only once it has something to render (an event type alone is not enough). */
function hasContent(value: object): boolean {
  return Object.entries(value).some(([key, v]) => key !== 'type' && v !== undefined && v !== '')
}

export function applyLivePatch(d: WeddingDraft, patch: LivePatch): WeddingDraft {
  switch (patch.kind) {
    case 'locale':
      return d.locale === patch.locale ? d : { ...d, locale: patch.locale }
    case 'names':
      return {
        ...d,
        couple: {
          groom: { ...d.couple.groom, name: patch.groom || undefined },
          bride: { ...d.couple.bride, name: patch.bride || undefined },
        },
      }
    case 'section':
      switch (patch.section) {
        case 'story':
          return { ...d, story: { ...patch.value, timeline: d.story.timeline } }
        case 'gallery':
          return { ...d, gallery: { ...patch.value, images: d.gallery.images } }
        case 'couple':
          return { ...d, couple: { groom: patch.value.groom, bride: patch.value.bride } }
        case 'rsvp':
          return { ...d, rsvp: { ...patch.value, enabled: patch.value.enabled ?? true } }
        default:
          return { ...d, [patch.section]: patch.value }
      }
    case 'item': {
      const list = getList(d, patch.collection) as { id: string }[]
      if (patch.itemId === null) {
        if (!hasContent(patch.value)) return d
        return withList(d, patch.collection, [...list, { ...patch.value, id: NEW_ITEM_PREVIEW_ID }] as never[])
      }
      const index = list.findIndex((item) => item.id === patch.itemId)
      if (index < 0) return d // deleted meanwhile
      const next = list.slice()
      next[index] = { ...patch.value, id: patch.itemId }
      return withList(d, patch.collection, next as never[])
    }
  }
}

/** Saved draft overlaid with every live patch, in publishing order. Returns `saved` itself when there are none. */
export function applyLivePatches(saved: WeddingDraft, drafts: Iterable<readonly LivePatch[]>): WeddingDraft {
  let d = saved
  for (const patches of drafts) for (const patch of patches) d = applyLivePatch(d, patch)
  return d
}
