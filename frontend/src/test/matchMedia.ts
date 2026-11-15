/**
 * Install a fake `window.matchMedia` that answers the given queries (others → false).
 * Returns a function that restores the previous value.
 */
export function mockMatchMedia(matches: Record<string, boolean>): () => void {
  const previous = Object.getOwnPropertyDescriptor(window, 'matchMedia')
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string): MediaQueryList =>
      ({
        matches: matches[query] ?? false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  })
  return () => {
    if (previous) Object.defineProperty(window, 'matchMedia', previous)
    else delete (window as { matchMedia?: unknown }).matchMedia
  }
}
