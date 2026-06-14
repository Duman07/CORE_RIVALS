/**
 * SwingUtils — pure golf swing helpers.
 *
 * No Three.js or Rapier imports — safe on server AND client.
 *
 * Coordinate convention (Three.js / Rapier right-hand):
 *   yaw = 0  → player faces -Z (forward)
 *   +X = right,  +Y = up,  +Z = toward viewer
 *   sin(yaw) = X-component,  cos(yaw) = Z-component
 */

import {
  SWING_MAX_IMPULSE,
  SWING_LOFT_FACTOR,
} from '../constants/GameConstants.js';

/**
 * Compute the impulse vector to apply to the ball on a swing.
 *
 * @param {number} power      — pre-clamped to [0,1] by caller; clamped here too as safety net
 * @param {number} yaw        — player facing angle in radians
 * @param {{ swingPower?: number }} [charStats]  — character stat multiplier
 * @returns {{ fx: number, fy: number, fz: number }}
 */
export function computeSwingForce(power, yaw, charStats) {
  const p     = Math.max(0, Math.min(1, power));
  const scale = p * SWING_MAX_IMPULSE * (charStats?.swingPower ?? 1);
  return {
    fx: -Math.sin(yaw) * scale,
    fy:  p * SWING_LOFT_FACTOR,
    fz: -Math.cos(yaw) * scale,
  };
}
