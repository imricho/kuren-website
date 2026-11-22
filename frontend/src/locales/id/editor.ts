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
  recoveryTitle: 'Ada perubahan yang belum tersimpan di perangkat ini',
  recoveryIntro: 'Perubahan ini dibuat di sini tetapi belum sampai ke server (halaman tertutup, koneksi terputus, atau penyimpanan gagal). Pulihkan untuk menyimpannya sekarang, atau buang.',
  recoveryFrom: 'diubah {when}',
  recoveryStale: 'Bagian ini sudah disimpan lagi setelah perubahan tersebut. Memulihkan akan menggantikan versi tersimpan.',
  recoveryRestore: 'Pulihkan',
  recoveryDiscard: 'Buang',
  recoveryOpen: 'Buka untuk memulihkan',
  recoveryOpenItem: 'Buka butirnya untuk memulihkan',
  recoveryRestored: '{section}: perubahan dipulihkan. Sedang menyimpan.',
  recoveryDiscarded: '{section}: perubahan dibuang.',
} as const satisfies Record<EditorMessageKey, string>

// Compile-time parity: Indonesian must not have keys English lacks.
type Extra = Exclude<keyof typeof editorId, EditorMessageKey>
const _noExtraKeys: [Extra] extends [never] ? true : never = true
void _noExtraKeys
