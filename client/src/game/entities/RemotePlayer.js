/**
 * RemotePlayer — a player controlled by a different browser tab.
 *
 * Position is interpolated from server snapshots with a fixed 100ms delay
 * so there are always ≥ 2 states in the buffer to interpolate between,
 * eliminating jitter caused by variable server tick delivery.
 *
 * Visual representation delegated to PlayerMesh (same as LocalPlayer).
 */

import { PlayerMesh } from './PlayerMesh.js';

/** ms delay behind "live" — must be ≥ 1 server broadcast interval (50ms) */
const INTERPOLATION_DELAY = 100;
const MAX_BUFFER_SIZE     = 20;

export class RemotePlayer {
  /**
   * @param {import('three').Scene} scene
   * @param {string} socketId
   * @param {string} character  — 'duman' | 'moises' | 'sebastian'
   * @param {string} name       — display name
   * @param {{ x:number, y:number, z:number }} initialPos
   */
  constructor(scene, socketId, character, name, initialPos) {
    this.socketId = socketId;

    /** @type {Array<{ time:number, x:number, y:number, z:number, yaw:number }>} */
    this._buffer = [];

    /** Latest interpolated XZ (for ground sampling). */
    this._pos = { x: initialPos?.x ?? 0, z: initialPos?.z ?? 0 };

    this._mesh = new PlayerMesh(scene, character, name, /* isLocal= */ false);

    if (initialPos) {
      this._mesh.setTransform(initialPos.x, 0, initialPos.z, 0);
      // Seed buffer so interpolation can start immediately
      const now = Date.now();
      const seed = { time: now - INTERPOLATION_DELAY, x: initialPos.x, y: 0, z: initialPos.z, yaw: 0 };
      this._buffer.push(seed, { ...seed, time: now });
    }
  }

  // ─── State updates ──────────────────────────────────────────────────────────

  /** Called when a MATCH_STATE snapshot contains data for this player. */
  addState(state) {
    this._buffer.push({
      time: Date.now(),
      x:    state.x,
      y:    state.y ?? 0,
      z:    state.z,
      yaw:  state.yaw,
    });

    while (this._buffer.length > MAX_BUFFER_SIZE) this._buffer.shift();
  }

  // ─── Render update ──────────────────────────────────────────────────────────

  /** Called every frame — interpolates position from the snapshot buffer. */
  update() {
    if (this._buffer.length < 2) return;

    const renderTime = Date.now() - INTERPOLATION_DELAY;

    // Find the two buffered states that straddle renderTime
    let older = null;
    let newer = null;

    for (let i = 0; i < this._buffer.length - 1; i++) {
      if (this._buffer[i].time <= renderTime && this._buffer[i + 1].time >= renderTime) {
        older = this._buffer[i];
        newer = this._buffer[i + 1];
        break;
      }
    }

    if (!older) {
      // renderTime is past the buffer — show the most recent known state
      const last = this._buffer.at(-1);
      this._mesh.setTransform(last.x, last.y, last.z, last.yaw);
      this._pos = { x: last.x, z: last.z };
      return;
    }

    const span = newer.time - older.time;
    const t    = span > 0 ? (renderTime - older.time) / span : 0;

    const x = older.x + (newer.x - older.x) * t;
    const y = older.y + (newer.y - older.y) * t;
    const z = older.z + (newer.z - older.z) * t;

    // Lerp yaw with wrap-around correction (prevents "spinning" at ±180°)
    let dyaw = newer.yaw - older.yaw;
    if (dyaw >  Math.PI) dyaw -= Math.PI * 2;
    if (dyaw < -Math.PI) dyaw += Math.PI * 2;
    const yaw = older.yaw + dyaw * t;

    this._mesh.setTransform(x, y, z, yaw);
    this._pos = { x, z };

    // Prune states older than renderTime (keep one before for the next frame)
    while (this._buffer.length > 2 && this._buffer[1].time < renderTime) {
      this._buffer.shift();
    }
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  dispose() {
    this._mesh.dispose();
  }

  // ─── Held item (GLB hand) ─────────────────────────────────────────────────────
  get hasHandBone() { return this._mesh.hasHandBone; }
  attachClub(obj)   { return this._mesh.attachToHand(obj); }
  detachClub(obj)   { this._mesh.detachFromHand(obj); }

  // ─── Terrain ──────────────────────────────────────────────────────────────────
  get position()           { return this._pos; }
  groundAlign(nx, ny, nz)  { this._mesh.applyGroundNormal(nx, ny, nz); }

  // ─── Animation ──────────────────────────────────────────────────────────────────
  updateAnim(dt)   { this._mesh.update(dt); }
  playAction(name) { this._mesh.playAction(name); }
}
