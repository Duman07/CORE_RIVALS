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
  SWING_LAUNCH_ANGLE,
} from '../constants/GameConstants.js';

/**
 * Compute the impulse vector to apply to the ball on a swing.
 *
 * Realistic golf model: the total impulse magnitude (power × max × character
 * strength) is launched at a fixed loft angle, so the ball lifts into an arc
 * (vertical = M·sin θ) and travels forward (horizontal = M·cos θ), then lands
 * and rolls. Soft shots stay low and short; full shots fly high and far.
 *
 * @param {number} power      — pre-clamped to [0,1] by caller; clamped here too as safety net
 * @param {number} yaw        — player facing angle in radians
 * @param {{ swingPower?: number }} [charStats]  — character stat multiplier
 * @returns {{ fx: number, fy: number, fz: number }}
 */
export function computeSwingForce(power, yaw, charStats) {
  const p     = Math.max(0, Math.min(1, power));
  const M     = p * SWING_MAX_IMPULSE * (charStats?.swingPower ?? 1);
  const horiz = M * Math.cos(SWING_LAUNCH_ANGLE);
  const vert  = M * Math.sin(SWING_LAUNCH_ANGLE);
  return {
    fx: -Math.sin(yaw) * horiz,
    fy:  vert,
    fz: -Math.cos(yaw) * horiz,
  };
}
