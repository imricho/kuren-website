/** English UI text for the live preview panel, split layout and mobile tabs (Agent A). Keep keys in sync with ../id/preview.ts (type-checked). */
export const previewEn = {
  // Editor shell
  editorPanelLabel: 'Editor',
  sectionsDone: '{done} of {total} done',
  editorViewTabs: 'Editor view',
  tabEdit: 'Edit',
  tabPreview: 'Preview',
  resizeEditor: 'Resize editor',
  resizeEditorValue: 'Editor {percent}%',

  // Preview toolbar
  livePreview: 'Live preview',
  previewDeviceGroup: 'Preview device',
  previewZoomGroup: 'Preview zoom',
  previewDevicePhone: 'Phone',
  previewDeviceDesktop: 'Desktop',
  previewZoomFit: 'Fit',
  previewZoomActual: '100%',
  previewThemeChange: 'Change',
  previewThemeChangeLabel: 'Change theme ({name})',
  previewFullScreen: 'Full screen',
  previewToolbarLabel: 'Preview options',

  // Frame and states
  previewFrameLabel: 'Live preview, {device} size — scrollable',
  previewLoading: 'Loading preview…',
  previewNoTheme: 'No theme chosen yet — showing {name}.',
  previewChooseTheme: 'Choose a theme',
  previewErrorTitle: 'Preview couldn’t load',
  previewErrorBody: 'Your edits are safe. You can keep editing while we try again.',
  previewErrorRetry: 'Try again',

  // Full-screen preview page
  previewShowsLatest: 'Shows your latest edits.',
} as const

export type PreviewMessageKey = keyof typeof previewEn
