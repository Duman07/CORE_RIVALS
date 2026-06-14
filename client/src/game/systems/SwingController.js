/**
 * SwingController — manages golf swing input on the client.
 *
 * State machine:
 *   IDLE      — waiting; player must hold a club
 *   CHARGING  — [SPACE] held down; power accumulates
 *   COOLDOWN  — swing emitted; waiting for server cooldown to expire
 *
 * On [SPACE] release from CHARGING state:
 *   → emits GAME_SWING { power, yaw, itemId } to server
 *   → transitions to COOLDOWN for visual feedback
 *
 * COOLDOWN timer is driven by update(dt); the server is the true gate.
 * If the server rejects the swing (e.g. cooldown not expired, out of reach),
 * the client transitions back to IDLE on its own after SWING_COOLDOWN_SECS.
 */

import { GAME_SWING } from '@core-rivals/shared/constants/SocketEvents';
import { SWING_CHARGE_TIME, SWING_COOLDOWN_SECS } from '@core-rivals/shared/constants/GameConstants';

const SWING_KEY = 'Space';

export class SwingController {
  /**
   * @param {import('socket.io-client').Socket} socket
   */
  constructor(socket) {
    this._socket  = socket;
    this._state   = 'IDLE';   // IDLE | CHARGING | COOLDOWN
    this._power   = 0;
    this._itemId  = null;
    this._yaw     = 0;
    this._cdTimer = 0;        // cooldown countdown (seconds)

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp   = this._onKeyUp.bind(this);
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup',   this._onKeyUp);
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  /** Set every frame from CameraController / InputSystem yaw. */
  setYaw(yaw) {
    this._yaw = yaw;
  }

  /** Set by ItemPickupSystem after MATCH_STATE sync. null = not holding. */
  setItemId(id) {
    this._itemId = id;
    // If the club was dropped while charging, cancel the swing
    if (id === null && this._state === 'CHARGING') {
      this._state = 'IDLE';
      this._power = 0;
    }
  }

  /**
   * Advance the swing state machine.
   * @param {number} dt — frame delta-time in seconds
   */
  update(dt) {
    if (this._state === 'CHARGING') {
      this._power = Math.min(1, this._power + dt / SWING_CHARGE_TIME);
    } else if (this._state === 'COOLDOWN') {
      this._cdTimer -= dt;
      if (this._cdTimer <= 0) {
        this._cdTimer = 0;
        this._state   = 'IDLE';
      }
    }
  }

  get state()    { return this._state; }
  get power()    { return this._power; }
  get cdFrac()   { return this._cdTimer / SWING_COOLDOWN_SECS; } // 0–1 remaining fraction

  dispose() {
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup',   this._onKeyUp);
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  _onKeyDown(e) {
    if (e.code !== SWING_KEY || e.repeat) return;
    if (this._state === 'IDLE' && this._itemId !== null) {
      this._state = 'CHARGING';
      this._power = 0;
    }
  }

  _onKeyUp(e) {
    if (e.code !== SWING_KEY) return;
    if (this._state === 'CHARGING') {
      this._emit();
    }
  }

  _emit() {
    this._socket.emit(GAME_SWING, {
      power:  this._power,
      yaw:    this._yaw,
      itemId: this._itemId,
    });
    // Start local cooldown for UI feedback (server is the real gate)
    this._state   = 'COOLDOWN';
    this._cdTimer = SWING_COOLDOWN_SECS;
    this._power   = 0;
  }
}
