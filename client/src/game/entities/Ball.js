/**
 * Ball — client-side visual entity for the game sphere.
 *
 * Receives server snapshots (x,y,z,vx,vy,vz) via addState() and interpolates
 * between them with a fixed 50ms delay — less than players because the ball
 * has no human input latency to compensate for.
 *
 * No client-side physics simulation. Position is purely server-driven.
 */

import * as THREE from 'three';

const INTERPOLATION_DELAY = 50;   // ms
const MAX_BUFFER_SIZE     = 20;

export class Ball {
  /** @param {THREE.Scene} scene */
  constructor(scene) {
    this._buffer = [];

    const geo = new THREE.SphereGeometry(0.25, 20, 20);
    const mat = new THREE.MeshStandardMaterial({
      color:             0xf0ede0,
      emissive:          0x99aaff,
      emissiveIntensity: 0.12,
      roughness:         0.5,
      metalness:         0.1,
    });
    this._mesh             = new THREE.Mesh(geo, mat);
    this._mesh.castShadow  = true;
    this._mesh.position.set(0, 0.25, 0);
    scene.add(this._mesh);
  }

  /** @param {{ x:number, y:number, z:number, vx:number, vy:number, vz:number }} state */
  addState(state) {
    this._buffer.push({ time: Date.now(), x: state.x, y: state.y, z: state.z });
    if (this._buffer.length > MAX_BUFFER_SIZE) this._buffer.shift();
  }

  /** Called every frame from GameEngine render loop. */
  update() {
    if (this._buffer.length < 2) return;

    const renderTime = Date.now() - INTERPOLATION_DELAY;
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
      const last = this._buffer.at(-1);
      this._mesh.position.set(last.x, last.y, last.z);
      return;
    }

    const span = newer.time - older.time;
    const t    = span > 0 ? (renderTime - older.time) / span : 0;
    this._mesh.position.set(
      older.x + (newer.x - older.x) * t,
      older.y + (newer.y - older.y) * t,
      older.z + (newer.z - older.z) * t,
    );

    while (this._buffer.length > 2 && this._buffer[1].time < renderTime) {
      this._buffer.shift();
    }
  }

  dispose() {
    this._mesh.parent?.remove(this._mesh);
    this._mesh.geometry.dispose();
    this._mesh.material.dispose();
  }
}
