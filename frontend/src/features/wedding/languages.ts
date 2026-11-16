/**
 * Languages offered for scripture text blocks (stored as BCP 47 codes, used as `lang=`
 * so screen readers pick the right voice). Names are shown in their own language.
 */
export const LANG_TAG = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/

export const SCRIPTURE_LANGUAGES: readonly { code: string; name: string }[] = [
  { code: 'ar', name: 'العربية (Arabic)' },
  { code: 'id', name: 'Bahasa Indonesia' },
  { code: 'en', name: 'English' },
  { code: 'he', name: 'עברית (Hebrew)' },
  { code: 'el', name: 'Ελληνικά (Greek)' },
  { code: 'la', name: 'Latina (Latin)' },
  { code: 'sa', name: 'संस्कृतम् (Sanskrit)' },
  { code: 'pi', name: 'Pāli' },
  { code: 'hi', name: 'हिन्दी (Hindi)' },
  { code: 'zh', name: '中文 (Chinese)' },
  { code: 'jv', name: 'Basa Jawa (Javanese)' },
  { code: 'su', name: 'Basa Sunda (Sundanese)' },
  { code: 'ban', name: 'Basa Bali (Balinese)' },
]

/** A valid language code, or undefined (never a broken `lang` attribute). */
export function langOrUndefined(value: string | undefined): string | undefined {
  const v = value?.trim()
  return v && LANG_TAG.test(v) ? v : undefined
}
