/**
 * ArenaScene — Three.js scene setup.
 *
 * Terreno "CORE RIVALS" — campo de golf triangular 1v1v1 (simetria rotacional 120 grados).
 * El relieve del suelo proviene de la funcion COMPARTIDA terrainHeight(x,z), la misma
 * que usa el servidor para su heightfield de Rapier: lo visual y lo fisico coinciden.
 *
 * Zonas (vista superior):
 *   - Arena central abierta alrededor del spawn de la esfera.
 *   - 3 carriles (fairways) de metal hacia cada Core.
 *   - Banda de arena (bunker) frente a cada Core.
 *   - Chevron de piedra en "V" + deflectores -> rebotes / evita tiro recto.
 *   - Columnas centrales de piedra -> cobertura junto a la esfera.
 */

import * as THREE from './_three_stub.mjs';
import {
  SPAWN_POSITIONS,
  CHARACTER_COLORS,
  CORE_POSITIONS,
  CORE_RADIUS,
  CLUB_SPAWN_POSITIONS,
  BALL_SPAWN,
  WALL_HALF,
  WALL_HEIGHT,
} from './shared/constants/GameConstants.js';
import {
  terrainHeight,
  terrainNormal,
  TERRAIN_SIZE,
  TERRAIN_SEGMENTS,
} from './shared/terrain/TerrainUtils.js';
import { getObstacles, SURFACES } from './shared/arena/ArenaLayout.js';

// Paleta del terreno
const COLOR = {
  grass:      0x4f7a3a,
  grassLight: 0x5f8f47,
  sand:       0xd8bd7a,
  metal:      0x8b94a0,
  stone:      0x8a7d6c,
  stoneLight: 0x9c8f7c,
  void:       0x0a0d12,
  tee:        0xf0e3c0,
};

