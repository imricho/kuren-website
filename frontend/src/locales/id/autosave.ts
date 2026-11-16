/** Indonesian counterpart of ../en/autosave.ts. Must have exactly the same keys. */
import type { AutosaveMessageKey } from '../en/autosave'

export const autosaveId = {
  saveStatusSaved: 'Semua perubahan tersimpan',
  saveStatusUnsaved: 'Ada perubahan belum tersimpan',
  saveStatusSaving: 'Menyimpan…',
  saveStatusFailed: 'Gagal menyimpan',
  saveStatusOffline: 'Offline — disimpan saat online kembali',
  saveStatusConflict: 'Diubah di perangkat lain',
  saveStatusInvalid: 'Belum bisa disimpan — periksa kolom yang ditandai',
  saveShortInvalid: 'Periksa',
  keepMineTitle: 'Ganti versi yang lain?',
  keepMineBody: 'Suntingan Anda akan menimpa versi yang disimpan di perangkat lain. Tindakan ini tidak dapat dibatalkan.',
  previewVisualOnly: 'Pratinjau visual saja. Gunakan Layar penuh untuk membaca situs dengan pembaca layar.',
  saveShortSaved: 'Tersimpan',
  saveShortUnsaved: 'Belum disimpan',
  saveShortSaving: 'Menyimpan…',
  saveShortFailed: 'Gagal',
  saveShortOffline: 'Offline',
  saveShortConflict: 'Konflik',
  saveNow: 'Simpan sekarang',
  retrySave: 'Coba lagi',
  reloadLatest: 'Muat versi terbaru',
  keepMine: 'Pakai versi saya',

  conflictTitle: 'Situs Anda diubah di perangkat lain.',
  conflictBody: 'Simpan otomatis dijeda. Muat versi terbaru, atau pakai versi Anda dan simpan di atas perubahan lain.',
  reloadLatestTitle: 'Muat versi terbaru?',
  reloadLatestBody: 'Perubahan di perangkat ini yang belum tersimpan akan diganti dengan versi terbaru.',

  itemDone: 'Selesai',

  showOnWebsite: 'Tampilkan di situs',
  showSectionHint: 'Matikan untuk menyembunyikan bagian ini dari tamu.',
  sectionHiddenNote: 'Disembunyikan dari situs Anda. Konten tetap tersimpan — aktifkan lagi untuk menampilkannya.',
} as const satisfies Record<AutosaveMessageKey, string>

// Compile-time parity: Indonesian must not have keys English lacks.
type Extra = Exclude<keyof typeof autosaveId, AutosaveMessageKey>
const _noExtraKeys: [Extra] extends [never] ? true : never = true
void _noExtraKeys
