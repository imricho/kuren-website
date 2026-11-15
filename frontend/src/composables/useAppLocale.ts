import { ref } from 'vue'

import { cmsEn } from '@/locales/en/cms'
import { cmsId } from '@/locales/id/cms'
import { editorEn } from '@/locales/en/editor'
import { editorId } from '@/locales/id/editor'
import { shellEn } from '@/locales/en/shell'
import { shellId } from '@/locales/id/shell'

export type AppLocale = 'en' | 'id'

// Catalog hierarchy terms are product labels: retain Category, Collection and
// Template verbatim in both locales. Internal family keys/IDs remain stable.
const messages = {
  en: {
    language: 'Language', english: 'English', bahasa: 'Bahasa Indonesia', mainNav: 'Main navigation', dashboard: 'Dashboard', themes: 'Themes', account: 'Account', signOut: 'Sign out',
    dashboardEyebrow: 'Dashboard', hello: 'Hello, {name}',
    chooseTheme: 'Choose a theme', browseThemes: 'Browse themes', selected: 'Selected: {path}',
    accountTitle: 'Your profile', profileUpdated: 'Your profile has been updated.', email: 'Email', saveChanges: 'Save changes', saving: 'Saving…',
    createAccount: 'Create your account', createAccountBody: 'Start building your wedding website. It only takes a minute.', createAccountAction: 'Create account', signIn: 'Sign in', welcomeBack: 'Welcome back', signInBody: 'Sign in to continue planning your wedding website.',
    pageNotFound: 'This page could not be found', backHome: 'Back to home',
    chooseWeddingTheme: 'Choose your wedding theme', allFamilies: 'All categories', themeBrowser: 'Theme browser', browseThemeLabel: 'Browse themes', hide: 'Hide', show: 'Show',
    family: 'Category', collection: 'Collection', template: 'Template', chooseFamily: 'Choose a category', chooseCollection: 'Choose a collection', templates: 'Templates',
    allCollections: 'All {family} collections', collectionsInDevelopment: 'Collections in development', familyInDevelopment: '{family} is in development. It has no collections or templates to preview or select yet.',
    noTemplates: 'Templates for this collection are in development and can’t be previewed or selected yet.', designDirection: 'Design direction', previewing: 'Previewing', draft: 'draft', sampleWedding: 'sample wedding', preview: 'Preview',
    available: 'Available', draftPreview: 'Draft — preview only', inDevelopment: 'In development', previewOnly: 'Preview only', previewOnlyDraft: 'Preview only — draft',
    reviewPending: 'Review pending', awaitingReview: 'Awaiting cultural review', culturallyReviewed: 'Culturally reviewed',
    templateAvailable: '{count} template available', templatesAvailable: '{count} templates available', draftsToPreview: '{count} draft to preview', draftsToPreviewPlural: '{count} drafts to preview', planned: '{count} planned', templatesPlanned: '{count} templates planned', noTemplatesYet: 'No templates yet',
    familyInDevelopmentSummary: 'In development — no collections yet', collectionInDevelopment: '{count} collection in development', collectionsInDevelopmentCount: '{count} collections in development',
    selectedLabel: 'Selected', noSelection: 'No template selected yet — preview freely, then select the one you love.', viewCollection: 'View collection',
    previewSize: 'Preview size', phone: 'Phone', tablet: 'Tablet', desktop: 'Desktop', fullScreenPreview: 'Full-screen preview', selectTemplate: 'Select template', openEditor: 'Edit', themeOpenEditorFailed: 'Your template is saved. Try again to open Edit.',
    back: 'Back', previewLocation: 'Previewed template location', previewPaneLocation: 'Template category and collection', templatePreview: 'Template preview',
    collectionNotFound: 'Collection not found', familyNotFound: 'Category not found',
    templateMissing: 'Template “{name}” doesn’t exist — showing {fallback} instead.', draftNotice: 'This draft is for preview only and can’t be selected yet.', noTemplatesNotice: '{scope} has no templates to preview yet. Still showing {template} from {path}.',
    aboutCollection: 'About this collection', regionalScope: 'Regional scope', designStatus: 'Design status', culturalReview: 'Cultural review', optionsToDefine: 'Options to be defined with reviewers.', draftDesign: 'Draft design', basedOn: 'what it’s based on', uses: 'Uses', leftOut: 'Left out until reviewed', reviewPlan: 'Review plan', notContacted: 'not yet contacted', whoShouldReview: 'Who should review', openQuestions: 'Open questions', researching: 'Researching', notConfirmed: 'not confirmed', draftArtDirection: 'Draft art direction', creativeNotClaims: 'creative choices, not cultural claims', draftPalette: 'Draft palette', type: 'Type:', composition: 'Composition:', imagery: 'Imagery:',
    previewTemplate: 'Preview {name}', previewingLabel: 'Previewing · ', alsoKnownAs: 'Also known as',
    authBrandTitle: 'A wedding website as thoughtful as your invitations.', authBrandBody: 'Choose a theme, add your story and details, and share one beautiful link with every guest.', yourName: 'Your name', password: 'Password', passwordHint: 'At least 8 characters.', newHere: 'New here?', createAnAccount: 'Create an account', alreadyAccount: 'Already have an account?',
    notReviewedNote: 'Not yet reviewed by a cultural practitioner or organisation. Not presented as authentic, approved or production-ready.', requiredUnconfirmed: 'Required for release — not confirmed yet', draftDirectionProvisional: 'Draft direction (provisional): {directions}', noCulturalMotifs: 'No culturally specific motifs are shown until a {locality} is chosen and reviewed.', optionsDefinedByReviewers: 'Options to be defined with reviewers.',
    designNotStarted: 'Not started', designDraft: 'Draft — preview available', designFinal: 'Final design', sources: 'Sources',
    verifiedCount: '{verified} of {total} verified', verified: 'Verified', notYetVerified: 'Not yet verified', confirmedReferences: 'Confirmed cultural references:', noneYet: 'none yet', researchingStatus: 'Researching', notConfirmedStatus: 'not confirmed',
    ...cmsEn,
    ...shellEn,
    ...editorEn,
  },
  id: {
    language: 'Bahasa', english: 'English', bahasa: 'Bahasa Indonesia', mainNav: 'Navigasi utama', dashboard: 'Dasbor', themes: 'Tema', account: 'Akun', signOut: 'Keluar',
    dashboardEyebrow: 'Dasbor', hello: 'Halo, {name}',
    chooseTheme: 'Pilih tema', browseThemes: 'Jelajahi tema', selected: 'Dipilih: {path}',
    accountTitle: 'Profil Anda', profileUpdated: 'Profil Anda berhasil diperbarui.', email: 'Email', saveChanges: 'Simpan perubahan', saving: 'Menyimpan…',
    createAccount: 'Buat akun', createAccountBody: 'Mulai buat situs pernikahan Anda. Hanya perlu satu menit.', createAccountAction: 'Buat akun', signIn: 'Masuk', welcomeBack: 'Selamat datang kembali', signInBody: 'Masuk untuk melanjutkan perencanaan situs pernikahan Anda.',
    pageNotFound: 'Halaman tidak ditemukan', backHome: 'Kembali ke beranda',
    chooseWeddingTheme: 'Pilih tema pernikahan', allFamilies: 'Semua Category', themeBrowser: 'Jelajahi tema', browseThemeLabel: 'Jelajahi tema', hide: 'Sembunyikan', show: 'Tampilkan',
    family: 'Category', collection: 'Collection', template: 'Template', chooseFamily: 'Pilih Category', chooseCollection: 'Pilih Collection', templates: 'Template',
    allCollections: 'Semua koleksi {family}', collectionsInDevelopment: 'Koleksi sedang dikembangkan', familyInDevelopment: '{family} sedang dikembangkan. Belum ada koleksi atau template yang dapat dipratinjau maupun dipilih.',
    noTemplates: 'Template untuk koleksi ini sedang dikembangkan dan belum dapat dipratinjau atau dipilih.', designDirection: 'Arah desain', previewing: 'Pratinjau', draft: 'draf', sampleWedding: 'contoh pernikahan', preview: 'Pratinjau',
    available: 'Tersedia', draftPreview: 'Draf — pratinjau saja', inDevelopment: 'Sedang dikembangkan', previewOnly: 'Pratinjau saja', previewOnlyDraft: 'Pratinjau saja — draf',
    reviewPending: 'Menunggu peninjauan', awaitingReview: 'Menunggu tinjauan budaya', culturallyReviewed: 'Telah ditinjau secara budaya',
    templateAvailable: '{count} template tersedia', templatesAvailable: '{count} template tersedia', draftsToPreview: '{count} draf untuk dipratinjau', draftsToPreviewPlural: '{count} draf untuk dipratinjau', planned: '{count} direncanakan', templatesPlanned: '{count} template direncanakan', noTemplatesYet: 'Belum ada template',
    familyInDevelopmentSummary: 'Sedang dikembangkan — belum ada koleksi', collectionInDevelopment: '{count} koleksi sedang dikembangkan', collectionsInDevelopmentCount: '{count} koleksi sedang dikembangkan',
    selectedLabel: 'Dipilih', noSelection: 'Belum ada template dipilih — lihat pratinjaunya, lalu pilih yang Anda sukai.', viewCollection: 'Lihat koleksi',
    previewSize: 'Ukuran pratinjau', phone: 'Ponsel', tablet: 'Tablet', desktop: 'Desktop', fullScreenPreview: 'Pratinjau Full-screen', selectTemplate: 'Pilih template', openEditor: 'Edit', themeOpenEditorFailed: 'Template Anda telah disimpan. Coba lagi untuk membuka Edit.',
    back: 'Kembali', previewLocation: 'Lokasi template yang dipratinjau', previewPaneLocation: 'Category dan Collection template', templatePreview: 'Pratinjau template',
    collectionNotFound: 'Koleksi tidak ditemukan', familyNotFound: 'Category tidak ditemukan',
    templateMissing: 'Template “{name}” tidak ditemukan — menampilkan {fallback}.', draftNotice: 'Draf ini hanya untuk pratinjau dan belum dapat dipilih.', noTemplatesNotice: '{scope} belum memiliki template untuk dipratinjau. Menampilkan {template} dari {path}.',
    aboutCollection: 'Tentang koleksi ini', regionalScope: 'Cakupan wilayah', designStatus: 'Status desain', culturalReview: 'Tinjauan budaya', optionsToDefine: 'Pilihan akan ditentukan bersama para peninjau.', draftDesign: 'Draf desain', basedOn: 'dasar desain', uses: 'Digunakan', leftOut: 'Belum digunakan sebelum ditinjau', reviewPlan: 'Rencana peninjauan', notContacted: 'belum dihubungi', whoShouldReview: 'Pihak yang sebaiknya meninjau', openQuestions: 'Pertanyaan terbuka', researching: 'Sedang diteliti', notConfirmed: 'belum dikonfirmasi', draftArtDirection: 'Draf arahan artistik', creativeNotClaims: 'pilihan kreatif, bukan klaim budaya', draftPalette: 'Palet draf', type: 'Tipografi:', composition: 'Komposisi:', imagery: 'Citra:',
    previewTemplate: 'Pratinjau {name}', previewingLabel: 'Sedang dipratinjau · ', alsoKnownAs: 'Disebut juga',
    authBrandTitle: 'Situs pernikahan yang dipersiapkan sepenuh hati, seperti undangan Anda.', authBrandBody: 'Pilih tema, tambahkan kisah dan detail acara, lalu bagikan satu tautan istimewa kepada semua tamu.', yourName: 'Nama Anda', password: 'Kata sandi', passwordHint: 'Minimal 8 karakter.', newHere: 'Pengguna baru?', createAnAccount: 'Buat akun', alreadyAccount: 'Sudah memiliki akun?',
    notReviewedNote: 'Belum ditinjau oleh praktisi atau organisasi budaya. Tidak dinyatakan autentik, disetujui, atau siap digunakan.', requiredUnconfirmed: 'Wajib dikonfirmasi sebelum dirilis', draftDirectionProvisional: 'Arah draf (sementara): {directions}', noCulturalMotifs: 'Motif budaya tertentu tidak ditampilkan sebelum {locality} dipilih dan ditinjau.', optionsDefinedByReviewers: 'Pilihan akan ditentukan bersama para peninjau.',
    designNotStarted: 'Belum dimulai', designDraft: 'Draf — pratinjau tersedia', designFinal: 'Desain final', sources: 'Sumber',
    verifiedCount: '{verified} dari {total} terverifikasi', verified: 'Terverifikasi', notYetVerified: 'Belum terverifikasi', confirmedReferences: 'Referensi budaya terkonfirmasi:', noneYet: 'belum ada', researchingStatus: 'Sedang diteliti', notConfirmedStatus: 'belum dikonfirmasi',
    ...cmsId,
    ...shellId,
    ...editorId,
  },
} as const

