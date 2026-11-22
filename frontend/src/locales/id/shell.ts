/** Indonesian counterpart of ../en/shell.ts. Must have exactly the same keys. */
import type { ShellMessageKey } from '../en/shell'

export const shellId = {
  // Judul dokumen
  appTitleDefault: 'Temuvibe · Undangan digital',
  welcomeTitle: 'Mulai',

  // Kerangka aplikasi / menu akun
  menuButtonLabel: 'Menu untuk {name}',
  menuButtonLabelAnon: 'Menu',
  menuSignedInAs: 'Masuk sebagai',

  // Hero dasbor
  heroNamesPlaceholder: 'Situs pernikahan Anda',
  heroDaysToGo: '{count} hari lagi',
  heroOneDayToGo: '1 hari lagi',
  heroToday: 'Hari ini hari pernikahan Anda',
  heroNextStep: 'Langkah berikutnya',
  nextThemeAction: 'Pilih tema',
  nextThemeHint: 'Pilih tampilan yang pertama kali dilihat tamu.',
  nextOpeningAction: 'Lengkapi bagian pembuka',
  nextOpeningHint: 'Tambahkan judul situs, tanggal pernikahan, dan nama Anda.',
  nextCoupleAction: 'Perkenalkan mempelai',
  nextCoupleHint: 'Tambahkan nama lengkap mempelai pria dan wanita.',
  nextEventsAction: 'Tambahkan acara',
  nextEventsHint: 'Beri tahu tamu waktu dan lokasi acara.',
  nextRsvpAction: 'Atur konfirmasi kehadiran',
  nextRsvpHint: 'Beri judul bagian RSVP agar tamu dapat merespons.',
  nextClosingAction: 'Tulis pesan penutup',
  nextClosingHint: 'Beberapa kata terima kasih untuk menutup situs Anda.',
  nextDoneAction: 'Lihat pratinjau situs',
  nextDoneHint: 'Semua bagian wajib sudah lengkap.',
  sectionToDo: 'Perlu diisi',

  // Pengaturan awal (/welcome)
  welcomeSkipAll: 'Lewati pengaturan',
  welcomeStepOf: 'Langkah {n} dari {total}',
  welcomeProgress: 'Progres pengaturan',
  welcomeStepNames: 'Nama & tanggal',
  welcomeStepTheme: 'Tema',
  welcomeStepSite: 'Situs Anda',
  welcomeNamesTitle: 'Mari mulai dari kalian berdua',
  welcomeNamesBody: 'Nama dan tanggal pernikahan tampil di bagian pembuka situs Anda. Anda bisa mengubahnya kapan saja.',
  welcomeGroomNamePlaceholder: 'mis. Rizky Pratama',
  welcomeGroomNicknamePlaceholder: 'mis. Rizky',
  welcomeBrideNamePlaceholder: 'mis. Ayu Lestari',
  welcomeBrideNicknamePlaceholder: 'mis. Ayu',
  welcomeSaveContinue: 'Simpan dan lanjutkan',
  welcomeContinue: 'Lanjutkan',
  welcomeSkipStep: 'Lewati dulu',
  welcomeSaveFailed: 'Langkah ini belum tersimpan. Periksa koneksi Anda lalu coba lagi.',
  welcomeFieldInvalid: 'Periksa kembali isian ini.',
  welcomeThemeTitle: 'Pilih tampilan',
  welcomeThemeBody: 'Mulai dengan salah satu tema ini. Anda bisa melihat tema lain dan menggantinya kapan saja.',
  welcomeThemeLegend: 'Tema untuk memulai',
  welcomeBrowseAll: 'Lihat semua tema',
  welcomeThemeFailed: 'Tema ini belum tersimpan. Coba lagi.',
  welcomeSiteTitle: 'Situs Anda mulai terbentuk',
  welcomeSiteBody: 'Lihat situs Anda seperti yang akan dilihat tamu. Lalu tambahkan acara dan RSVP dari dasbor.',
  welcomeSeeSite: 'Lihat situs Anda',
  welcomeToDashboard: 'Ke dasbor',
  welcomeSummaryNames: 'Nama',
  welcomeNotSet: 'Belum diisi',

  // Kesalahan akun & profil (pesan server tidak pernah ditampilkan apa adanya)
  authErrGeneric: 'Terjadi kesalahan. Silakan coba lagi.',
  authErrNetwork: 'Server tidak dapat dihubungi. Periksa koneksi Anda lalu coba lagi.',
  authErrInvalidCredentials: 'Email atau kata sandi salah.',
  authErrEmailTaken: 'Email ini sudah terdaftar. Silakan masuk.',
  authErrEmailInvalid: 'Masukkan alamat email yang valid, mis. ayu@example.com.',
  authErrPasswordShort: 'Gunakan minimal {min} karakter.',
  authErrPasswordRequired: 'Masukkan kata sandi Anda.',
  authErrNameRequired: 'Masukkan nama Anda.',
  authErrTooLong: 'Gunakan maksimal {max} karakter.',
  authErrFieldInvalid: 'Periksa kembali isian ini.',
  authErrTooMany: 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.',
  authErrSessionExpired: 'Sesi Anda telah berakhir. Silakan masuk kembali.',
} as const satisfies Record<ShellMessageKey, string>

// Compile-time parity: Indonesian must not have keys English lacks.
type Extra = Exclude<keyof typeof shellId, ShellMessageKey>
const _noExtraKeys: [Extra] extends [never] ? true : never = true
void _noExtraKeys
