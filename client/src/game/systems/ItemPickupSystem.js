/**
 * ItemPickupSystem — handles client-side item interaction.
 *
 * Responsibilities:
 *   • Listen for [E] keypress → emit GAME_PICKUP or GAME_DROP.
 *   • Track whether the local player is currently holding an item,
 *     by syncing with the items snapshot from MATCH_STATE.
 *
 * Design:
 *   • Emits only — no client-side prediction of item state.
 *   • Server is authoritative; MATCH_STATE confirms the new state.
 */

import { GAME_PICKUP, GAME_DROP } from '@core-rivals/shared/constants/SocketEvents';
import { PICKUP_RADIUS }          from '@core-rivals/shared/constants/GameConstants';

const INTERACT_KEY     = 'KeyE';
const PICKUP_EMIT_COOLDOWN = 350; // ms — avoid spamming GAME_PICKUP each frame

export class ItemPickupSystem {
  /**
   * @param {import('socket.io-client').Socket} socket
   */
  constructor(socket) {
    this._socket    = socket;
    this._holding   = false;
    this._heldId    = null;
    this._lastEmit  = 0;

    this._onKeyDown = this._onKeyDown.bind(this);
    document.addEventListener('keydown', this._onKeyDown);
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  /** Called each server tick from GameEngine with the latest items snapshot. */
  syncState(items, mySocketId) {
    const mine     = items?.find((i) => i.ownerId === mySocketId) ?? null;
    this._holding  = mine !== null;
    this._heldId   = mine?.id ?? null;
  }

  /**
   * Walk-over auto-pickup. Called every frame from GameEngine with the local
   * player position and the latest item snapshot. When the player is empty-handed
   * and stands on an available golf club, it emits GAME_PICKUP (throttled). The
   * server stays authoritative — it re-checks distance and confirms via MATCH_STATE.
   *
   * @param {{ x:number, z:number } | null} localXZ
   * @param {Array<object> | null} items
   */
  update(localXZ, items) {
    if (this._holding || !localXZ || !items) return;

    let near = false;
    for (const it of items) {
      if (it.type !== 'golf_club' || it.ownerId !== null) continue;
      const dx = it.x - localXZ.x;
      const dz = it.z - localXZ.z;
      if (dx * dx + dz * dz <= PICKUP_RADIUS * PICKUP_RADIUS) { near = true; break; }
    }
    if (!near) return;

    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    if (now - this._lastEmit < PICKUP_EMIT_COOLDOWN) return;
    this._lastEmit = now;
    this._socket.emit(GAME_PICKUP, {});
  }

  get isHolding()  { return this._holding; }
  get heldItemId() { return this._heldId; }

  dispose() {
    document.removeEventListener('keydown', this._onKeyDown);
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  _onKeyDown(e) {
    if (e.code !== INTERACT_KEY || e.repeat) return;
    // [E] now only drops; pickup happens automatically on walk-over.
    if (this._holding) this._socket.emit(GAME_DROP, {});
  }
}
