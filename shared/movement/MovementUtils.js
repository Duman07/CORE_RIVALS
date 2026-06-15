/**
 * MovementUtils — pure movement mathematics shared between server and client.
 *
 * Using a pure function (no side effects) guarantees that client prediction
 * and server simulation always produce identical results given the same inputs,
 * which is a prerequisite for correct server reconciliation.
 *
 * Coordinate convention (Three.js Y-up, right-handed):
 *   • yaw = 0   → player faces −Z (into the scene, default camera forward)
 *   • yaw decreases when the mouse moves right (clockwise from above)
 *   • W (dz=+1) moves in the facing direction; S (dz=−1) moves backwards
 *   • D (dx=+1) strafes right;                 A (dx=−1) strafes left
 */

import {
  MOVE_SPEED,
  SPRINT_SPEED,
  ARENA_SIZE,
} from '../constants/GameConstants.js';

/**
 * Apply one movement step to a player state and return the new state.
 *
 * @param {{ x: number, y: number, z: number, yaw: number }} state
 * @param {{ dx: number, dz: number, sprint: boolean, yaw: number, dt: number }} input
 * @returns {{ x: number, y: number, z: number, yaw: number }}
 */
export function applyMovement(state, input) {
  const { dx, dz, sprint, yaw, dt } = input;
  const speedScale = input.speedScale ?? 1;   // per-character movilidad multiplier (default 1)

  // Cap delta-time to prevent tunnelling on lag spikes
  const safeDt = Math.min(dt, 0.05);

  const len = Math.hypot(dx, dz);
  if (len < 0.001) {
    // No directional input — only update facing direction
    return { ...state, yaw };
  }

  // Normalise input vector so diagonals aren't faster
  const ndx = dx / len;
  const ndz = dz / len;

  const speed = (sprint ? SPRINT_SPEED : MOVE_SPEED) * speedScale;

  // Rotate input from camera-local space to world space.
  // Forward (ndz=+1) moves toward (−sin yaw, 0, −cos yaw).
  // Right   (ndx=+1) moves toward ( cos yaw, 0, −sin yaw).
  const wx = -ndz * Math.sin(yaw) + ndx * Math.cos(yaw);
  const wz = -ndz * Math.cos(yaw) - ndx * Math.sin(yaw);

  return {
    ...state,
    x: Math.max(-ARENA_SIZE, Math.min(ARENA_SIZE, state.x + wx * speed * safeDt)),
    z: Math.max(-ARENA_SIZE, Math.min(ARENA_SIZE, state.z + wz * speed * safeDt)),
    yaw,
  };
}
