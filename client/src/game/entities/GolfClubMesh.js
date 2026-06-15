/**
 * GolfClubMesh — Three.js visual for a golf club WorldItem.
 *
 * Two display modes:
 *   Ground  — club lying on the arena floor at its world position.
 *   Held    — club held upright at the owning player's side.
 *
 * GameEngine calls setGroundPose() / setHeldPose() / hide() each frame
 * based on the item snapshot received from the server.
 */

import * as THREE from 'three';

const SHAFT_RADIUS = 0.025;
const SHAFT_LENGTH = 1.0;
const HEAD_W       = 0.14;
const HEAD_H       = 0.10;
const HEAD_D       = 0.20;

export class GolfClubMesh {
  /**
   * @param {THREE.Scene} scene
   */
  constructor(scene) {
    this._scene = scene;
    this._group = new THREE.Group();
    this._build();
    scene.add(this._group);
    this._group.visible = false;
  }

  // ─── Pose setters ────────────────────────────────────────────────────────────

  /** The underlying Object3D (so it can be parented to a hand bone). */
  get object3D() { return this._group; }

  /** Club lying on the ground at world coordinates (y = terrain height). */
  setGroundPose(x, y, z) {
    this._group.visible = true;
    this._group.scale.setScalar(1);
    this._group.position.set(x, (y ?? 0) + 0.12, z);
    this._group.rotation.set(Math.PI * 0.45, 0.4, 0);
  }

  /**
   * Club held upright at the player's right side.
   * @param {number} px @param {number} py @param {number} pz — player world position
   * @param {number} yaw — player yaw (radians)
   */
  setHeldPose(px, py, pz, yaw) {
    this._group.visible = true;
    // Offset to the right of the player's facing direction
    const rx = Math.cos(yaw) * 0.45;
    const rz = -Math.sin(yaw) * 0.45;
    this._group.position.set(px + rx, py + 0.15, pz + rz);
    this._group.rotation.set(0, yaw, Math.PI / 10);
  }

  hide() {
    this._group.visible = false;
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  dispose() {
    this._group.traverse((obj) => {
      if (obj.isMesh) {
        obj.geometry.dispose();
        obj.material.dispose();
      }
    });
    this._scene.remove(this._group);
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  _build() {
    // Shaft — metallic cylinder
    const shaftGeo = new THREE.CylinderGeometry(SHAFT_RADIUS, SHAFT_RADIUS, SHAFT_LENGTH, 8);
    const shaftMat = new THREE.MeshStandardMaterial({ color: 0xd0d0d0, metalness: 0.8, roughness: 0.2 });
    const shaft    = new THREE.Mesh(shaftGeo, shaftMat);
    shaft.position.y   = SHAFT_LENGTH / 2 + HEAD_H / 2;
    shaft.castShadow   = true;
    this._group.add(shaft);

    // Head — dark iron box at the base
    const headGeo = new THREE.BoxGeometry(HEAD_W, HEAD_H, HEAD_D);
    const headMat = new THREE.MeshStandardMaterial({ color: 0x555566, metalness: 0.9, roughness: 0.3 });
    const head    = new THREE.Mesh(headGeo, headMat);
    head.position.y  = 0;
    head.castShadow  = true;
    this._group.add(head);

    // Grip — darker band at the top of the shaft
    const gripGeo = new THREE.CylinderGeometry(SHAFT_RADIUS * 1.6, SHAFT_RADIUS * 1.6, 0.18, 8);
    const gripMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
    const grip    = new THREE.Mesh(gripGeo, gripMat);
    grip.position.y = SHAFT_LENGTH + HEAD_H / 2 - 0.09;
    this._group.add(grip);
  }
}
