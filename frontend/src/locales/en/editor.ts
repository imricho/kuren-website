/** English UI text for the editor polish (forms, lists, a11y). Keep keys in sync with ../id/editor.ts (type-checked). */
export const editorEn = {
  previewNotices: 'About this preview',
  // Lists
  moreActions: 'More actions: {name}',
  errEmptyItem: 'Add at least one detail before adding this item.',

  // Section navigation
  unsavedBadge: 'Unsaved',
  statusNeedsDetails: 'Needs details',

  // Event presets
  presetLegend: 'Start from',
  presetCustom: 'Custom event',
  presetHint: 'Fills in the type and name — you can change both.',

  // Couple: parents
  parentsLabel: 'Parents',
  parentsHint: 'Optional. Written as on your invitation.',
  parentsPlaceholderGroom: 'Son of Mr … & Mrs …',
  parentsPlaceholderBride: 'Daughter of Mr … & Mrs …',
  recoveryTitle: 'Unsaved changes found on this device',
  recoveryIntro: 'These changes were made here but never reached the server (the page closed, the connection dropped or a save failed). Restore them to save them now, or discard them.',
  recoveryFrom: 'changed {when}',
  recoveryStale: 'This section was saved again after these changes. Restoring replaces the saved version.',
  recoveryRestore: 'Restore',
  recoveryDiscard: 'Discard',
  recoveryOpen: 'Open to restore',
  recoveryOpenItem: 'Open the item to restore',
  recoveryRestored: '{section}: unsaved changes restored. Saving now.',
  recoveryDiscarded: '{section}: unsaved changes discarded.',
} as const

export type EditorMessageKey = keyof typeof editorEn
