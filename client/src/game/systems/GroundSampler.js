/**
 * GroundSampler — Raycaster-based terrain probe.
 *
 * Casts a ray straight down onto the arena ground mesh to read the exact
 * ground height and surface normal under any (x, z). Used to:
 *   • keep characters walking on the relief (height + slope tilt),
 *   • drape/align objects to the uneven ground.
 *
 * The ground mesh is the same surface the server samples analytically
 * (terrainHeight), so client visuals and server physics agree.
 */

import * as THREE from 'three';

const DOWN = new THREE.Vector3(0, -1, 0);

export class GroundSampler {
  constructor() {
    this._ray    = new THREE.Raycaster();
    this._target = null;
    this._origin = new THREE.Vector3();
  }

  /** @param {THREE.Mesh} mesh — the ground mesh to raycast against. */
  setTarget(mesh) { this._target = mesh; }

  /**
   * Probe the ground under (x, z).
   * @returns {{ y:number, nx:number, ny:number, nz:number } | null}
   */
  sample(x, z) {
    if (!this._target) return null;
    this._origin.set(x, 100, z);
    this._ray.set(this._origin, DOWN);
    const hits = this._ray.intersectObject(this._target, false);
    if (hits.length === 0) return null;

    const hit = hits[0];
    let nx = 0, ny = 1, nz = 0;
    if (hit.face) {
      const n = hit.face.normal.clone().transformDirection(this._target.matrixWorld);
      nx = n.x; ny = n.y; nz = n.z;
    }
    return { y: hit.point.y, nx, ny, nz };
  }
}