const familyCopy = {
  traditional: ['Heritage', 'Formal, penuh ornamen, dan tak lekang waktu', 'Gaya desain tanpa atribusi asal budaya tertentu, dari bingkai upacara formal hingga ornamen abstrak orisinal.'],
  international: ['Internasional', 'Global, editorial, dan berkesan mewah', 'Tata letak terinspirasi majalah dengan tipografi serif yang halus, ruang lega, dan foto memenuhi bidang.'],
  classic: ['Konvensional / Klasik', 'Nuansa undangan yang tak lekang waktu', 'Desain romantis dan akrab: bunga, warna pastel lembut, tulisan elegan, dan bingkai foto melengkung.'],
  artistic: ['Artistik', 'Ekspresif, kontemporer, dan berani', 'Komposisi asimetris, tipografi besar, dan foto bergaya kolase yang ekspresif namun tetap mudah dibaca.'],
  'modern-minimalist': ['Minimalis Modern', 'Kesederhanaan hangat, komposisi presisi', 'Desain pernikahan ekspresif dengan kisi yang teratur, warna netral bertekstur, dan tipografi percaya diri.'],
  'rustic-nature': ['Alam / Rustic', 'Romansa taman yang terasa alami', 'Undangan bernuansa taman dengan lapisan hijau, ilustrasi botani, dan permukaan hangat seperti kertas.'],
} as const

