// riverline-audio-foley-manifest/v1: recorded poker-world foley and cue layering data.
(function installRiverlineAudioFoleyManifest(globalScope) {
  const SCHEMA_VERSION = 'riverline-audio-foley-manifest/v1';
  const LICENSE = Object.freeze({
    id: 'CC0-1.0',
    name: 'Creative Commons CC0 1.0 Universal',
    url: 'https://creativecommons.org/publicdomain/zero/1.0/'
  });

  function sample({
    id,
    family,
    file,
    author,
    soundId,
    title,
    durationMs,
    sha256,
    production = true,
    gainTrim = 1,
    sourceOffsetMs = 0,
    playDurationMs = durationMs,
    fadeOutMs = 18
  }) {
    return Object.freeze({
      schemaVersion: 'riverline-audio-foley-sample/v1',
      id,
      family,
      production,
      sourceType: 'recorded_foley',
      url: `assets/audio/foley/${file}`,
      format: 'audio/ogg',
      durationMs,
      playback: Object.freeze({ gainTrim, sourceOffsetMs, playDurationMs, fadeOutMs }),
      sha256,
      provenance: Object.freeze({
        provider: 'Freesound',
        author,
        soundId,
        title,
        pageUrl: `https://freesound.org/people/${author}/sounds/${soundId}/`,
        artifact: 'Freesound high-quality Ogg preview of the CC0 source recording',
        license: LICENSE
      })
    });
  }

  const samples = Object.freeze([
    sample({ id: 'card-deal-01', family: 'cards_deal', file: 'cards/deal_01.ogg', author: 'el_boss', soundId: 571577, title: 'Playing Card Deal Variation 1', durationMs: 754, gainTrim: 1, sourceOffsetMs: 70, playDurationMs: 430, sha256: 'b5f67a777bb249ec5eeb91582b737cda3f39f180d206748678c561b4bab15f76' }),
    sample({ id: 'card-deal-02', family: 'cards_deal', file: 'cards/deal_02.ogg', author: 'RealSquink', soundId: 787405, title: 'Card Deal', durationMs: 779, gainTrim: 0.78, sourceOffsetMs: 110, playDurationMs: 540, sha256: '77fd32773efe912176f9b18e7c7c1bf6f8be63a147f71e9f43cce0d3781525bf' }),
    sample({ id: 'card-slide-01', family: 'cards_slide', file: 'cards/slide_01.ogg', author: 'SilverDubloons', soundId: 817579, title: 'slideCard04', durationMs: 348, gainTrim: 1.35, sourceOffsetMs: 20, playDurationMs: 320, sha256: '57bd4de5516ac6754566004419bf0d0919ce4a812015a92267ec87ccf837c920' }),
    sample({ id: 'card-slide-02', family: 'cards_slide', file: 'cards/slide_02.ogg', author: 'el_boss', soundId: 571581, title: 'Playing Card Slide Right', durationMs: 265, production: false, sha256: 'ad925fadb9b7087f8b9134f5ff56121b0e7e589190a4c8b546f9b5e219988202' }),
    sample({ id: 'chip-small-01', family: 'chips_small', file: 'chips/small_01.ogg', author: 'SilverDubloons', soundId: 817552, title: 'chip00', durationMs: 319, gainTrim: 1.1, playDurationMs: 290, sha256: '75847401912ffc2a40a393ce40498a184fee531ac518dd9fb90f0e028f599c58' }),
    sample({ id: 'chip-small-02', family: 'chips_small', file: 'chips/small_02.ogg', author: 'SilverDubloons', soundId: 817554, title: 'chip02', durationMs: 331, gainTrim: 0.97, playDurationMs: 320, sha256: '464254e98338097dbb142ab20a2d04149e7dc89eecd0c2744ed0e7b9db36050b' }),
    sample({ id: 'chip-small-03', family: 'chips_small', file: 'chips/small_03.ogg', author: 'SilverDubloons', soundId: 817555, title: 'chip04', durationMs: 240, gainTrim: 0.83, playDurationMs: 220, sha256: '3acaba023538526bc5bf3e34f026a56589bf26b0468631389f82e03f9c5af469' }),
    sample({ id: 'chip-medium-01', family: 'chips_medium', file: 'chips/medium_01.ogg', author: 'fartheststar', soundId: 201809, title: 'poker_chips5.wav', durationMs: 375, gainTrim: 0.72, playDurationMs: 230, sha256: 'cbe622c64bcd2f55c498befa60d369faf452b64a9da3e4ce7afe7e872466b089' }),
    sample({ id: 'chip-medium-02', family: 'chips_medium', file: 'chips/medium_02.ogg', author: 'Za-Games', soundId: 540369, title: 'Poker Chip Drop', durationMs: 708, production: false, sha256: '9771a7a83a3735d44b1b420afac751970e7f2a9317b571027c15aeb89304abfd' }),
    sample({ id: 'chip-large-01', family: 'chips_large', file: 'chips/large_01.ogg', author: 'Joma86', soundId: 532861, title: 'AllInPushChips.wav', durationMs: 929, gainTrim: 0.5, playDurationMs: 920, fadeOutMs: 28, sha256: '68c2b61473c0a4333dfe246df5aa0730cf39acd59729321b0b5e05b08e46d942' }),
    sample({ id: 'chip-large-02', family: 'chips_large', file: 'chips/large_02.ogg', author: 'Joma86', soundId: 532860, title: 'AllInPushChips2.wav', durationMs: 848, gainTrim: 0.85, playDurationMs: 830, fadeOutMs: 28, sha256: '3168d7884a8dcece5d70cc370a60bb27595eaa41d253bd34a73a367f0421f688' }),
    sample({ id: 'chip-pot-01', family: 'chips_pot', file: 'chips/pot_01.ogg', author: 'SilverDubloons', soundId: 817567, title: 'clatter10', durationMs: 1207, gainTrim: 0.55, sourceOffsetMs: 70, playDurationMs: 1100, fadeOutMs: 32, sha256: '6d6b98a5a59a1efafc891cbd9b62b07e619629bb075f1b8e492db43a7e652329' }),
    sample({ id: 'chip-pot-02', family: 'chips_pot', file: 'chips/pot_02.ogg', author: 'Za-Games', soundId: 540368, title: 'Handfull of Poker Chips', durationMs: 352, production: false, sha256: 'd7ac3cf33acd804bb23637c97e2b8bfd9c22043a1af9f9b4e2958323309b6c15' }),
    sample({ id: 'table-check-01', family: 'table_check', file: 'table/check_01.ogg', author: 'NoisyRedFox', soundId: 742356, title: 'SingleKnock_Wood', durationMs: 203, gainTrim: 0.42, sourceOffsetMs: 43, playDurationMs: 74, fadeOutMs: 18, sha256: '8af8671c46811ec5512e1fe85ca7eec90a1575979adce68c91916a5bf7c60a72' }),
    sample({ id: 'table-check-02', family: 'table_check', file: 'table/check_02.ogg', author: 'emapuree', soundId: 848748, title: 'tap on felt', durationMs: 217, production: false, sha256: 'bf88b8abb05f1bae88274d86bb62e27576025a539e5dd54922f65ae3aca369f5' })
  ]);

  const families = Object.freeze(samples.reduce((result, entry) => {
    if (!entry.production) return result;
    if (!result[entry.family]) result[entry.family] = [];
    result[entry.family].push(entry.id);
    return result;
  }, {}));
  Object.values(families).forEach(Object.freeze);

  function layer(family, { count = 1, spacingMs = 0, gain = 1 } = {}) {
    return Object.freeze({ family, count, spacingMs, gain });
  }

  const cues = Object.freeze({
    card_deal: Object.freeze({ layers: Object.freeze([layer('cards_deal', { gain: 0.88 })]) }),
    board_reveal: Object.freeze({ layers: Object.freeze([layer('cards_deal', { count: 3, spacingMs: 92, gain: 0.72 })]) }),
    card_reveal: Object.freeze({ layers: Object.freeze([layer('cards_deal', { gain: 0.8 })]) }),
    check: Object.freeze({ layers: Object.freeze([layer('table_check', { gain: 0.78 })]) }),
    fold: Object.freeze({ layers: Object.freeze([layer('cards_slide', { gain: 0.88 })]) }),
    call: Object.freeze({ layers: Object.freeze([layer('chips_small', { gain: 0.55 })]) }),
    bet: Object.freeze({ layers: Object.freeze([layer('chips_medium', { gain: 0.74 })]) }),
    raise: Object.freeze({ layers: Object.freeze([layer('chips_medium', { count: 2, spacingMs: 44, gain: 0.7 })]) }),
    all_in: Object.freeze({ layers: Object.freeze([layer('chips_large', { gain: 0.92 })]) }),
    pot_collect: Object.freeze({ layers: Object.freeze([layer('chips_pot', { gain: 0.74 })]) })
  });

  const manifest = Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    sourcePolicy: 'recorded_foley_primary',
    variation: Object.freeze({ playbackRateRange: Object.freeze([0.998, 1.002]), gainRange: Object.freeze([0.99, 1.01]), timingJitterMs: 1.5 }),
    samples,
    families,
    cues
  });

  Object.defineProperty(globalScope, 'RiverlineAudioFoleyManifest', {
    configurable: false,
    enumerable: false,
    value: manifest,
    writable: false
  });
})(globalThis);
