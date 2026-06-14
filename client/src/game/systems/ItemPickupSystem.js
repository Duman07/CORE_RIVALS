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

const INTERACT_KEY = 'KeyE';

export class ItemPickupSystem {
  /**
   * @param {import('socket.io-client').Socket} socket
   */
  constructor(socket) {
    this._socket   = socket;
    this._holding  = false;
    this._heldId   = null;

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

  get isHolding()  { return this._holding; }
  get heldItemId() { return this._heldId; }

  dispose() {
    document.removeEventListener('keydown', this._onKeyDown);
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  _onKeyDown(e) {
    if (e.code !== INTERACT_KEY || e.repeat) return;
    if (this._holding) {
      this._socket.emit(GAME_DROP, {});
    } else {
      this._socket.emit(GAME_PICKUP, {});
    }
  }
}
