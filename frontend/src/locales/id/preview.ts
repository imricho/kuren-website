/** Indonesian counterpart of ../en/preview.ts. Must have exactly the same keys. */
import type { PreviewMessageKey } from '../en/preview'

export const previewId = {
  // Editor shell
  editorPanelLabel: 'Editor',
  sectionsDone: '{done} dari {total} selesai',
  editorViewTabs: 'Tampilan editor',
  tabEdit: 'Edit',
  tabPreview: 'Pratinjau',
  resizeEditor: 'Ubah ukuran editor',
  resizeEditorValue: 'Editor {percent}%',

  // Preview toolbar
  livePreview: 'Pratinjau langsung',
  previewDeviceGroup: 'Perangkat pratinjau',
  previewZoomGroup: 'Zoom pratinjau',
  previewDevicePhone: 'Ponsel',
  previewDeviceDesktop: 'Desktop',
  previewZoomFit: 'Pas',
  previewZoomActual: '100%',
  previewThemeChange: 'Ganti',
  previewThemeChangeLabel: 'Ganti tema ({name})',
  previewFullScreen: 'Layar penuh',
  previewToolbarLabel: 'Opsi pratinjau',

  // Frame and states
  previewFrameLabel: 'Pratinjau langsung, ukuran {device} — dapat digulir',
  previewLoading: 'Memuat pratinjau…',
  previewNoTheme: 'Belum memilih tema — menampilkan {name}.',
  previewChooseTheme: 'Pilih tema',
  previewErrorTitle: 'Pratinjau gagal dimuat',
  previewErrorBody: 'Suntingan Anda aman. Anda tetap bisa mengedit sambil kami mencoba lagi.',
  previewErrorRetry: 'Coba lagi',

  // Full-screen preview page
  previewShowsLatest: 'Menampilkan suntingan terbaru Anda.',
} as const satisfies Record<PreviewMessageKey, string>

// Compile-time parity: Indonesian must not have keys English lacks.
type Extra = Exclude<keyof typeof previewId, PreviewMessageKey>
const _noExtraKeys: [Extra] extends [never] ? true : never = true
void _noExtraKeys
