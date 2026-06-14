/**
 * CombatController — handles push (F) and block (RMB) input.
 *
 * Push:
 *   On F keydown, finds the nearest remote player within PUSH_MAX_DISTANCE
 *   and emits GAME_PUSH { targetId }. Client-side cooldown prevents spam
 *   emissions; the server enforces the authoritative cooldown independently.
 *
 * Block:
 *   RMB down → emit GAME_BLOCK { active: true }.
 *   RMB up   → emit GAME_BLOCK { active: false }.
 *   Block state is tracked locally to drive HUD feedback.
 *
 * Usage in GameEngine:
 *   this._combat = new CombatController(socket);
 *   this._combat.init(canvas, mySocketId);
 *   // each frame:
 *   this._combat.setPositions(localPos, remotePositionsMap);
 *   // on dispose:
 *   this._combat.dispose();
 */

import {
  GAME_PUSH,
  GAME_BLOCK,
} from '@core-rivals/shared/constants/SocketEvents';
import { PUSH_MAX_DISTANCE, PUSH_COOLDOWN_SECS } from '@core-rivals/shared/constants/GameConstants';

// Client-side cooldown display (not authoritative — server has its own gate)
const PUSH_COOLDOWN_MS = PUSH_COOLDOWN_SECS * 1000;

export class CombatController {
  /**
   * @param {import('socket.io-client').Socket} socket
   */
  constructor(socket) {
    this._socket       = socket;
    this._localId      = null;
    this._localPos     = null;             // { x, z }
    /** @type {Map<string, { x:number, z:number }>} */
    this._remotePos    = new Map();

    this._isBlocking   = false;
    this._lastPushMs   = -Infinity;        // client-side cooldown timer

    // Bound listeners
    this._onKeyDown    = this._onKeyDown.bind(this);
    this._onMouseDown  = this._onMouseDown.bind(this);
    this._onMouseUp    = this._onMouseUp.bind(this);
    this._onContextMenu = this._onContextMenu.bind(this);
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  /**
   * Attach input listeners to canvas.
   * @param {HTMLCanvasElement} canvas
   * @param {string} localId
   */
  init(canvas, localId) {
    this._canvas  = canvas;
    this._localId = localId;

    window.addEventListener('keydown', this._onKeyDown);
    canvas.addEventListener('mousedown',  this._onMouseDown);
    canvas.addEventListener('mouseup',    this._onMouseUp);
    // Prevent context menu from opening on right-click
    canvas.addEventListener('contextmenu', this._onContextMenu);
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    if (this._canvas) {
      this._canvas.removeEventListener('mousedown',   this._onMouseDown);
      this._canvas.removeEventListener('mouseup',     this._onMouseUp);
      this._canvas.removeEventListener('contextmenu', this._onContextMenu);
    }
    // Ensure block is released on cleanup
    if (this._isBlocking) {
      this._isBlocking = false;
      this._socket.emit(GAME_BLOCK, { active: false });
    }
  }

  // ─── Position feed ───────────────────────────────────────────────────────────

  /**
   * Called every frame by GameEngine with latest world positions.
   * @param {{ x:number, z:number } | null} localPos
   * @param {Map<string, { x:number, z:number }>} remotePositions
   */
  setPositions(localPos, remotePositions) {
    this._localPos  = localPos;
    this._remotePos = remotePositions;
  }

  // ─── State accessors ─────────────────────────────────────────────────────────

  /** Whether the local player is currently blocking. */
  get isBlocking() { return this._isBlocking; }

  /**
   * Remaining client-side push cooldown, 0–1 (0 = ready, 1 = just fired).
   * For HUD display only — not authoritative.
   */
  get pushCooldownRatio() {
    const elapsed = performance.now() - this._lastPushMs;
    return Math.max(0, 1 - elapsed / PUSH_COOLDOWN_MS);
  }

  // ─── Input handlers ──────────────────────────────────────────────────────────

  _onKeyDown(e) {
    if (e.code !== 'KeyF') return;
    if (e.repeat) return;   // ignore auto-repeat

    // Client-side cooldown check (visual only — server re-validates)
    if (performance.now() - this._lastPushMs < PUSH_COOLDOWN_MS) return;

    const target = this._findNearestTarget();
    if (!target) return;

    this._lastPushMs = performance.now();
    this._socket.emit(GAME_PUSH, { targetId: target.id });
  }

  _onMouseDown(e) {
    if (e.button !== 2) return;   // RMB only
    e.preventDefault();
    if (this._isBlocking) return;
    this._isBlocking = true;
    this._socket.emit(GAME_BLOCK, { active: true });
  }

  _onMouseUp(e) {
    if (e.button !== 2) return;
    if (!this._isBlocking) return;
    this._isBlocking = false;
    this._socket.emit(GAME_BLOCK, { active: false });
  }

  _onContextMenu(e) {
    e.preventDefault();   // always suppress — RMB is a game action
  }

  // ─── Target selection ────────────────────────────────────────────────────────

  /**
   * Find the nearest remote player within PUSH_MAX_DISTANCE.
   * @returns {{ id:string, x:number, z:number } | null}
   */
  _findNearestTarget() {
    if (!this._localPos) return null;

    let nearest     = null;
    let nearestDist = PUSH_MAX_DISTANCE;

    for (const [id, pos] of this._remotePos) {
      const dx   = pos.x - this._localPos.x;
      const dz   = pos.z - this._localPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest     = { id, x: pos.x, z: pos.z };
      }
    }

    return nearest;
  }
}