const collectionCopy = {
  'ceremonial-classic': ['Klasik Seremonial', 'Bingkai formal, tata letak seimbang, warna kaya, dan tipografi display yang halus.', 'Arah desain formal orisinal dengan komposisi simetris dan bingkai dekoratif.'],
  'artisan-pattern': ['Pola Artisan', 'Ornamen geometris orisinal, tekstur taktil, dan cerita warna yang ekspresif.', 'Karya pola abstrak kontemporer; tidak dikaitkan dengan tekstil atau komunitas tertentu.'],
  editorial: ['Editorial', 'Tata letak terinspirasi majalah dengan serif halus, ruang lega, dan foto penuh bidang.', 'Desain editorial kontemporer dan cetak mewah.'],
  'romantic-floral': ['Floral Romantis', 'Pastel lembut, ilustrasi botani, dan tulisan elegan untuk nuansa undangan klasik.', 'Alat tulis klasik dan ilustrasi botani.'],
  contemporary: ['Kontemporer', 'Komposisi seperti galeri dengan tipografi besar, foto kolase, dan satu aksen cerah.', 'Desain grafis kontemporer dan tata letak buku seni.'],
  'quiet-form': ['Bentuk Hening', 'Komposisi hangat dengan jarak presisi, kontras lembut, dan tipografi percaya diri.', 'Arah desain modern orisinal yang berfokus pada kisi, keselarasan, kontras, dan ruang lega.'],
  'field-notes': ['Catatan Alam', 'Undangan bernuansa taman dengan hijau hutan, ilustrasi botani, dan warna kertas hangat.', 'Karya dan tata letak terinspirasi alam; tidak mewakili tempat, komunitas, atau motif budaya tertentu.'],
  'formal-signatures': ['Tanda Tangan Formal', 'Tipografi seremonial, warna malam yang pekat, dan bingkai yang anggun.', 'Komposisi alat tulis formal orisinal tanpa mewakili tradisi budaya tertentu.'],
  'abstract-heritage': ['Warisan Abstrak', 'Garis kontemporer, geometri, dan tekstur tanpa atribusi budaya.', 'Sistem garis dan geometri abstrak orisinal, bukan salinan seni budaya tertentu.'],
  'coastal-journal': ['Jurnal Pesisir', 'Tata letak editorial lapang, warna kaca laut, dan fotografi lanskap.', 'Desain editorial kontemporer dan fotografi lanskap.'],
  'city-editions': ['Edisi Kota', 'Fotografi dokumenter, kisi asimetris, dan keterangan bergaya arsip.', 'Majalah kota kontemporer dan fotografi dokumenter.'],
  'after-hours': ['Selepas Senja', 'Fotografi senja, warna gelap, dan detail editorial bercahaya lembut.', 'Editorial malam kontemporer dan fotografi fesyen.'],
  'botanical-classics': ['Klasik Botani', 'Ilustrasi botani, hijau pucat, dan bingkai undangan yang anggun.', 'Ilustrasi botani orisinal dan komposisi alat tulis klasik.'],
  'fine-keepsakes': ['Kenang-Kenangan Istimewa', 'Garis metalik lembut, foto berbingkai, dan aksen bunga terpilih.', 'Alat tulis kenang-kenangan kontemporer dan fotografi bunga.'],
  'estate-gardens': ['Taman Manor', 'Fotografi taman formal, serif klasik, dan suasana senja.', 'Konvensi undangan taman klasik dan fotografi manor.'],
  'color-experiments': ['Eksperimen Warna', 'Bidang warna tegas, tata letak modular, dan tipografi geometris.', 'Studi warna kontemporer orisinal dan desain grafis modular.'],
  'photo-studies': ['Studi Foto', 'Foto candid berlapis, tekstur kertas, dan komposisi editorial.', 'Esai foto kontemporer dan desain cetak independen.'],
  'gallery-editions': ['Edisi Galeri', 'Ritme katalog seni, bagian bernomor, keterangan ringkas, dan ruang lega.', 'Katalog seni dan grafis pameran.'],
  'soft-essentials': ['Esensi Lembut', 'Kertas terang, kisi modular, detail tanggal, dan margin lega.', 'Desain cetak minimalis dan antarmuka kontemporer.'],
  'evening-minimal': ['Minimalis Malam', 'Kontras tegas, bidang gelap, dan tipografi presisi untuk suasana malam.', 'Alat tulis pesta formal modern dan sistem tipografi.'],
  'fine-lines': ['Garis Halus', 'Bingkai garis tipis, crop foto terarah, dan susunan seperti galeri.', 'Pembingkaian geometris orisinal dan arahan seni kontemporer.'],
  'garden-gatherings': ['Perjamuan Taman', 'Dedaunan zaitun, foto kebun, dan detail acara yang santai.', 'Fotografi pernikahan alam dan karya botani orisinal.'],
  'landscape-editions': ['Edisi Lanskap', 'Cakrawala terbuka, warna hijau lembut, dan cahaya alami sinematik.', 'Fotografi lanskap kontemporer dan desain cetak bernuansa alam.'],
  'botanical-paper': ['Kertas Botani', 'Detail bunga kering, permukaan kertas hangat, dan alur cerita organik.', 'Ilustrasi botani orisinal dan desain kertas bertekstur.'],
} as const

