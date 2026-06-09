/**
 * ScoreManager — tracks scores for one match.
 *
 * Score rule: when the ball enters Core[i], the two players who do NOT own
 * that Core each receive +1 point. The owner receives nothing.
 *
 * Core ownership: CORE_POSITIONS[i] belongs to the player in slot i+1.
 */

export class ScoreManager {
  /**
   * @param {Array<{ socketId: string, slot: number }>} players
   */
  constructor(players) {
    /** @type {Record<string, number>} socketId → score */
    this._scores = {};

    /** @type {Record<number, string>} coreIndex → ownerSocketId */
    this._coreOwner = {};

    for (const p of players) {
      this._scores[p.socketId]      = 0;
      this._coreOwner[p.slot - 1]  = p.socketId;
    }
  }

  /**
   * Register a goal in Core[coreIndex].
   * The two non-owners each receive +1.
   * @param {number} coreIndex — 0, 1, or 2
   * @returns {Record<string, number>} updated scores snapshot
   */
  registerGoal(coreIndex) {
    const ownerId = this._coreOwner[coreIndex];
    for (const id of Object.keys(this._scores)) {
      if (id !== ownerId) this._scores[id]++;
    }
    return this.getScores();
  }

  /** @returns {Record<string, number>} shallow copy of current scores */
  getScores() {
    return { ...this._scores };
  }
}