// Helpers
function makeBox(w, h, d, color, opts) {
  const o = opts || {};
  const metalness = o.metalness || 0;
  const roughness = o.roughness != null ? o.roughness : 0.9;
  const mat = metalness > 0
    ? new THREE.MeshStandardMaterial({ color, metalness, roughness })
    : new THREE.MeshLambertMaterial({ color });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// Coloca un prop de sector: coordenadas locales (lx,lz) con +Z apuntando del centro
// hacia el Core, apoyado sobre el relieve del terreno.
function placeOnSpoke(scene, mesh, corePos, lx, lz, localYaw, yOffset) {
  const theta = Math.atan2(corePos.x, corePos.z);
  const wx = lx * Math.cos(theta) + lz * Math.sin(theta);
  const wz = -lx * Math.sin(theta) + lz * Math.cos(theta);
  mesh.position.set(wx, terrainHeight(wx, wz) + (yOffset || 0), wz);
  mesh.rotation.y = theta + (localYaw || 0);
  scene.add(mesh);
}

// Placa CONFORMADA al relieve: malla subdividida cuyos vértices siguen
// terrainHeight (la placa de hierro se pega al piso y se adapta al desnivel).
function makeConformingPlate(scene, corePos, lx, lz, w, len, color, opts, yOffset) {
  const o = opts || {};
  const theta = Math.atan2(corePos.x, corePos.z);
  const cos = Math.cos(theta), sin = Math.sin(theta);
  const cwx = lx * cos + lz * sin;
  const cwz = -lx * sin + lz * cos;

  const geo = new THREE.PlaneGeometry(w, len, Math.max(2, Math.round(w)), Math.max(2, Math.round(len)));
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vz = pos.getZ(i);
    const wx = cwx + (vx * cos + vz * sin);
    const wz = cwz + (-vx * sin + vz * cos);
    pos.setY(i, terrainHeight(wx, wz) + (yOffset || 0));
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();

  const mat = o.metalness > 0
    ? new THREE.MeshStandardMaterial({ color, metalness: o.metalness, roughness: o.roughness != null ? o.roughness : 0.5 })
    : new THREE.MeshLambertMaterial({ color });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(cwx, 0, cwz);
  mesh.rotation.y = theta;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

// Lay a flat decal (ring/disc) flush on the slope: tilt its face to the terrain
// normal so it doesn't clip half-buried on uneven ground.
const _UP = new THREE.Vector3(0, 1, 0);
function layFlatOnTerrain(mesh, x, z, yOffset) {
  const n = terrainNormal(x, z);
  const qBase = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  const qTilt = new THREE.Quaternion().setFromUnitVectors(_UP, new THREE.Vector3(n.x, n.y, n.z));
  mesh.quaternion.copy(qTilt).multiply(qBase);
  mesh.position.set(x, terrainHeight(x, z) + (yOffset || 0), z);
}

export function buildArenaScene(scene, renderer) {
  // Renderer
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type    = THREE.PCFSoftShadowMap;

  // Cielo
  scene.background = new THREE.Color(0x0b1016);
  scene.fog        = new THREE.FogExp2(0x0b1016, 0.0075);

  // Luces
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));

  const sun = new THREE.DirectionalLight(0xfff5d0, 1.35);
  sun.position.set(28, 46, 22);
  sun.castShadow           = true;
  sun.shadow.mapSize.width = sun.shadow.mapSize.height = 2048;
  sun.shadow.camera.near   = 1;
  sun.shadow.camera.far    = 140;
  sun.shadow.camera.left   = sun.shadow.camera.bottom = -46;
  sun.shadow.camera.right  = sun.shadow.camera.top    =  46;
  sun.shadow.bias          = -0.001;
  scene.add(sun);

  const rimLight = new THREE.DirectionalLight(0x3050a0, 0.5);
  rimLight.position.set(-20, 14, -26);
  scene.add(rimLight);

  // Cesped ondulado (campo de golf). Misma funcion de relieve que el servidor.
  const grassGeo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
  grassGeo.rotateX(-Math.PI / 2);
  const gpos = grassGeo.attributes.position;
  for (let i = 0; i < gpos.count; i++) {
    const x = gpos.getX(i);
    const z = gpos.getZ(i);
    gpos.setY(i, terrainHeight(x, z));
  }
  gpos.needsUpdate = true;
  grassGeo.computeVertexNormals();
  const grass = new THREE.Mesh(grassGeo, new THREE.MeshLambertMaterial({ color: COLOR.grass }));
  grass.receiveShadow = true;
  scene.add(grass);

  // Anillo de la arena central (marca la zona abierta sin tapar el relieve).
  const arenaRing = new THREE.Mesh(
    new THREE.RingGeometry(6.6, 7.0, 56),
    new THREE.MeshBasicMaterial({ color: 0xcfe0b0, transparent: true, opacity: 0.45, side: THREE.DoubleSide }),
  );
  layFlatOnTerrain(arenaRing, BALL_SPAWN.x, BALL_SPAWN.z, 0.06);
  scene.add(arenaRing);

  // Superficies por Core (coinciden EXACTAMENTE con las zonas de surfaceAt).
  const M = SURFACES.METAL, SA = SURFACES.SAND;
  const mCenter = (M.zMin + M.zMax) / 2,  mLen = M.zMax - M.zMin,  mW = M.halfX * 2;
  const sCenter = (SA.zMin + SA.zMax) / 2, sLen = SA.zMax - SA.zMin, sW = SA.halfX * 2;
  CORE_POSITIONS.forEach((corePos) => {
    // Fairway de metal conformado (la pelota rueda más rápido y lejos).
    makeConformingPlate(scene, corePos, 0, mCenter, mW, mLen, COLOR.metal, { metalness: 0.55, roughness: 0.45 }, 0.05);
    // Bunker de arena conformado (la pelota se frena).
    makeConformingPlate(scene, corePos, 0, sCenter, sW, sLen, COLOR.sand, null, 0.04);
  });

  // Obstáculos sólidos (mismos que el servidor: muros funnel + columnas).
  const wallMat   = new THREE.MeshLambertMaterial({ color: COLOR.stone });
  const columnMat = new THREE.MeshLambertMaterial({ color: COLOR.stoneLight });
  for (const o of getObstacles()) {
    if (o.kind === 'wall') {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(o.hw * 2, o.hh * 2, o.hd * 2), wallMat);
      mesh.position.set(o.x, o.cy, o.z);
      mesh.rotation.y = o.yaw;
      mesh.castShadow = mesh.receiveShadow = true;
      scene.add(mesh);
    } else {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(o.radius, o.radius * 1.1, o.hh * 2, 16), columnMat);
      mesh.position.set(o.x, o.cy, o.z);
      mesh.castShadow = mesh.receiveShadow = true;
      scene.add(mesh);
    }
  }

  const charColors = Object.values(CHARACTER_COLORS);

  // Pilares de identidad detras de cada Core.
  const PILLAR_H = 6;
  const pillarGeo = new THREE.BoxGeometry(0.5, PILLAR_H, 0.5);
  CORE_POSITIONS.forEach((c, i) => {
    const len = Math.hypot(c.x, c.z) || 1;
    const px = (c.x / len) * (len + 1.6);
    const pz = (c.z / len) * (len + 1.6);
    const pillar = new THREE.Mesh(pillarGeo, new THREE.MeshLambertMaterial({ color: charColors[i] != null ? charColors[i] : 0xe8a020 }));
    // Base buried 1.2 m below ground so it never floats on the relief.
    pillar.position.set(px, terrainHeight(px, pz) - 1.2 + PILLAR_H / 2, pz);
    pillar.castShadow = true;
    scene.add(pillar);
  });

  // Anillos de spawn (colores de personaje).
  SPAWN_POSITIONS.forEach(({ x, z }, i) => {
    const col = charColors[i] != null ? charColors[i] : 0x888888;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1.25, 32),
      new THREE.MeshLambertMaterial({ color: col, side: THREE.DoubleSide }),
    );
    layFlatOnTerrain(ring, x, z, 0.05);
    scene.add(ring);

    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.7, 8),
      new THREE.MeshLambertMaterial({ color: col }),
    );
    post.position.set(x, terrainHeight(x, z) + 0.25, z);
    scene.add(post);
  });

  // Tees: marcadores de aparicion de los palos de golf.
  CLUB_SPAWN_POSITIONS.forEach(({ x, z }) => {
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(0.7, 24),
      new THREE.MeshLambertMaterial({ color: COLOR.tee, side: THREE.DoubleSide }),
    );
    layFlatOnTerrain(disc, x, z, 0.04);
    disc.receiveShadow = true;
    scene.add(disc);
  });

  // Marcadores de Core (anillo dorado + hueco oscuro + halo de identidad).
  const holeMat = new THREE.MeshBasicMaterial({ color: 0x020508, side: THREE.DoubleSide });
  const rimMat  = new THREE.MeshBasicMaterial({ color: 0xffd700, side: THREE.DoubleSide });

  CORE_POSITIONS.forEach(({ x, z }, i) => {
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(CORE_RADIUS + 0.22, CORE_RADIUS + 0.8, 44),
      new THREE.MeshBasicMaterial({
        color: charColors[i] != null ? charColors[i] : 0xffffff, transparent: true, opacity: 0.55, side: THREE.DoubleSide,
      }),
    );
    layFlatOnTerrain(halo, x, z, 0.03);
    scene.add(halo);

    const hole = new THREE.Mesh(new THREE.CircleGeometry(CORE_RADIUS, 44), holeMat);
    layFlatOnTerrain(hole, x, z, 0.04);
    scene.add(hole);

    const rim = new THREE.Mesh(new THREE.RingGeometry(CORE_RADIUS, CORE_RADIUS + 0.22, 44), rimMat);
    layFlatOnTerrain(rim, x, z, 0.05);
    scene.add(rim);
  });

  // Capa traslúcida perimetral ("vidrio") contra la que rebota la pelota.
  // Coincide con los muros físicos del servidor (±WALL_HALF, alto WALL_HEIGHT).
  const H   = WALL_HALF;
  const cy  = WALL_HEIGHT / 2 - 1;
  const len = 2 * WALL_HALF + 4;
  const glassMat = new THREE.MeshBasicMaterial({
    color: 0x8ec5ff, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false,
  });
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0.55 });
  const panels = [
    { x: 0,  z:  H, ry: 0 },
    { x: 0,  z: -H, ry: 0 },
    { x: H,  z:  0, ry: Math.PI / 2 },
    { x: -H, z:  0, ry: Math.PI / 2 },
  ];
  for (const p of panels) {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(len, WALL_HEIGHT), glassMat);
    panel.position.set(p.x, cy, p.z);
    panel.rotation.y = p.ry;
    scene.add(panel);

    // Borde superior luminoso para leer el límite.
    const edge = new THREE.Mesh(new THREE.BoxGeometry(len, 0.12, 0.12), edgeMat);
    edge.position.set(p.x, cy + WALL_HEIGHT / 2, p.z);
    edge.rotation.y = p.ry;
    scene.add(edge);
  }

  // Devuelve la malla del suelo para el GroundSampler (raycaster de personajes).
  return { ground: grass };
}