const templateTaglines: Record<string, string> = {
  'ivory-processional': 'Nuansa seremonial dalam warna gading dan emas antik',
  'terracotta-geometry': 'Tanah liat hangat, pasir, dan geometri orisinal',
  'gilded-vow': 'Arang, emas antik, dan tipografi berkontras tinggi',
  'candlelit-hall': 'Warna plum gelap dan hangatnya cahaya lilin',
  'pressed-filigree': 'Batu pucat, garis perunggu, dan simetri tenang',
  'loomed-lines': 'Kisi berkesan anyaman dalam warna krem dan permata',
  'the-monograph': 'Kisah cinta dengan margin luas dan alur editorial',
  'coastal-issue': 'Warna kaca laut dan cakrawala yang lapang',
  'the-sunday-edit': 'Beige hangat, zaitun, dan foto candid',
  'city-journal': 'Kisi cerita terbelah dengan karakter dokumenter',
  'gallery-no-08': 'Tipografi besar, blok foto, dan nomor yang halus',
  'modern-heirloom': 'Navy, krem, dan detail foto bergaya arsip',
  afterglow: 'Foto senja dalam espresso dan sampanye',
  rosewater: 'Merah muda lembut, krem, dan tulisan anggun',
  'lily-and-lace': 'Hijau sage pucat dan ilustrasi lili orisinal',
  'the-conservatory': 'Foto rumah kaca dan detail hijau pakis',
  'pearl-keepsake': 'Gading, abu mutiara, dan garis metalik halus',
  'peony-season': 'Merah muda hangat, hijau daun, dan bunga ekspresif',
  'bluebell-manor': 'Biru lembut dan krem dalam tata letak formal',
  'garden-at-dusk': 'Mauve, hijau tua, dan suasana taman senja',
  'cut-paper': 'Lapisan bentuk kertas koral dan biru ultramarin',
  'color-study': 'Bidang warna luas dan kisi tipografi tegas',
  'chromatic-vows': 'Aksen merah-oranye dan kartu modular',
  afterimage: 'Lapisan foto lembut dalam ungu dan merah hangat',
  'sunday-collage': 'Komposisi foto bertape di atas kertas hangat',
  'the-exhibition': 'Alur katalog seni dengan momen bernomor',
  'negative-space': 'Satu potret dramatis dikelilingi ruang lega',
  monogram: 'Inisial, simetri, dan hitam lembut di atas krem',
  'soft-grid': 'Batu pucat, zaitun lembut, dan bagian modular',
  'paper-light': 'Putih cerah, detail halus, dan margin lebar',
  'black-tie': 'Hero terbelah dalam hitam, putih, dan kuningan',
  'quiet-contrast': 'Abu hangat, satu bidang gelap, dan crop potret',
  outline: 'Bingkai garis halus dalam taupe dan warna kapur',
  atelier: 'Kisi galeri dengan keterangan grafit',
  meadowlight: 'Padang bunga liar bernuansa oat dan hijau lembut',
  'olive-grove': 'Zaitun, krem, dan foto pepohonan bermandikan matahari',
  'orchard-table': 'Buah, dedaunan, dan kartu perjamuan yang lapang',
  'coastal-pine': 'Kaca laut, hijau pinus, dan cakrawala terbuka',
  'golden-hour-garden': 'Cahaya madu, lumut, dan foto yang intim',
  'gathered-branch': 'Ilustrasi ranting orisinal dan alur cerita vertikal',
  'wildflower-press': 'Bunga kering di atas kertas perkamen lavender',
}

