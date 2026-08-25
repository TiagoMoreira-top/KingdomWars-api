/**
 * ⚖️ GAME RULES
 *
 * Scalar rules that belong to no single building or unit. Kept out of
 * BUILDINGS deliberately: that object is iterated in a dozen places to list
 * every structure, so a stray non-building key there shows up in the UI as a
 * phantom building.
 */
const GAME_RULES = {
  /**
   * ⏱️ A work with less than this remaining may be waved through at no cost.
   * Served to the client so its button greys out on exactly the rule the
   * server enforces — the two can never disagree about the boundary.
   */
  AUTO_FINISH_MS: 3 * 60 * 1000,

  /** Base number of simultaneous works, before research adds crews. */
  BASE_BUILD_SLOTS: 3,
};

module.exports = GAME_RULES;
