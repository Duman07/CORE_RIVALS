/**
 * CameraController — third-person orbit camera.
 *
 * The camera is always positioned behind the player at a configurable distance,
 * orbiting around the player based on the current yaw (horizontal) and pitch
 * (vertical) from InputSystem.
 *
 * Camera position derivation (yaw=0 → player faces −Z):
 *   Behind vector = opposite of facing direction = (sin yaw, 0, cos yaw)
 *   Camera pos    = player.pos + behindVector * DISTANCE + (0, HEIGHT, 0)
 *
 * The position is smoothed with lerp each frame to prevent jitter when the
 * player position snaps during reconciliation.
 */

import * as THREE from 'three';

const DISTANCE      = 8;     // metres behind the player
const HEIGHT        = 4.5;   // metres above the player's feet
const LOOK_AT_Y     = 1.4;   // look toward player's torso, not feet
const LERP_FACTOR   = 0.12;  // camera smoothing (lower = smoother but laggier)
const PITCH_DIST    = 2.5;   // how much pitch affects vertical offset

export class CameraController {
  constructor() {
    this._target  = new THREE.Vector3();
    this._current = new THREE.Vector3();
    this._lookAt  = new THREE.Vector3();
    this._first   = true;
  }

  /**
   * Update camera position and look-at every frame.
   *
   * @param {THREE.PerspectiveCamera} camera
   * @param {{ x:number, y:number, z:number }} playerPos
   * @param {number} yaw   — from InputSystem
   * @param {number} pitch — from InputSystem
   */
  update(camera, playerPos, yaw, pitch) {
    // Camera sits behind the player (opposite of facing direction)
    const sinYaw = Math.sin(yaw);
    const cosYaw = Math.cos(yaw);

    const horizDist = DISTANCE;
    const vertOff   = HEIGHT + pitch * PITCH_DIST;

    this._target.set(
      playerPos.x + sinYaw * horizDist,
      Math.max(0.5, vertOff),           // never go below the floor
      playerPos.z + cosYaw * horizDist,
    );

    if (this._first) {
      // Snap on first frame to avoid flying in from origin
      this._current.copy(this._target);
      this._first = false;
    } else {
      this._current.lerp(this._target, LERP_FACTOR);
    }

    camera.position.copy(this._current);

    this._lookAt.set(playerPos.x, LOOK_AT_Y, playerPos.z);
    camera.lookAt(this._lookAt);
  }

  /** Call when the match restarts or the player teleports. */
  reset() {
    this._first = true;
  }
}
