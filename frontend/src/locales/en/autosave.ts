/** English UI text for the autosave, save status and conflicts (Agent B). Keep keys in sync with ../id/autosave.ts (type-checked). */
export const autosaveEn = {
  // Save status (docs/ux/live-editor.md §5): full text, and the short word used at narrow widths (§10).
  saveStatusSaved: 'All changes saved',
  saveStatusUnsaved: 'Unsaved changes',
  saveStatusSaving: 'Saving…',
  saveStatusFailed: 'Couldn’t save',
  saveStatusOffline: 'Offline — saves when you reconnect',
  saveStatusConflict: 'Edited on another device',
  saveStatusInvalid: 'Can’t save yet — check the highlighted fields',
  saveShortInvalid: 'Check fields',
  keepMineTitle: 'Replace the other version?',
  keepMineBody: 'Your edits will be saved over the version saved on the other device. This can’t be undone.',
  previewVisualOnly: 'Visual preview only. Use Full screen to read the website with a screen reader.',
  saveShortSaved: 'Saved',
  saveShortUnsaved: 'Unsaved',
  saveShortSaving: 'Saving…',
  saveShortFailed: 'Failed',
  saveShortOffline: 'Offline',
  saveShortConflict: 'Conflict',
  saveNow: 'Save now',
  retrySave: 'Retry',
  reloadLatest: 'Reload latest',
  keepMine: 'Keep mine',

  // Conflict
  conflictTitle: 'Your website was edited on another device.',
  conflictBody: 'Autosave is paused. Reload the latest version, or keep yours and save it over the other changes.',
  reloadLatestTitle: 'Reload the latest version?',
  reloadLatestBody: 'Changes on this device that haven’t been saved will be replaced by the latest version.',

  // Item editors
  itemDone: 'Done',

  // Story / Gallery "Show on website"
  showOnWebsite: 'Show on website',
  showSectionHint: 'Turn off to hide this section from your guests.',
  sectionHiddenNote: 'Hidden from your website. Your content is kept — turn this on to show it again.',
} as const

export type AutosaveMessageKey = keyof typeof autosaveEn
