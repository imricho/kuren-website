/**
 * Device-local recovery of unsaved editor changes (interrupted sessions).
 *
 * While a section's working copy differs from what the server has, the form is kept in
 * localStorage under the signed-in user and the invitation. It is removed as soon as the
 * change is saved or discarded, so an entry only survives when the tab closed, crashed,
 * went offline or a save failed before the change reached the server. On the next visit
 * the editor offers to restore or discard it; nothing is applied automatically.
 *
 * Privacy: entries are scoped to the user id (other accounts on the same browser never see
 * them), expire after 14 days and are all removed on sign-out. Storage failures (private
 * mode, quota) are ignored: recovery is a safety net, never required.
 */
const PREFIX = 'temuvibe.recovery.v1'
export const RECOVERY_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000

export interface RecoveryEntry {
  /** The unsaved form values. */
  form: unknown
  /** The saved payload (JSON) the edits were based on, to tell whether the server moved on. */
  baseline: string
  /** When the change was last made (ms since epoch). */
  at: number
}

export interface RecoveryListItem {
  /** Draft key, e.g. "opening" or "events:session-2". */
  key: string
  at: number
}

const storageKey = (userId: string, invitationId: string, key: string) => `${PREFIX}.${userId}.${invitationId}.${key}`

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function saveRecovery(userId: string, invitationId: string, key: string, entry: RecoveryEntry): void {
  try {
    storage()?.setItem(storageKey(userId, invitationId, key), JSON.stringify(entry))
  } catch {
    // Quota or disabled storage: no recovery for this change.
  }
}

export function loadRecovery(userId: string, invitationId: string, key: string, now = Date.now()): RecoveryEntry | null {
  const s = storage()
  if (!s) return null
  try {
    const raw = s.getItem(storageKey(userId, invitationId, key))
    if (!raw) return null
    const entry = JSON.parse(raw) as Partial<RecoveryEntry>
    if (typeof entry.at !== 'number' || typeof entry.baseline !== 'string' || !entry.form || typeof entry.form !== 'object' || now - entry.at > RECOVERY_MAX_AGE_MS) {
      s.removeItem(storageKey(userId, invitationId, key))
      return null
    }
    return entry as RecoveryEntry
  } catch {
    return null
  }
}

export function removeRecovery(userId: string, invitationId: string, key: string): void {
  try {
    storage()?.removeItem(storageKey(userId, invitationId, key))
  } catch {
    // Nothing to do.
  }
}

/** Every (unexpired) recovery entry of one invitation for this user, newest first. */
export function listRecoveries(userId: string, invitationId: string, now = Date.now()): RecoveryListItem[] {
  const s = storage()
  if (!s) return []
  const prefix = `${PREFIX}.${userId}.${invitationId}.`
  const out: RecoveryListItem[] = []
  try {
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i)
      if (!k?.startsWith(prefix)) continue
      const key = k.slice(prefix.length)
      const entry = loadRecovery(userId, invitationId, key, now)
      if (entry) out.push({ key, at: entry.at })
    }
  } catch {
    return []
  }
  return out.sort((a, b) => b.at - a.at)
}

/** Remove recovery entries: all of them, or one invitation's (any user) when it is deleted. */
export function clearRecoveries(scope: { invitationId?: string } = {}): void {
  const s = storage()
  if (!s) return
  try {
    const doomed: string[] = []
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i)
      if (!k?.startsWith(`${PREFIX}.`)) continue
      if (scope.invitationId && k.split('.')[4] !== scope.invitationId) continue
      doomed.push(k)
    }
    doomed.forEach((k) => s.removeItem(k))
  } catch {
    // Nothing to do.
  }
}
