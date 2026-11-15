/** Indonesian counterpart of ../en/editor.ts. Must have exactly the same keys. */
import type { EditorMessageKey } from '../en/editor'

export const editorId = {
  previewNotices: 'Tentang pratinjau ini',
  // Lists
  moreActions: 'Aksi lainnya: {name}',
  errEmptyItem: 'Isi setidaknya satu detail sebelum menambahkan item ini.',

  // Section navigation
  unsavedBadge: 'Belum disimpan',
  statusNeedsDetails: 'Perlu dilengkapi',

  // Event presets
  presetLegend: 'Mulai dari',
  presetCustom: 'Acara lainnya',
  presetHint: 'Mengisi jenis dan nama acara — keduanya bisa diubah.',

  // Couple: parents
  parentsLabel: 'Orang tua',
  parentsHint: 'Opsional. Tulis seperti di undangan Anda.',
  parentsPlaceholderGroom: 'Putra dari Bapak … & Ibu …',
  parentsPlaceholderBride: 'Putri dari Bapak … & Ibu …',
} as const satisfies Record<EditorMessageKey, string>

// Compile-time parity: Indonesian must not have keys English lacks.
type Extra = Exclude<keyof typeof editorId, EditorMessageKey>
const _noExtraKeys: [Extra] extends [never] ? true : never = true
void _noExtraKeys
