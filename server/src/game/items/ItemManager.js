import { GolfClub } from './GolfClub.js';
import {
  CLUB_SPAWN_POSITIONS,
  PICKUP_RADIUS,
} from '@core-rivals/shared/constants/GameConstants';

/**
 * ItemManager — owns the lifecycle of all WorldItems for one match.
 *
 * Responsibilities:
 *   • Spawn golf clubs at fixed positions on construction.
 *   • tryPickup  — nearest available item within PICKUP_RADIUS.
 *   • drop       — returns item to world at player's feet.
 *   • releaseAll — reset all items held by a disconnecting player.
 *   • getSnapshot — serialise all items for MATCH_STATE broadcast.
 */
export class ItemManager {
  constructor() {
    /** @type {Map<string, import('./WorldItem.js').WorldItem>} */
    this._items = new Map();
    this._spawnClubs();
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Attempt to pick up the nearest available item.
   * A player can only hold one item at a time.
   *
   * @param {string} playerId
   * @param {number} px
   * @param {number} pz
   * @returns {import('./WorldItem.js').WorldItem | null}
   */
  tryPickup(playerId, px, pz) {
    if (this._getHeldBy(playerId)) return null; // already holding something

    let nearest     = null;
    let nearestDist = PICKUP_RADIUS;

    for (const item of this._items.values()) {
      if (!item.isAvailable) continue;
      const dx   = item.x - px;
      const dz   = item.z - pz;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < nearestDist) { nearestDist = dist; nearest = item; }
    }

    if (!nearest) return null;
    nearest.pickup(playerId);
    return nearest;
  }

  /**
   * Drop the item held by this player at the given position.
   * @param {string} playerId
   * @param {number} px
   * @param {number} pz
   * @returns {import('./WorldItem.js').WorldItem | null}
   */
  drop(playerId, px, pz) {
    const item = this._getHeldBy(playerId);
    if (!item) return null;
    item.drop(px, pz);
    return item;
  }

  /**
   * Get the item currently held by a player (or null).
   * @param {string} playerId
   * @returns {import('./WorldItem.js').WorldItem | null}
   */
  getHeldBy(playerId) {
    return this._getHeldBy(playerId);
  }

  /**
   * Reset all items held by this player to their spawn positions.
   * Called when a player disconnects.
   * @param {string} playerId
   */
  releaseAll(playerId) {
    const item = this._getHeldBy(playerId);
    if (item) item.resetToSpawn();
    return item ?? null;
  }

  /**
   * Serialise all items for inclusion in MATCH_STATE.
   * @returns {Array<object>}
   */
  getSnapshot() {
    return [...this._items.values()].map((i) => i.serialize());
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  _spawnClubs() {
    for (const pos of CLUB_SPAWN_POSITIONS) {
      const club = new GolfClub(pos.x, pos.y ?? 0, pos.z);
      this._items.set(club.id, club);
    }
  }

  _getHeldBy(playerId) {
    for (const item of this._items.values()) {
      if (item.ownerId === playerId) return item;
    }
    return null;
  }
}
