/** What the device tells us about itself. Missing values mean the browser does not say. */
export type DeviceHints = {
  reducedMotion: boolean;
  webgl2: boolean;
  /** Gigabytes, as reported by `navigator.deviceMemory` (Chromium only). */
  memory?: number;
  cores?: number;
  /** Touch-first device (phone or tablet). */
  coarsePointer: boolean;
};

/**
 * Whether to start without the 3D layer. Deliberately conservative: it is
 * better to give a weak phone a fluid flat map than a stuttering 3D one, and
 * the user can always turn 3D on by hand.
 */
export function shouldStartLite(hints: DeviceHints): boolean {
  if (hints.reducedMotion || !hints.webgl2) return true;
  if (hints.memory !== undefined && hints.memory <= 2) return true;
  return hints.coarsePointer && hints.cores !== undefined && hints.cores <= 4;
}

export function readDeviceHints(): DeviceHints {
  const matches = (query: string) => typeof matchMedia === 'function' && matchMedia(query).matches;
  const nav = typeof navigator === 'undefined' ? undefined : (navigator as Navigator & { deviceMemory?: number });
  return {
    reducedMotion: matches('(prefers-reduced-motion: reduce)'),
    webgl2: typeof WebGL2RenderingContext !== 'undefined',
    memory: nav?.deviceMemory,
    cores: nav?.hardwareConcurrency,
    coarsePointer: matches('(pointer: coarse)'),
  };
}

export type LiteChoice = 'auto' | 'on' | 'off';

/** The user's explicit choice always wins over detection and the watchdog. */
export function resolveLite(choice: LiteChoice, detected: boolean, watchdogTripped: boolean): boolean {
  if (choice === 'on') return true;
  if (choice === 'off') return false;
  return detected || watchdogTripped;
}

const STORAGE_KEY = 'usp-map:lite';

export function readLiteChoice(): LiteChoice {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'on' || stored === 'off' ? stored : 'auto';
  } catch {
    return 'auto';
  }
}

export function storeLiteChoice(choice: LiteChoice) {
  try {
    if (choice === 'auto') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // Private browsing or storage disabled: the choice lasts for this visit only.
  }
}
