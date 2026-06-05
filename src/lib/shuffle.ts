/**
 * Cryptographically-seeded random helpers for the Relive feed.
 *
 * We use crypto.getRandomValues directly (no PRNG seed) so each call produces a
 * fresh, non-deterministic order. Order is held in a ref by the caller, so this
 * is invoked sparingly (on explicit reshuffle).
 */

function secureRandomInt(maxExclusive: number): number {
  if (maxExclusive <= 0) return 0;
  // Rejection-sampled uniform int in [0, maxExclusive).
  const range = 0x100000000; // 2^32
  const limit = range - (range % maxExclusive);
  const buf = new Uint32Array(1);
  while (true) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % maxExclusive;
  }
}

/** Fisher–Yates shuffle backed by crypto.getRandomValues. Returns a new array. */
export function secureShuffle<T>(arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Insert `item` at a uniformly random index of a copy of `arr`. */
export function insertAtRandomIndex<T>(arr: readonly T[], item: T): T[] {
  const idx = secureRandomInt(arr.length + 1);
  const out = arr.slice();
  out.splice(idx, 0, item);
  return out;
}
