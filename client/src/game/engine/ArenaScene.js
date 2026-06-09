/**
 * ArenaScene — Three.js scene setup.
 *
 * Phase 4 additions:
 *   • Core markers — 3 golden rings with dark centre discs at CORE_POSITIONS.
 *     Visually distinct from the character spawn rings.
 */

import * as THREE from 'three';
import {
  SPAWN_POSITIONS,
  CHARACTER_COLORS,
  CORE_POSITIONS,
  CORE_RADIUS,
} from '@core-rivals/shared/constants/GameConstants';

const FLOOR_SIZE = 50;
const FLOOR_HALF = FLOOR_SIZE / 2;

export function buildArenaScene(scene, renderer) {
  // ── Renderer ──────────────────────────────────────────────────────────────
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type    = THREE.PCFSoftShadowMap;

  // ── Sky ───────────────────────────────────────────────────────────────────
  scene.background = new THREE.Color(0x090c10);
  scene.fog        = new THREE.FogExp2(0x090c10, 0.016);

  // ── Lights ────────────────────────────────────────────────────────────────
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));

  const sun = new THREE.DirectionalLight(0xfff5d0, 1.4);
  sun.position.set(20, 30, 15);
  sun.castShadow           = true;
  sun.shadow.mapSize.width = sun.shadow.mapSize.height = 2048;
  sun.shadow.camera.near   = 1;
  sun.shadow.camera.far    = 80;
  sun.shadow.camera.left   = sun.shadow.camera.bottom = -30;
  sun.shadow.camera.right  = sun.shadow.camera.top    =  30;
  sun.shadow.bias          = -0.001;
  scene.add(sun);

  const rimLight = new THREE.DirectionalLight(0x3050a0, 0.6);
  rimLight.position.set(-15, 10, -20);
  scene.add(rimLight);

  // ── Floor ─────────────────────────────────────────────────────────────────
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(FLOOR_SIZE, FLOOR_SIZE),
    new THREE.MeshLambertMaterial({ color: 0x1a2030 }),
  );
  floor.rotation.x    = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // ── Grid ──────────────────────────────────────────────────────────────────
  const grid = new THREE.GridHelper(FLOOR_SIZE, 25, 0x2a3550, 0x1e2a40);
  grid.position.y = 0.01;
  scene.add(grid);

  // ── Boundary pillars ──────────────────────────────────────────────────────
  const pillarMat = new THREE.MeshLambertMaterial({ color: 0xe8a020 });
  const pillarGeo = new THREE.BoxGeometry(0.3, 3.5, 0.3);
  for (const [x, z] of [
    [-FLOOR_HALF + 0.5,  FLOOR_HALF - 0.5],
    [ FLOOR_HALF - 0.5,  FLOOR_HALF - 0.5],
    [-FLOOR_HALF + 0.5, -FLOOR_HALF + 0.5],
    [ FLOOR_HALF - 0.5, -FLOOR_HALF + 0.5],
  ]) {
    const p = new THREE.Mesh(pillarGeo, pillarMat);
    p.position.set(x, 1.75, z);
    p.castShadow = true;
    scene.add(p);
  }

  // ── Spawn rings (character colours) ───────────────────────────────────────
  const charColors = Object.values(CHARACTER_COLORS);
  SPAWN_POSITIONS.forEach(({ x, z }, i) => {
    const mat  = new THREE.MeshLambertMaterial({ color: charColors[i] ?? 0x888888, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.25, 32), mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.02, z);
    scene.add(ring);

    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8),
      new THREE.MeshLambertMaterial({ color: charColors[i] ?? 0x888888 }),
    );
    post.position.set(x, 0.25, z);
    scene.add(post);
  });

  // ── Core markers (gold ring + dark hole) ──────────────────────────────────
  const holeMat = new THREE.MeshBasicMaterial({ color: 0x020508, side: THREE.DoubleSide });
  const rimMat  = new THREE.MeshBasicMaterial({ color: 0xffd700, side: THREE.DoubleSide });

  CORE_POSITIONS.forEach(({ x, z }) => {
    // Dark disc — the "hole"
    const hole = new THREE.Mesh(new THREE.CircleGeometry(CORE_RADIUS, 40), holeMat);
    hole.rotation.x = -Math.PI / 2;
    hole.position.set(x, 0.01, z);
    scene.add(hole);

    // Gold outer ring
    const rim = new THREE.Mesh(new THREE.RingGeometry(CORE_RADIUS, CORE_RADIUS + 0.22, 40), rimMat);
    rim.rotation.x = -Math.PI / 2;
    rim.position.set(x, 0.015, z);
    scene.add(rim);
  });
}
