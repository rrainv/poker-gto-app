/**

 * Perfect Hash using Combinatorial Number System

 * Maps each unique 5-card combination to a unique index in [0, C(52,5)-1]

 * without collisions using the combinatorial number system.

 */

class PerfectHash {

  constructor() {

    // Pre-computed binomial coefficients C(n,k) for n up to 52, k up to 5

    this.binomial = this.computeBinomials(52, 5);

  }



  computeBinomials(maxN, maxK) {

    const binom = Array(maxN + 1).fill(0).map(() => Array(maxK + 1).fill(0));

    for (let n = 0; n <= maxN; n++) {

      binom[n][0] = 1;

      for (let k = 1; k <= Math.min(n, maxK); k++) {

        binom[n][k] = binom[n - 1][k - 1] + binom[n - 1][k];

      }

    }

    return binom;

  }



  /**

   * Convert a 5-card combination to a unique index using combinatorial number system

   * Cards must be sorted in ascending order (0-51 where 0=2s, 1=2h, ..., 51=Ac)

   */

  hash5(cards) {

    const sorted = [...cards].sort((a, b) => a - b);

    let index = 0;

    for (let i = 0; i < 5; i++) {

      for (let j = 0; j < sorted[i]; j++) {

        index += this.binomial[51 - j][4 - i];

      }

    }

    return index;

  }



  /**

   * Convert card string to 0-51 index

   * 0=2s, 1=2h, 2=2d, 3=2c, 4=3s, ..., 51=Ac

   */

  cardToIndex(card) {

    const rank = RANKS.indexOf(card[0]);

    const suit = ['s', 'h', 'd', 'c'].indexOf(card[1]);

    return rank * 4 + suit;

  }



  /**

   * Convert 0-51 index to card string

   */

  indexToCard(index) {

    const rank = Math.floor(index / 4);

    const suit = index % 4;

    return RANKS[rank] + ['s', 'h', 'd', 'c'][suit];

  }

}



const perfectHash = new PerfectHash();
export { PerfectHash, perfectHash };