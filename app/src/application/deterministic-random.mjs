/**
 * Small storage- and DOM-free unsigned-32-bit random stream used only where a
 * caller already owns an explicit deterministic seed. It is not a source of
 * entropy and never reads time, crypto, or ambient randomness.
 */
export function createSeededRandom(seed) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError('seed must be an unsigned 32-bit integer');
  }
  let state = (seed >>> 0) || 0x9e3779b9;
  return Object.freeze({
    nextUint32() {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return state >>> 0;
    },
    nextFloat() {
      return this.nextUint32() / 0x1_0000_0000;
    },
    nextInt(maximumExclusive) {
      if (!Number.isInteger(maximumExclusive) || maximumExclusive <= 0) {
        throw new RangeError('maximumExclusive must be a positive integer');
      }
      return Math.floor(this.nextFloat() * maximumExclusive);
    },
    choose(values) {
      if (!Array.isArray(values) || values.length === 0) {
        throw new RangeError('Cannot choose from an empty collection');
      }
      return values[this.nextInt(values.length)];
    },
    shuffle(values) {
      const shuffled = [...values];
      for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const selected = this.nextInt(index + 1);
        [shuffled[index], shuffled[selected]] = [shuffled[selected], shuffled[index]];
      }
      return shuffled;
    },
  });
}
