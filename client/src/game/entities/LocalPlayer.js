/**
 * LocalPlayer — the player controlled by this browser tab.
 *
 * Visual representation is fully delegated to PlayerMesh, which handles
 * the GLB load, fallback capsule, and floating name label.
 *
 * This class owns only:
 *   • Mutable position / yaw state
 *   • Client-side prediction  (applyInput)
 *   • Server reconciliation   (reconcile)
 */

import { applyMovement } from '@core-rivals/shared/movement/MovementUtils';
import { PlayerMesh }    from './PlayerMesh.js';

export class LocalPlayer {
  /**
   * @param {import('three').Scene} scene
   * @param {string} socketId
   * @param {string} character  — 'duman' | 'moises' | 'sebastian'
   * @param {string} name       — display name (shown in label)
   * @param {{ x:number, y:number, z:number }} initialPos
   */
  constructor(scene, socketId, character, name, initialPos) {
    this.socketId = socketId;

    /** Authoritative position — updated by prediction and reconciliation */
    this.position = { x: initialPos.x, y: 0, z: initialPos.z };
    this.yaw      = 0;

    this._mesh = new PlayerMesh(scene, character, name, /* isLocal= */ true);
    this._syncMesh();
  }

  // ─── Prediction ─────────────────────────────────────────────────────────────

  /**
   * Apply one frame of local movement prediction.
   * Called every frame before the server snapshot arrives.
   *
   * @param {{ dx:number, dz:number, sprint:boolean, yaw:number }} input
   * @param {number} dt — frame delta (seconds)
   */
  applyInput(input, dt) {
    const next    = applyMovement(this.position, { ...input, dt });
    this.position = { x: next.x, y: next.y, z: next.z };
    this.yaw      = next.yaw;
    this._syncMesh();
  }

  // ─── Reconciliation ─────────────────────────────────────────────────────────

  /**
   * Snap to server authoritative position, then replay unacknowledged inputs.
   *
   * @param {{ x:number, y:number, z:number, yaw:number }} serverState
   * @param {object[]} bufferedInputs — inputs server hasn't processed yet
   */
  reconcile(serverState, bufferedInputs) {
    // 1. Accept server truth
    this.position = { x: serverState.x, y: serverState.y ?? 0, z: serverState.z };
    this.yaw      = serverState.yaw;

    // 2. Re-simulate inputs not yet processed by the server
    for (const input of bufferedInputs) {
      const next    = applyMovement(this.position, input);
      this.position = { x: next.x, y: next.y, z: next.z };
      this.yaw      = next.yaw;
    }

    this._syncMesh();
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  dispose() {
    this._mesh.dispose();
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  _syncMesh() {
    this._mesh.setTransform(this.position.x, this.position.y, this.position.z, this.yaw);
  }
}