const templateCopy = {
  traditional: ['Formal, seremonial, dan tak lekang waktu', 'Undangan klasik dengan bingkai elegan, hiasan ornamental, dan palet merah marun kaya.'],
  international: ['Modern, editorial, dan berkesan mewah', 'Tata letak editorial dengan serif elegan, ruang lega, dan fotografi dramatis.'],
  conventional: ['Bunga romantis dalam warna pastel lembut', 'Undangan klasik dengan komposisi floral, warna blush, dan tipografi romantis.'],
  artistic: ['Berani, editorial, dan ekspresif', 'Komposisi galeri dengan tipografi ekspresif, kolase, dan aksen warna yang kuat.'],
  'still-form': ['Kesederhanaan hangat, dibuat lebih personal', 'Tata letak presisi dengan warna kertas lembut, tipografi sans, dan bingkai foto yang terarah.'],
  'wildwood-gathering': ['Perayaan taman yang dirangkai sepenuh hati', 'Undangan bernuansa alam dengan hijau hutan, detail botani, foto berlapis, dan warna kertas hangat.'],
  ethnic: ['Terinspirasi tekstil, hangat, dan khas', 'Pola geometris orisinal, tekstur taktil, dan palet warna ekspresif tanpa klaim asal budaya tertentu.'],
} as const

