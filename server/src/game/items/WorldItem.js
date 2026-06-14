import { v4 as uuidv4 } from 'uuid';

/**
 * WorldItem — base entity for any pickable object that lives in the world.
 *
 * State machine:
 *   AVAILABLE  (ownerId === null)   — sitting at world position
 *   HELD       (ownerId === string) — carried by a player
 *
 * Transitions:
 *   pickup(playerId)  → AVAILABLE → HELD
 *   drop(x, z)        → HELD → AVAILABLE at new pos
 *   resetToSpawn()    → any → AVAILABLE at original spawn
 */
export class WorldItem {
  /**
   * @param {{ type: string, x: number, y: number, z: number }} opts
   */
  constructor({ type, x, y, z }) {
    this.id      = uuidv4();
    this.type    = type;
    this.x       = x;
    this.y       = y;
    this.z       = z;
    this.ownerId = null;

    // Cached for resetToSpawn
    this._spawnX = x;
    this._spawnY = y;
    this._spawnZ = z;
  }

  // ─── Computed ───────────────────────────────────────────────────────────────

  get isAvailable() {
    return this.ownerId === null;
  }

  // ─── Transitions ────────────────────────────────────────────────────────────

  pickup(playerId) {
    this.ownerId = playerId;
  }

  drop(x, z) {
    this.ownerId = null;
    this.x       = x;
    this.z       = z;
  }

  resetToSpawn() {
    this.ownerId = null;
    this.x       = this._spawnX;
    this.y       = this._spawnY;
    this.z       = this._spawnZ;
  }

  // ─── Serialisation ──────────────────────────────────────────────────────────

  serialize() {
    return {
      id:      this.id,
      type:    this.type,
      x:       this.x,
      y:       this.y,
      z:       this.z,
      ownerId: this.ownerId,
    };
  }
}
