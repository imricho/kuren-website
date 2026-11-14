/**
 * Vitest setup.
 *
 * Node 25+ ships an experimental global `localStorage` that shadows jsdom's and
 * is non-functional without `--localstorage-file`. Provide a spec-compliant
 * in-memory Storage when the global one is unusable, so tests behave the same
 * on every Node version.
 */
function isUsable(storage: unknown): boolean {
  try {
    return typeof (storage as Storage)?.clear === 'function' && typeof (storage as Storage).setItem === 'function'
  } catch {
    return false
  }
}

class MemoryStorage implements Storage {
  #data = new Map<string, string>()
  get length() {
    return this.#data.size
  }
  clear() {
    this.#data.clear()
  }
  getItem(key: string) {
    return this.#data.get(key) ?? null
  }
  key(index: number) {
    return [...this.#data.keys()][index] ?? null
  }
  removeItem(key: string) {
    this.#data.delete(key)
  }
  setItem(key: string, value: string) {
    this.#data.set(key, String(value))
  }
}

for (const name of ['localStorage', 'sessionStorage'] as const) {
  if (!isUsable(globalThis[name])) {
    Object.defineProperty(globalThis, name, { value: new MemoryStorage(), configurable: true, writable: true })
  }
}