export type AppMessageKey = keyof typeof messages.en

export function localizedCatalogText(id: string, field: 'name' | 'tagline' | 'description' | 'reference', fallback: string): string {
  if (currentLocale.value !== 'id') return fallback
  const family = familyCopy[id as keyof typeof familyCopy]
  if (family) return field === 'name' ? family[0] : field === 'tagline' ? family[1] : field === 'description' ? family[2] : fallback
  const collection = collectionCopy[id as keyof typeof collectionCopy]
  if (collection) return field === 'name' ? collection[0] : field === 'description' ? collection[1] : field === 'reference' ? collection[2] : fallback
  const template = templateCopy[id as keyof typeof templateCopy]
  if (template) return field === 'tagline' ? template[0] : field === 'description' ? template[1] : fallback
  if (field === 'tagline' && templateTaglines[id]) return templateTaglines[id]
  return fallback
}

const STORAGE_KEY = 'kuren.appLocale'
const initialLocale: AppLocale = (() => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved === 'id' || saved === 'en' ? saved : 'en'
  } catch {
    return 'en'
  }
})()
const currentLocale = ref<AppLocale>(initialLocale)

if (typeof document !== 'undefined') document.documentElement.lang = currentLocale.value

export function useAppLocale() {
  function setLocale(locale: AppLocale) {
    currentLocale.value = locale
    if (typeof document !== 'undefined') document.documentElement.lang = locale
    try {
      localStorage.setItem(STORAGE_KEY, locale)
    } catch {
      // Keep the current session preference if storage is unavailable.
    }
  }

  function t(key: AppMessageKey, vars: Record<string, string | number> = {}): string {
    let message: string = messages[currentLocale.value][key]
    for (const [name, value] of Object.entries(vars)) message = message.split(`{${name}}`).join(String(value))
    return message
  }

  return { locale: currentLocale, setLocale, t }
}
