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

import * as THREE from 'three';
import {
  SPAWN_POSITIONS,
  CHARACTER_COLORS,
  CORE_POSITIONS,
  CORE_RADIUS,
  CLUB_SPAWN_POSITIONS,
  BALL_SPAWN,
} from '@core-rivals/shared/constants/GameConstants';
import {
  terrainHeight,
  TERRAIN_SIZE,
  TERRAIN_SEGMENTS,
} from '@core-rivals/shared/terrain/TerrainUtils';

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
  arenaRing.rotation.x = -Math.PI / 2;
  arenaRing.position.set(BALL_SPAWN.x, terrainHeight(BALL_SPAWN.x, BALL_SPAWN.z) + 0.06, BALL_SPAWN.z);
  scene.add(arenaRing);

  // Elementos por sector (fairway, bunker, chevron, deflectores) por cada Core.
  CORE_POSITIONS.forEach((corePos) => {
    // Carril / fairway de metal CONFORMADO al relieve (se pega y adapta al desnivel).
    makeConformingPlate(scene, corePos, 0, 13, 4, 18, COLOR.metal, { metalness: 0.55, roughness: 0.45 }, 0.05);

    // Banda de arena frente al Core CONFORMADA (frena la esfera).
    makeConformingPlate(scene, corePos, 0, 24, 11, 3, COLOR.sand, null, 0.04);

    // Chevron de piedra en "V" (apex hacia el centro): desvia el tiro recto.
    const wingL = makeBox(4, 0.9, 0.6, COLOR.stone);
    placeOnSpoke(scene, wingL, corePos, -1.9, 26.4, 0.5, 0.45);
    const wingR = makeBox(4, 0.9, 0.6, COLOR.stone);
    placeOnSpoke(scene, wingR, corePos, 1.9, 26.4, -0.5, 0.45);

    // Deflectores angulados a los flancos del Core (bank shots).
    const defL = makeBox(3.4, 0.75, 0.55, COLOR.stoneLight);
    placeOnSpoke(scene, defL, corePos, -4.6, 28, -0.55, 0.38);
    const defR = makeBox(3.4, 0.75, 0.55, COLOR.stoneLight);
    placeOnSpoke(scene, defR, corePos, 4.6, 28, 0.55, 0.38);
  });

  // Columnas de cobertura central (piedra), en los huecos entre carriles.
  const colMat = new THREE.MeshLambertMaterial({ color: COLOR.stoneLight });
  const colGeo = new THREE.CylinderGeometry(0.5, 0.55, 1.6, 16);
  for (const ang of [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3]) {
    const cx = Math.sin(ang) * 7;
    const cz = Math.cos(ang) * 7;
    const col = new THREE.Mesh(colGeo, colMat);
    col.position.set(cx, terrainHeight(cx, cz) + 0.8, cz);
    col.castShadow = col.receiveShadow = true;
    scene.add(col);
  }

  const charColors = Object.values(CHARACTER_COLORS);

  // Pilares de identidad detras de cada Core.
  const pillarGeo = new THREE.BoxGeometry(0.5, 5, 0.5);
  CORE_POSITIONS.forEach((c, i) => {
    const len = Math.hypot(c.x, c.z) || 1;
    const px = (c.x / len) * (len + 1.6);
    const pz = (c.z / len) * (len + 1.6);
    const pillar = new THREE.Mesh(pillarGeo, new THREE.MeshLambertMaterial({ color: charColors[i] != null ? charColors[i] : 0xe8a020 }));
    pillar.position.set(px, terrainHeight(px, pz) + 2.5, pz);
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
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, terrainHeight(x, z) + 0.05, z);
    scene.add(ring);

    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8),
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
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(x, terrainHeight(x, z) + 0.04, z);
    disc.receiveShadow = true;
    scene.add(disc);
  });

  // Marcadores de Core (anillo dorado + hueco oscuro + halo de identidad).
  const holeMat = new THREE.MeshBasicMaterial({ color: 0x020508, side: THREE.DoubleSide });
  const rimMat  = new THREE.MeshBasicMaterial({ color: 0xffd700, side: THREE.DoubleSide });

  CORE_POSITIONS.forEach(({ x, z }, i) => {
    const baseY = terrainHeight(x, z);
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(CORE_RADIUS + 0.22, CORE_RADIUS + 0.8, 44),
      new THREE.MeshBasicMaterial({
        color: charColors[i] != null ? charColors[i] : 0xffffff, transparent: true, opacity: 0.55, side: THREE.DoubleSide,
      }),
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.set(x, baseY + 0.03, z);
    scene.add(halo);

    const hole = new THREE.Mesh(new THREE.CircleGeometry(CORE_RADIUS, 44), holeMat);
    hole.rotation.x = -Math.PI / 2;
    hole.position.set(x, baseY + 0.04, z);
    scene.add(hole);

    const rim = new THREE.Mesh(new THREE.RingGeometry(CORE_RADIUS, CORE_RADIUS + 0.22, 44), rimMat);
    rim.rotation.x = -Math.PI / 2;
    rim.position.set(x, baseY + 0.05, z);
    scene.add(rim);
  });

  // Devuelve la malla del suelo para el GroundSampler (raycaster de personajes).
  return { ground: grass };
}
