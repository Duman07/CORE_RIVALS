/**
 * ArenaLayout — single source of truth for obstacles and ground surfaces.
 *
 * Shared by the client (visual meshes) and the server (physics colliders +
 * ball surface friction) so what you see is exactly what collides.
 *
 * Per Core (symmetric, 120°): a metal fairway lane and a sand bunker in front
 * of the Core, plus two angled "bumper" walls that form a funnel (bank shots).
 * Plus three central stone columns for cover near the sphere.
 *
 * Surfaces affect the ball's roll:
 *   grass → standard | metal → rolls far/fast | sand → slows down
 */

import { CORE_POSITIONS } from '../constants/GameConstants.js';
import { terrainHeight } from '../terrain/TerrainUtils.js';

// Surface footprints in each Core's local frame (+Z points centre→Core).
const METAL = { halfX: 2,  zMin: 6,  zMax: 22 };   // fairway lane
const SAND  = { halfX: 5,  zMin: 22, zMax: 26 };   // bunker in front of the Core

// Per-surface ball linear damping (higher = stops sooner).
export const SURFACE_DAMPING = Object.freeze({
  grass: 0.55,
  metal: 0.20,
  sand:  3.00,
});

function spokeAngle(core) { return Math.atan2(core.x, core.z); }

// local (lx,lz) → world (x,z)   [+Z local points toward the Core]
function toWorld(theta, lx, lz) {
  return {
    x:  lx * Math.cos(theta) + lz * Math.sin(theta),
    z: -lx * Math.sin(theta) + lz * Math.cos(theta),
  };
}

// Lowest/highest terrain under a footprint, so a rigid prop can be anchored with
// its base buried below the ground and its top a fixed height above it.
function terrainRange(cx, cz, yaw, halfLen, halfDepth) {
  let tmin = Infinity, tmax = -Infinity;
  const cos = Math.cos(yaw), sin = Math.sin(yaw);
  for (let u = -1; u <= 1; u++) {
    for (let v = -1; v <= 1; v++) {
      const lx = u * halfLen, lz = v * halfDepth;
      const wx = cx + lx * cos + lz * sin;
      const wz = cz - lx * sin + lz * cos;
      const h = terrainHeight(wx, wz);
      if (h < tmin) tmin = h;
      if (h > tmax) tmax = h;
    }
  }
  return { tmin, tmax };
}

// Anchor a prop: base buried `skirt` below the lowest ground, top `visibleH`
// above the highest ground under the footprint. Returns resolved { cy, hh }.
function anchor(cx, cz, yaw, halfLen, halfDepth, visibleH, skirt) {
  const { tmin, tmax } = terrainRange(cx, cz, yaw, halfLen, halfDepth);
  const bottom = tmin - skirt;
  const top    = tmax + visibleH;
  return { cy: (top + bottom) / 2, hh: (top - bottom) / 2 };
}

/**
 * All solid obstacles (physical + visual), already anchored to the relief.
 *  wall:   { kind:'wall', x, z, yaw, hw, hd, hh, cy }   (half-extents + resolved Y)
 *  column: { kind:'column', x, z, radius, hh, cy }
 */
export function getObstacles() {
  const obs = [];
  for (const core of CORE_POSITIONS) {
    const th = spokeAngle(core);
    for (const b of [{ lx: -4.5, lz: 25, yaw: 0.6 }, { lx: 4.5, lz: 25, yaw: -0.6 }]) {
      const w   = toWorld(th, b.lx, b.lz);
      const yaw = th + b.yaw;
      const hw = 3, hd = 0.35;
      const { cy, hh } = anchor(w.x, w.z, yaw, hw, hd, 1.2, 0.5);
      obs.push({ kind: 'wall', x: w.x, z: w.z, yaw, hw, hd, hh, cy });
    }
  }
  for (const a of [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3]) {
    const x = Math.sin(a) * 7, z = Math.cos(a) * 7, radius = 0.5;
    const { cy, hh } = anchor(x, z, 0, radius, radius, 1.4, 0.5);
    obs.push({ kind: 'column', x, z, radius, hh, cy });
  }
  return obs;
}

/** Surface type under a world point: 'grass' | 'metal' | 'sand'. */
export function surfaceAt(x, z) {
  for (const core of CORE_POSITIONS) {
    const th  = spokeAngle(core);
    const cos = Math.cos(th), sin = Math.sin(th);
    const lx  = x * cos - z * sin;
    const lz  = x * sin + z * cos;
    if (Math.abs(lx) <= SAND.halfX  && lz >= SAND.zMin  && lz <= SAND.zMax)  return 'sand';
    if (Math.abs(lx) <= METAL.halfX && lz >= METAL.zMin && lz <= METAL.zMax) return 'metal';
  }
  return 'grass';
}

// Surface footprints (for the client to draw conforming plates).
export const SURFACES = { METAL, SAND };
