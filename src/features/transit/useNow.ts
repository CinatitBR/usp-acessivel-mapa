import { useEffect, useState } from 'react';

/** Re-renders every 10 s so "3 min" keeps counting down, and estimates follow the buses, between refreshes. */
export function useNow(): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
