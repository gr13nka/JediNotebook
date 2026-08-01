import { useEffect, useState } from 'react';

// Reactive `window.matchMedia` match. Lazy initial state reads the query
// synchronously so the first frame already has the correct layout (no
// mobile-layout flash on desktop).
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mq = window.matchMedia(query);
    setMatches(mq.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);

  return matches;
}
