/**
 * TerrainUtils — single source of truth for the arena's ground relief.
 *
 * `terrainHeight(x, z)` is a PURE deterministic function shared by:
 *   • the client  → displaces the grass mesh and places every prop on the ground
 *   • the server  → builds a Rapier heightfield collider (ball rolls on slopes)
 *                    and keeps each player's feet on the surface.
 *
 * Because both sides sample the exact same function, the visual terrain and the
 * physical terrain always agree. Keep the relief GENTLE (rolling, like a golf
 * course) so no slope creates an unfair structural advantage.
 */

// Heightfield discretisation (shared so server collider and any client use match).
export const TERRAIN_SIZE     = 88;   // metres — square extent centred on origin
export const TERRAIN_SEGMENTS = 96;   // grid cells per side

/**
 * Smooth rolling height in metres at world (x, z). Amplitude ~ ±1 m.
 * @param {number} x
 * @param {number} z
 * @returns {number}
 */
export function terrainHeight(x, z) {
  return (
    0.45 * Math.sin(x * 0.16) * Math.cos(z * 0.13) +
    0.30 * Math.sin((x + z) * 0.085 + 0.6) +
    0.22 * Math.cos(x * 0.06 - z * 0.09)
  );
}
